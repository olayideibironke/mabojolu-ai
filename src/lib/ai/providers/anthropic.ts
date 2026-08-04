import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { chatError } from "../errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
} from "../provider";

/**
 * Anthropic adapter.
 *
 * Notes on the request shape, which differs from older Claude API guidance:
 *  - Thinking is on by default on Claude Opus 5, and `max_tokens` caps thinking
 *    plus visible text together, so the budget must leave room for both.
 *  - `temperature`, `top_p`, `top_k`, and `budget_tokens` are rejected on
 *    current models. Behavior is steered by the system prompt instead.
 *  - A safety refusal is a successful HTTP 200 carrying
 *    `stop_reason: "refusal"`, so it is handled as an outcome, not an exception.
 *  - Raw reasoning is never surfaced. `display` is left at its default so
 *    thinking text is omitted, and only a progress label reaches the client.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";

  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private client: Anthropic | null = null;

  constructor(options: { apiKey: string | undefined; timeoutMs: number }) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): Anthropic {
    if (!this.apiKey) {
      throw chatError("provider_not_configured");
    }

    // The SDK client is cheap but not free; reuse it across requests so
    // connection pooling actually applies.
    this.client ??= new Anthropic({
      apiKey: this.apiKey,
      // The SDK's own retries are disabled: a retry after a partial stream
      // would bill a second generation. Retry policy is the caller's decision.
      maxRetries: 0,
      timeout: this.timeoutMs,
    });

    return this.client;
  }

  async *stream(request: GenerationRequest): AsyncIterable<GenerationChunk> {
    const client = this.getClient();

    let stream: Awaited<ReturnType<typeof client.messages.stream>>;
    try {
      stream = client.messages.stream(
        {
          model: request.model.providerModelId,
          max_tokens: Math.min(
            request.maxOutputTokens,
            request.model.maxOutputTokens,
          ),
          system: request.systemPrompt,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        },
        {
          signal: request.signal,
          ...(request.idempotencyKey
            ? { idempotencyKey: request.idempotencyKey }
            : {}),
        },
      );
    } catch (cause) {
      throw translateError(cause);
    }

    let sawText = false;
    let announcedThinking = false;

    try {
      for await (const event of stream) {
        if (request.signal.aborted) {
          break;
        }

        if (event.type === "content_block_start") {
          // Signal that reasoning is underway without exposing its content.
          if (event.content_block.type === "thinking" && !announcedThinking) {
            announcedThinking = true;
            yield { type: "progress", label: "Thinking" };
          }
          continue;
        }

        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          sawText = true;
          yield { type: "text", text: event.delta.text };
        }
      }

      // An aborted stream has no meaningful final message to await.
      if (request.signal.aborted) {
        yield { type: "finish", finishReason: "aborted" };
        return;
      }

      const message = await stream.finalMessage();

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        ...(message.usage.cache_read_input_tokens
          ? { cacheReadTokens: message.usage.cache_read_input_tokens }
          : {}),
        ...(message.usage.cache_creation_input_tokens
          ? { cacheWriteTokens: message.usage.cache_creation_input_tokens }
          : {}),
      };

      // A refusal arrives as a successful response. If nothing was streamed,
      // report it so the UI can explain rather than showing an empty answer.
      if (message.stop_reason === "refusal" && !sawText) {
        yield { type: "finish", finishReason: "refusal", usage };
        return;
      }

      yield {
        type: "finish",
        finishReason:
          message.stop_reason === "max_tokens" ? "max_tokens" : "end_turn",
        usage,
      };
    } catch (cause) {
      // Abort during iteration is expected when the user presses stop.
      if (request.signal.aborted) {
        yield { type: "finish", finishReason: "aborted" };
        return;
      }
      throw translateError(cause);
    }
  }
}

/**
 * Map SDK exceptions onto our error codes.
 *
 * Uses the SDK's typed error classes rather than string matching, and never
 * forwards the provider's own message to the user.
 */
function translateError(cause: unknown): ReturnType<typeof chatError> {
  if (cause instanceof Anthropic.APIUserAbortError) {
    return chatError("aborted", { cause });
  }

  if (cause instanceof Anthropic.AuthenticationError) {
    return chatError("provider_not_configured", {
      message:
        "The AI provider credential was rejected. Check the configured API key.",
      cause,
    });
  }

  if (cause instanceof Anthropic.PermissionDeniedError) {
    return chatError("provider_not_configured", {
      message:
        "The configured credential does not have access to the selected model.",
      cause,
    });
  }

  if (cause instanceof Anthropic.RateLimitError) {
    const header = cause.headers?.get?.("retry-after");
    const parsed = header ? Number.parseInt(header, 10) : Number.NaN;

    return chatError("rate_limited", {
      message:
        "The AI service is busy right now. Please wait a moment and try again.",
      retryAfterSeconds: Number.isFinite(parsed) ? parsed : undefined,
      cause,
    });
  }

  if (cause instanceof Anthropic.BadRequestError) {
    // Usually an oversized conversation for the selected model.
    return chatError("context_too_large", { cause });
  }

  if (cause instanceof Anthropic.NotFoundError) {
    return chatError("provider_unavailable", {
      message:
        "The selected model is not available. Please choose another model.",
      cause,
    });
  }

  if (cause instanceof Anthropic.APIConnectionTimeoutError) {
    return chatError("provider_timeout", { cause });
  }

  if (cause instanceof Anthropic.APIConnectionError) {
    return chatError("provider_unavailable", { cause });
  }

  if (cause instanceof Anthropic.APIError) {
    return chatError("provider_unavailable", { cause });
  }

  return chatError("internal_error", { cause });
}

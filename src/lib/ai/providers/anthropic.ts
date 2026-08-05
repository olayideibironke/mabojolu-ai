import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";

import { chatError } from "../errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
  NormalizedMessage,
} from "../provider";

/**
 * Anthropic adapter.
 *
 * Current Claude models accept structured content blocks containing text and
 * images. Mabojolu converts its provider-independent message format here so the
 * rest of the application remains independent of Anthropic API details.
 *
 * Raw private reasoning is never sent to the browser. Thinking events produce
 * only a generic progress label.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";

  private readonly apiKey:
    | string
    | undefined;

  private readonly timeoutMs: number;

  private client:
    | Anthropic
    | null = null;

  constructor(options: {
    apiKey:
      | string
      | undefined;
    timeoutMs: number;
  }) {
    this.apiKey =
      options.apiKey;

    this.timeoutMs =
      options.timeoutMs;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): Anthropic {
    if (!this.apiKey) {
      throw chatError(
        "provider_not_configured",
      );
    }

    /*
     * Reuse the SDK client across requests so connection pooling remains
     * effective. Automatic retries are disabled because retrying after a
     * partially delivered stream could create a second billable generation.
     */
    this.client ??=
      new Anthropic({
        apiKey:
          this.apiKey,
        maxRetries: 0,
        timeout:
          this.timeoutMs,
      });

    return this.client;
  }

  async *stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk> {
    const client =
      this.getClient();

    const messages =
      request.messages.map(
        toAnthropicMessage,
      );

    let stream: Awaited<
      ReturnType<
        typeof client.messages.stream
      >
    >;

    try {
      stream =
        client.messages.stream(
          {
            model:
              request.model
                .providerModelId,

            max_tokens:
              Math.min(
                request.maxOutputTokens,
                request.model
                  .maxOutputTokens,
              ),

            system:
              request.systemPrompt,

            messages,
          },
          {
            signal:
              request.signal,

            ...(request.idempotencyKey
              ? {
                  idempotencyKey:
                    request.idempotencyKey,
                }
              : {}),
          },
        );
    } catch (cause) {
      throw translateError(
        cause,
      );
    }

    let sawText = false;
    let announcedThinking =
      false;

    try {
      for await (
        const event of stream
      ) {
        if (
          request.signal.aborted
        ) {
          break;
        }

        if (
          event.type ===
          "content_block_start"
        ) {
          /*
           * Indicate that reasoning is underway without exposing private
           * reasoning content.
           */
          if (
            event.content_block
              .type ===
              "thinking" &&
            !announcedThinking
          ) {
            announcedThinking =
              true;

            yield {
              type: "progress",
              label:
                "Thinking",
            };
          }

          continue;
        }

        if (
          event.type ===
            "content_block_delta" &&
          event.delta.type ===
            "text_delta"
        ) {
          sawText = true;

          yield {
            type: "text",
            text:
              event.delta.text,
          };
        }
      }

      if (
        request.signal.aborted
      ) {
        yield {
          type: "finish",
          finishReason:
            "aborted",
        };

        return;
      }

      const message =
        await stream.finalMessage();

      const usage = {
        inputTokens:
          message.usage
            .input_tokens,

        outputTokens:
          message.usage
            .output_tokens,

        ...(message.usage
          .cache_read_input_tokens
          ? {
              cacheReadTokens:
                message.usage
                  .cache_read_input_tokens,
            }
          : {}),

        ...(message.usage
          .cache_creation_input_tokens
          ? {
              cacheWriteTokens:
                message.usage
                  .cache_creation_input_tokens,
            }
          : {}),
      };

      /*
       * Refusals are successful API responses. When no visible text was
       * streamed, return a refusal outcome so the Mabojolu UI can explain it.
       */
      if (
        message.stop_reason ===
          "refusal" &&
        !sawText
      ) {
        yield {
          type: "finish",
          finishReason:
            "refusal",
          usage,
        };

        return;
      }

      yield {
        type: "finish",

        finishReason:
          message.stop_reason ===
          "max_tokens"
            ? "max_tokens"
            : "end_turn",

        usage,
      };
    } catch (cause) {
      if (
        request.signal.aborted
      ) {
        yield {
          type: "finish",
          finishReason:
            "aborted",
        };

        return;
      }

      throw translateError(
        cause,
      );
    }
  }
}

/**
 * Convert Mabojolu's normalized message into Anthropic's typed content format.
 *
 * Images are placed before the accompanying text so Claude receives the visual
 * context and then the user's instruction. Ordinary text-only messages remain
 * structured content blocks, keeping one consistent request shape.
 */
function toAnthropicMessage(
  message: NormalizedMessage,
): MessageParam {
  const content:
    ContentBlockParam[] = [];

  for (
    const image of
    message.images ?? []
  ) {
    content.push({
      type: "image",

      source: {
        type: "base64",

        media_type:
          image.mimeType,

        data:
          image.base64Data,
      },
    });
  }

  /*
   * Preserve the text exactly as supplied by Mabojolu. When a future image-only
   * request contains no text, add a minimal instruction so the API still
   * receives a useful user turn.
   */
  content.push({
    type: "text",

    text:
      message.content.length >
      0
        ? message.content
        : "Please analyze the attached image.",
  });

  return {
    role:
      message.role,
    content,
  };
}

/**
 * Map Anthropic SDK exceptions onto Mabojolu's provider-independent errors.
 *
 * Provider error messages and credentials are never returned directly to the
 * browser.
 */
function translateError(
  cause: unknown,
): ReturnType<
  typeof chatError
> {
  if (
    cause instanceof
    Anthropic.APIUserAbortError
  ) {
    return chatError(
      "aborted",
      {
        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.AuthenticationError
  ) {
    return chatError(
      "provider_not_configured",
      {
        message:
          "The AI provider credential was rejected. Check the configured API key.",

        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.PermissionDeniedError
  ) {
    return chatError(
      "provider_not_configured",
      {
        message:
          "The configured credential does not have access to the selected model.",

        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.RateLimitError
  ) {
    const header =
      cause.headers?.get?.(
        "retry-after",
      );

    const parsed =
      header
        ? Number.parseInt(
            header,
            10,
          )
        : Number.NaN;

    return chatError(
      "rate_limited",
      {
        message:
          "The AI service is busy right now. Please wait a moment and try again.",

        retryAfterSeconds:
          Number.isFinite(
            parsed,
          )
            ? parsed
            : undefined,

        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.BadRequestError
  ) {
    return chatError(
      "context_too_large",
      {
        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.NotFoundError
  ) {
    return chatError(
      "provider_unavailable",
      {
        message:
          "The selected model is not available. Please choose another model.",

        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.APIConnectionTimeoutError
  ) {
    return chatError(
      "provider_timeout",
      {
        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.APIConnectionError
  ) {
    return chatError(
      "provider_unavailable",
      {
        cause,
      },
    );
  }

  if (
    cause instanceof
    Anthropic.APIError
  ) {
    return chatError(
      "provider_unavailable",
      {
        cause,
      },
    );
  }

  return chatError(
    "internal_error",
    {
      cause,
    },
  );
}
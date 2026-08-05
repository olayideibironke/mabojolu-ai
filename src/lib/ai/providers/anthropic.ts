import "server-only";

import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages/messages";

import type { ChatSource } from "@/types/chat";

import { chatError } from "../errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
  NormalizedMessage,
} from "../provider";

const WEB_SEARCH_MAX_USES = 3;

const WEB_SEARCH_INSTRUCTIONS = `
You have access to live web search.

Use web search whenever the user's request depends on current, recent, changing,
local, commercial, legal, financial, political, medical, product, pricing,
availability, schedule, news, public-figure, organization, recommendation, or
other information that may have changed since your training data.

Also search whenever the user explicitly asks you to search, browse, verify,
look something up, find current information, compare current options, or provide
live catalog data.

Do not search for ordinary greetings, creative writing, rewriting, translation,
summaries of content already supplied by the user, basic calculations, or
stable knowledge that does not require current verification.

When searching:
- Prefer official, primary, and authoritative sources.
- Verify important claims using more than one reliable source when practical.
- Ensure current factual claims are supported by the returned citations.
- Distinguish confirmed facts from inference or uncertainty.
- Never invent a source, quotation, price, availability status, or citation.
- Never claim that you searched the web when no search was performed.
- Do not expose internal tool calls, encrypted metadata, or private reasoning.
`.trim();

/**
 * Anthropic adapter.
 *
 * Claude remains Mabojolu's reasoning and conversational provider. Anthropic's
 * server-side web-search tool is available on every request, but Claude invokes
 * it only when the user's question requires current or externally verified
 * information.
 *
 * Raw private reasoning is never sent to the browser. Thinking events produce
 * only a generic progress label.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";

  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  private client: Anthropic | null = null;

  constructor(options: {
    apiKey: string | undefined;
    timeoutMs: number;
  }) {
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

    /*
     * Reuse the SDK client across requests so connection pooling remains
     * effective. Automatic retries are disabled because retrying after a
     * partially delivered stream could create a second billable generation or
     * another set of billable web searches.
     */
    this.client ??= new Anthropic({
      apiKey: this.apiKey,
      maxRetries: 0,
      timeout: this.timeoutMs,
    });

    return this.client;
  }

  async *stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk> {
    const client = this.getClient();

    const messages = request.messages.map(toAnthropicMessage);

    let stream: Awaited<
      ReturnType<typeof client.messages.stream>
    >;

    try {
      stream = client.messages.stream(
        {
          model: request.model.providerModelId,

          max_tokens: Math.min(
            request.maxOutputTokens,
            request.model.maxOutputTokens,
          ),

          system: [
            request.systemPrompt.trim(),
            WEB_SEARCH_INSTRUCTIONS,
          ]
            .filter(Boolean)
            .join("\n\n"),

          messages,

          /*
           * Claude decides whether the current request needs live information.
           * The hard cap prevents one response from performing unlimited
           * searches against Westforge's Anthropic account.
           */
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: WEB_SEARCH_MAX_USES,
            },
          ],
        },
        {
          signal: request.signal,

          ...(request.idempotencyKey
            ? {
                idempotencyKey: request.idempotencyKey,
              }
            : {}),
        },
      );
    } catch (cause) {
      throw translateError(cause);
    }

    let sawText = false;
    let announcedThinking = false;
    let announcedSearching = false;

    const emittedSourceIds = new Set<string>();

    try {
      for await (const event of stream) {
        if (request.signal.aborted) {
          break;
        }

        if (event.type === "content_block_start") {
          /*
           * Indicate that reasoning is underway without exposing private
           * reasoning content.
           */
          if (
            event.content_block.type === "thinking" &&
            !announcedThinking
          ) {
            announcedThinking = true;

            yield {
              type: "progress",
              label: "Thinking",
            };
          }

          /*
           * A server tool begins with a server_tool_use block. We expose only a
           * friendly status, never Claude's internal query payload.
           */
          if (
            event.content_block.type === "server_tool_use" &&
            event.content_block.name === "web_search" &&
            !announcedSearching
          ) {
            announcedSearching = true;

            yield {
              type: "progress",
              label: "Searching the web",
            };
          }

          continue;
        }

        if (event.type !== "content_block_delta") {
          continue;
        }

        if (event.delta.type === "text_delta") {
          sawText = true;

          yield {
            type: "text",
            text: event.delta.text,
          };

          continue;
        }

        /*
         * Anthropic streams citation metadata separately from visible text.
         * Only public web-search citations are forwarded to Mabojolu.
         */
        if (
          event.delta.type === "citations_delta" &&
          event.delta.citation.type === "web_search_result_location"
        ) {
          const source = toChatSource({
            url: event.delta.citation.url,
            title: event.delta.citation.title,
            citedText: event.delta.citation.cited_text,
          });

          if (
            source &&
            !emittedSourceIds.has(source.id)
          ) {
            emittedSourceIds.add(source.id);

            yield {
              type: "source",
              source,
            };
          }
        }
      }

      if (request.signal.aborted) {
        yield {
          type: "finish",
          finishReason: "aborted",
        };

        return;
      }

      const message = await stream.finalMessage();

      const usage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,

        ...(message.usage.cache_read_input_tokens
          ? {
              cacheReadTokens:
                message.usage.cache_read_input_tokens,
            }
          : {}),

        ...(message.usage.cache_creation_input_tokens
          ? {
              cacheWriteTokens:
                message.usage.cache_creation_input_tokens,
            }
          : {}),
      };

      /*
       * Refusals are successful API responses. When no visible text was
       * streamed, return a refusal outcome so the Mabojolu UI can explain it.
       */
      if (
        message.stop_reason === "refusal" &&
        !sawText
      ) {
        yield {
          type: "finish",
          finishReason: "refusal",
          usage,
        };

        return;
      }

      yield {
        type: "finish",

        finishReason:
          message.stop_reason === "max_tokens"
            ? "max_tokens"
            : "end_turn",

        usage,
      };
    } catch (cause) {
      if (request.signal.aborted) {
        yield {
          type: "finish",
          finishReason: "aborted",
        };

        return;
      }

      throw translateError(cause);
    }
  }
}

/**
 * Convert Mabojolu's normalized message into Anthropic's typed content format.
 *
 * Images are placed before the accompanying text so Claude receives the visual
 * context and then the user's instruction. Mabojolu can analyze uploaded images
 * but does not generate new images.
 */
function toAnthropicMessage(
  message: NormalizedMessage,
): MessageParam {
  const content: ContentBlockParam[] = [];

  for (const image of message.images ?? []) {
    content.push({
      type: "image",

      source: {
        type: "base64",
        media_type: image.mimeType,
        data: image.base64Data,
      },
    });
  }

  /*
   * Preserve the text exactly as supplied by Mabojolu. When an image-only
   * request contains no text, add a minimal instruction so the API still
   * receives a useful user turn.
   */
  content.push({
    type: "text",

    text:
      message.content.length > 0
        ? message.content
        : "Please analyze the attached image.",
  });

  return {
    role: message.role,
    content,
  };
}

/**
 * Convert one Anthropic citation into browser-safe Mabojolu source metadata.
 */
function toChatSource(input: {
  url: string;
  title: string | null;
  citedText: string;
}): ChatSource | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input.url);
  } catch {
    return null;
  }

  /*
   * Do not forward executable, local, or insecure URL schemes into clickable
   * browser content.
   */
  if (parsedUrl.protocol !== "https:") {
    return null;
  }

  const normalizedUrl = parsedUrl.toString();

  const title =
    input.title?.trim() ||
    parsedUrl.hostname.replace(/^www\./, "");

  const citedText = input.citedText.trim();

  return {
    id: createSourceId(normalizedUrl),
    title,
    url: normalizedUrl,

    ...(citedText
      ? {
          citedText,
        }
      : {}),
  };
}

/**
 * Build a stable non-secret identifier so repeated citations to the same page
 * collapse into one visible source.
 */
function createSourceId(url: string): string {
  return `source-${createHash("sha256")
    .update(url)
    .digest("hex")
    .slice(0, 16)}`;
}

/**
 * Map Anthropic SDK exceptions onto Mabojolu's provider-independent errors.
 *
 * Provider error messages and credentials are never returned directly to the
 * browser.
 */
function translateError(
  cause: unknown,
): ReturnType<typeof chatError> {
  if (cause instanceof Anthropic.APIUserAbortError) {
    return chatError("aborted", {
      cause,
    });
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
        "The configured credential does not have access to the selected model or live web search.",

      cause,
    });
  }

  if (cause instanceof Anthropic.RateLimitError) {
    const header = cause.headers?.get?.("retry-after");

    const parsed = header
      ? Number.parseInt(header, 10)
      : Number.NaN;

    return chatError("rate_limited", {
      message:
        "The AI service is busy right now. Please wait a moment and try again.",

      retryAfterSeconds: Number.isFinite(parsed)
        ? parsed
        : undefined,

      cause,
    });
  }

  if (cause instanceof Anthropic.BadRequestError) {
    if (isWebSearchConfigurationError(cause)) {
      return chatError("provider_unavailable", {
        message:
          "Live web access is temporarily unavailable. Please try again later.",

        cause,
      });
    }

    return chatError("context_too_large", {
      cause,
    });
  }

  if (cause instanceof Anthropic.NotFoundError) {
    return chatError("provider_unavailable", {
      message:
        "The selected model is not available. Please choose another model.",

      cause,
    });
  }

  if (cause instanceof Anthropic.APIConnectionTimeoutError) {
    return chatError("provider_timeout", {
      cause,
    });
  }

  if (cause instanceof Anthropic.APIConnectionError) {
    return chatError("provider_unavailable", {
      cause,
    });
  }

  if (cause instanceof Anthropic.APIError) {
    return chatError("provider_unavailable", {
      cause,
    });
  }

  return chatError("internal_error", {
    cause,
  });
}

/**
 * Distinguish a disabled or unsupported web-search configuration from an
 * ordinary oversized-context request, since both arrive as HTTP 400 errors.
 */
function isWebSearchConfigurationError(
  cause: InstanceType<typeof Anthropic.BadRequestError>,
): boolean {
  const message = cause.message.toLowerCase();

  return (
    message.includes("web search") ||
    message.includes("web_search") ||
    message.includes("server tool") ||
    message.includes("tool type")
  );
}
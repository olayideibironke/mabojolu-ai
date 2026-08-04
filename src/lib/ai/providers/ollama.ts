import "server-only";

import { chatError } from "@/lib/ai/errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
  NormalizedMessage,
} from "@/lib/ai/provider";

interface OllamaProviderOptions {
  baseUrl: string;
  timeoutMs: number;
  keepAlive: string;
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: true;

  /**
   * Mabojolu currently hides private reasoning and requests only the final
   * answer. Ollama supports disabling thinking with this field for compatible
   * Qwen models.
   */
  think: false;

  keep_alive: string;

  options: {
    num_predict: number;
  };
}

interface OllamaStreamMessage {
  role?: string;
  content?: string;
  thinking?: string;
  images?: unknown;
}

interface OllamaStreamChunk {
  model?: string;
  created_at?: string;
  message?: OllamaStreamMessage;
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

function normalizeBaseUrl(
  baseUrl: string,
): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, "");
}

function toOllamaMessage(
  message: NormalizedMessage,
): OllamaChatMessage {
  const images =
    message.images?.map(
      (image) => image.base64Data,
    );

  return {
    role: message.role,
    content: message.content,

    ...(images && images.length > 0
      ? {
          images,
        }
      : {}),
  };
}

function buildMessages(
  request: GenerationRequest,
): OllamaChatMessage[] {
  return [
    {
      role: "system",
      content: request.systemPrompt,
    },

    ...request.messages.map(
      toOllamaMessage,
    ),
  ];
}

function createCombinedSignal(input: {
  requestSignal: AbortSignal;
  timeoutMs: number;
}): {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
} {
  const controller =
    new AbortController();

  let timeoutTriggered = false;

  const abortFromRequest = () => {
    controller.abort(
      input.requestSignal.reason,
    );
  };

  if (input.requestSignal.aborted) {
    abortFromRequest();
  } else {
    input.requestSignal.addEventListener(
      "abort",
      abortFromRequest,
      {
        once: true,
      },
    );
  }

  const timeout = setTimeout(() => {
    timeoutTriggered = true;

    controller.abort(
      new DOMException(
        "Ollama request timed out.",
        "TimeoutError",
      ),
    );
  }, input.timeoutMs);

  return {
    signal: controller.signal,

    timedOut: () =>
      timeoutTriggered,

    cleanup: () => {
      clearTimeout(timeout);

      input.requestSignal.removeEventListener(
        "abort",
        abortFromRequest,
      );
    },
  };
}

async function readErrorDetail(
  response: Response,
): Promise<string | undefined> {
  try {
    const body =
      (await response.json()) as {
        error?: unknown;
      };

    return typeof body.error ===
      "string"
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
}

function translateHttpFailure(input: {
  status: number;
  detail?: string;
}): ReturnType<typeof chatError> {
  const cause = input.detail
    ? new Error(input.detail)
    : new Error(
        `Ollama returned HTTP ${input.status}.`,
      );

  if (input.status === 400) {
    return chatError(
      "invalid_request",
      {
        message:
          "Ollama could not process that message or image. Try a smaller image or another response mode.",
        cause,
      },
    );
  }

  if (input.status === 404) {
    return chatError(
      "provider_unavailable",
      {
        message:
          "The selected local model is not installed. Choose another response mode or install the model.",
        cause,
      },
    );
  }

  if (input.status === 408) {
    return chatError(
      "provider_timeout",
      {
        cause,
      },
    );
  }

  if (input.status === 429) {
    return chatError(
      "rate_limited",
      {
        message:
          "The local AI service is busy. Wait a moment and try again.",
        cause,
      },
    );
  }

  if (input.status >= 500) {
    return chatError(
      "provider_unavailable",
      {
        message:
          "Ollama is temporarily unavailable. Confirm it is running and try again.",
        cause,
      },
    );
  }

  return chatError(
    "provider_unavailable",
    {
      cause,
    },
  );
}

function translateConnectionFailure(
  cause: unknown,
  timedOut: boolean,
  requestAborted: boolean,
): ReturnType<typeof chatError> {
  if (requestAborted) {
    return chatError(
      "aborted",
      {
        cause,
      },
    );
  }

  if (timedOut) {
    return chatError(
      "provider_timeout",
      {
        message:
          "The local model took too long to respond. Try Fast mode or send a smaller image.",
        cause,
      },
    );
  }

  return chatError(
    "provider_unavailable",
    {
      message:
        "Mabojolu could not connect to Ollama. Confirm Ollama is running and try again.",
      cause,
    },
  );
}

function finishReason(
  chunk: OllamaStreamChunk,
  maxOutputTokens: number,
): "end_turn" | "max_tokens" {
  if (
    chunk.done_reason === "length" ||
    (typeof chunk.eval_count ===
      "number" &&
      chunk.eval_count >=
        maxOutputTokens)
  ) {
    return "max_tokens";
  }

  return "end_turn";
}

export class OllamaProvider
  implements AiProvider
{
  readonly id = "ollama";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly keepAlive: string;

  constructor(
    options: OllamaProviderOptions,
  ) {
    this.baseUrl =
      normalizeBaseUrl(
        options.baseUrl,
      );

    this.timeoutMs =
      options.timeoutMs;

    this.keepAlive =
      options.keepAlive;
  }

  isConfigured(): boolean {
    return (
      this.baseUrl.length > 0 &&
      this.timeoutMs > 0 &&
      this.keepAlive.trim()
        .length > 0
    );
  }

  async *stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk> {
    if (!this.isConfigured()) {
      throw chatError(
        "provider_not_configured",
        {
          message:
            "Ollama is not configured correctly. Check the local Ollama settings.",
        },
      );
    }

    const combined =
      createCombinedSignal({
        requestSignal:
          request.signal,

        timeoutMs:
          this.timeoutMs,
      });

    const body: OllamaChatRequest = {
      model:
        request.model
          .providerModelId,

      messages:
        buildMessages(request),

      stream: true,

      /**
       * Thinking is disabled because Mabojolu does not expose private reasoning
       * traces. Only final response text is streamed to the interface.
       */
      think: false,

      keep_alive:
        this.keepAlive,

      options: {
        num_predict:
          request.maxOutputTokens,
      },
    };

    let response: Response;

    try {
      response = await fetch(
        `${this.baseUrl}/api/chat`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            body,
          ),

          signal:
            combined.signal,

          cache: "no-store",
        },
      );
    } catch (cause) {
      combined.cleanup();

      throw translateConnectionFailure(
        cause,
        combined.timedOut(),
        request.signal.aborted,
      );
    }

    if (!response.ok) {
      const detail =
        await readErrorDetail(
          response,
        );

      combined.cleanup();

      throw translateHttpFailure({
        status: response.status,
        detail,
      });
    }

    if (!response.body) {
      combined.cleanup();

      throw chatError(
        "provider_unavailable",
        {
          message:
            "Ollama returned an empty response. Please try again.",
        },
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";
    let sawText = false;
    let receivedFinish = false;

    try {
      while (true) {
        const result =
          await reader.read();

        if (result.done) {
          break;
        }

        buffer += decoder.decode(
          result.value,
          {
            stream: true,
          },
        );

        const lines =
          buffer.split(/\r?\n/);

        buffer =
          lines.pop() ?? "";

        for (const line of lines) {
          const trimmed =
            line.trim();

          if (!trimmed) {
            continue;
          }

          let chunk:
            OllamaStreamChunk;

          try {
            chunk =
              JSON.parse(
                trimmed,
              ) as OllamaStreamChunk;
          } catch (cause) {
            throw chatError(
              "provider_unavailable",
              {
                message:
                  "Ollama returned an unreadable response. Please try again.",
                cause,
              },
            );
          }

          if (chunk.error) {
            throw chatError(
              "provider_unavailable",
              {
                message:
                  "Ollama could not complete that request. Try again or choose another response mode.",
                cause:
                  new Error(
                    chunk.error,
                  ),
              },
            );
          }

          const text =
            chunk.message
              ?.content ?? "";

          if (text.length > 0) {
            sawText = true;

            yield {
              type: "text",
              text,
            };
          }

          /**
           * The `thinking` field is deliberately ignored. Mabojolu never
           * forwards private reasoning traces to the browser.
           */

          if (chunk.done) {
            receivedFinish = true;

            yield {
              type: "finish",

              finishReason:
                finishReason(
                  chunk,
                  request.maxOutputTokens,
                ),

              usage: {
                inputTokens:
                  chunk.prompt_eval_count ??
                  0,

                outputTokens:
                  chunk.eval_count ??
                  0,
              },
            };

            return;
          }
        }
      }

      /**
       * Process a final JSON object that may not end with a newline.
       */
      const trailing =
        `${buffer}${decoder.decode()}`
          .trim();

      if (trailing.length > 0) {
        let chunk:
          OllamaStreamChunk;

        try {
          chunk =
            JSON.parse(
              trailing,
            ) as OllamaStreamChunk;
        } catch (cause) {
          throw chatError(
            "provider_unavailable",
            {
              message:
                "Ollama returned an incomplete response. Please try again.",
              cause,
            },
          );
        }

        if (chunk.error) {
          throw chatError(
            "provider_unavailable",
            {
              message:
                "Ollama could not complete that request. Try again or choose another response mode.",
              cause:
                new Error(
                  chunk.error,
                ),
            },
          );
        }

        const text =
          chunk.message
            ?.content ?? "";

        if (text.length > 0) {
          sawText = true;

          yield {
            type: "text",
            text,
          };
        }

        if (chunk.done) {
          receivedFinish = true;

          yield {
            type: "finish",

            finishReason:
              finishReason(
                chunk,
                request.maxOutputTokens,
              ),

            usage: {
              inputTokens:
                chunk.prompt_eval_count ??
                0,

              outputTokens:
                chunk.eval_count ??
                0,
            },
          };

          return;
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

      if (!receivedFinish) {
        yield {
          type: "finish",

          finishReason:
            sawText
              ? "end_turn"
              : "refusal",
        };
      }
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

      if (
        combined.timedOut()
      ) {
        throw chatError(
          "provider_timeout",
          {
            message:
              "The local model took too long to respond. Try Fast mode or send a smaller image.",
            cause,
          },
        );
      }

      if (
        cause instanceof Error &&
        cause.name ===
          "AbortError"
      ) {
        throw chatError(
          "provider_unavailable",
          {
            message:
              "The Ollama connection ended unexpectedly. Please try again.",
            cause,
          },
        );
      }

      throw cause;
    } finally {
      combined.cleanup();

      try {
        await reader.cancel();
      } catch {
        /**
         * The stream may already be closed. No action is needed.
         */
      }

      reader.releaseLock();
    }
  }
}
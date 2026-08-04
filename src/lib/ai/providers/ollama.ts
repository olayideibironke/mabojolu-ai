import "server-only";

import { ChatError, chatError } from "../errors";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
} from "../provider";

interface OllamaProviderOptions {
  baseUrl: string;
  timeoutMs: number;
  keepAlive?: string;
}

interface OllamaChatChunk {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

/**
 * Local Ollama provider.
 *
 * Runs entirely through the Ollama HTTP API on the user's computer.
 * No cloud API credential or paid provider token is required.
 */
export class OllamaProvider implements AiProvider {
  readonly id = "ollama";

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly keepAlive: string;

  constructor(options: OllamaProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs;
    this.keepAlive = options.keepAlive ?? "5m";
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  async *stream(
    request: GenerationRequest,
  ): AsyncIterable<GenerationChunk> {
    const controller = new AbortController();
    let timedOut = false;

    const forwardRequestAbort = () => {
      controller.abort(request.signal.reason);
    };

    if (request.signal.aborted) {
      forwardRequestAbort();
    } else {
      request.signal.addEventListener(
        "abort",
        forwardRequestAbort,
        { once: true },
      );
    }

    const timeout = setTimeout(() => {
      timedOut = true;

      controller.abort(
        new DOMException(
          "The local model response timed out.",
          "TimeoutError",
        ),
      );
    }, this.timeoutMs);

    try {
      yield {
        type: "progress",
        label: "Thinking",
      };

      let response: Response;

      try {
        response = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: request.model.providerModelId,
            messages: [
              {
                role: "system",
                content: request.systemPrompt,
              },
              ...request.messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            ],
            stream: true,

            /*
             * Thinking-capable models may produce a separate reasoning field.
             * Mabojolu never sends that private reasoning trace to the browser.
             */
            think: false,

            keep_alive: this.keepAlive,

            options: {
              num_predict: Math.min(
                request.maxOutputTokens,
                request.model.maxOutputTokens,
              ),
            },
          }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (cause) {
        if (request.signal.aborted) {
          yield {
            type: "finish",
            finishReason: "aborted",
          };
          return;
        }

        if (timedOut) {
          throw chatError("provider_timeout", { cause });
        }

        throw chatError("provider_unavailable", {
          message:
            "Mabojolu could not reach the local AI engine. Make sure Ollama is running.",
          cause,
        });
      }

      if (!response.ok) {
        throw await translateHttpError(response);
      }

      if (!response.body) {
        throw chatError("provider_unavailable", {
          message:
            "The local AI engine returned an empty response.",
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let receivedFinishChunk = false;

      while (true) {
        const result = await reader.read();

        if (result.done) {
          break;
        }

        buffer += decoder.decode(result.value, {
          stream: true,
        });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const chunk = parseChunk(line);

          if (!chunk) {
            continue;
          }

          if (chunk.error) {
            throw chatError("provider_unavailable", {
              message:
                "The local AI engine could not complete that response.",
              cause: new Error(chunk.error),
            });
          }

          const content = chunk.message?.content;

          if (content) {
            yield {
              type: "text",
              text: content,
            };
          }

          if (chunk.done) {
            receivedFinishChunk = true;

            yield {
              type: "finish",
              finishReason: mapFinishReason(
                chunk.done_reason,
              ),
              usage: {
                inputTokens:
                  chunk.prompt_eval_count ?? 0,
                outputTokens:
                  chunk.eval_count ?? 0,
              },
            };

            return;
          }
        }
      }

      buffer += decoder.decode();

      const finalChunk = parseChunk(buffer);

      if (finalChunk) {
        if (finalChunk.error) {
          throw chatError("provider_unavailable", {
            message:
              "The local AI engine could not complete that response.",
            cause: new Error(finalChunk.error),
          });
        }

        const content = finalChunk.message?.content;

        if (content) {
          yield {
            type: "text",
            text: content,
          };
        }

        if (finalChunk.done) {
          receivedFinishChunk = true;

          yield {
            type: "finish",
            finishReason: mapFinishReason(
              finalChunk.done_reason,
            ),
            usage: {
              inputTokens:
                finalChunk.prompt_eval_count ?? 0,
              outputTokens:
                finalChunk.eval_count ?? 0,
            },
          };

          return;
        }
      }

      if (request.signal.aborted) {
        yield {
          type: "finish",
          finishReason: "aborted",
        };
        return;
      }

      if (!receivedFinishChunk) {
        throw chatError("provider_unavailable", {
          message:
            "The local AI response ended unexpectedly. Please try again.",
        });
      }
    } catch (cause) {
      if (request.signal.aborted) {
        yield {
          type: "finish",
          finishReason: "aborted",
        };
        return;
      }

      if (timedOut) {
        throw chatError("provider_timeout", { cause });
      }

      if (cause instanceof ChatError) {
        throw cause;
      }

      throw chatError("provider_unavailable", {
        cause,
      });
    } finally {
      clearTimeout(timeout);

      request.signal.removeEventListener(
        "abort",
        forwardRequestAbort,
      );

      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
  }
}

function parseChunk(
  line: string,
): OllamaChatChunk | null {
  const cleaned = line.trim();

  if (!cleaned) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(cleaned);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error(
        "Ollama returned a non-object stream chunk.",
      );
    }

    return parsed as OllamaChatChunk;
  } catch (cause) {
    throw chatError("provider_unavailable", {
      message:
        "The local AI engine returned an invalid response.",
      cause,
    });
  }
}

function mapFinishReason(
  reason: string | undefined,
): "end_turn" | "max_tokens" {
  if (
    reason === "length" ||
    reason === "max_tokens"
  ) {
    return "max_tokens";
  }

  return "end_turn";
}

async function translateHttpError(
  response: Response,
): Promise<ChatError> {
  let providerDetail = `Ollama HTTP ${response.status}`;

  try {
    const payload: unknown = await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      providerDetail = payload.error;
    }
  } catch {
    // Keep the status-based server log detail.
  }

  const cause = new Error(providerDetail);

  if (response.status === 404) {
    return chatError("provider_not_configured", {
      message:
        "The configured local AI model is not installed. Install it in Ollama and try again.",
      cause,
    });
  }

  if (response.status === 429) {
    return chatError("rate_limited", {
      message:
        "The local AI engine is busy. Please wait a moment and try again.",
      cause,
    });
  }

  if (
    response.status === 408 ||
    response.status === 504
  ) {
    return chatError("provider_timeout", {
      cause,
    });
  }

  if (response.status === 400) {
    return chatError("invalid_request", {
      message:
        "The local AI engine could not process that request.",
      cause,
    });
  }

  return chatError("provider_unavailable", {
    message:
      "The local AI engine is temporarily unavailable. Please try again.",
    cause,
  });
}
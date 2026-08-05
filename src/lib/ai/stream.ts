import "server-only";

import type {
  ChatSource,
  ChatStreamEvent,
} from "@/types/chat";

import {
  logChatError,
  normalizeError,
} from "./errors";
import type { GenerationChunk } from "./provider";

/**
 * Server-sent event encoding for chat responses.
 *
 * SSE rather than a raw text stream so several event kinds including deltas,
 * progress, verified sources, usage, and errors can share one connection.
 */
const encoder = new TextEncoder();

function encodeEvent(
  event: ChatStreamEvent,
): Uint8Array {
  /*
   * JSON is written on one data line. Newlines inside strings are escaped by
   * JSON.stringify, so event content cannot break SSE framing.
   */
  return encoder.encode(
    `data: ${JSON.stringify(event)}\n\n`,
  );
}

export interface StreamOptions {
  messageId: string;
  model: string;

  /** Sent in the start event so the client learns a newly created id. */
  conversationId?: string;

  chunks: AsyncIterable<GenerationChunk>;

  /** Aborted when the client disconnects or the user presses stop. */
  signal: AbortSignal;

  /**
   * Called once generation settles.
   *
   * Text and sources are supplied together so persistence can retain the full
   * verified response rather than saving citations only in the live browser.
   */
  onSettled?: (result: {
    text: string;

    sources: ChatSource[];

    finishReason:
      | "end_turn"
      | "max_tokens"
      | "aborted"
      | "refusal"
      | "error";

    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  }) => Promise<void> | void;

  /** Correlation values for logs. Never conversation content. */
  logContext?: Record<
    string,
    string | number | undefined
  >;
}

export function createChatStream(
  options: StreamOptions,
): Response {
  /**
   * Set when the consumer goes away.
   *
   * A disconnected client closes the controller. This flag prevents that
   * normal interruption from being treated as an internal application error.
   */
  let clientGone = false;

  const stream =
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let accumulated = "";
        let settled = false;

        const sourcesById =
          new Map<string, ChatSource>();

        /**
         * Write one event, reporting whether the client is still listening.
         */
        const write = (
          event: ChatStreamEvent,
        ): boolean => {
          if (clientGone) {
            return false;
          }

          try {
            controller.enqueue(
              encodeEvent(event),
            );

            return true;
          } catch {
            clientGone = true;
            return false;
          }
        };

        /**
         * Return sources in their original discovery order.
         */
        const getSources =
          (): ChatSource[] =>
            Array.from(
              sourcesById.values(),
            );

        /**
         * Persist exactly once, whatever path generation exits through.
         */
        const settle = async (
          finishReason:
            | "end_turn"
            | "max_tokens"
            | "aborted"
            | "refusal"
            | "error",

          usage?: {
            inputTokens: number;
            outputTokens: number;
          },
        ) => {
          if (settled) {
            return;
          }

          settled = true;

          try {
            await options.onSettled?.({
              text: accumulated,
              sources: getSources(),
              finishReason,
              usage,
            });
          } catch (cause) {
            /*
             * Persistence failure must not corrupt a response the user may
             * already be reading.
             */
            logChatError(
              normalizeError(cause),
              {
                ...options.logContext,
                stage: "persist",
              },
            );
          }
        };

        /**
         * True once the user has stopped or the browser has gone away.
         */
        const isInterrupted = () =>
          clientGone ||
          options.signal.aborted;

        try {
          write({
            type: "start",
            messageId:
              options.messageId,
            model:
              options.model,

            ...(options.conversationId
              ? {
                  conversationId:
                    options.conversationId,
                }
              : {}),
          });

          for await (
            const chunk of
              options.chunks
          ) {
            /*
             * Stop pulling from the provider when nobody is listening so an
             * abandoned request stops creating additional usage.
             */
            if (isInterrupted()) {
              break;
            }

            if (
              chunk.type === "text"
            ) {
              accumulated +=
                chunk.text;

              if (
                !write({
                  type: "delta",
                  text: chunk.text,
                })
              ) {
                break;
              }

              continue;
            }

            if (
              chunk.type ===
              "progress"
            ) {
              write({
                type: "status",
                label:
                  chunk.label,
              });

              continue;
            }

            if (
              chunk.type ===
              "source"
            ) {
              /*
               * Ignore duplicate source events. A provider may cite the same
               * page several times throughout one answer.
               */
              if (
                !sourcesById.has(
                  chunk.source.id,
                )
              ) {
                sourcesById.set(
                  chunk.source.id,
                  chunk.source,
                );

                write({
                  type: "source",
                  source:
                    chunk.source,
                });
              }

              continue;
            }

            /*
             * chunk.type === "finish"
             */
            await settle(
              chunk.finishReason,
              chunk.usage,
            );

            write({
              type: "done",
              finishReason:
                chunk.finishReason,

              ...(chunk.usage
                ? {
                    usage:
                      chunk.usage,
                  }
                : {}),
            });
          }

          /*
           * A provider that ends without an explicit finish still has to be
           * settled or the reply would never be saved.
           */
          if (!settled) {
            const reason =
              isInterrupted()
                ? "aborted"
                : "end_turn";

            await settle(reason);

            write({
              type: "done",
              finishReason:
                reason,
            });
          }
        } catch (cause) {
          const error =
            normalizeError(cause);

          /*
           * Interruption is not a fault. Preserve partial text and sources.
           */
          if (
            error.code ===
              "aborted" ||
            isInterrupted()
          ) {
            await settle(
              "aborted",
            );

            write({
              type: "done",
              finishReason:
                "aborted",
            });
          } else {
            logChatError(
              error,
              options.logContext,
            );

            await settle(
              "error",
            );

            write({
              type: "error",
              error:
                error.toPayload(),
            });
          }
        } finally {
          try {
            controller.close();
          } catch {
            /*
             * The stream was already closed because the client disconnected.
             */
          }
        }
      },

      /**
       * The browser detached, for example because the user navigated away.
       */
      cancel() {
        clientGone = true;
      },
    });

  return new Response(
    stream,
    {
      headers: {
        "Content-Type":
          "text/event-stream; charset=utf-8",

        "Cache-Control":
          "no-store, no-transform",

        Connection:
          "keep-alive",

        "X-Accel-Buffering":
          "no",
      },
    },
  );
}

/**
 * JSON error response for failures detected before streaming starts.
 */
export function errorResponse(
  error: {
    toPayload: () => unknown;
    httpStatus: number;
    retryAfterSeconds?: number;
  },
): Response {
  return new Response(
    JSON.stringify({
      error:
        error.toPayload(),
    }),
    {
      status:
        error.httpStatus,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store",

        ...(error.retryAfterSeconds
          ? {
              "Retry-After":
                String(
                  error.retryAfterSeconds,
                ),
            }
          : {}),
      },
    },
  );
}
import "server-only";

import type { ChatStreamEvent } from "@/types/chat";

import { logChatError, normalizeError } from "./errors";
import type { GenerationChunk } from "./provider";

/**
 * Server-sent event encoding for chat responses.
 *
 * SSE rather than a raw text stream so several event kinds (deltas, progress,
 * usage, errors) share one connection, and so a failure occurring after headers
 * are sent still reaches the client as a typed event rather than a truncated
 * body.
 */

const encoder = new TextEncoder();

function encodeEvent(event: ChatStreamEvent): Uint8Array {
  // JSON on a single `data:` line. Newlines inside strings are escaped by
  // JSON.stringify, so no event content can break the framing.
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export interface StreamOptions {
  messageId: string;
  model: string;
  chunks: AsyncIterable<GenerationChunk>;
  /** Aborted when the client disconnects or the user presses stop. */
  signal: AbortSignal;
  /**
   * Called once the generation settles. This is where persistence happens, so it
   * must run for every outcome including abort. A partial reply is saved with
   * `interrupted` rather than being discarded.
   */
  onSettled?: (result: {
    text: string;
    finishReason: "end_turn" | "max_tokens" | "aborted" | "refusal" | "error";
    usage?: { inputTokens: number; outputTokens: number };
  }) => Promise<void> | void;
  /** Correlation values for logs. Never conversation content. */
  logContext?: Record<string, string | number | undefined>;
}

export function createChatStream(options: StreamOptions): Response {
  /**
   * Set when the consumer goes away.
   *
   * A disconnected client closes the controller, after which `enqueue` throws
   * `TypeError: Invalid state`. Without this flag that TypeError normalizes to
   * `internal_error`, which would both log a false incident and, worse, persist
   * an interrupted reply as a failure. Interruption must stay a clean outcome.
   */
  let clientGone = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let accumulated = "";
      let settled = false;

      /**
       * Write one event, reporting whether the client is still listening.
       *
       * Returns false once the consumer has detached, which is the signal to
       * stop generating rather than an error to report.
       */
      const write = (event: ChatStreamEvent): boolean => {
        if (clientGone) {
          return false;
        }

        try {
          controller.enqueue(encodeEvent(event));
          return true;
        } catch {
          clientGone = true;
          return false;
        }
      };

      /** Persist exactly once, whatever path we exit through. */
      const settle = async (
        finishReason:
          | "end_turn"
          | "max_tokens"
          | "aborted"
          | "refusal"
          | "error",
        usage?: { inputTokens: number; outputTokens: number },
      ) => {
        if (settled) {
          return;
        }
        settled = true;

        try {
          await options.onSettled?.({ text: accumulated, finishReason, usage });
        } catch (cause) {
          // A persistence failure must not corrupt the response the user may
          // already be reading, so it is logged and contained here.
          logChatError(normalizeError(cause), {
            ...options.logContext,
            stage: "persist",
          });
        }
      };

      /** True once the user has stopped or the browser has gone away. */
      const isInterrupted = () => clientGone || options.signal.aborted;

      try {
        write({
          type: "start",
          messageId: options.messageId,
          model: options.model,
        });

        for await (const chunk of options.chunks) {
          // Stop pulling from the provider the moment nobody is listening, so an
          // abandoned request stops incurring cost.
          if (isInterrupted()) {
            break;
          }

          if (chunk.type === "text") {
            accumulated += chunk.text;
            if (!write({ type: "delta", text: chunk.text })) {
              break;
            }
            continue;
          }

          if (chunk.type === "progress") {
            write({ type: "status", label: chunk.label });
            continue;
          }

          // chunk.type === "finish"
          await settle(chunk.finishReason, chunk.usage);
          write({
            type: "done",
            finishReason: chunk.finishReason,
            ...(chunk.usage ? { usage: chunk.usage } : {}),
          });
        }

        // A provider that ended without an explicit finish, or a loop we broke
        // out of, still has to be settled or the reply would never be saved.
        if (!settled) {
          const reason = isInterrupted() ? "aborted" : "end_turn";
          await settle(reason);
          write({ type: "done", finishReason: reason });
        }
      } catch (cause) {
        const error = normalizeError(cause);

        // Interruption is not a fault. Keep the partial text and record it as
        // interrupted, so the conversation stays coherent.
        if (error.code === "aborted" || isInterrupted()) {
          await settle("aborted");
          write({ type: "done", finishReason: "aborted" });
        } else {
          logChatError(error, options.logContext);
          await settle("error");
          write({ type: "error", error: error.toPayload() });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the client went away. Nothing to do.
        }
      }
    },

    /**
     * The consumer detached, for example the browser navigated away.
     *
     * Recording it here means the generation loop stops on its next iteration
     * instead of running to completion for an audience of nobody.
     */
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Tells nginx-style proxies not to buffer, which would defeat streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

/** JSON error response for failures detected before streaming starts. */
export function errorResponse(error: {
  toPayload: () => unknown;
  httpStatus: number;
  retryAfterSeconds?: number;
}): Response {
  return new Response(JSON.stringify({ error: error.toPayload() }), {
    status: error.httpStatus,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(error.retryAfterSeconds
        ? { "Retry-After": String(error.retryAfterSeconds) }
        : {}),
    },
  });
}

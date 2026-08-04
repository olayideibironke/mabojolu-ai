import type { ChatErrorPayload, ChatStreamEvent } from "@/types/chat";

/**
 * Browser-side SSE reader.
 *
 * A hand-rolled reader over `fetch` rather than `EventSource`, because
 * `EventSource` cannot issue a POST, cannot send a JSON body, and cannot be
 * aborted cleanly. This is a Client Component dependency and holds no secrets.
 */

/** Fallback error when the server response cannot be interpreted at all. */
const UNKNOWN_ERROR: ChatErrorPayload = {
  code: "internal_error",
  message: "Something went wrong. Please try again.",
  retryable: true,
};

export interface StreamCallbacks {
  onStart?: (info: { messageId: string; model: string }) => void;
  onDelta: (text: string) => void;
  onStatus?: (label: string) => void;
  onDone: (info: {
    finishReason: "end_turn" | "max_tokens" | "aborted" | "refusal";
  }) => void;
  onError: (error: ChatErrorPayload) => void;
}

export async function streamChat(
  body: unknown,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // A user-initiated stop surfaces here as an AbortError. Treat it as the
    // control-flow signal it is, not a network failure.
    if (isAbort(cause, signal)) {
      callbacks.onDone({ finishReason: "aborted" });
      return;
    }

    callbacks.onError({
      code: "provider_unavailable",
      message:
        "Could not reach Mabojolu. Check your connection and try again.",
      retryable: true,
    });
    return;
  }

  // Failures detected before streaming arrive as JSON with a status code.
  if (!response.ok) {
    callbacks.onError(await readErrorPayload(response));
    return;
  }

  if (!response.body) {
    callbacks.onError(UNKNOWN_ERROR);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminalEvent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // `stream: true` keeps multi-byte characters intact across chunk
      // boundaries, which matters for any non-ASCII output.
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. A trailing partial frame
      // stays in the buffer until the rest arrives.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = parseFrame(frame);
        if (!event) {
          continue;
        }

        switch (event.type) {
          case "start":
            callbacks.onStart?.({
              messageId: event.messageId,
              model: event.model,
            });
            break;
          case "delta":
            callbacks.onDelta(event.text);
            break;
          case "status":
            callbacks.onStatus?.(event.label);
            break;
          case "done":
            sawTerminalEvent = true;
            callbacks.onDone({ finishReason: event.finishReason });
            break;
          case "error":
            sawTerminalEvent = true;
            callbacks.onError(event.error);
            break;
        }
      }
    }

    // The connection closed without a terminal event: the stream was cut short.
    // Report it rather than leaving the UI stuck in a streaming state forever.
    if (!sawTerminalEvent) {
      if (signal.aborted) {
        callbacks.onDone({ finishReason: "aborted" });
      } else {
        callbacks.onError({
          code: "provider_unavailable",
          message: "The response ended unexpectedly. Please try again.",
          retryable: true,
        });
      }
    }
  } catch (cause) {
    if (isAbort(cause, signal)) {
      callbacks.onDone({ finishReason: "aborted" });
      return;
    }

    callbacks.onError({
      code: "provider_unavailable",
      message: "The connection was interrupted. Please try again.",
      retryable: true,
    });
  } finally {
    // Release the lock so the connection can be torn down promptly on abort.
    try {
      reader.releaseLock();
    } catch {
      // Already released.
    }
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  const line = frame
    .split("\n")
    .find((candidate) => candidate.startsWith("data:"));

  if (!line) {
    return null;
  }

  try {
    return JSON.parse(line.slice(5).trim()) as ChatStreamEvent;
  } catch {
    // A malformed frame is skipped rather than aborting the whole stream.
    return null;
  }
}

async function readErrorPayload(response: Response): Promise<ChatErrorPayload> {
  try {
    const data = (await response.json()) as { error?: ChatErrorPayload };

    if (data.error?.message && data.error.code) {
      return data.error;
    }
  } catch {
    // Body was not JSON. Fall through to a status-derived message.
  }

  if (response.status === 429) {
    return {
      code: "rate_limited",
      message:
        "You have sent a lot of messages in a short time. Please wait a moment and try again.",
      retryable: true,
    };
  }

  if (response.status === 401) {
    return {
      code: "unauthorized",
      message: "Please sign in to continue.",
      retryable: false,
    };
  }

  return UNKNOWN_ERROR;
}

function isAbort(cause: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) {
    return true;
  }

  return cause instanceof Error && cause.name === "AbortError";
}

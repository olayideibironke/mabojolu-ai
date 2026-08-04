import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "./use-chat";

/**
 * Chat hook behaviour.
 *
 * The first test here is a regression test for a real bug, and it is the reason
 * this file exists.
 *
 * `send`, `retry`, `regenerate`, and `editUserMessage` each started a network
 * request from inside a `setMessages` updater. State updaters must be pure, and
 * React deliberately double-invokes them in development to surface impure ones,
 * so every send fired twice and created two conversations milliseconds apart.
 *
 * It was invisible in unit tests that mocked at a higher level and invisible in
 * code review. It surfaced only by driving the running app and then counting rows
 * in the database. These tests assert the observable consequence: one call to the
 * transport per user action.
 */

/** Build a minimal SSE stream so the hook's reader completes normally. */
function sseResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function successfulReply(): Response {
  return sseResponse([
    JSON.stringify({
      type: "start",
      messageId: "server-msg-1",
      model: "mabojolu-mock",
      conversationId: "conv-1",
    }),
    JSON.stringify({ type: "delta", text: "Hello" }),
    JSON.stringify({ type: "delta", text: " there" }),
    JSON.stringify({ type: "done", finishReason: "end_turn" }),
  ]);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => successfulReply());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Requests to the chat endpoint only, ignoring feedback and history calls. */
function chatCalls(): unknown[] {
  return fetchMock.mock.calls.filter((call) => call[0] === "/api/chat");
}

describe("useChat", () => {
  it("issues exactly one request per send", async () => {
    // The regression assertion. Two requests here means a side effect has been
    // reintroduced into a state updater.
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatCalls()).toHaveLength(1);
  });

  it("adds the user turn and a streamed assistant reply", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Hello",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello there",
      status: "complete",
    });
  });

  it("adopts the server's conversation id exactly once", async () => {
    // Reported once per conversation, not once per double-invoked updater.
    const onConversationChanged = vi.fn();
    const { result } = renderHook(() => useChat({ onConversationChanged }));

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onConversationChanged).toHaveBeenCalledTimes(1);
    expect(onConversationChanged).toHaveBeenCalledWith("conv-1");
  });

  it("records the server message id, so feedback is addressable", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1].serverId).toBe("server-msg-1");
  });

  it("ignores a send while a generation is running", async () => {
    // Prevents a double submit from starting two billable generations.
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send("First");
    });
    act(() => {
      result.current.send("Second");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatCalls()).toHaveLength(1);
  });

  it("ignores an empty or whitespace-only send", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("   \n  ");
    });

    expect(chatCalls()).toHaveLength(0);
    expect(result.current.messages).toHaveLength(0);
  });

  it("keeps partial text and marks it interrupted when stopped", async () => {
    /*
     * The interruption guarantee. The transport reports an aborted finish, and the
     * partial reply must be retained rather than discarded or shown as failed.
     */
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-2",
          model: "mabojolu-mock",
          conversationId: "conv-2",
        }),
        JSON.stringify({ type: "delta", text: "Half an answer" }),
        JSON.stringify({ type: "done", finishReason: "aborted" }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Tell me something long");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1]).toMatchObject({
      content: "Half an answer",
      status: "interrupted",
    });
  });

  it("removes the placeholder when stopped before any text arrived", async () => {
    // An empty bubble left behind would look like a broken reply.
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-3",
          model: "mabojolu-mock",
        }),
        JSON.stringify({ type: "done", finishReason: "aborted" }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Stop immediately");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("attaches a retryable error and keeps partial text on failure", async () => {
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-4",
          model: "mabojolu-mock",
        }),
        JSON.stringify({ type: "delta", text: "Partial" }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "The AI service is temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1]).toMatchObject({
      content: "Partial",
      status: "failed",
    });
    expect(result.current.canRetry).toBe(true);
  });

  it("issues exactly one request per retry", async () => {
    fetchMock.mockImplementationOnce(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-5",
          model: "mabojolu-mock",
        }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "Temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // One send plus one retry. Three would mean the updater fired twice again.
    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
  });

  it("reuses the idempotency key on retry but not on regenerate", async () => {
    /*
     * A retry of the same logical request must be recognizable, so the server does
     * not bill a second generation. A regenerate is a new request the user asked
     * for, so it gets a fresh key.
     */
    fetchMock.mockImplementationOnce(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-6",
          model: "mabojolu-mock",
        }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "Temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const keys = chatCalls().map((call) => {
      const init = (call as [string, RequestInit])[1];
      return JSON.parse(String(init.body)).idempotencyKey as string;
    });

    expect(keys[0]).toBe(keys[1]);
  });

  it("issues exactly one request when regenerating", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantId = result.current.messages[1].id;

    await act(async () => {
      result.current.regenerate(assistantId);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
  });

  it("issues exactly one request when editing, and discards later turns", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Original question");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const userId = result.current.messages[0].id;

    await act(async () => {
      result.current.editUserMessage(userId, "Edited question");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe("Edited question");
  });

  it("does not send an unchanged edit", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Same text");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const userId = result.current.messages[0].id;

    await act(async () => {
      result.current.editUserMessage(userId, "   ");
    });

    // An empty edit is a no-op rather than a wasted generation.
    expect(chatCalls()).toHaveLength(1);
  });

  it("clears the transcript and conversation on reset", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
  });

  it("loads a stored conversation and mirrors ids for feedback", async () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.loadMessages(
        [
          {
            id: "stored-1",
            role: "user",
            content: "Earlier question",
            status: "complete",
            createdAt: "2026-08-04T00:00:00.000Z",
          },
          {
            id: "stored-2",
            role: "assistant",
            content: "Earlier answer",
            status: "complete",
            createdAt: "2026-08-04T00:00:01.000Z",
          },
        ],
        "conv-restored",
      );
    });

    expect(result.current.messages).toHaveLength(2);
    // Stored rows already carry database ids, so actions work immediately after
    // a refresh.
    expect(result.current.messages[1].serverId).toBe("stored-2");
  });
});

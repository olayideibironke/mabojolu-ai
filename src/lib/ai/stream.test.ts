import { describe, expect, it, vi } from "vitest";

import type { ChatStreamEvent } from "@/types/chat";

import { chatError } from "./errors";
import type { GenerationChunk } from "./provider";
import { createChatStream, errorResponse } from "./stream";

/**
 * The SSE layer is where a generation's outcome is decided and persisted, so
 * these cases cover each terminal path: completion, interruption, mid-stream
 * failure, and the client vanishing.
 */

async function* chunks(
  ...items: GenerationChunk[]
): AsyncIterable<GenerationChunk> {
  for (const item of items) {
    yield item;
  }
}

/** Read a whole SSE body and parse each frame. */
async function readEvents(response: Response): Promise<ChatStreamEvent[]> {
  const text = await response.text();

  return text
    .split("\n\n")
    .map((frame) => frame.split("\n").find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(5).trim()) as ChatStreamEvent);
}

describe("createChatStream", () => {
  it("emits start, deltas, and done in order", async () => {
    const response = createChatStream({
      messageId: "reply-1",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
        { type: "finish", finishReason: "end_turn" },
      ),
    });

    const events = await readEvents(response);

    expect(events.map((event) => event.type)).toEqual([
      "start",
      "delta",
      "delta",
      "done",
    ]);
  });

  it("sets SSE headers and disables buffering", async () => {
    // Without no-transform and X-Accel-Buffering a proxy can buffer the whole
    // response, which silently defeats streaming.
    const response = createChatStream({
      messageId: "reply-2",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks({ type: "finish", finishReason: "end_turn" }),
    });

    expect(response.headers.get("Content-Type")).toMatch(/text\/event-stream/);
    expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(response.headers.get("Cache-Control")).toMatch(/no-transform/);
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    await response.text();
  });

  it("forwards a progress label as a status event", async () => {
    const response = createChatStream({
      messageId: "reply-3",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "progress", label: "Thinking" },
        { type: "finish", finishReason: "end_turn" },
      ),
    });

    const events = await readEvents(response);

    expect(events).toContainEqual({ type: "status", label: "Thinking" });
  });

  it("persists the accumulated text with its finish reason", async () => {
    const onSettled = vi.fn();

    const response = createChatStream({
      messageId: "reply-4",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "text", text: "Saved " },
        { type: "text", text: "text" },
        {
          type: "finish",
          finishReason: "end_turn",
          usage: { inputTokens: 10, outputTokens: 4 },
        },
      ),
      onSettled,
    });

    await readEvents(response);

    expect(onSettled).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledWith({
      text: "Saved text",
      finishReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 4 },
    });
  });

  it("persists partial text as interrupted when the provider reports an abort", async () => {
    // The core interruption guarantee: a stopped reply is kept and labelled, not
    // discarded and not recorded as a failure.
    const onSettled = vi.fn();

    const response = createChatStream({
      messageId: "reply-5",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "text", text: "Half a thought" },
        { type: "finish", finishReason: "aborted" },
      ),
      onSettled,
    });

    const events = await readEvents(response);

    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Half a thought", finishReason: "aborted" }),
    );
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "aborted" });
  });

  it("treats a thrown AbortError as an interruption, not an error", async () => {
    const onSettled = vi.fn();

    async function* aborting(): AsyncIterable<GenerationChunk> {
      yield { type: "text", text: "Started" };
      const abort = new Error("aborted");
      abort.name = "AbortError";
      throw abort;
    }

    const response = createChatStream({
      messageId: "reply-6",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: aborting(),
      onSettled,
    });

    const events = await readEvents(response);

    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ finishReason: "aborted" }),
    );
    // The user must not be shown an error for their own stop action.
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("reports a mid-stream failure as an error event and keeps partial text", async () => {
    const onSettled = vi.fn();

    async function* failing(): AsyncIterable<GenerationChunk> {
      yield { type: "text", text: "Partial answer" };
      throw chatError("provider_unavailable");
    }

    const response = createChatStream({
      messageId: "reply-7",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: failing(),
      onSettled,
    });

    const events = await readEvents(response);
    const last = events.at(-1);

    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.error.code).toBe("provider_unavailable");
      expect(last.error.retryable).toBe(true);
    }
    // The text already shown is preserved rather than thrown away.
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Partial answer", finishReason: "error" }),
    );
  });

  it("settles a provider that ends without an explicit finish", async () => {
    // Otherwise the reply would never be saved.
    const onSettled = vi.fn();

    const response = createChatStream({
      messageId: "reply-8",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks({ type: "text", text: "No finish chunk" }),
      onSettled,
    });

    await readEvents(response);

    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ finishReason: "end_turn" }),
    );
  });

  it("settles exactly once even if the provider yields two finish chunks", async () => {
    // Double persistence would duplicate a message in the transcript.
    const onSettled = vi.fn();

    const response = createChatStream({
      messageId: "reply-9",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "finish", finishReason: "end_turn" },
        { type: "finish", finishReason: "end_turn" },
      ),
      onSettled,
    });

    await readEvents(response);

    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("still settles when the client disconnects mid-stream", async () => {
    /*
     * Regression test for a real bug found in manual testing.
     *
     * When the consumer cancels, `controller.enqueue` throws a TypeError. That
     * was normalized to `internal_error`, so a user closing their tab both
     * logged a false incident and persisted the reply as failed instead of
     * interrupted. Cancelling must settle as an abort.
     */
    const onSettled = vi.fn();

    async function* slow(): AsyncIterable<GenerationChunk> {
      yield { type: "text", text: "first" };
      // Give the cancel below a chance to land between chunks.
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield { type: "text", text: "second" };
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield { type: "finish", finishReason: "end_turn" };
    }

    const response = createChatStream({
      messageId: "reply-10",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: slow(),
      onSettled,
    });

    const reader = response.body!.getReader();
    await reader.read(); // start event
    await reader.cancel(); // client goes away

    // Let the generator observe the cancellation and settle.
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(onSettled).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ finishReason: "aborted" }),
    );
  });

  it("does not let a persistence failure break the response", async () => {
    // A database problem must not corrupt output the user is already reading.
    const response = createChatStream({
      messageId: "reply-11",
      model: "mabojolu-mock",
      signal: new AbortController().signal,
      chunks: chunks(
        { type: "text", text: "Answer" },
        { type: "finish", finishReason: "end_turn" },
      ),
      onSettled: () => {
        throw new Error("database unavailable");
      },
    });

    const events = await readEvents(response);

    expect(events.at(-1)).toMatchObject({ type: "done" });
  });
});

describe("errorResponse", () => {
  it("returns the mapped status and a Retry-After header when known", () => {
    const response = errorResponse(
      chatError("rate_limited", { retryAfterSeconds: 42 }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("omits Retry-After when no delay is known", () => {
    const response = errorResponse(chatError("invalid_request"));

    expect(response.status).toBe(400);
    expect(response.headers.get("Retry-After")).toBeNull();
  });
});

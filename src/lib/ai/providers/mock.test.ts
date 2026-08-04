import { describe, expect, it } from "vitest";

import { ChatError } from "../errors";
import { findModel, type ModelDefinition } from "../models";
import type { GenerationChunk } from "../provider";

import { MockProvider } from "./mock";

/**
 * The mock provider is what lets the rest of the product be tested without a
 * credential, so its own contract needs to hold: it must stream, it must stop
 * when aborted, and it must report usage.
 */

const model = findModel("mabojolu-mock") as ModelDefinition;

function request(overrides: Partial<Parameters<MockProvider["stream"]>[0]> = {}) {
  return {
    model,
    systemPrompt: "You are Mabojolu.",
    messages: [{ role: "user" as const, content: "Hello there" }],
    maxOutputTokens: 1_024,
    signal: new AbortController().signal,
    ...overrides,
  };
}

async function collect(
  iterable: AsyncIterable<GenerationChunk>,
): Promise<GenerationChunk[]> {
  const chunks: GenerationChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("MockProvider", () => {
  const provider = new MockProvider({ chunkDelayMs: 0 });

  it("reports itself as configured, needing no credential", () => {
    expect(provider.isConfigured()).toBe(true);
  });

  it("streams text in multiple chunks", () => {
    // A single-chunk response would not exercise the streaming path the real
    // provider uses.
    return collect(provider.stream(request())).then((chunks) => {
      const textChunks = chunks.filter((chunk) => chunk.type === "text");
      expect(textChunks.length).toBeGreaterThan(5);
    });
  });

  it("emits a progress signal before text", () => {
    return collect(provider.stream(request())).then((chunks) => {
      expect(chunks[0]).toEqual({ type: "progress", label: "Thinking" });
    });
  });

  it("finishes with end_turn and usage", () => {
    return collect(provider.stream(request())).then((chunks) => {
      const last = chunks.at(-1);

      expect(last?.type).toBe("finish");
      if (last?.type === "finish") {
        expect(last.finishReason).toBe("end_turn");
        expect(last.usage?.inputTokens).toBeGreaterThan(0);
        expect(last.usage?.outputTokens).toBeGreaterThan(0);
      }
    });
  });

  it("echoes the user's message so a developer can confirm the round trip", () => {
    return collect(
      provider.stream(
        request({
          messages: [{ role: "user", content: "unique-probe-string" }],
        }),
      ),
    ).then((chunks) => {
      const text = chunks
        .filter((chunk) => chunk.type === "text")
        .map((chunk) => (chunk.type === "text" ? chunk.text : ""))
        .join("");

      expect(text).toContain("unique-probe-string");
      // It must also be clear this is not a real model answer.
      expect(text).toMatch(/development mode/i);
    });
  });

  it("stops promptly when aborted before starting", async () => {
    const controller = new AbortController();
    controller.abort();

    const chunks = await collect(
      provider.stream(request({ signal: controller.signal })),
    );

    const last = chunks.at(-1);
    expect(last?.type).toBe("finish");
    if (last?.type === "finish") {
      expect(last.finishReason).toBe("aborted");
    }
  });

  it("reports partial usage when aborted mid-stream", async () => {
    // Abort must still account for what was generated, since it was billable.
    const controller = new AbortController();
    const slowProvider = new MockProvider({ chunkDelayMs: 5 });
    const chunks: GenerationChunk[] = [];

    for await (const chunk of slowProvider.stream(
      request({ signal: controller.signal }),
    )) {
      chunks.push(chunk);
      if (chunks.filter((c) => c.type === "text").length === 3) {
        controller.abort();
      }
    }

    const last = chunks.at(-1);
    expect(last?.type).toBe("finish");
    if (last?.type === "finish") {
      expect(last.finishReason).toBe("aborted");
      expect(last.usage?.outputTokens).toBeGreaterThan(0);
    }
  });

  it("rejects a request with no user message", async () => {
    await expect(
      collect(
        provider.stream(
          request({ messages: [{ role: "assistant", content: "orphan" }] }),
        ),
      ),
    ).rejects.toThrowError(ChatError);
  });
});

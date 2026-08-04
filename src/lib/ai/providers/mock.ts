import "server-only";

import { chatError } from "../errors";
import { estimateTokens } from "../models";
import type {
  AiProvider,
  GenerationChunk,
  GenerationRequest,
} from "../provider";

/**
 * Development and test provider.
 *
 * Exists so the whole product, including streaming, abort, and usage
 * accounting, can be built and tested with no credential and no network. It is
 * deliberately deterministic: automated tests assert on its output.
 *
 * Never selected in production unless AI_PROVIDER is explicitly set to "mock".
 */
export class MockProvider implements AiProvider {
  readonly id = "mock";

  /** Milliseconds between emitted chunks. Zero in tests to keep them fast. */
  private readonly chunkDelayMs: number;

  constructor(options: { chunkDelayMs?: number } = {}) {
    this.chunkDelayMs = options.chunkDelayMs ?? 18;
  }

  isConfigured(): boolean {
    return true;
  }

  async *stream(request: GenerationRequest): AsyncIterable<GenerationChunk> {
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      throw chatError("invalid_request", {
        message: "A user message is required.",
      });
    }

    yield { type: "progress", label: "Thinking" };

    const reply = buildReply(lastUserMessage.content);
    const words = reply.split(/(\s+)/).filter((part) => part.length > 0);
    let emitted = "";

    for (const word of words) {
      // Abort must be observed between chunks so stopping is immediate.
      if (request.signal.aborted) {
        yield {
          type: "finish",
          finishReason: "aborted",
          usage: {
            inputTokens: estimateInputTokens(request),
            outputTokens: estimateTokens(emitted),
          },
        };
        return;
      }

      if (this.chunkDelayMs > 0) {
        await delay(this.chunkDelayMs, request.signal);
      }

      emitted += word;
      yield { type: "text", text: word };
    }

    yield {
      type: "finish",
      finishReason: "end_turn",
      usage: {
        inputTokens: estimateInputTokens(request),
        outputTokens: estimateTokens(emitted),
      },
    };
  }
}

function estimateInputTokens(request: GenerationRequest): number {
  const body = request.messages.map((message) => message.content).join("\n");
  return estimateTokens(request.systemPrompt) + estimateTokens(body);
}

/**
 * Deterministic reply.
 *
 * Echoes enough of the prompt that a developer can confirm the full round trip
 * carried their input, and states plainly that no live model is connected so
 * mock output is never mistaken for a real answer.
 */
function buildReply(prompt: string): string {
  const trimmed = prompt.trim();
  const excerpt = trimmed.length > 160 ? `${trimmed.slice(0, 160)}...` : trimmed;

  return [
    "**Development mode.** Mabojolu is running against the local mock provider, so this is not a real model response.",
    "",
    `Your message was received in full and read as: "${excerpt}"`,
    "",
    "The full request path is working: validation, context construction, streaming, abort, and usage accounting all ran. Set `AI_PROVIDER=anthropic` and add a provider credential in `.env.local` to get live answers.",
  ].join("\n");
}

/** Sleep that rejects promptly on abort so stop is not delayed by a pending timer. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

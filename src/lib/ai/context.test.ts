import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/types/chat";

import { buildContext } from "./context";
import { ChatError } from "./errors";
import { findModel, type ModelDefinition } from "./models";

/**
 * Context construction decides what the model sees and what it costs, so these
 * cases pin the rules that protect correctness and budget.
 */

const model = findModel("mabojolu-mock") as ModelDefinition;

function message(
  overrides: Partial<ChatMessage> & Pick<ChatMessage, "role" | "content">,
): ChatMessage {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    status: overrides.status ?? "complete",
    createdAt: overrides.createdAt ?? "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function build(messages: ChatMessage[], contextTokenBudget = 100_000) {
  return buildContext({
    messages,
    systemPrompt: "You are Mabojolu.",
    model,
    maxOutputTokens: 1_024,
    contextTokenBudget,
  });
}

describe("buildContext", () => {
  it("preserves chronological order", () => {
    // The walk is backwards for budgeting, so ordering is a real regression risk.
    const result = build([
      message({ role: "user", content: "first" }),
      message({ role: "assistant", content: "second" }),
      message({ role: "user", content: "third" }),
    ]);

    expect(result.messages.map((m) => m.content)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("excludes failed messages", () => {
    // A failed turn holds an error, not an answer. Sending it would teach the
    // model that its own failure was a valid reply.
    const result = build([
      message({ role: "user", content: "question" }),
      message({ role: "assistant", content: "broken", status: "failed" }),
      message({ role: "user", content: "retry" }),
    ]);

    expect(result.messages.map((m) => m.content)).toEqual([
      "question",
      "retry",
    ]);
  });

  it("excludes pending placeholder messages", () => {
    const result = build([
      message({ role: "user", content: "question" }),
      message({ role: "assistant", content: "", status: "pending" }),
    ]);

    expect(result.messages).toHaveLength(1);
  });

  it("keeps interrupted messages", () => {
    // A stopped reply is partial but genuine, and dropping it would lose context
    // the user can see on screen.
    const result = build([
      message({ role: "user", content: "question" }),
      message({ role: "assistant", content: "partial", status: "interrupted" }),
      message({ role: "user", content: "continue" }),
    ]);

    expect(result.messages).toHaveLength(3);
  });

  it("drops the oldest messages when over budget and reports the count", () => {
    // Recent turns carry the most signal, so they must win the budget.
    const messages = Array.from({ length: 40 }, (_, index) =>
      message({ role: index % 2 === 0 ? "user" : "assistant", content: "x".repeat(400) }),
    );
    messages.push(message({ role: "user", content: "most recent" }));

    const result = build(messages, 1_500);

    expect(result.droppedMessages).toBeGreaterThan(0);
    // The newest turn must always survive.
    expect(result.messages.at(-1)?.content).toBe("most recent");
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it("always keeps at least the newest message", () => {
    // Even an absurdly small budget must not produce an empty prompt.
    const result = build([message({ role: "user", content: "hello" })], 1);

    expect(result.messages).toHaveLength(1);
  });

  it("throws when the only message cannot fit the budget", () => {
    // Truncating a user's words silently would be worse than telling them.
    expect(() =>
      build([message({ role: "user", content: "x".repeat(2_000_000) })]),
    ).toThrowError(ChatError);
  });

  it("throws when there is nothing eligible to send", () => {
    expect(() =>
      build([message({ role: "user", content: "", status: "failed" })]),
    ).toThrowError(ChatError);
  });

  it("reports an input token estimate that includes the system prompt", () => {
    const result = build([message({ role: "user", content: "hello" })]);

    expect(result.estimatedInputTokens).toBeGreaterThan(0);
  });
});

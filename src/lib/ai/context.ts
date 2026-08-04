import type { ChatMessage } from "@/types/chat";
import { chatError } from "./errors";
import { estimateTokens, type ModelDefinition } from "./models";
import type { NormalizedMessage } from "./provider";

/**
 * Context construction strategy.
 *
 * Goals, in priority order:
 *  1. Never send a prompt larger than the model can accept.
 *  2. Always keep the most recent turns, which carry the most signal.
 *  3. Keep system instructions separate from user content.
 *  4. Drop failed and empty messages so a broken turn does not poison context.
 *
 * Older turns are currently dropped rather than summarized. Summarization is a
 * deliberate future step: it costs an extra generation and needs its own
 * evaluation, so shipping it silently here would be worse than dropping with a
 * documented rule. `droppedMessages` is reported so callers can surface it.
 */

export interface BuiltContext {
  messages: NormalizedMessage[];
  estimatedInputTokens: number;
  /** How many older messages were excluded to fit the budget. */
  droppedMessages: number;
}

export function buildContext(input: {
  messages: ChatMessage[];
  systemPrompt: string;
  model: ModelDefinition;
  maxOutputTokens: number;
  /** Configured ceiling, clamped against the model's real window. */
  contextTokenBudget: number;
}): BuiltContext {
  const { messages, systemPrompt, model, maxOutputTokens } = input;

  // Reserve room for the reply and a safety margin, since token estimation is
  // approximate and a provider-side overrun is a hard failure.
  const reserved = maxOutputTokens + estimateTokens(systemPrompt) + 2_048;
  const budget = Math.max(
    1_024,
    Math.min(input.contextTokenBudget, model.contextWindowTokens - reserved),
  );

  const eligible = messages.filter(
    (message) =>
      message.status !== "failed" &&
      message.status !== "pending" &&
      message.content.trim().length > 0,
  );

  if (eligible.length === 0) {
    throw chatError("invalid_request", {
      message: "There is no message to send.",
    });
  }

  // Walk backwards so recent turns win the budget.
  const selected: NormalizedMessage[] = [];
  let used = 0;

  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const message = eligible[index];
    const cost = estimateTokens(message.content);

    if (used + cost > budget && selected.length > 0) {
      break;
    }

    // A single message larger than the whole budget cannot be trimmed safely,
    // so tell the user rather than truncating their words silently.
    if (used + cost > budget) {
      throw chatError("context_too_large", {
        message:
          "That message is too large for the selected model. Please shorten it or start a new chat.",
      });
    }

    selected.push({ role: message.role, content: message.content });
    used += cost;
  }

  selected.reverse();

  return {
    messages: selected,
    estimatedInputTokens: used + estimateTokens(systemPrompt),
    droppedMessages: eligible.length - selected.length,
  };
}

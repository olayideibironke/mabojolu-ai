import {
  estimateTokens,
} from "./models";

import type {
  ChatMessage,
} from "@/types/chat";

export const BROWSER_CONTEXT_WINDOW_TOKENS =
  4096;

export const BROWSER_CONTEXT_SAFETY_TOKENS =
  256;

export interface BrowserContextMessage {
  role:
    | "system"
    | "user"
    | "assistant";

  content:
    string;
}

export interface BrowserContextResult {
  messages:
    BrowserContextMessage[];

  estimatedInputTokens:
    number;

  omittedMessageCount:
    number;

  fits:
    boolean;
}

function messageTokens(
  message:
    BrowserContextMessage,
): number {
  return (
    estimateTokens(
      message.content,
    ) +
    8
  );
}

/**
 * Build an evidence-bounded browser context without truncating the current user
 * request.
 *
 * The newest user turn must fit in full. Older turns are admitted newest-first
 * until the 4096-token browser context budget is exhausted.
 */
export function buildBrowserContext(input: {
  systemPrompt:
    string;

  messages:
    Array<
      Pick<
        ChatMessage,
        | "role"
        | "content"
      >
    >;

  maxOutputTokens:
    number;
}):
  BrowserContextResult {
  const systemMessage:
    BrowserContextMessage = {
    role:
      "system",

    content:
      input.systemPrompt,
  };

  const usableMessages =
    input.messages
      .filter(
        (message) =>
          message.content
            .trim()
            .length >
          0,
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            message.content,
        }),
      );

  const latestUserIndex =
    usableMessages
      .map(
        (message) =>
          message.role,
      )
      .lastIndexOf(
        "user",
      );

  if (
    latestUserIndex <
    0
  ) {
    return {
      messages: [
        systemMessage,
      ],

      estimatedInputTokens:
        messageTokens(
          systemMessage,
        ),

      omittedMessageCount:
        usableMessages
          .length,

      fits:
        false,
    };
  }

  const latestUser =
    usableMessages[
      latestUserIndex
    ];

  const inputBudget =
    BROWSER_CONTEXT_WINDOW_TOKENS -
    input.maxOutputTokens -
    BROWSER_CONTEXT_SAFETY_TOKENS;

  const requiredTokens =
    messageTokens(
      systemMessage,
    ) +
    messageTokens(
      latestUser,
    );

  if (
    inputBudget <=
      0 ||
    requiredTokens >
      inputBudget
  ) {
    return {
      messages: [
        systemMessage,
        latestUser,
      ],

      estimatedInputTokens:
        requiredTokens,

      omittedMessageCount:
        Math.max(
          0,
          usableMessages
            .length -
            1,
        ),

      fits:
        false,
    };
  }

  const selected:
    BrowserContextMessage[] = [
      latestUser,
    ];

  let usedTokens =
    requiredTokens;

  for (
    let index =
      latestUserIndex -
      1;
    index >=
      0;
    index -=
      1
  ) {
    const candidate =
      usableMessages[
        index
      ];

    const candidateTokens =
      messageTokens(
        candidate,
      );

    if (
      usedTokens +
        candidateTokens >
      inputBudget
    ) {
      continue;
    }

    selected.unshift(
      candidate,
    );

    usedTokens +=
      candidateTokens;
  }

  return {
    messages: [
      systemMessage,
      ...selected,
    ],

    estimatedInputTokens:
      usedTokens,

    omittedMessageCount:
      usableMessages
        .length -
      selected.length,

    fits:
      true,
  };
}

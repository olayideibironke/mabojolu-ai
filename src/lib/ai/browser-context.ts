import {
  contentWithAttachmentContext,
} from "./attachment-context";

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
        | "attachments"
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
          contentWithAttachmentContext(
            message,
          )
            .trim()
            .length >
          0,
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            contentWithAttachmentContext(
              message,
            ),
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

  const history =
    usableMessages.slice(
      0,
      latestUserIndex,
    );

  const segments:
    BrowserContextMessage[][] =
      [];

  for (
    let index =
      history.length -
      1;
    index >=
      0;
  ) {
    const current =
      history[index];

    if (
      current.role ===
        "assistant"
    ) {
      const previous =
        index >
          0
          ? history[
              index -
              1
            ]
          : undefined;

      if (
        previous?.role ===
        "user"
      ) {
        segments.push([
          previous,
          current,
        ]);

        index -=
          2;

        continue;
      }

      index -=
        1;

      continue;
    }

    segments.push([
      current,
    ]);

    index -=
      1;
  }

  const selectedSegments:
    BrowserContextMessage[][] =
      [];

  let usedTokens =
    requiredTokens;

  for (
    const segment of
      segments
  ) {
    const segmentTokens =
      segment.reduce(
        (
          total,
          message,
        ) =>
          total +
          messageTokens(
            message,
          ),
        0,
      );

    if (
      usedTokens +
        segmentTokens >
      inputBudget
    ) {
      break;
    }

    selectedSegments.push(
      segment,
    );

    usedTokens +=
      segmentTokens;
  }

  const selectedHistory =
    selectedSegments
      .reverse()
      .flat();

  return {
    messages: [
      systemMessage,
      ...selectedHistory,
      latestUser,
    ],

    estimatedInputTokens:
      usedTokens,

    omittedMessageCount:
      usableMessages
        .length -
      selectedHistory.length -
      1,

    fits:
      true,
  };
}

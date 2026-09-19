import {
  estimateTokens,
  findModel,
} from "./models";

import type {
  ChatMessage,
} from "@/types/chat";

export type HandoverPressureLevel =
  | "none"
  | "prepare"
  | "urgent";

export interface HandoverPressure {
  level:
    HandoverPressureLevel;

  estimatedConversationTokens:
    number;

  estimatedUsableTokens:
    number;

  utilization:
    number;
}

const IMAGE_TOKEN_ESTIMATE =
  1_024;

const MINIMUM_USABLE_CONTEXT =
  4_096;

const PREPARE_THRESHOLD =
  0.72;

const URGENT_THRESHOLD =
  0.88;

const PREPARE_MESSAGE_COUNT =
  280;

const URGENT_MESSAGE_COUNT =
  360;

function usableMessage(
  message:
    ChatMessage,
): boolean {
  return (
    message.status !==
      "failed" &&
    message.status !==
      "pending" &&
    (
      message.content.trim()
        .length >
        0 ||
      (
        message.attachments
          ?.length ??
        0
      ) >
        0
    )
  );
}

export function estimateConversationTokens(
  messages:
    readonly ChatMessage[],
):
  number {
  return messages
    .filter(
      usableMessage,
    )
    .reduce(
      (
        total,
        message,
      ) =>
        total +
        estimateTokens(
          message.content,
        ) +
        (
          message.attachments
            ?.length ??
          0
        ) *
          IMAGE_TOKEN_ESTIMATE,
      0,
    );
}

export function handoverPressure(input: {
  messages:
    readonly ChatMessage[];

  modelId:
    string;

  contextTokenBudget?:
    number;
}):
  HandoverPressure {
  const model =
    findModel(
      input.modelId,
    );

  const estimatedConversationTokens =
    estimateConversationTokens(
      input.messages,
    );

  if (
    !model
  ) {
    return {
      level:
        input.messages.length >=
          PREPARE_MESSAGE_COUNT
          ? "prepare"
          : "none",

      estimatedConversationTokens,

      estimatedUsableTokens:
        0,

      utilization:
        0,
    };
  }

  const modelUsableTokens =
    model.contextWindowTokens -
    model.maxOutputTokens -
    3_072;

  const configuredBudget =
    input.contextTokenBudget &&
    Number.isFinite(
      input.contextTokenBudget,
    )
      ? input.contextTokenBudget
      : Number.POSITIVE_INFINITY;

  const estimatedUsableTokens =
    Math.max(
      MINIMUM_USABLE_CONTEXT,
      Math.min(
        modelUsableTokens,
        configuredBudget,
      ),
    );

  const utilization =
    estimatedConversationTokens /
    estimatedUsableTokens;

  const level:
    HandoverPressureLevel =
    utilization >=
        URGENT_THRESHOLD ||
      input.messages.length >=
        URGENT_MESSAGE_COUNT
      ? "urgent"
      : utilization >=
            PREPARE_THRESHOLD ||
          input.messages.length >=
            PREPARE_MESSAGE_COUNT
        ? "prepare"
        : "none";

  return {
    level,

    estimatedConversationTokens,

    estimatedUsableTokens,

    utilization,
  };
}

function compact(
  value:
    string,

  limit:
    number,
):
  string {
  const normalized =
    value
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (
    normalized.length <=
      limit
  ) {
    return normalized;
  }

  return (
    normalized.slice(
      0,
      Math.max(
        0,
        limit - 1,
      ),
    ) +
    "…"
  );
}

function continuitySignalScore(
  message:
    ChatMessage,
):
  number {
  const content =
    message.content
      .toLowerCase();

  const signals = [
    "must",
    "do not",
    "don't",
    "never",
    "always",
    "we decided",
    "agreed",
    "locked",
    "verified",
    "completed",
    "current status",
    "next step",
    "important",
    "constraint",
    "requirement",
    "path:",
    "branch",
    "commit",
  ];

  return signals.reduce(
    (
      score,
      signal,
    ) =>
      content.includes(
        signal,
      )
        ? score + 1
        : score,
    0,
  );
}

function displayRole(
  role:
    ChatMessage[
      "role"
    ],
):
  string {
  return role ===
    "user"
    ? "USER"
    : "MABOJOLU";
}

/**
 * Build a portable continuity packet without another inference call.
 *
 * The packet deliberately favors the original objective, latest user direction,
 * and recent working turns. This makes handover available even when local-only
 * inference is selected or the active context window is already under pressure.
 */
export function buildHandoverPacket(input: {
  messages:
    readonly ChatMessage[];

  conversationTitle?:
    string;

  conversationId?:
    string | null;

  generatedAt?:
    string;
}):
  string {
  const eligible =
    input.messages.filter(
      usableMessage,
    );

  const userMessages =
    eligible.filter(
      (message) =>
        message.role ===
        "user",
    );

  const firstUser =
    userMessages[0];

  const latestUser =
    userMessages.at(
      -1,
    );

  const recent =
    eligible.slice(
      -12,
    );

  const recentIds =
    new Set(
      recent.map(
        (
          message,
        ) =>
          message.id,
      ),
    );

  const continuityHighlights =
    eligible
      .filter(
        (
          message,
        ) =>
          !recentIds.has(
            message.id,
          ) &&
          continuitySignalScore(
            message,
          ) >
            0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          continuitySignalScore(
            right,
          ) -
          continuitySignalScore(
            left,
          ),
      )
      .slice(
        0,
        8,
      );

  const lines: string[] = [
    "# MABOJOLU CONTINUITY HANDOVER",
    "",
    "Continue this work as the same ongoing project. Do not ask the user to re-explain background that is contained below. Preserve established decisions and constraints unless the user changes them.",
    "",
    "## Source",
    `Conversation: ${input.conversationTitle?.trim() || "Untitled conversation"}`,
    `Conversation ID: ${input.conversationId || "not available"}`,
    `Prepared: ${input.generatedAt || new Date().toISOString()}`,
  ];

  if (
    firstUser
  ) {
    lines.push(
      "",
      "## Original objective",
      compact(
        firstUser.content,
        1_800,
      ),
    );
  }

  if (
    latestUser &&
    latestUser.id !==
      firstUser?.id
  ) {
    lines.push(
      "",
      "## Latest user direction",
      compact(
        latestUser.content,
        2_400,
      ),
    );
  }

  if (
    continuityHighlights.length >
      0
  ) {
    lines.push(
      "",
      "## Earlier constraints and decisions",
    );

    for (
      const message of
        continuityHighlights
    ) {
      lines.push(
        "",
        `### ${displayRole(
          message.role,
        )}`,
        compact(
          message.content,
          900,
        ),
      );
    }
  }

  lines.push(
    "",
    "## Recent working context",
  );

  for (
    const message of
      recent
  ) {
    lines.push(
      "",
      `### ${displayRole(
        message.role,
      )}`,
      compact(
        message.content,
        message.role ===
          "user"
          ? 1_600
          : 1_300,
      ),
    );
  }

  lines.push(
    "",
    "## Continuation instruction",
    "Resume from the latest unresolved task. Treat the handover as project context, verify any uncertain details from the conversation when possible, and keep the user's established workflow and constraints intact.",
  );

  return lines.join(
    "\n",
  );
}

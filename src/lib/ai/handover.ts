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

  const estimatedUsableTokens =
    Math.max(
      MINIMUM_USABLE_CONTEXT,
      model.contextWindowTokens -
        model.maxOutputTokens -
        3_072,
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

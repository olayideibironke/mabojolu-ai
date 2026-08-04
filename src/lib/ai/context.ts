import type {
  ChatImageAttachment,
  ChatMessage,
} from "@/types/chat";

import { chatError } from "./errors";
import {
  estimateTokens,
  type ModelDefinition,
} from "./models";
import type {
  NormalizedImage,
  NormalizedMessage,
} from "./provider";

/**
 * Context construction strategy.
 *
 * Goals, in priority order:
 *
 * 1. Never send a prompt larger than the selected model can accept.
 * 2. Always keep the most recent turns.
 * 3. Keep server instructions separate from user content.
 * 4. Preserve validated image attachments for vision-capable models.
 * 5. Drop failed and empty messages so broken turns do not poison context.
 *
 * Older turns are dropped rather than silently summarized. The number of
 * removed messages is returned to the gateway for logging and diagnostics.
 */

export interface BuiltContext {
  messages: NormalizedMessage[];

  estimatedInputTokens: number;

  /** Number of older messages excluded to fit the context budget. */
  droppedMessages: number;
}

/**
 * Conservative context allowance for one image.
 *
 * Vision tokenization varies by model and image dimensions. Mabojolu therefore
 * reserves a fixed safety allowance rather than treating base64 characters as
 * ordinary text tokens.
 */
const ESTIMATED_TOKENS_PER_IMAGE = 2_048;

function extractBase64Data(
  attachment: ChatImageAttachment,
): string {
  const expectedPrefix =
    `data:${attachment.mimeType};base64,`;

  if (
    !attachment.dataUrl.startsWith(
      expectedPrefix,
    )
  ) {
    throw chatError(
      "invalid_request",
      {
        message:
          `${attachment.name} contains invalid image data.`,
      },
    );
  }

  const base64Data =
    attachment.dataUrl.slice(
      expectedPrefix.length,
    );

  if (
    base64Data.length === 0
  ) {
    throw chatError(
      "invalid_request",
      {
        message:
          `${attachment.name} contains no readable image data.`,
      },
    );
  }

  return base64Data;
}

function normalizeImages(
  message: ChatMessage,
): NormalizedImage[] {
  const attachments =
    message.attachments ?? [];

  if (
    attachments.length === 0
  ) {
    return [];
  }

  if (
    message.role !== "user"
  ) {
    throw chatError(
      "invalid_request",
      {
        message:
          "Only user messages can contain image attachments.",
      },
    );
  }

  return attachments.map(
    (attachment) => ({
      name: attachment.name,
      mimeType:
        attachment.mimeType,
      base64Data:
        extractBase64Data(
          attachment,
        ),
    }),
  );
}

function messageHasUsableContent(
  message: ChatMessage,
): boolean {
  const hasText =
    message.content.trim()
      .length > 0;

  const hasImages =
    (message.attachments?.length ??
      0) > 0;

  return hasText || hasImages;
}

function estimateMessageCost(
  message: ChatMessage,
): number {
  const textTokens =
    estimateTokens(
      message.content,
    );

  const imageTokens =
    (message.attachments?.length ??
      0) *
    ESTIMATED_TOKENS_PER_IMAGE;

  return (
    textTokens +
    imageTokens
  );
}

function normalizeMessage(
  message: ChatMessage,
): NormalizedMessage {
  const images =
    normalizeImages(message);

  return {
    role: message.role,

    content:
      message.content.trim()
        .length > 0
        ? message.content
        : "Please describe and analyze the attached image.",

    ...(images.length > 0
      ? {
          images,
        }
      : {}),
  };
}

export function buildContext(input: {
  messages: ChatMessage[];
  systemPrompt: string;
  model: ModelDefinition;
  maxOutputTokens: number;

  /** Configured ceiling, clamped against the model's actual window. */
  contextTokenBudget: number;
}): BuiltContext {
  const {
    messages,
    systemPrompt,
    model,
    maxOutputTokens,
  } = input;

  const imageCount =
    messages.reduce(
      (
        total,
        message,
      ) =>
        total +
        (message.attachments
          ?.length ?? 0),
      0,
    );

  if (
    imageCount > 0 &&
    !model.capabilities.vision
  ) {
    throw chatError(
      "invalid_request",
      {
        message:
          "The selected response mode cannot analyze images.",
      },
    );
  }

  /**
   * Reserve room for the response, system instructions, and an additional
   * safety margin because token estimation is approximate.
   */
  const reserved =
    maxOutputTokens +
    estimateTokens(
      systemPrompt,
    ) +
    2_048;

  const availableModelBudget =
    model.contextWindowTokens -
    reserved;

  const budget = Math.max(
    1_024,
    Math.min(
      input.contextTokenBudget,
      availableModelBudget,
    ),
  );

  const eligible =
    messages.filter(
      (message) =>
        message.status !==
          "failed" &&
        message.status !==
          "pending" &&
        messageHasUsableContent(
          message,
        ),
    );

  if (
    eligible.length === 0
  ) {
    throw chatError(
      "invalid_request",
      {
        message:
          "There is no message or image to send.",
      },
    );
  }

  /**
   * Walk backward through the transcript so the most recent messages win the
   * available context budget.
   */
  const selected:
    NormalizedMessage[] = [];

  let used = 0;

  for (
    let index =
      eligible.length - 1;
    index >= 0;
    index -= 1
  ) {
    const message =
      eligible[index];

    const cost =
      estimateMessageCost(
        message,
      );

    if (
      used + cost > budget &&
      selected.length > 0
    ) {
      break;
    }

    /**
     * A single message larger than the entire available budget cannot be
     * trimmed without changing the user's meaning or silently removing images.
     */
    if (
      used + cost > budget
    ) {
      throw chatError(
        "context_too_large",
        {
          message:
            "That message or image set is too large for the selected model. Remove an image, shorten the message, or start a new chat.",
        },
      );
    }

    selected.push(
      normalizeMessage(message),
    );

    used += cost;
  }

  selected.reverse();

  return {
    messages: selected,

    estimatedInputTokens:
      used +
      estimateTokens(
        systemPrompt,
      ),

    droppedMessages:
      eligible.length -
      selected.length,
  };
}
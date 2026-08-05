import type { NextRequest } from "next/server";

import {
  chatError,
  logChatError,
  normalizeError,
} from "@/lib/ai/errors";
import { startGeneration } from "@/lib/ai/gateway";
import {
  estimateCostUsd,
  findModel,
} from "@/lib/ai/models";
import {
  createChatStream,
  errorResponse,
} from "@/lib/ai/stream";
import { generateConversationTitle } from "@/lib/ai/title";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { inspectServerEnv } from "@/lib/env";
import {
  beginGeneration,
  checkUsageLimits,
} from "@/lib/security/limits";
import {
  getRateLimiter,
  rateLimitIdentity,
} from "@/lib/security/rate-limit";
import {
  chatRequestSchema,
  MAX_CHAT_IMAGE_ATTACHMENTS,
  MAX_CHAT_IMAGE_DATA_URL_CHARS,
  parseJsonBody,
} from "@/lib/validation/chat";
import type {
  ChatImageAttachment,
  ChatMessage,
} from "@/types/chat";

/**
 * Mabojolu chat completion endpoint.
 *
 * Request order:
 *
 * 1. Validate server configuration.
 * 2. Authenticate the user.
 * 3. Reject an oversized request.
 * 4. Apply rate limits.
 * 5. Validate text and image data.
 * 6. Check sustained usage limits.
 * 7. Verify conversation ownership.
 * 8. Persist the user text.
 * 9. Pass text and images into the AI gateway.
 * 10. Stream the response.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Four 10 MB images expand during base64 encoding.
 *
 * The additional allowance covers JSON structure, message history, system
 * metadata, and ordinary text.
 */
const MAX_BODY_BYTES =
  MAX_CHAT_IMAGE_ATTACHMENTS *
    MAX_CHAT_IMAGE_DATA_URL_CHARS +
  1_000_000;

function normalizedMessageContent(
  message: {
    content: string;
    attachments?: readonly unknown[];
  },
): string {
  const trimmed =
    message.content.trim();

  if (trimmed.length > 0) {
    return message.content;
  }

  if (
    message.attachments &&
    message.attachments.length > 0
  ) {
    return "Please describe and analyze the attached image.";
  }

  return message.content;
}

function copyAttachments(
  attachments:
    | Array<{
        id: string;
        name: string;
        mimeType:
          | "image/jpeg"
          | "image/png"
          | "image/webp";
        sizeBytes: number;
        dataUrl: string;
      }>
    | undefined,
): ChatImageAttachment[] | undefined {
  if (
    !attachments ||
    attachments.length === 0
  ) {
    return undefined;
  }

  return attachments.map(
    (attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      dataUrl: attachment.dataUrl,
    }),
  );
}

export async function POST(
  request: NextRequest,
): Promise<Response> {
  /**
   * Declared outside the try block so any failure before streaming begins can
   * release the user's concurrency slot.
   */
  let releaseGeneration:
    | (() => void)
    | null = null;

  try {
    const envResult =
      inspectServerEnv();

    if (!envResult.ok) {
      console.error(
        "[mabojolu] invalid environment",
        envResult.issues.join("; "),
      );

      return errorResponse(
        chatError(
          "provider_not_configured",
        ),
      );
    }

    const env = envResult.env;

    /**
     * Identity comes first because every database and usage operation must be
     * scoped to the authenticated user.
     */
    const session =
      await getSession();

    if (!session) {
      return errorResponse(
        chatError("unauthorized"),
      );
    }

    /**
     * Reject a declared oversized request before loading it into memory.
     */
    const declaredLength =
      request.headers.get(
        "content-length",
      );

    if (declaredLength) {
      const declaredBytes =
        Number(declaredLength);

      if (
        Number.isFinite(
          declaredBytes,
        ) &&
        declaredBytes >
          MAX_BODY_BYTES
      ) {
        return errorResponse(
          chatError(
            "message_too_long",
            {
              message:
                "That request is too large. Remove one or more images and try again.",
            },
          ),
        );
      }
    }

    /**
     * Burst rate limiting is keyed to the authenticated user.
     */
    const limit = getRateLimiter({
      name: "chat",
      max:
        env.MABOJOLU_RATE_LIMIT_MAX,
      windowMs:
        env.MABOJOLU_RATE_LIMIT_WINDOW_MS,
    }).check(
      rateLimitIdentity({
        userId: session.userId,
        headers: request.headers,
      }),
    );

    if (!limit.allowed) {
      return errorResponse(
        chatError("rate_limited", {
          retryAfterSeconds:
            limit.retryAfterSeconds,
        }),
      );
    }

    /**
     * Read as text first so requests without a Content-Length header are still
     * checked before JSON parsing.
     */
    let rawText: string;

    try {
      rawText =
        await request.text();
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That request could not be read. Please try again.",
          },
        ),
      );
    }

    if (
      rawText.length >
      MAX_BODY_BYTES
    ) {
      return errorResponse(
        chatError(
          "message_too_long",
          {
            message:
              "That request is too large. Remove one or more images and try again.",
          },
        ),
      );
    }

    let rawBody: unknown;

    try {
      rawBody =
        JSON.parse(rawText);
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That request contains invalid data. Please try again.",
          },
        ),
      );
    }

    const parsed =
      parseJsonBody(
        chatRequestSchema,
        rawBody,
      );

    if (!parsed.ok) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              parsed.message,
          },
        ),
      );
    }

    const body =
      parsed.data;

    const lastMessage =
      body.messages.at(-1);

    if (!lastMessage) {
      return errorResponse(
        chatError(
          "invalid_request",
        ),
      );
    }

    if (
      lastMessage.content.length >
      env.MABOJOLU_MAX_MESSAGE_CHARS
    ) {
      return errorResponse(
        chatError(
          "message_too_long",
        ),
      );
    }

    if (
      body.messages.length >
      env.MABOJOLU_MAX_CONVERSATION_MESSAGES
    ) {
      return errorResponse(
        chatError(
          "conversation_too_long",
        ),
      );
    }

    /**
     * Sustained usage, identity allowances, spending, maintenance, and
     * concurrency limits.
     *
     * The full server-resolved session is passed so the limiter can distinguish
     * an anonymous guest, a registered user, and the Westforge administrator.
     */
    const usageDecision =
      await checkUsageLimits(
        session,
      );

    if (
      !usageDecision.allowed &&
      usageDecision.error
    ) {
      return errorResponse(
        usageDecision.error,
      );
    }

    const database =
      getDatabase();

    /**
     * Resolve or create the conversation.
     */
    let conversationId =
      body.conversationId;

    const normalizedLastContent =
      normalizedMessageContent(
        lastMessage,
      );

    if (conversationId) {
      const existing =
        await database.getConversation(
          conversationId,
          session.userId,
        );

      if (!existing) {
        return errorResponse(
          chatError("not_found"),
        );
      }
    } else {
      const titleSource =
        normalizedLastContent.trim()
          .length > 0
          ? normalizedLastContent
          : "Image conversation";

      const created =
        await database.createConversation(
          {
            userId:
              session.userId,

            title:
              generateConversationTitle(
                titleSource,
              ),
          },
        );

      conversationId =
        created.id;
    }

    /**
     * Persist the user turn before starting generation.
     *
     * Raw image data is intentionally not written into the message database.
     * It remains in the current request and is passed directly to the vision
     * model. This prevents multi-megabyte base64 strings from bloating ordinary
     * conversation records.
     */
    await database.appendMessage({
      conversationId,
      userId:
        session.userId,
      role: "user",
      content:
        normalizedLastContent,
      status: "complete",
      clientId:
        lastMessage.id,
    });

    /**
     * Normalize browser messages for the AI gateway.
     *
     * Client-supplied message status and model metadata are ignored. The server
     * controls both.
     */
    const messages: ChatMessage[] =
      body.messages.map(
        (message) => {
          const attachments =
            copyAttachments(
              message.attachments,
            );

          return {
            id:
              message.id,

            role:
              message.role,

            content:
              normalizedMessageContent(
                message,
              ),

            status:
              "complete",

            createdAt:
              message.createdAt ??
              new Date().toISOString(),

            ...(attachments
              ? {
                  attachments,
                }
              : {}),
          };
        },
      );

    const generation =
      startGeneration({
        messages,

        modelId:
          body.modelId,

        signal:
          request.signal,

        idempotencyKey:
          body.idempotencyKey,
      });

    const requestHasImages =
      messages.some(
        (message) =>
          (
            message.attachments
              ?.length ?? 0
          ) > 0,
      );

    if (
      requestHasImages &&
      !generation.model
        .capabilities.vision
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "The selected response mode cannot analyze images.",
          },
        ),
      );
    }

    /**
     * Create the assistant row before streaming so stopped or failed
     * generations can still be persisted correctly.
     */
    const assistantMessage =
      await database.appendMessage({
        conversationId,

        userId:
          session.userId,

        role:
          "assistant",

        content:
          "",

        status:
          "streaming",

        model:
          generation.model.id,

        promptVersion:
          generation.promptVersion,

        clientId:
          body.idempotencyKey
            ? `${body.idempotencyKey}-assistant`
            : undefined,
      });

    releaseGeneration =
      beginGeneration(
        session.userId,
      );

    const release =
      releaseGeneration;

    const settledConversationId =
      conversationId;

    return createChatStream({
      messageId:
        assistantMessage.id,

      model:
        generation.model.id,

      conversationId,

      chunks:
        generation.chunks,

      signal:
        request.signal,

      logContext: {
        model:
          generation.model.id,

        promptVersion:
          generation.promptVersion,

        droppedMessages:
          generation.droppedMessages,
      },

      onSettled: async ({
        text,
        finishReason,
        usage,
      }) => {
        try {
          const status =
            finishReason ===
            "aborted"
              ? "interrupted"
              : finishReason ===
                    "error" ||
                  finishReason ===
                    "refusal"
                ? "failed"
                : "complete";

          await database.updateMessage(
            assistantMessage.id,
            session.userId,
            {
              content:
                text,

              status,

              ...(usage
                ? {
                    usage,
                  }
                : {}),

              errorCode:
                status ===
                "failed"
                  ? finishReason ===
                    "refusal"
                    ? "provider_refused"
                    : "internal_error"
                  : "",
            },
          );

          if (usage) {
            const model =
              findModel(
                generation.model.id,
              );

            await database.recordUsage(
              {
                userId:
                  session.userId,

                conversationId:
                  settledConversationId,

                provider:
                  generation.model
                    .providerId,

                model:
                  generation.model.id,

                inputTokens:
                  usage.inputTokens,

                outputTokens:
                  usage.outputTokens,

                estimatedCostUsd:
                  model
                    ? estimateCostUsd(
                        model,
                        usage,
                      )
                    : 0,

                finishReason,
              },
            );
          }

          if (
            finishReason ===
            "refusal"
          ) {
            await database.recordSafetyEvent(
              {
                userId:
                  session.userId,

                conversationId:
                  settledConversationId,

                kind:
                  "provider_refusal",

                severity:
                  "warning",

                detail:
                  `Model ${generation.model.id} declined to answer.`,
              },
            );
          }
        } finally {
          release();
        }
      },
    });
  } catch (cause) {
    /**
     * Once the stream starts, it owns the release callback. Reaching this catch
     * means streaming did not begin, so release the slot here.
     */
    releaseGeneration?.();

    const error =
      normalizeError(
        cause,
      );

    logChatError(
      error,
      {
        route:
          "POST /api/chat",
      },
    );

    return errorResponse(
      error,
    );
  }
}

/**
 * Explicit method response so an accidental browser GET receives a useful
 * answer rather than an ambiguous 404.
 */
export function GET(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code:
          "invalid_request",

        message:
          "This endpoint accepts POST requests only.",

        retryable:
          false,
      },
    }),
    {
      status:
        405,

      headers: {
        "Content-Type":
          "application/json",

        Allow:
          "POST",
      },
    },
  );
}
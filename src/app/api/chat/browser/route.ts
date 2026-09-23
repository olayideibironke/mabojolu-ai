import type {
  NextRequest,
} from "next/server";

import {
  z,
} from "zod";

import {
  chatError,
  logChatError,
  normalizeError,
} from "@/lib/ai/errors";

import {
  errorResponse,
} from "@/lib/ai/stream";

import {
  generateConversationTitle,
} from "@/lib/ai/title";

import {
  getSession,
} from "@/lib/auth/session";

import {
  getDatabase,
} from "@/lib/database";

import {
  checkUsageLimits,
} from "@/lib/security/limits";

import {
  usageRuntimeConfig,
} from "@/lib/security/runtime-config";

import {
  getRateLimiter,
  rateLimitIdentity,
} from "@/lib/security/rate-limit";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const beginSchema =
  z.object({
    action:
      z.literal(
        "begin",
      ),

    conversationId:
      z.string()
        .min(1)
        .optional(),

    proposedConversationId:
      z.string()
        .min(1),

    idempotencyKey:
      z.string()
        .min(1),

    modelId:
      z.enum([
        "mabojolu-fast",
        "mabojolu-regular",
        "mabojolu-local",
      ])
        .default(
          "mabojolu-fast",
        ),

    userMessage:
      z.object({
        id:
          z.string()
            .min(1),

        content:
          z.string(),

        createdAt:
          z.string()
            .min(1),
      }),
  });

const settleSchema =
  z.object({
    action:
      z.literal(
        "settle",
      ),

    conversationId:
      z.string()
        .min(1),

    assistantMessageId:
      z.string()
        .min(1),

    content:
      z.string(),

    status:
      z.enum([
        "complete",
        "interrupted",
        "failed",
      ]),

    errorCode:
      z.string()
        .min(1)
        .optional(),
  });

const requestSchema =
  z.discriminatedUnion(
    "action",
    [
      beginSchema,
      settleSchema,
    ],
  );

/**
 * Persistence control plane for browser-owned inference.
 *
 * No language model is called from this endpoint.
 *
 * begin:
 * - authenticates the user
 * - creates or verifies the conversation
 * - persists the user turn
 * - creates an assistant placeholder
 *
 * settle:
 * - finalizes the assistant placeholder after browser/WebGPU inference
 *
 * This preserves Mabojolu conversation history and feedback IDs while keeping
 * the expensive inference computation on the user's device.
 */
export async function POST(
  request:
    NextRequest,
):
  Promise<Response> {
  try {
    const session =
      await getSession();

    if (
      !session
    ) {
      return errorResponse(
        chatError(
          "unauthorized",
        ),
      );
    }

    let raw:
      unknown;

    try {
      raw =
        await request.json();
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That browser-compute request could not be read.",
          },
        ),
      );
    }

    const parsed =
      requestSchema
        .safeParse(
          raw,
        );

    if (
      !parsed.success
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That browser-compute request is invalid.",
          },
        ),
      );
    }

    const database =
      getDatabase();

    if (
      parsed.data
        .action ===
      "settle"
    ) {
      const conversation =
        await database
          .getConversation(
            parsed.data
              .conversationId,

            session.userId,
          );

      if (
        !conversation
      ) {
        return errorResponse(
          chatError(
            "not_found",
          ),
        );
      }

      const updated =
        await database
          .updateMessage(
            parsed.data
              .assistantMessageId,

            session.userId,

            {
              content:
                parsed.data
                  .content,

              status:
                parsed.data
                  .status,

              ...(parsed.data
                  .errorCode
                ? {
                    errorCode:
                      parsed.data
                        .errorCode,
                  }
                : {}),
            },
          );

      if (
        !updated
      ) {
        return errorResponse(
          chatError(
            "not_found",
          ),
        );
      }

      await database
        .touchConversation(
          parsed.data
            .conversationId,

          session.userId,
        );

      return Response.json({
        ok: true,
      });
    }

    const runtimeConfig =
      usageRuntimeConfig();

    const usage =
      await checkUsageLimits(
        session,
        {
          enforceProviderCostCeiling:
            false,
        },
      );

    if (
      !usage.allowed
    ) {
      return errorResponse(
        usage.error ??
          chatError(
            "rate_limited",
          ),
      );
    }

    const limit =
      getRateLimiter({
        name:
          "browser-chat-persistence",

        max:
          runtimeConfig
            .rateLimitMax,

        windowMs:
          runtimeConfig
            .rateLimitWindowMs,
      }).check(
        rateLimitIdentity({
          userId:
            session.userId,

          headers:
            request.headers,
        }),
      );

    if (
      !limit.allowed
    ) {
      return errorResponse(
        chatError(
          "rate_limited",
          {
            retryAfterSeconds:
              limit
                .retryAfterSeconds,
          },
        ),
      );
    }

    const {
      conversationId:
        suppliedConversationId,

      proposedConversationId,

      idempotencyKey,

      modelId,

      userMessage,
    } = parsed.data;

    let conversationId =
      suppliedConversationId ??
      proposedConversationId;

    const existing =
      await database
        .getConversation(
          conversationId,
          session.userId,
        );

    if (
      suppliedConversationId &&
      !existing
    ) {
      return errorResponse(
        chatError(
          "not_found",
        ),
      );
    }

    if (
      !existing
    ) {
      const created =
        await database
          .createConversation({
            id:
              proposedConversationId,

            userId:
              session.userId,

            title:
              generateConversationTitle(
                userMessage
                  .content
                  .trim()
                  .length >
                  0
                  ? userMessage
                      .content
                  : "Attachment",
              ),
          });

      conversationId =
        created.id;
    }

    await database
      .appendMessage({
        conversationId,

        userId:
          session.userId,

        role:
          "user",

        content:
          userMessage
            .content,

        status:
          "complete",

        clientId:
          userMessage.id,
      });

    const assistant =
      await database
        .appendMessage({
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
            modelId ===
              "mabojolu-fast"
              ? "mabojolu-browser-fast"
              : modelId ===
                  "mabojolu-regular"
                ? "mabojolu-browser-regular"
                : "mabojolu-browser-quality",

          promptVersion:
            "browser-webgpu-v0.2",

          clientId:
            idempotencyKey +
            "-assistant",
        });

    return Response.json(
      {
        conversationId,

        messageId:
          assistant.id,

        model:
          modelId ===
            "mabojolu-fast"
            ? "mabojolu-browser-fast"
            : modelId ===
                "mabojolu-regular"
              ? "mabojolu-browser-regular"
              : "mabojolu-browser-quality",
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (
    cause
  ) {
    const error =
      normalizeError(
        cause,
      );

    logChatError(
      error,
      {
        route:
          "POST /api/chat/browser",
      },
    );

    return errorResponse(
      error,
    );
  }
}

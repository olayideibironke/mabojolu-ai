import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { startGeneration } from "@/lib/ai/gateway";
import { estimateCostUsd, findModel } from "@/lib/ai/models";
import { createChatStream, errorResponse } from "@/lib/ai/stream";
import { generateConversationTitle } from "@/lib/ai/title";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { inspectServerEnv } from "@/lib/env";
import { beginGeneration, checkUsageLimits } from "@/lib/security/limits";
import { getRateLimiter, rateLimitIdentity } from "@/lib/security/rate-limit";
import { chatRequestSchema, parseJsonBody } from "@/lib/validation/chat";
import type { ChatMessage } from "@/types/chat";

/**
 * Chat completion endpoint.
 *
 * The order of operations matters, and it is deliberate: authenticate, rate limit,
 * validate, check quotas, verify conversation ownership, and only then contact a
 * provider. Every gate that can reject a request cheaply runs before the one
 * expensive step, so abuse and mistakes cost nothing.
 *
 * A Route Handler rather than a Server Action, because the response is a
 * long-lived SSE stream that must be abortable mid-flight.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reject an oversized body before parsing it. */
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: NextRequest): Promise<Response> {
  // Declared here so the finally block can release the concurrency slot on every
  // exit path. Leaking a slot would lock a user out of their own account.
  let releaseGeneration: (() => void) | null = null;

  try {
    const envResult = inspectServerEnv();
    if (!envResult.ok) {
      console.error(
        "[mabojolu] invalid environment",
        envResult.issues.join("; "),
      );
      return errorResponse(chatError("provider_not_configured"));
    }
    const env = envResult.env;

    // 1. Identity first: everything downstream is scoped to a user.
    const session = await getSession();
    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const declaredLength = request.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
      return errorResponse(
        chatError("message_too_long", {
          message: "That request is too large. Please shorten your message.",
        }),
      );
    }

    // 2. Burst rate limit, keyed to the authenticated user so it cannot be
    //    sidestepped by rotating a header.
    const limit = getRateLimiter({
      name: "chat",
      max: env.MABOJOLU_RATE_LIMIT_MAX,
      windowMs: env.MABOJOLU_RATE_LIMIT_WINDOW_MS,
    }).check(rateLimitIdentity({ userId: session.userId, headers: request.headers }));

    if (!limit.allowed) {
      return errorResponse(
        chatError("rate_limited", { retryAfterSeconds: limit.retryAfterSeconds }),
      );
    }

    // 3. Shape validation.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(
        chatError("invalid_request", {
          message: "That request could not be read. Please try again.",
        }),
      );
    }

    const parsed = parseJsonBody(chatRequestSchema, rawBody);
    if (!parsed.ok) {
      return errorResponse(
        chatError("invalid_request", { message: parsed.message }),
      );
    }

    const body = parsed.data;
    const lastMessage = body.messages.at(-1);

    if (!lastMessage) {
      return errorResponse(chatError("invalid_request"));
    }
    if (lastMessage.content.length > env.MABOJOLU_MAX_MESSAGE_CHARS) {
      return errorResponse(chatError("message_too_long"));
    }
    if (body.messages.length > env.MABOJOLU_MAX_CONVERSATION_MESSAGES) {
      return errorResponse(chatError("conversation_too_long"));
    }

    // 4. Sustained quotas, spend ceiling, concurrency, maintenance mode.
    const usageDecision = await checkUsageLimits(session.userId);
    if (!usageDecision.allowed && usageDecision.error) {
      return errorResponse(usageDecision.error);
    }

    const database = getDatabase();

    // 5. Resolve the conversation, creating one on the first message so opening a
    //    chat is a single round trip.
    let conversationId = body.conversationId;

    if (conversationId) {
      // Ownership check. `getConversation` filters by user id, so a conversation
      // belonging to someone else is indistinguishable from one that does not
      // exist, which is the correct answer to give.
      const existing = await database.getConversation(
        conversationId,
        session.userId,
      );

      if (!existing) {
        return errorResponse(chatError("not_found"));
      }
    } else {
      const created = await database.createConversation({
        userId: session.userId,
        title: generateConversationTitle(lastMessage.content),
      });
      conversationId = created.id;
    }

    // 6. Persist the user turn before generating, so a provider failure cannot
    //    lose what the user typed. Idempotent on the client id, so a retry does
    //    not duplicate it.
    await database.appendMessage({
      conversationId,
      userId: session.userId,
      role: "user",
      content: lastMessage.content,
      status: "complete",
      clientId: lastMessage.id,
    });

    // 7. Normalize for the gateway. Client-supplied status and model are ignored:
    //    the server decides both.
    const messages: ChatMessage[] = body.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status: "complete",
      createdAt: message.createdAt ?? new Date().toISOString(),
    }));

    const generation = startGeneration({
      messages,
      modelId: body.modelId,
      // Aborts when the browser disconnects, so an abandoned tab stops generating
      // rather than running to completion for nobody.
      signal: request.signal,
      idempotencyKey: body.idempotencyKey,
    });

    // 8. Create the assistant row up front, so a stopped or failed generation has
    //    an existing row to settle into rather than vanishing.
    const assistantMessage = await database.appendMessage({
      conversationId,
      userId: session.userId,
      role: "assistant",
      content: "",
      status: "streaming",
      model: generation.model.id,
      promptVersion: generation.promptVersion,
      // Derived from the request's key so a retry updates the same row.
      clientId: body.idempotencyKey
        ? `${body.idempotencyKey}-assistant`
        : undefined,
    });

    releaseGeneration = beginGeneration(session.userId);
    const release = releaseGeneration;
    const settledConversationId = conversationId;

    return createChatStream({
      messageId: assistantMessage.id,
      model: generation.model.id,
      // Tells the client which conversation this belongs to, which matters most on
      // the first message, where the server just created it.
      conversationId,
      chunks: generation.chunks,
      signal: request.signal,
      logContext: {
        model: generation.model.id,
        promptVersion: generation.promptVersion,
        droppedMessages: generation.droppedMessages,
      },
      onSettled: async ({ text, finishReason, usage }) => {
        try {
          // Map the provider outcome onto a message status. `aborted` becomes
          // `interrupted`, which is a legitimate state rather than a failure, and
          // the partial text is kept.
          const status =
            finishReason === "aborted"
              ? "interrupted"
              : finishReason === "error" || finishReason === "refusal"
                ? "failed"
                : "complete";

          await database.updateMessage(assistantMessage.id, session.userId, {
            content: text,
            status,
            ...(usage ? { usage } : {}),
            // Empty string clears a stale error when a retry succeeds.
            errorCode:
              status === "failed"
                ? finishReason === "refusal"
                  ? "provider_refused"
                  : "internal_error"
                : "",
          });

          if (usage) {
            const model = findModel(generation.model.id);

            await database.recordUsage({
              userId: session.userId,
              conversationId: settledConversationId,
              provider: generation.model.providerId,
              model: generation.model.id,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              estimatedCostUsd: model ? estimateCostUsd(model, usage) : 0,
              finishReason,
            });
          }

          // A refusal is a safety-relevant outcome worth recording. Only the code
          // is stored, never the prompt that triggered it.
          if (finishReason === "refusal") {
            await database.recordSafetyEvent({
              userId: session.userId,
              conversationId: settledConversationId,
              kind: "provider_refusal",
              severity: "warning",
              detail: `Model ${generation.model.id} declined to answer.`,
            });
          }
        } finally {
          // Always release, even if persistence threw, or the slot leaks.
          release();
        }
      },
    });
  } catch (cause) {
    // The stream owns the release once it starts. Reaching here means it never
    // did, so release now.
    releaseGeneration?.();

    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/chat" });
    return errorResponse(error);
  }
}

/** Explicit 405, so an accidental GET gets a clear answer rather than a 404. */
export function GET(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: "invalid_request",
        message: "This endpoint accepts POST requests only.",
        retryable: false,
      },
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
    },
  );
}

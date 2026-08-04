import type { NextRequest } from "next/server";

import { startGeneration } from "@/lib/ai/gateway";
import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { createChatStream, errorResponse } from "@/lib/ai/stream";
import { inspectServerEnv } from "@/lib/env";
import { getRateLimiter, rateLimitIdentity } from "@/lib/security/rate-limit";
import { chatRequestSchema, parseJsonBody } from "@/lib/validation/chat";
import type { ChatMessage } from "@/types/chat";

/**
 * Chat completion endpoint.
 *
 * A Route Handler rather than a Server Action: the response is a long-lived
 * SSE stream that must be abortable mid-flight, which Server Actions do not
 * model. The handler stays thin, with all provider work behind the gateway.
 *
 * Node runtime, because the provider SDK and (later) the Supabase server client
 * need Node APIs.
 */
export const runtime = "nodejs";
/** Never cached: every response is user-specific and streamed. */
export const dynamic = "force-dynamic";

/** Refuse a body large enough to be an abuse vector before parsing it. */
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: NextRequest): Promise<Response> {
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

    const declaredLength = request.headers.get("content-length");
    if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
      return errorResponse(
        chatError("message_too_long", {
          message: "That request is too large. Please shorten your message.",
        }),
      );
    }

    // Rate limit before doing any provider work, so a flood costs us nothing.
    // Anonymous traffic is keyed by client address; once authentication lands
    // in Phase 3 the user id becomes the identity.
    const identity = rateLimitIdentity({ headers: request.headers });
    const limit = getRateLimiter({
      name: "chat",
      max: env.MABOJOLU_RATE_LIMIT_MAX,
      windowMs: env.MABOJOLU_RATE_LIMIT_WINDOW_MS,
    }).check(identity);

    if (!limit.allowed) {
      return errorResponse(
        chatError("rate_limited", {
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
      );
    }

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

    // Enforce the configured limits, which may be tighter than the schema's
    // static defaults.
    const lastMessage = body.messages.at(-1);
    if (lastMessage && lastMessage.content.length > env.MABOJOLU_MAX_MESSAGE_CHARS) {
      return errorResponse(chatError("message_too_long"));
    }
    if (body.messages.length > env.MABOJOLU_MAX_CONVERSATION_MESSAGES) {
      return errorResponse(chatError("conversation_too_long"));
    }

    // Normalize into the internal shape. Client-supplied status and model are
    // ignored: the server decides both.
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
      // Aborts when the browser disconnects, so an abandoned tab stops
      // generating instead of running to completion and billing for output
      // nobody will read.
      signal: request.signal,
      idempotencyKey: body.idempotencyKey,
    });

    return createChatStream({
      // Correlates the streamed reply with the placeholder the client rendered.
      messageId: `${lastMessage?.id ?? "message"}-reply`,
      model: generation.model.id,
      chunks: generation.chunks,
      signal: request.signal,
      logContext: {
        model: generation.model.id,
        promptVersion: generation.promptVersion,
        droppedMessages: generation.droppedMessages,
      },
    });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/chat" });
    return errorResponse(error);
  }
}

/** Explicit 405 so an accidental GET gets a clear answer rather than a 404. */
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

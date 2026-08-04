import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { feedbackSchema, parseJsonBody } from "@/lib/validation/chat";

/**
 * Message feedback.
 *
 * Real persistence rather than a UI-only toggle. A thumb that only animates would
 * be a decorative control, and the point of feedback is that someone can act on
 * it.
 *
 * Sending the same rating twice clears it, so a mis-click is reversible.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(
        chatError("invalid_request", {
          message: "That request could not be read.",
        }),
      );
    }

    const parsed = parseJsonBody(feedbackSchema, rawBody);

    if (!parsed.ok) {
      return errorResponse(
        chatError("invalid_request", { message: parsed.message }),
      );
    }

    const database = getDatabase();
    const { messageId, rating, note } = parsed.data;

    // The adapter scopes this by user id, so feedback cannot be attached to
    // another account's message.
    const stored = await database.setFeedback(
      messageId,
      session.userId,
      rating,
      note,
    );

    if (!stored) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json({ ok: true });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/feedback" });
    return errorResponse(error);
  }
}

/** Clear feedback on a message. */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const messageId = request.nextUrl.searchParams.get("messageId");

    if (!messageId) {
      return errorResponse(
        chatError("invalid_request", { message: "A message id is required." }),
      );
    }

    const cleared = await getDatabase().setFeedback(
      messageId,
      session.userId,
      null,
    );

    if (!cleared) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json({ ok: true });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "DELETE /api/feedback" });
    return errorResponse(error);
  }
}

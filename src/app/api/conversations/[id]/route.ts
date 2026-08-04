import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { conversationRenameSchema, parseJsonBody } from "@/lib/validation/chat";

/**
 * A single conversation: read, rename, delete.
 *
 * Every handler passes the session's user id into the query, so an id alone is
 * never enough to reach a conversation. A conversation belonging to someone else
 * returns `not_found` rather than `forbidden`, so the API does not confirm that a
 * given id exists to a user who has no right to know.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  // Written as an explicit promise type rather than the generated
  // `RouteContext<"...">` helper: those types are emitted during dev, build, or
  // `next typegen`, so a route referencing its own path fails to typecheck until
  // after the first build. `params` is a promise in the App Router.
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const { id } = await context.params;
    const conversation = await getDatabase().getConversation(id, session.userId);

    if (!conversation) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json(
      { conversation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "GET /api/conversations/[id]" });
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  // Written as an explicit promise type rather than the generated
  // `RouteContext<"...">` helper: those types are emitted during dev, build, or
  // `next typegen`, so a route referencing its own path fails to typecheck until
  // after the first build. `params` is a promise in the App Router.
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const { id } = await context.params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(
        chatError("invalid_request", { message: "That request could not be read." }),
      );
    }

    const parsed = parseJsonBody(conversationRenameSchema, rawBody);

    if (!parsed.ok) {
      return errorResponse(
        chatError("invalid_request", { message: parsed.message }),
      );
    }

    const renamed = await getDatabase().renameConversation(
      id,
      session.userId,
      parsed.data.title,
    );

    if (!renamed) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json({ ok: true, title: parsed.data.title });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "PATCH /api/conversations/[id]" });
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  // Written as an explicit promise type rather than the generated
  // `RouteContext<"...">` helper: those types are emitted during dev, build, or
  // `next typegen`, so a route referencing its own path fails to typecheck until
  // after the first build. `params` is a promise in the App Router.
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const { id } = await context.params;
    const deleted = await getDatabase().deleteConversation(id, session.userId);

    if (!deleted) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json({ ok: true });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "DELETE /api/conversations/[id]" });
    return errorResponse(error);
  }
}

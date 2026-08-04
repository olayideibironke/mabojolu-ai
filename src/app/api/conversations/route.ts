import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

/**
 * Conversation list.
 *
 * GET returns the signed-in user's conversations, optionally filtered by a search
 * term. Ownership is not a query parameter: it comes from the verified session, so
 * a client cannot ask for someone else's list.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const search = request.nextUrl.searchParams.get("search") ?? undefined;

    // Bound the search term. An unbounded string becomes a needlessly expensive
    // pattern match.
    if (search && search.length > 200) {
      return errorResponse(
        chatError("invalid_request", { message: "Search term is too long." }),
      );
    }

    const conversations = await getDatabase().listConversations(session.userId, {
      search,
      limit: 100,
    });

    return Response.json(
      { conversations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "GET /api/conversations" });
    return errorResponse(error);
  }
}

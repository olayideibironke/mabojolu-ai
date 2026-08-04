import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { getStorage } from "@/lib/attachments/storage";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

/**
 * Attachment download, for local development.
 *
 * In a Supabase deployment a signed URL serves the file directly from storage. In
 * local development there is no signing key, so this authenticated route stands in
 * and performs the ownership check itself.
 *
 * The path is attacker-controlled input, so it is never used to read from disk
 * directly. Instead the requested path is matched against a row the session
 * actually owns; only a path that appears in the caller's own records is served.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const requestedPath = request.nextUrl.searchParams.get("path");

    if (!requestedPath) {
      return errorResponse(
        chatError("invalid_request", { message: "A path is required." }),
      );
    }

    /*
     * Ownership by prefix, then by record.
     *
     * The prefix test is a fast reject; the record lookup is the real control,
     * because it proves the path belongs to a row this user owns rather than
     * merely looking like it does.
     */
    if (!requestedPath.startsWith(`${session.userId}/`)) {
      return errorResponse(chatError("not_found"));
    }

    // The conversation id is the second path segment.
    const segments = requestedPath.split("/");
    const conversationId = segments[1];

    if (!conversationId) {
      return errorResponse(chatError("not_found"));
    }

    const attachments = await getDatabase().listAttachments(
      conversationId,
      session.userId,
    );

    const record = attachments.find(
      (attachment) => attachment.storagePath === requestedPath,
    );

    // No matching row means either the file is not theirs or it does not exist.
    // Both answer the same way, so this cannot be used to probe for paths.
    if (!record) {
      return errorResponse(chatError("not_found"));
    }

    const bytes = await getStorage().get(requestedPath);

    if (!bytes) {
      return errorResponse(chatError("not_found"));
    }

    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": record.mimeType,
        // `attachment` rather than `inline`: forcing a download means a file the
        // browser might render, such as an image or HTML-like text, cannot execute
        // in this origin's context.
        "Content-Disposition": `attachment; filename="${record.filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        // Defence in depth against content-type confusion on download.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "GET /api/attachments/content" });
    return errorResponse(error);
  }
}

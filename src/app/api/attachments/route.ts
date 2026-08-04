import type { NextRequest } from "next/server";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import {
  buildStoragePath,
  validateAttachment,
} from "@/lib/attachments/validation";
import { getStorage } from "@/lib/attachments/storage";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { serverEnv } from "@/lib/env";
import { getRateLimiter, rateLimitIdentity } from "@/lib/security/rate-limit";

/**
 * Attachment upload.
 *
 * Disabled unless `MABOJOLU_ATTACHMENTS_ENABLED=true`. The architecture and its
 * tests are complete, but enabling broad upload access should be a deliberate
 * decision taken after the storage controls have been verified against a real
 * project, rather than something that happens by default.
 *
 * Order of checks: feature flag, session, rate limit, size, ownership, then
 * content validation. Each cheap gate runs before the expensive one, so a rejected
 * upload never reaches storage.
 *
 * A stored attachment is created as `uploaded`, never `ready`. Nothing treats a
 * file as readable by the model until processing has actually succeeded, so the
 * assistant cannot claim to have understood a document it has not read.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const env = serverEnv();

    if (!env.MABOJOLU_ATTACHMENTS_ENABLED) {
      return errorResponse(
        chatError("invalid_request", {
          message:
            "File attachments are not enabled on this installation of Mabojolu.",
        }),
      );
    }

    const session = await getSession();
    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    // Tighter than the chat limit: an upload costs storage and processing, so a
    // burst is more expensive than a burst of messages.
    const limit = getRateLimiter({
      name: "attachment-upload",
      max: 10,
      windowMs: 60_000,
    }).check(rateLimitIdentity({ userId: session.userId, headers: request.headers }));

    if (!limit.allowed) {
      return errorResponse(
        chatError("rate_limited", {
          message: "Too many uploads. Please wait a moment and try again.",
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
      );
    }

    // Reject an oversized body from its declared length, before reading it into
    // memory. Waiting until after the read would let a large upload consume
    // memory regardless.
    const declaredLength = request.headers.get("content-length");
    if (
      declaredLength &&
      Number(declaredLength) > env.MABOJOLU_MAX_ATTACHMENT_BYTES + 8_192
    ) {
      const limitMb = Math.floor(env.MABOJOLU_MAX_ATTACHMENT_BYTES / 1_048_576);
      return errorResponse(
        chatError("message_too_long", {
          message: `That file is larger than the ${limitMb} MB limit.`,
        }),
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse(
        chatError("invalid_request", {
          message: "That upload could not be read.",
        }),
      );
    }

    const file = form.get("file");
    const conversationId = form.get("conversationId");

    if (!(file instanceof File)) {
      return errorResponse(
        chatError("invalid_request", { message: "No file was provided." }),
      );
    }
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return errorResponse(
        chatError("invalid_request", {
          message: "A conversation is required for an attachment.",
        }),
      );
    }

    const database = getDatabase();

    // Ownership before any storage work. `getConversation` filters by user id, so
    // a conversation belonging to someone else is indistinguishable from one that
    // does not exist.
    const conversation = await database.getConversation(
      conversationId,
      session.userId,
    );

    if (!conversation) {
      return errorResponse(chatError("not_found"));
    }

    // Read enough bytes to check the signature. WebP needs 12.
    const bytes = new Uint8Array(await file.arrayBuffer());

    const validation = validateAttachment({
      filename: file.name,
      declaredMimeType: file.type,
      sizeBytes: bytes.byteLength,
      header: bytes.subarray(0, 16),
      maxBytes: env.MABOJOLU_MAX_ATTACHMENT_BYTES,
    });

    if (!validation.ok || !validation.safeFilename || !validation.format) {
      // Recorded as a safety event: a mismatch between a declared type and actual
      // contents may be an attempt to smuggle a payload past the allowlist. Only
      // the failure kind is stored, never the file.
      await database.recordSafetyEvent({
        userId: session.userId,
        conversationId,
        kind: "attachment_rejected",
        severity:
          validation.failure === "content_mismatch" ? "warning" : "info",
        detail: `Rejected upload: ${validation.failure}.`,
      });

      return errorResponse(
        chatError("invalid_request", {
          message: validation.message ?? "That file could not be accepted.",
        }),
      );
    }

    // Quota check, mirroring the database trigger. Two layers, so a bug in one
    // cannot let a user exceed their allowance.
    const existing = await database.listAttachments(conversationId, session.userId);
    if (existing.length >= env.MABOJOLU_MAX_ATTACHMENTS_PER_USER) {
      return errorResponse(
        chatError("invalid_request", {
          message: "You have reached the attachment limit for this conversation.",
        }),
      );
    }

    /*
     * The row is created first, so its id can form part of the storage path and no
     * stored object exists without a row describing it.
     *
     * The placeholder path is namespaced and unique rather than a bare literal:
     * the column is unique, so two concurrent uploads sharing one placeholder
     * would collide, and a distinctive value makes a row that never completed
     * obvious rather than looking like a real path.
     */
    const record = await database.createAttachment({
      userId: session.userId,
      conversationId,
      filename: validation.safeFilename,
      mimeType: validation.format.mimeType,
      sizeBytes: bytes.byteLength,
      storagePath: `pending/${session.userId}/${crypto.randomUUID()}`,
    });

    const storagePath = buildStoragePath({
      userId: session.userId,
      conversationId,
      attachmentId: record.id,
      safeFilename: validation.safeFilename,
    });

    try {
      await getStorage().put(storagePath, bytes, validation.format.mimeType);
    } catch (cause) {
      // Mark the row failed rather than leaving it stuck at `pending`, so the UI
      // can explain rather than showing a file that never arrives.
      await database.updateAttachmentStatus(record.id, session.userId, "failed", {
        failureReason: "Upload to storage failed.",
      });

      logChatError(normalizeError(cause), { stage: "attachment_put" });

      return errorResponse(
        chatError("internal_error", {
          message: "That file could not be stored. Please try again.",
        }),
      );
    }

    /*
     * Marked `uploaded`, deliberately not `ready`.
     *
     * The bytes are stored and validated, but no text has been extracted, so the
     * model cannot read this file yet. Only a successful processing step advances
     * it to `ready`, which is what keeps the assistant from claiming to have read
     * something it has not.
     *
     * The real storage path is recorded here, after the object exists. Writing it
     * earlier would leave a row pointing at bytes that had not been stored yet.
     */
    await database.updateAttachmentStatus(record.id, session.userId, "uploaded", {
      storagePath,
    });

    return Response.json({
      attachment: {
        id: record.id,
        filename: validation.safeFilename,
        mimeType: validation.format.mimeType,
        sizeBytes: bytes.byteLength,
        status: "uploaded",
      },
      // Stated plainly, so the client does not present the file as usable.
      note:
        "The file is stored and validated. Document processing is not enabled yet, so Mabojolu cannot read its contents.",
    });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/attachments" });
    return errorResponse(error);
  }
}

/** List the attachments on a conversation. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const conversationId = request.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return errorResponse(
        chatError("invalid_request", { message: "A conversation id is required." }),
      );
    }

    const attachments = await getDatabase().listAttachments(
      conversationId,
      session.userId,
    );

    return Response.json({ attachments });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "GET /api/attachments" });
    return errorResponse(error);
  }
}

/** Delete an attachment, honouring the documented right to remove uploads. */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse(chatError("unauthorized"));
    }

    const attachmentId = request.nextUrl.searchParams.get("id");

    if (!attachmentId) {
      return errorResponse(
        chatError("invalid_request", { message: "An attachment id is required." }),
      );
    }

    const deleted = await getDatabase().deleteAttachment(
      attachmentId,
      session.userId,
    );

    if (!deleted) {
      return errorResponse(chatError("not_found"));
    }

    return Response.json({ ok: true });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "DELETE /api/attachments" });
    return errorResponse(error);
  }
}

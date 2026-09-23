import type {
  NextRequest,
} from "next/server";

import {
  chatError,
  logChatError,
  normalizeError,
} from "@/lib/ai/errors";
import {
  attachmentEvidenceSidecarPath,
  decodeMultimodalEvidence,
  encodeMultimodalEvidence,
  processAttachmentBytesWithLocalRuntime,
} from "@/lib/attachments/analysis";
import {
  getStorage,
} from "@/lib/attachments/storage";
import {
  getSession,
} from "@/lib/auth/session";
import {
  getDatabase,
} from "@/lib/database";
import {
  errorResponse,
} from "@/lib/ai/stream";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function attachmentIdFromRequest(
  request:
    NextRequest,
): string | null {
  return request
    .nextUrl
    .searchParams
    .get(
      "id",
    );
}

export async function GET(
  request:
    NextRequest,
): Promise<Response> {
  try {
    const session =
      await getSession();

    if (!session) {
      return errorResponse(
        chatError(
          "unauthorized",
        ),
      );
    }

    const attachmentId =
      attachmentIdFromRequest(
        request,
      );

    if (!attachmentId) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "An attachment id is required.",
          },
        ),
      );
    }

    const database =
      getDatabase();

    const record =
      await database
        .getAttachment(
          attachmentId,
          session.userId,
        );

    if (!record) {
      return errorResponse(
        chatError(
          "not_found",
        ),
      );
    }

    if (
      record.status !==
        "ready"
    ) {
      return Response.json(
        {
          attachment: {
            id:
              record.id,

            status:
              record.status,

            failureReason:
              record
                .failureReason,
          },
        },
        {
          status:
            record.status ===
              "failed"
              ? 422
              : 202,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const sidecarPath =
      attachmentEvidenceSidecarPath(
        record.storagePath,
      );

    const bytes =
      await getStorage().get(
        sidecarPath,
      );

    if (!bytes) {
      return errorResponse(
        chatError(
          "internal_error",
          {
            message:
              "The attachment is marked ready, but its analysis evidence is missing.",
          },
        ),
      );
    }

    const evidence =
      decodeMultimodalEvidence(
        bytes,
      );

    if (!evidence) {
      return errorResponse(
        chatError(
          "internal_error",
          {
            message:
              "The attachment analysis evidence is invalid.",
          },
        ),
      );
    }

    return Response.json(
      {
        attachment: {
          id:
            record.id,

          filename:
            record.filename,

          mimeType:
            record.mimeType,

          status:
            record.status,
        },

        evidence,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (cause) {
    const error =
      normalizeError(
        cause,
      );

    logChatError(
      error,
      {
        route:
          "GET /api/attachments/process",
      },
    );

    return errorResponse(
      error,
    );
  }
}

export async function POST(
  request:
    NextRequest,
): Promise<Response> {
  try {
    const session =
      await getSession();

    if (!session) {
      return errorResponse(
        chatError(
          "unauthorized",
        ),
      );
    }

    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That processing request could not be read.",
          },
        ),
      );
    }

    if (
      typeof rawBody !==
        "object" ||
      rawBody ===
        null ||
      !(
        "attachmentId" in
        rawBody
      ) ||
      typeof (
        rawBody as {
          attachmentId?:
            unknown;
        }
      )
        .attachmentId !==
        "string"
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "An attachment id is required.",
          },
        ),
      );
    }

    const attachmentId =
      (
        rawBody as {
          attachmentId:
            string;
        }
      )
        .attachmentId
        .trim();

    if (
      attachmentId.length ===
        0
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "An attachment id is required.",
          },
        ),
      );
    }

    const database =
      getDatabase();

    const record =
      await database
        .getAttachment(
          attachmentId,
          session.userId,
        );

    if (!record) {
      return errorResponse(
        chatError(
          "not_found",
        ),
      );
    }

    if (
      record.status ===
        "pending"
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "The attachment upload has not completed yet.",
          },
        ),
      );
    }

    if (
      record.status ===
        "processing"
    ) {
      return Response.json(
        {
          attachment: {
            id:
              record.id,

            status:
              "processing",
          },
        },
        {
          status:
            202,
        },
      );
    }

    const storage =
      getStorage();

    if (
      record.status ===
        "ready"
    ) {
      const existingBytes =
        await storage.get(
          attachmentEvidenceSidecarPath(
            record.storagePath,
          ),
        );

      const existingEvidence =
        existingBytes
          ? decodeMultimodalEvidence(
              existingBytes,
            )
          : undefined;

      if (
        existingEvidence
      ) {
        return Response.json(
          {
            attachment: {
              id:
                record.id,

              filename:
                record.filename,

              mimeType:
                record.mimeType,

              status:
                "ready",
            },

            evidence:
              existingEvidence,
          },
          {
            headers: {
              "Cache-Control":
                "private, no-store",
            },
          },
        );
      }
    }

    const sourceBytes =
      await storage.get(
        record.storagePath,
      );

    if (!sourceBytes) {
      await database
        .updateAttachmentStatus(
          record.id,
          session.userId,
          "failed",
          {
            failureReason:
              "Stored attachment bytes are missing.",
          },
        );

      return errorResponse(
        chatError(
          "not_found",
          {
            message:
              "The stored attachment could not be found.",
          },
        ),
      );
    }

    await database
      .updateAttachmentStatus(
        record.id,
        session.userId,
        "processing",
      );

    const processed =
      await processAttachmentBytesWithLocalRuntime(
        {
          attachmentId:
            record.id,

          filename:
            record.filename,

          mimeType:
            record.mimeType,

          bytes:
            sourceBytes,
        },
      );

    if (!processed.ok) {
      await database
        .updateAttachmentStatus(
          record.id,
          session.userId,
          "failed",
          {
            failureReason:
              processed
                .message,
          },
        );

      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              processed
                .message,
          },
        ),
      );
    }

    const sidecarPath =
      attachmentEvidenceSidecarPath(
        record.storagePath,
      );

    try {
      await storage.put(
        sidecarPath,
        encodeMultimodalEvidence(
          processed
            .evidence,
        ),
        "application/json",
      );
    } catch (cause) {
      await database
        .updateAttachmentStatus(
          record.id,
          session.userId,
          "failed",
          {
            failureReason:
              "Attachment analysis evidence could not be stored.",
          },
        );

      throw cause;
    }

    await database
      .updateAttachmentStatus(
        record.id,
        session.userId,
        "ready",
      );

    return Response.json(
      {
        attachment: {
          id:
            record.id,

          filename:
            record.filename,

          mimeType:
            record.mimeType,

          status:
            "ready",
        },

        evidence:
          processed
            .evidence,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  } catch (cause) {
    const error =
      normalizeError(
        cause,
      );

    logChatError(
      error,
      {
        route:
          "POST /api/attachments/process",
      },
    );

    return errorResponse(
      error,
    );
  }
}

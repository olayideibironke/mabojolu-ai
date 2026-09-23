import type {
  NextRequest,
} from "next/server";

import {
  chatError,
  logChatError,
  normalizeError,
} from "@/lib/ai/errors";
import {
  processAttachmentBytesWithLocalRuntime,
} from "@/lib/attachments/analysis";
import {
  validateAttachment,
} from "@/lib/attachments/validation";
import {
  errorResponse,
} from "@/lib/ai/stream";
import {
  getSession,
} from "@/lib/auth/session";
import {
  serverEnv,
} from "@/lib/env";
import {
  getRateLimiter,
  rateLimitIdentity,
} from "@/lib/security/rate-limit";
import {
  MAX_CHAT_DOCUMENT_TEXT_CHARS,
  MAX_CHAT_IMAGE_ATTACHMENTS,
} from "@/lib/validation/chat";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function isMediaMimeType(
  mimeType:
    string,
): boolean {
  return (
    mimeType.startsWith(
      "audio/",
    ) ||
    mimeType.startsWith(
      "video/",
    )
  );
}

function decodedBase64Bytes(
  base64:
    string,
): number {
  const padding =
    base64.endsWith(
      "==",
    )
      ? 2
      : base64.endsWith(
            "=",
          )
        ? 1
        : 0;

  return Math.max(
    0,
    Math.floor(
      (
        base64.length *
        3
      ) /
        4 -
        padding,
    ),
  );
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

    const env =
      serverEnv();

    const absoluteBodyLimit =
      Math.max(
        env
          .MABOJOLU_MAX_ATTACHMENT_BYTES,
        env
          .MABOJOLU_MAX_MEDIA_ATTACHMENT_BYTES,
      ) +
      16_384;

    const declaredLength =
      request.headers.get(
        "content-length",
      );

    if (
      declaredLength &&
      Number(
        declaredLength,
      ) >
        absoluteBodyLimit
    ) {
      return errorResponse(
        chatError(
          "message_too_long",
          {
            message:
              "That file is larger than Mabojolu's configured local analysis limit.",
          },
        ),
      );
    }

    const limit =
      getRateLimiter({
        name:
          "transient-multimodal-analysis",

        max:
          8,

        windowMs:
          60_000,
      }).check(
        rateLimitIdentity({
          userId:
            session.userId,

          headers:
            request.headers,
        }),
      );

    if (!limit.allowed) {
      return errorResponse(
        chatError(
          "rate_limited",
          {
            message:
              "Too many file-analysis requests. Please wait a moment and try again.",

            retryAfterSeconds:
              limit
                .retryAfterSeconds,
          },
        ),
      );
    }

    let form:
      FormData;

    try {
      form =
        await request
          .formData();
    } catch {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "That file could not be read.",
          },
        ),
      );
    }

    const file =
      form.get(
        "file",
      );

    if (
      !(
        file instanceof
        File
      )
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "No file was provided.",
          },
        ),
      );
    }

    const bytes =
      new Uint8Array(
        await file
          .arrayBuffer(),
      );

    const maxBytes =
      isMediaMimeType(
        file.type,
      )
        ? env
            .MABOJOLU_MAX_MEDIA_ATTACHMENT_BYTES
        : env
            .MABOJOLU_MAX_ATTACHMENT_BYTES;

    const validation =
      validateAttachment({
        filename:
          file.name,

        declaredMimeType:
          file.type,

        sizeBytes:
          bytes.byteLength,

        header:
          bytes.subarray(
            0,
            16,
          ),

        maxBytes,
      });

    if (
      !validation.ok ||
      !validation.safeFilename ||
      !validation.format
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              validation.message ??
              "That file could not be analyzed.",
          },
        ),
      );
    }

    const attachmentId =
      crypto.randomUUID();

    const processed =
      await processAttachmentBytesWithLocalRuntime(
        {
          attachmentId,

          filename:
            validation
              .safeFilename,

          mimeType:
            validation
              .format
              .mimeType,

          bytes,
        },
      );

    if (!processed.ok) {
      return errorResponse(
        chatError(
          processed.reason ===
            "processor-unavailable"
            ? "provider_unavailable"
            : "invalid_request",
          {
            message:
              processed
                .message,
          },
        ),
      );
    }

    const chatAttachments:
      Array<
        Record<
          string,
          unknown
        >
      > =
      [];

    const text =
      (
        processed
          .evidence
          .text ??
        processed
          .evidence
          .transcript ??
        ""
      )
        .trim()
        .slice(
          0,
          MAX_CHAT_DOCUMENT_TEXT_CHARS,
        );

    if (text) {
      const encoded =
        new TextEncoder().encode(
          text,
        );

      chatAttachments.push({
        kind:
          "document",

        id:
          `${attachmentId}-evidence`,

        name:
          validation
            .safeFilename,

        mimeType:
          "text/plain",

        sizeBytes:
          encoded
            .byteLength,

        textContent:
          text,
      });
    }

    const frames =
      processed
        .evidence
        .images
        ?.slice(
          0,
          MAX_CHAT_IMAGE_ATTACHMENTS,
        ) ??
      [];

    for (
      const [
        index,
        frame,
      ] of
        frames.entries()
    ) {
      chatAttachments.push({
        kind:
          "image",

        id:
          `${attachmentId}-frame-${index + 1}`,

        name:
          `${validation.safeFilename} frame ${index + 1}`,

        mimeType:
          frame
            .mimeType,

        sizeBytes:
          decodedBase64Bytes(
            frame
              .base64Data,
          ),

        dataUrl:
          `data:${frame.mimeType};base64,${frame.base64Data}`,
      });
    }

    if (
      chatAttachments.length ===
        0
    ) {
      return errorResponse(
        chatError(
          "invalid_request",
          {
            message:
              "Mabojolu processed the file but found no text, speech, or visual frame evidence to analyze.",
          },
        ),
      );
    }

    return Response.json(
      {
        attachments:
          chatAttachments,

        analysis: {
          modality:
            processed
              .evidence
              .modality,

          processor:
            processed
              .evidence
              .processor
              .id,

          warnings:
            processed
              .evidence
              .warnings,
        },
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
          "POST /api/attachments/analyze",
      },
    );

    return errorResponse(
      error,
    );
  }
}

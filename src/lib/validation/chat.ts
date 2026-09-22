import { z } from "zod";

/**
 * Request validation for the Mabojolu chat API.
 *
 * Everything arriving from the browser is untrusted. Text and image limits are
 * enforced before provider work begins so malformed or oversized requests are
 * rejected cheaply.
 */

/** Kept in sync with the defaults in `src/lib/env.ts`. */
export const MAX_MESSAGE_CHARS = 32_000;
export const MAX_CONVERSATION_MESSAGES = 400;
export const MAX_TITLE_CHARS = 120;

/** Maximum number of attachments allowed on one user message. */
export const MAX_CHAT_ATTACHMENTS = 6;

/** Maximum number of images allowed on one user message. */
export const MAX_CHAT_IMAGE_ATTACHMENTS = 4;

/** Maximum original size of one image. */
export const MAX_CHAT_IMAGE_BYTES =
  10 * 1024 * 1024;

/**
 * Base64 expands binary data by roughly one third.
 *
 * This upper bound includes room for the data URL prefix while preventing an
 * attacker from submitting an unlimited string with a false `sizeBytes` value.
 */
export const MAX_CHAT_IMAGE_DATA_URL_CHARS =
  Math.ceil(
    MAX_CHAT_IMAGE_BYTES * 1.38,
  ) + 128;

/** Maximum browser-extracted UTF-8 text carried by one text document. */
export const MAX_CHAT_DOCUMENT_TEXT_CHARS =
  200_000;

/** Maximum original size of one directly readable text document. */
export const MAX_CHAT_DOCUMENT_BYTES =
  2 * 1024 * 1024;

const messageRole = z.enum([
  "user",
  "assistant",
]);

const supportedImageMimeType = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const supportedTextDocumentMimeType =
  z.enum([
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
  ]);

const attachmentId = z
  .string()
  .trim()
  .min(1, {
    message:
      "Each attachment requires an identifier.",
  })
  .max(128, {
    message:
      "An attachment identifier is too long.",
  });

const attachmentName = z
  .string()
  .trim()
  .min(1, {
    message:
      "Each attachment requires a filename.",
  })
  .max(255, {
    message:
      "An attachment filename is too long.",
  });

const imageAttachment = z
  .strictObject({
    kind:
      z.literal(
        "image",
      )
        .optional(),

    id: attachmentId,

    name: attachmentName,

    mimeType:
      supportedImageMimeType,

    sizeBytes: z
      .number()
      .int()
      .positive({
        message:
          "The selected image is empty.",
      })
      .max(
        MAX_CHAT_IMAGE_BYTES,
        {
          message:
            "Each image must be 10 MB or smaller.",
        },
      ),

    dataUrl: z
      .string()
      .min(1, {
        message:
          "The selected image has no data.",
      })
      .max(
        MAX_CHAT_IMAGE_DATA_URL_CHARS,
        {
          message:
            "The selected image is too large.",
        },
      ),
  })
  .superRefine(
    (attachment, ctx) => {
      const expectedPrefix =
        `data:${attachment.mimeType};base64,`;

      if (
        !attachment.dataUrl.startsWith(
          expectedPrefix,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataUrl"],
          message:
            "The image type does not match its data.",
        });

        return;
      }

      const base64 =
        attachment.dataUrl.slice(
          expectedPrefix.length,
        );

      if (
        base64.length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataUrl"],
          message:
            "The selected image has no readable data.",
        });

        return;
      }

      /**
       * Base64 may contain A-Z, a-z, 0-9, plus, slash, and up to two trailing
       * equals signs. Whitespace and arbitrary characters are rejected.
       */
      if (
        !/^[A-Za-z0-9+/]+={0,2}$/.test(
          base64,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataUrl"],
          message:
            "The selected image data is malformed.",
        });

        return;
      }

      if (
        base64.length % 4 !== 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataUrl"],
          message:
            "The selected image data is incomplete.",
        });

        return;
      }

      const padding =
        base64.endsWith("==")
          ? 2
          : base64.endsWith("=")
            ? 1
            : 0;

      const estimatedDecodedBytes =
        (base64.length * 3) / 4 -
        padding;

      if (
        estimatedDecodedBytes >
        MAX_CHAT_IMAGE_BYTES
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataUrl"],
          message:
            "Each image must be 10 MB or smaller.",
        });

        return;
      }

      /**
       * The browser-supplied original size is not trusted as the final security
       * check, but a major mismatch indicates a malformed request.
       *
       * A small allowance is kept because browser metadata and decoded payload
       * calculations can differ by a few bytes.
       */
      const sizeDifference =
        Math.abs(
          estimatedDecodedBytes -
            attachment.sizeBytes,
        );

      if (sizeDifference > 16) {
        ctx.addIssue({
          code: "custom",
          path: ["sizeBytes"],
          message:
            "The image size does not match its data.",
        });
      }
    },
  );

const textDocumentAttachment =
  z.strictObject({
    kind:
      z.literal(
        "document",
      ),

    id:
      attachmentId,

    name:
      attachmentName,

    mimeType:
      supportedTextDocumentMimeType,

    sizeBytes:
      z.number()
        .int()
        .positive({
          message:
            "The selected document is empty.",
        })
        .max(
          MAX_CHAT_DOCUMENT_BYTES,
          {
            message:
              "Each text document must be 2 MB or smaller.",
          },
        ),

    textContent:
      z.string()
        .min(
          1,
          {
            message:
              "The selected document has no readable text.",
          },
        )
        .max(
          MAX_CHAT_DOCUMENT_TEXT_CHARS,
          {
            message:
              "The selected document contains too much text.",
          },
        ),
  });

const chatAttachment =
  z.union([
    imageAttachment,
    textDocumentAttachment,
  ]);

const incomingMessage = z
  .strictObject({
    id: z
      .string()
      .min(1)
      .max(128),

    role: messageRole,

    content: z
      .string()
      .max(
        MAX_MESSAGE_CHARS,
        {
          message:
            `Messages cannot exceed ${MAX_MESSAGE_CHARS} characters.`,
        },
      ),

    createdAt: z
      .string()
      .datetime({
        offset: true,
      })
      .optional(),

    attachments: z
      .array(
        chatAttachment,
      )
      .max(
        MAX_CHAT_ATTACHMENTS,
        {
          message:
            `You can attach up to ${MAX_CHAT_ATTACHMENTS} files to one message.`,
        },
      )
      .optional(),
  })
  .superRefine(
    (message, ctx) => {
      if (
        message.role ===
          "assistant" &&
        message.attachments &&
        message.attachments.length >
          0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["attachments"],
          message:
            "Assistant messages cannot include user attachments.",
        });
      }

      const imageCount =
        message.attachments
          ?.filter(
            (
              attachment,
            ) =>
              "dataUrl" in
              attachment,
          )
          .length ??
        0;

      if (
        imageCount >
        MAX_CHAT_IMAGE_ATTACHMENTS
      ) {
        ctx.addIssue({
          code:
            "custom",
          path: [
            "attachments",
          ],
          message:
            `You can attach up to ${MAX_CHAT_IMAGE_ATTACHMENTS} images to one message.`,
        });
      }
    },
  );

export const chatRequestSchema = z
  .strictObject({
    /**
     * Missing conversation id means the server creates a new conversation.
     */
    conversationId: z
      .string()
      .uuid()
      .optional(),

    messages: z
      .array(incomingMessage)
      .min(1, {
        message:
          "At least one message is required.",
      })
      .max(
        MAX_CONVERSATION_MESSAGES,
        {
          message:
            "This conversation is too long to continue.",
        },
      ),

    modelId: z
      .string()
      .min(1)
      .max(64)
      .optional(),

    /**
     * Deduplication key used to prevent a retry from creating a second
     * generation.
     */
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .optional(),
  })
  .superRefine(
    (value, ctx) => {
      const last =
        value.messages.at(-1);

      if (
        last?.role !== "user"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["messages"],
          message:
            "The last message must be from the user.",
        });

        return;
      }

      const hasText =
        last.content.trim()
          .length > 0;

      const hasAttachments =
        (last.attachments?.length ??
          0) > 0;

      if (
        !hasText &&
        !hasAttachments
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["messages"],
          message:
            "A message cannot be empty unless a file is attached.",
        });
      }
    },
  );

export type ChatRequest =
  z.infer<
    typeof chatRequestSchema
  >;

export const conversationRenameSchema =
  z.strictObject({
    title: z
      .string()
      .trim()
      .min(1, {
        message:
          "Title cannot be empty.",
      })
      .max(
        MAX_TITLE_CHARS,
        {
          message:
            `Title cannot exceed ${MAX_TITLE_CHARS} characters.`,
        },
      ),
  });

export const feedbackSchema =
  z.strictObject({
    messageId: z
      .string()
      .min(1)
      .max(128),

    rating: z.enum([
      "up",
      "down",
    ]),

    /**
     * Optional free-text note. Bounded so it cannot be used as bulk storage.
     */
    note: z
      .string()
      .trim()
      .max(2_000)
      .optional(),
  });

/**
 * Parse a request body safely.
 *
 * Returns a result rather than throwing so callers can map failures onto
 * Mabojolu's own error codes.
 */
export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
):
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
    } {
  const parsed =
    schema.safeParse(body);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  const first =
    parsed.error.issues[0];

  return {
    ok: false,
    message:
      first?.message ??
      "That request could not be processed.",
  };
}
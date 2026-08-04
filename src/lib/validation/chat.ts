import { z } from "zod";

/**
 * Request validation for the chat API.
 *
 * Everything arriving from the browser is untrusted. Limits are enforced here,
 * before any provider work is scheduled, so a malformed or oversized body costs
 * nothing. The schema is the API contract, so it deliberately rejects unknown
 * keys rather than ignoring them.
 */

/** Kept in sync with the defaults in `src/lib/env.ts`. */
export const MAX_MESSAGE_CHARS = 32_000;
export const MAX_CONVERSATION_MESSAGES = 400;
export const MAX_TITLE_CHARS = 120;

const messageRole = z.enum(["user", "assistant"]);

const incomingMessage = z.strictObject({
  id: z.string().min(1).max(128),
  role: messageRole,
  content: z
    .string()
    .max(MAX_MESSAGE_CHARS, {
      message: `Messages cannot exceed ${MAX_MESSAGE_CHARS} characters.`,
    }),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

export const chatRequestSchema = z
  .strictObject({
    /**
     * Optional. Absent means the server creates a new conversation, which keeps
     * the first message of a chat a single round trip.
     */
    conversationId: z.string().uuid().optional(),
    messages: z
      .array(incomingMessage)
      .min(1, { message: "At least one message is required." })
      .max(MAX_CONVERSATION_MESSAGES, {
        message: "This conversation is too long to continue.",
      }),
    modelId: z.string().min(1).max(64).optional(),
    /**
     * Deduplication key. Lets a retry of the same logical request be recognized
     * instead of producing a second billable generation.
     */
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .superRefine((value, ctx) => {
    const last = value.messages.at(-1);

    // The server generates assistant turns, so a request must end on the user.
    if (last?.role !== "user") {
      ctx.addIssue({
        code: "custom",
        path: ["messages"],
        message: "The last message must be from the user.",
      });
      return;
    }

    if (last.content.trim().length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Message cannot be empty.",
      });
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const conversationRenameSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, { message: "Title cannot be empty." })
    .max(MAX_TITLE_CHARS, {
      message: `Title cannot exceed ${MAX_TITLE_CHARS} characters.`,
    }),
});

export const feedbackSchema = z.strictObject({
  messageId: z.string().min(1).max(128),
  rating: z.enum(["up", "down"]),
  /** Optional free-text note. Bounded so it cannot be used as bulk storage. */
  note: z.string().trim().max(2_000).optional(),
});

/**
 * Parse a request body safely.
 *
 * Returns a result rather than throwing so callers map failures onto our own
 * error codes, and so a malformed body never produces a stack trace response.
 */
export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; message: string } {
  const parsed = schema.safeParse(body);

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  // Surface the first issue only. Full validation detail is internal.
  const first = parsed.error.issues[0];
  return {
    ok: false,
    message: first?.message ?? "That request could not be processed.",
  };
}

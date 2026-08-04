/**
 * Shared chat types.
 *
 * These cross the browser/server boundary, so they stay free of server-only
 * imports and describe only data that is safe to send to a client.
 */

export type MessageRole = "user" | "assistant";

/**
 * Delivery state of a single message.
 *
 * `interrupted` is a first-class outcome, not an error: the user stopped
 * generation and the partial text is intentionally kept.
 */
export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "interrupted"
  | "failed";

export type FeedbackRating = "up" | "down";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  /** ISO 8601. Assigned by whichever side created the message. */
  createdAt: string;
  /** Present on assistant messages once a provider has responded. */
  model?: string;
  /** Set when `status` is `failed`. Safe for display. */
  error?: ChatErrorPayload;
  feedback?: FeedbackRating;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

/** Conversation summary for the sidebar; excludes message bodies. */
export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Stable, machine-readable error codes.
 *
 * The UI maps these to copy and to whether a retry is worth offering, so they
 * are part of the API contract rather than an implementation detail.
 */
export type ChatErrorCode =
  | "invalid_request"
  | "message_too_long"
  | "conversation_too_long"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "provider_not_configured"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_refused"
  | "context_too_large"
  | "aborted"
  | "internal_error";

export interface ChatErrorPayload {
  code: ChatErrorCode;
  /** User-facing message. Never contains a stack trace or credential. */
  message: string;
  retryable: boolean;
  /** Seconds to wait before retrying. Only set for `rate_limited`. */
  retryAfterSeconds?: number;
}

/** Token accounting for one generation, used for usage and cost reporting. */
export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Server-sent events emitted by the chat route.
 *
 * A discriminated union so the client parser is exhaustive and adding an event
 * type is a compile error at every consumer until handled.
 */
export type ChatStreamEvent =
  | { type: "start"; messageId: string; model: string }
  | { type: "delta"; text: string }
  | { type: "status"; label: string }
  | {
      type: "done";
      finishReason: "end_turn" | "max_tokens" | "aborted" | "refusal";
      usage?: UsageRecord;
    }
  | { type: "error"; error: ChatErrorPayload };

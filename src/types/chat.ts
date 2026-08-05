/**
 * Shared Mabojolu chat types.
 *
 * These types cross the browser and server boundary, so they contain only data
 * that is safe to send to the client. Provider credentials and server-only
 * implementation details must never be added here.
 */

export type MessageRole =
  | "user"
  | "assistant";

/**
 * Delivery state of one message.
 *
 * Interrupted is a valid outcome rather than an error because the user may
 * intentionally stop generation while keeping the partial response.
 */
export type MessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "interrupted"
  | "failed";

export type FeedbackRating =
  | "up"
  | "down";

/**
 * Public source used to support a Mabojolu response.
 *
 * Provider-specific citation identifiers and encrypted metadata remain on the
 * server. Only safe display information crosses into the browser.
 */
export interface ChatSource {
  /**
   * Stable identifier created by Mabojolu for this response.
   *
   * The same web page may be cited more than once, but it should appear only
   * once in the visible source list.
   */
  id: string;

  /**
   * Human-readable page or document title.
   */
  title: string;

  /**
   * Complete HTTPS source address.
   */
  url: string;

  /**
   * Short supporting excerpt supplied by the provider when available.
   *
   * This is optional because some providers return a source title and URL
   * without a safe excerpt.
   */
  citedText?: string;
}

/**
 * Image attached to a user message.
 *
 * `dataUrl` contains the browser-readable preview and the base64 image payload
 * used for the current local Ollama vision request.
 *
 * Only validated JPEG, PNG, and WebP images should reach this structure.
 */
export interface ChatImageAttachment {
  /** Client-generated stable identifier. */
  id: string;

  /** Original display name selected by the user. */
  name: string;

  /** Validated image MIME type. */
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp";

  /** Original file size before base64 encoding. */
  sizeBytes: number;

  /**
   * Complete data URL, for example:
   * data:image/png;base64,iVBORw0KGgo...
   */
  dataUrl: string;
}

export interface ChatMessage {
  id: string;

  /**
   * Database identifier assigned by the server.
   *
   * This remains separate from `id` because optimistic messages need a stable
   * client identifier before the database row exists.
   */
  serverId?: string;

  role: MessageRole;
  content: string;
  status: MessageStatus;

  /** ISO 8601 timestamp. */
  createdAt: string;

  /**
   * Images included with a user message.
   *
   * Assistant messages normally leave this undefined.
   */
  attachments?: ChatImageAttachment[];

  /** Present on assistant messages after a provider starts responding. */
  model?: string;

  /** Safe display error when the message status is failed. */
  error?: ChatErrorPayload;

  feedback?: FeedbackRating;

  /**
   * Verified public sources supporting an assistant response.
   *
   * User messages should not contain sources.
   */
  sources?: ChatSource[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

/**
 * Conversation summary used in the sidebar.
 *
 * Message bodies, sources, and attachment data are intentionally excluded.
 */
export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/**
 * Stable machine-readable error codes.
 *
 * The client uses these values to determine display text and whether retrying
 * can reasonably succeed.
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

  /** User-facing message without stack traces or credentials. */
  message: string;

  retryable: boolean;

  /** Present only for rate-limited responses. */
  retryAfterSeconds?: number;
}

/**
 * Token accounting for one completed generation.
 */
export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Server-sent events emitted by the chat API.
 */
export type ChatStreamEvent =
  | {
      type: "start";

      /** Server identifier for the assistant message being written. */
      messageId: string;

      model: string;

      /**
       * Included when the server creates a new conversation during this
       * request.
       */
      conversationId?: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "status";
      label: string;
    }
  | {
      /**
       * One verified web source discovered during generation.
       *
       * The client deduplicates these by source ID before attaching them to the
       * assistant message.
       */
      type: "source";
      source: ChatSource;
    }
  | {
      type: "done";

      finishReason:
        | "end_turn"
        | "max_tokens"
        | "aborted"
        | "refusal";

      usage?: UsageRecord;
    }
  | {
      type: "error";
      error: ChatErrorPayload;
    };
import type { ChatErrorCode, ChatErrorPayload } from "@/types/chat";

/**
 * A failure that is safe to show a user.
 *
 * Provider SDKs throw errors whose messages can contain request bodies, header
 * dumps, or credential fragments. Everything crossing the response boundary is
 * normalized through this class so the browser only ever sees curated copy,
 * while `cause` keeps the original for server-side logging.
 */
export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly httpStatus: number;

  constructor(init: {
    code: ChatErrorCode;
    message: string;
    retryable?: boolean;
    retryAfterSeconds?: number;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(init.message, { cause: init.cause });
    this.name = "ChatError";
    this.code = init.code;
    this.retryable = init.retryable ?? DEFAULT_RETRYABLE[init.code];
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.httpStatus = init.httpStatus ?? DEFAULT_STATUS[init.code];
  }

  toPayload(): ChatErrorPayload {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: this.retryAfterSeconds }),
    };
  }
}

/**
 * Whether retrying the identical request could plausibly succeed.
 *
 * Deliberately conservative: a retry that re-runs a billable generation which
 * already partly succeeded costs the user real money, so only transient
 * transport-level failures are retryable. `aborted` is false because the user
 * chose to stop.
 */
const DEFAULT_RETRYABLE: Record<ChatErrorCode, boolean> = {
  invalid_request: false,
  message_too_long: false,
  conversation_too_long: false,
  unauthorized: false,
  forbidden: false,
  not_found: false,
  rate_limited: true,
  provider_not_configured: false,
  provider_unavailable: true,
  provider_timeout: true,
  provider_refused: false,
  context_too_large: false,
  aborted: false,
  internal_error: true,
};

const DEFAULT_STATUS: Record<ChatErrorCode, number> = {
  invalid_request: 400,
  message_too_long: 413,
  conversation_too_long: 413,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  provider_not_configured: 503,
  provider_unavailable: 502,
  provider_timeout: 504,
  provider_refused: 200,
  context_too_large: 413,
  aborted: 499,
  internal_error: 500,
};

/** User-facing copy. No em dashes, per the product copy rules. */
const MESSAGES: Record<ChatErrorCode, string> = {
  invalid_request: "That request could not be processed. Please try again.",
  message_too_long:
    "That message is too long. Please shorten it and send again.",
  conversation_too_long:
    "This conversation has grown too long. Start a new chat to continue.",
  unauthorized: "Please sign in to continue.",
  forbidden: "You do not have access to this conversation.",
  not_found: "That conversation could not be found.",
  rate_limited:
    "You have sent a lot of messages in a short time. Please wait a moment and try again.",
  provider_not_configured:
    "Mabojolu is not connected to an AI provider yet. Add a provider credential to continue.",
  provider_unavailable:
    "The AI service is temporarily unavailable. Please try again in a moment.",
  provider_timeout: "That response took too long. Please try again.",
  provider_refused:
    "Mabojolu was unable to answer that request. Try rephrasing it.",
  context_too_large:
    "This conversation is too large to process. Start a new chat to continue.",
  aborted: "Generation stopped.",
  internal_error: "Something went wrong on our side. Please try again.",
};

export function chatError(
  code: ChatErrorCode,
  overrides: { message?: string; cause?: unknown; retryAfterSeconds?: number } = {},
): ChatError {
  return new ChatError({
    code,
    message: overrides.message ?? MESSAGES[code],
    cause: overrides.cause,
    retryAfterSeconds: overrides.retryAfterSeconds,
  });
}

/**
 * Coerce any thrown value into a `ChatError`.
 *
 * Unknown failures collapse to `internal_error` so an unexpected provider
 * exception can never leak its message to the browser.
 */
export function normalizeError(cause: unknown): ChatError {
  if (cause instanceof ChatError) {
    return cause;
  }

  // Abort is a normal control-flow signal, not a fault.
  if (
    cause instanceof DOMException && cause.name === "AbortError"
  ) {
    return chatError("aborted", { cause });
  }
  if (cause instanceof Error && cause.name === "AbortError") {
    return chatError("aborted", { cause });
  }

  return chatError("internal_error", { cause });
}

/**
 * Log a failure with its underlying cause, server-side only.
 *
 * Prompt and message bodies are never passed here. The spec requires that
 * private user content not be logged carelessly, so callers supply identifiers
 * and codes rather than conversation text.
 */
export function logChatError(
  error: ChatError,
  context: Record<string, string | number | undefined> = {},
): void {
  if (error.code === "aborted") {
    return; // A user pressing stop is not an incident.
  }

  const detail = error.cause instanceof Error ? error.cause.message : undefined;

  console.error("[mabojolu] chat error", {
    code: error.code,
    ...context,
    ...(detail ? { detail } : {}),
  });
}

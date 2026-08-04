/**
 * Persistence contract.
 *
 * Every storage operation the product needs, expressed independently of any
 * database. Two implementations exist: a local adapter for development and
 * tests, and a Supabase adapter for real deployments. The backend is selected
 * by environment, so swapping storage never touches route handlers or UI code.
 *
 * Two rules shape this interface:
 *
 * 1. Ownership is a parameter, never an assumption. Every method that reaches a
 *    user-owned row takes an explicit `userId` and filters on it. Row-level
 *    security remains a second line of defence rather than the only one.
 *
 * 2. Conversation identifiers are opaque. A caller can reach a row only by
 *    supplying both the identifier and the owning user.
 */

import type {
  ChatMessage,
  Conversation,
  ConversationSummary,
  FeedbackRating,
  MessageStatus,
  UsageRecord,
} from "@/types/chat";

/** A user profile row. Kept minimal because Mabojolu needs very little. */
export interface Profile {
  id: string;
  email: string;
  displayName: string | null;

  /** Site-wide role. Admin access is checked server-side against this value. */
  role: "user" | "admin";

  createdAt: string;
}

export interface CreateConversationInput {
  userId: string;
  title: string;

  /** Supplied by the caller so an optimistic client identifier can be honored. */
  id?: string;
}

export interface AppendMessageInput {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;

  /** Client-generated identifier used for idempotency on retries. */
  clientId?: string;

  model?: string;
  promptVersion?: string;
  usage?: UsageRecord;
  errorCode?: string;
}

export interface UsageEventInput {
  userId: string;
  conversationId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  estimatedCostUsd: number;
  finishReason: string;
}

export interface SafetyEventInput {
  userId: string | null;
  conversationId: string | null;

  /** What kind of boundary was hit, for example `provider_refusal`. */
  kind: string;

  /** Coarse severity so an operator can triage without reading user content. */
  severity: "info" | "warning" | "critical";

  /**
   * Non-sensitive detail.
   *
   * This must never contain prompt or message text. Safety telemetry is visible
   * to administrators, and copying user content into it would turn an audit
   * trail into a privacy leak.
   */
  detail: string;
}

/**
 * Input used to create an attachment row.
 *
 * `messageId` associates a persisted chat image with the exact user message
 * that introduced it. It remains nullable because Mabojolu also has a generic
 * conversation-level attachment workflow for future document processing.
 */
export interface AttachmentInput {
  userId: string;
  conversationId: string;
  messageId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;

  /** Path inside the private storage bucket. Never a public URL. */
  storagePath: string;
}

export interface AttachmentRecord {
  id: string;
  conversationId: string;

  /**
   * Message that owns this attachment.
   *
   * Chat images use a real message identifier. Conversation-level uploads use
   * null until they are associated with a message or document workflow.
   */
  messageId: string | null;

  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;

  /**
   * Upload and processing lifecycle.
   *
   * A file is not readable by the model until it is `ready`, preventing the
   * assistant from claiming to have analyzed bytes that were not stored or
   * validated successfully.
   */
  status:
    | "pending"
    | "uploaded"
    | "processing"
    | "ready"
    | "failed";

  failureReason: string | null;
  createdAt: string;
}

export interface AdminMetrics {
  userCount: number;
  conversationCount: number;
  messageCount: number;

  /** Usage grouped by provider and model, including estimated external cost. */
  usageByModel: Array<{
    provider: string;
    model: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;

  feedback: {
    up: number;
    down: number;
  };

  recentErrors: Array<{
    code: string;
    count: number;
  }>;

  safetyEvents: Array<{
    kind: string;
    severity: string;
    count: number;
  }>;
}

/**
 * Storage port.
 *
 * Every operation is asynchronous, including the local adapter, so switching
 * to a remote database never changes caller control flow.
 */
export interface DatabaseAdapter {
  /** Backend identifier used by diagnostics and the administration view. */
  readonly kind: "local" | "supabase";

  /** True when the adapter is usable. False means configuration is missing. */
  isReady(): boolean;

  // --- Profiles ------------------------------------------------------------

  getProfile(
    userId: string,
  ): Promise<Profile | null>;

  upsertProfile(profile: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<Profile>;

  // --- Conversations -------------------------------------------------------

  createConversation(
    input: CreateConversationInput,
  ): Promise<Conversation>;

  /** Returns null when the conversation does not exist or is not owned. */
  getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null>;

  listConversations(
    userId: string,
    options?: {
      search?: string;
      limit?: number;
    },
  ): Promise<ConversationSummary[]>;

  renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<boolean>;

  deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<boolean>;

  touchConversation(
    conversationId: string,
    userId: string,
  ): Promise<void>;

  // --- Messages ------------------------------------------------------------

  appendMessage(
    input: AppendMessageInput,
  ): Promise<ChatMessage>;

  /**
   * Update a message in place.
   *
   * Used to finalize a streamed assistant reply so a completed generation
   * updates the row it started rather than inserting a duplicate.
   */
  updateMessage(
    messageId: string,
    userId: string,
    patch: {
      content?: string;
      status?: MessageStatus;
      usage?: UsageRecord;
      errorCode?: string;
    },
  ): Promise<boolean>;

  /**
   * Look up a message by its client-supplied identifier.
   *
   * This is the idempotency check. A retried request finds its existing row
   * instead of creating a second one.
   */
  findMessageByClientId(
    conversationId: string,
    userId: string,
    clientId: string,
  ): Promise<ChatMessage | null>;

  /** Remove a message and every later turn for edit and regenerate flows. */
  deleteMessagesFrom(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<boolean>;

  // --- Feedback ------------------------------------------------------------

  setFeedback(
    messageId: string,
    userId: string,
    rating: FeedbackRating | null,
    note?: string,
  ): Promise<boolean>;

  // --- Usage and safety ----------------------------------------------------

  recordUsage(
    input: UsageEventInput,
  ): Promise<void>;

  recordSafetyEvent(
    input: SafetyEventInput,
  ): Promise<void>;

  /** Number of messages sent by one user within a quota window. */
  countRecentMessages(
    userId: string,
    sinceIso: string,
  ): Promise<number>;

  // --- Attachments ---------------------------------------------------------

  createAttachment(
    input: AttachmentInput,
  ): Promise<AttachmentRecord>;

  /**
   * Advance an attachment through its lifecycle.
   *
   * `storagePath` is settable here because a final path may contain the
   * database-generated attachment identifier. The row is created first with a
   * unique placeholder, the bytes are stored, and then the real path is
   * recorded with the status update.
   */
  updateAttachmentStatus(
    attachmentId: string,
    userId: string,
    status: AttachmentRecord["status"],
    options?: {
      failureReason?: string;
      storagePath?: string;
    },
  ): Promise<boolean>;

  /** Read one owned attachment without exposing another user's metadata. */
  getAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<AttachmentRecord | null>;

  /** List every attachment associated with one owned conversation. */
  listAttachments(
    conversationId: string,
    userId: string,
  ): Promise<AttachmentRecord[]>;

  deleteAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<boolean>;

  // --- Administration ------------------------------------------------------

  getAdminMetrics(): Promise<AdminMetrics>;

  /** Delete every row belonging to a user for account deletion requests. */
  deleteAllUserData(
    userId: string,
  ): Promise<void>;
}
/**
 * Persistence contract.
 *
 * Every storage operation the product needs, expressed independently of any
 * database. Two implementations exist: a local adapter for development and
 * tests, and a Supabase adapter for real deployments. Chosen by environment, so
 * swapping backends never touches a route handler or component.
 *
 * Two rules shape this interface:
 *
 *  1. Ownership is a parameter, never an assumption. Every method that reaches a
 *     user-owned row takes an explicit `userId` and filters on it. That keeps the
 *     application enforcing ownership on its own, so row-level security in the
 *     database is a second line of defence rather than the only one.
 *
 *  2. Conversation identifiers are opaque. A caller can only reach a row by
 *     supplying both the id and the owning user, so guessing an id is not enough
 *     to read someone else's conversation.
 */

import type {
  ChatMessage,
  Conversation,
  ConversationSummary,
  FeedbackRating,
  MessageStatus,
  UsageRecord,
} from "@/types/chat";

/** A user profile row. Kept minimal: the product needs very little. */
export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  /** Site-wide role. Admin access is checked server-side against this. */
  role: "user" | "admin";
  createdAt: string;
}

export interface CreateConversationInput {
  userId: string;
  title: string;
  /** Supplied by the caller so an optimistic client id can be honoured. */
  id?: string;
}

export interface AppendMessageInput {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  /** Client-generated id, used for idempotency on retries. */
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
  /** Coarse severity, so an operator can triage without reading content. */
  severity: "info" | "warning" | "critical";
  /**
   * Non-sensitive detail. Must never contain prompt or message text: safety
   * telemetry is read by administrators, and copying user content into it would
   * turn an audit trail into a privacy leak.
   */
  detail: string;
}

export interface AttachmentInput {
  userId: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Path within the storage bucket. Never a public URL. */
  storagePath: string;
}

export interface AttachmentRecord {
  id: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  /**
   * Upload and processing lifecycle. A file is not readable by the model until
   * `ready`, so the assistant can never claim to have understood a document that
   * has not actually been processed.
   */
  status: "pending" | "uploaded" | "processing" | "ready" | "failed";
  failureReason: string | null;
  createdAt: string;
}

export interface AdminMetrics {
  userCount: number;
  conversationCount: number;
  messageCount: number
  /** Usage grouped by provider and model, with estimated cost. */
  usageByModel: Array<{
    provider: string;
    model: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  feedback: { up: number; down: number };
  recentErrors: Array<{ code: string; count: number }>;
  safetyEvents: Array<{ kind: string; severity: string; count: number }>;
}

/**
 * The storage port.
 *
 * Async throughout, including in the local adapter, so swapping in a real
 * database cannot change any caller's control flow.
 */
export interface DatabaseAdapter {
  /** Identifies the backend in diagnostics and the admin view. */
  readonly kind: "local" | "supabase";

  /** True when the adapter is usable. False means credentials are missing. */
  isReady(): boolean;

  // --- Profiles ---
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(profile: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<Profile>;

  // --- Conversations ---
  createConversation(input: CreateConversationInput): Promise<Conversation>;
  /** Returns null when the conversation does not exist or is not owned. */
  getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null>;
  listConversations(
    userId: string,
    options?: { search?: string; limit?: number },
  ): Promise<ConversationSummary[]>;
  renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<boolean>;
  deleteConversation(conversationId: string, userId: string): Promise<boolean>;
  touchConversation(conversationId: string, userId: string): Promise<void>;

  // --- Messages ---
  appendMessage(input: AppendMessageInput): Promise<ChatMessage>;
  /**
   * Update a message in place.
   *
   * Used to finalize a streamed assistant reply, so a completed generation
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
   * Look up a message by the client-supplied id.
   *
   * The idempotency check: a retried request finds its existing row instead of
   * creating a second one.
   */
  findMessageByClientId(
    conversationId: string,
    userId: string,
    clientId: string,
  ): Promise<ChatMessage | null>;
  /** Remove a message and everything after it, for edit and regenerate. */
  deleteMessagesFrom(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<boolean>;

  // --- Feedback ---
  setFeedback(
    messageId: string,
    userId: string,
    rating: FeedbackRating | null,
    note?: string,
  ): Promise<boolean>;

  // --- Usage and safety ---
  recordUsage(input: UsageEventInput): Promise<void>;
  recordSafetyEvent(input: SafetyEventInput): Promise<void>;
  /** Messages sent by a user within a window, for per-user quotas. */
  countRecentMessages(userId: string, sinceIso: string): Promise<number>;

  // --- Attachments ---
  createAttachment(input: AttachmentInput): Promise<AttachmentRecord>;
  updateAttachmentStatus(
    attachmentId: string,
    userId: string,
    status: AttachmentRecord["status"],
    failureReason?: string,
  ): Promise<boolean>;
  listAttachments(
    conversationId: string,
    userId: string,
  ): Promise<AttachmentRecord[]>;
  deleteAttachment(attachmentId: string, userId: string): Promise<boolean>;

  // --- Administration ---
  getAdminMetrics(): Promise<AdminMetrics>;

  /** Delete every row belonging to a user, for account deletion requests. */
  deleteAllUserData(userId: string): Promise<void>;
}

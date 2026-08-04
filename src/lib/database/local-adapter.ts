import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ChatMessage,
  Conversation,
  ConversationSummary,
  FeedbackRating,
  MessageStatus,
  UsageRecord,
} from "@/types/chat";

import type {
  AdminMetrics,
  AppendMessageInput,
  AttachmentInput,
  AttachmentRecord,
  CreateConversationInput,
  DatabaseAdapter,
  Profile,
  SafetyEventInput,
  UsageEventInput,
} from "./types";

/**
 * Local development persistence.
 *
 * A JSON file under `.mabojolu-data/`, so conversations survive a page refresh
 * and a server restart without any external service. That makes refresh
 * restoration, history, search, rename, and delete genuinely testable rather
 * than simulated.
 *
 * Explicitly not for production, and it does not pretend otherwise:
 *  - A single JSON file has no transactions and no concurrent-write safety
 *    beyond the serialization below.
 *  - Every row lives in one file on one machine, so it does not scale and does
 *    not survive an ephemeral filesystem.
 *  - It enforces ownership in application code only. There is no row-level
 *    security, because there is no database to enforce it.
 *
 * `isProductionSafe` is false, and the admin view surfaces that.
 */

interface StoredMessage {
  id: string;
  conversationId: string;
  userId: string;
  clientId: string | null;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  model: string | null;
  promptVersion: string | null;
  usage: UsageRecord | null;
  errorCode: string | null;
  feedback: FeedbackRating | null;
  feedbackNote: string | null;
  createdAt: string;
  /** Ordering key. A timestamp alone can collide within the same millisecond. */
  sequence: number;
}

interface StoredConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface StoredUsageEvent extends UsageEventInput {
  id: string;
  createdAt: string;
}

interface StoredSafetyEvent extends SafetyEventInput {
  id: string;
  createdAt: string;
}

interface StoredAttachment extends AttachmentRecord {
  userId: string;
}

interface Database {
  version: 1;
  profiles: Profile[];
  conversations: StoredConversation[];
  messages: StoredMessage[];
  usageEvents: StoredUsageEvent[];
  safetyEvents: StoredSafetyEvent[];
  attachments: StoredAttachment[];
  nextSequence: number;
}

function emptyDatabase(): Database {
  return {
    version: 1,
    profiles: [],
    conversations: [],
    messages: [],
    usageEvents: [],
    safetyEvents: [],
    attachments: [],
    nextSequence: 1,
  };
}

export class LocalDatabaseAdapter implements DatabaseAdapter {
  readonly kind = "local" as const;

  private readonly filePath: string;
  private cache: Database | null = null;

  /**
   * Serializes reads and writes.
   *
   * Route handlers run concurrently, and two overlapping read-modify-write
   * cycles on one JSON file would lose data. Chaining every operation onto a
   * single promise makes the whole adapter one writer.
   */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: { directory?: string } = {}) {
    const directory =
      options.directory ?? path.join(process.cwd(), ".mabojolu-data");
    this.filePath = path.join(directory, "database.json");
  }

  isReady(): boolean {
    return true;
  }

  /** Run an operation with exclusive access to the store. */
  private run<T>(operation: (db: Database) => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      const db = await this.load();
      return operation(db);
    });

    // Keep the chain alive even when an operation rejects, or one failure would
    // permanently wedge every later call.
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async load(): Promise<Database> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Database;

      // A file from an older or corrupted shape starts clean rather than
      // throwing on every request. This is development data.
      this.cache = parsed.version === 1 ? parsed : emptyDatabase();
    } catch {
      this.cache = emptyDatabase();
    }

    return this.cache;
  }

  /**
   * Persist the store.
   *
   * Writes to a temporary file and renames it, so an interrupted write cannot
   * leave a truncated JSON file that fails to parse on next start.
   */
  private async persist(db: Database): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(db, null, 2), "utf8");
    await rename(temporary, this.filePath);
  }

  // --- Profiles -----------------------------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    return this.run(
      (db) => db.profiles.find((profile) => profile.id === userId) ?? null,
    );
  }

  async upsertProfile(input: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<Profile> {
    return this.run(async (db) => {
      const existing = db.profiles.find((profile) => profile.id === input.id);

      if (existing) {
        existing.email = input.email;
        if (input.displayName !== undefined) {
          existing.displayName = input.displayName;
        }
        await this.persist(db);
        return existing;
      }

      const profile: Profile = {
        id: input.id,
        email: input.email,
        displayName: input.displayName ?? null,
        // The first profile becomes admin so the admin area is reachable in
        // local development without a manual database edit.
        role: db.profiles.length === 0 ? "admin" : "user",
        createdAt: new Date().toISOString(),
      };

      db.profiles.push(profile);
      await this.persist(db);
      return profile;
    });
  }

  // --- Conversations ------------------------------------------------------

  async createConversation(
    input: CreateConversationInput,
  ): Promise<Conversation> {
    return this.run(async (db) => {
      const now = new Date().toISOString();
      const row: StoredConversation = {
        id: input.id ?? randomUUID(),
        userId: input.userId,
        title: input.title,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      db.conversations.push(row);
      await this.persist(db);

      return { ...toConversation(row), messages: [] };
    });
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    return this.run((db) => {
      // Ownership is part of the lookup, so an id alone is not enough to read a
      // conversation.
      const row = db.conversations.find(
        (candidate) =>
          candidate.id === conversationId &&
          candidate.userId === userId &&
          candidate.deletedAt === null,
      );

      if (!row) {
        return null;
      }

      const messages = db.messages
        .filter((message) => message.conversationId === conversationId)
        .sort((a, b) => a.sequence - b.sequence)
        .map(toChatMessage);

      return { ...toConversation(row), messages };
    });
  }

  async listConversations(
    userId: string,
    options: { search?: string; limit?: number } = {},
  ): Promise<ConversationSummary[]> {
    return this.run((db) => {
      const search = options.search?.trim().toLowerCase();

      let rows = db.conversations.filter(
        (row) => row.userId === userId && row.deletedAt === null,
      );

      if (search) {
        // Title match, plus message bodies so a user can find a conversation by
        // something they remember saying in it.
        const matchingIds = new Set(
          db.messages
            .filter(
              (message) =>
                message.userId === userId &&
                message.content.toLowerCase().includes(search),
            )
            .map((message) => message.conversationId),
        );

        rows = rows.filter(
          (row) =>
            row.title.toLowerCase().includes(search) || matchingIds.has(row.id),
        );
      }

      return rows
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, options.limit ?? 100)
        .map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          messageCount: db.messages.filter(
            (message) => message.conversationId === row.id,
          ).length,
        }));
    });
  }

  async renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.conversations.find(
        (candidate) =>
          candidate.id === conversationId &&
          candidate.userId === userId &&
          candidate.deletedAt === null,
      );

      if (!row) {
        return false;
      }

      row.title = title;
      row.updatedAt = new Date().toISOString();
      await this.persist(db);
      return true;
    });
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.conversations.find(
        (candidate) =>
          candidate.id === conversationId && candidate.userId === userId,
      );

      if (!row || row.deletedAt !== null) {
        return false;
      }

      // A hard delete of the conversation and its messages, because the user
      // asked for deletion and a soft-deleted row that still holds their words
      // would not honour that.
      db.conversations = db.conversations.filter(
        (candidate) => candidate.id !== conversationId,
      );
      db.messages = db.messages.filter(
        (message) => message.conversationId !== conversationId,
      );
      db.attachments = db.attachments.filter(
        (attachment) => attachment.conversationId !== conversationId,
      );

      await this.persist(db);
      return true;
    });
  }

  async touchConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.run(async (db) => {
      const row = db.conversations.find(
        (candidate) =>
          candidate.id === conversationId && candidate.userId === userId,
      );

      if (row) {
        row.updatedAt = new Date().toISOString();
        await this.persist(db);
      }
    });
  }

  // --- Messages -----------------------------------------------------------

  async appendMessage(input: AppendMessageInput): Promise<ChatMessage> {
    return this.run(async (db) => {
      const conversation = db.conversations.find(
        (candidate) =>
          candidate.id === input.conversationId &&
          candidate.userId === input.userId &&
          candidate.deletedAt === null,
      );

      // Refuse to write into a conversation the caller does not own, rather than
      // silently creating an orphaned message.
      if (!conversation) {
        throw new Error("Conversation not found for this user.");
      }

      // Idempotency: a retry carrying the same client id returns the existing
      // row instead of duplicating the message.
      if (input.clientId) {
        const existing = db.messages.find(
          (message) =>
            message.conversationId === input.conversationId &&
            message.clientId === input.clientId,
        );

        if (existing) {
          return toChatMessage(existing);
        }
      }

      const now = new Date().toISOString();
      const row: StoredMessage = {
        id: randomUUID(),
        conversationId: input.conversationId,
        userId: input.userId,
        clientId: input.clientId ?? null,
        role: input.role,
        content: input.content,
        status: input.status,
        model: input.model ?? null,
        promptVersion: input.promptVersion ?? null,
        usage: input.usage ?? null,
        errorCode: input.errorCode ?? null,
        feedback: null,
        feedbackNote: null,
        createdAt: now,
        sequence: db.nextSequence,
      };

      db.nextSequence += 1;
      db.messages.push(row);
      conversation.updatedAt = now;

      await this.persist(db);
      return toChatMessage(row);
    });
  }

  async updateMessage(
    messageId: string,
    userId: string,
    patch: {
      content?: string;
      status?: MessageStatus;
      usage?: UsageRecord;
      errorCode?: string;
    },
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.messages.find(
        (message) => message.id === messageId && message.userId === userId,
      );

      if (!row) {
        return false;
      }

      if (patch.content !== undefined) row.content = patch.content;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.usage !== undefined) row.usage = patch.usage;
      if (patch.errorCode !== undefined) row.errorCode = patch.errorCode;

      await this.persist(db);
      return true;
    });
  }

  async findMessageByClientId(
    conversationId: string,
    userId: string,
    clientId: string,
  ): Promise<ChatMessage | null> {
    return this.run((db) => {
      const row = db.messages.find(
        (message) =>
          message.conversationId === conversationId &&
          message.userId === userId &&
          message.clientId === clientId,
      );

      return row ? toChatMessage(row) : null;
    });
  }

  async deleteMessagesFrom(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const anchor = db.messages.find(
        (message) =>
          message.id === messageId &&
          message.conversationId === conversationId &&
          message.userId === userId,
      );

      if (!anchor) {
        return false;
      }

      // Everything from the anchor onward is dropped, because those turns
      // answered a question that no longer exists.
      db.messages = db.messages.filter(
        (message) =>
          message.conversationId !== conversationId ||
          message.sequence < anchor.sequence,
      );

      await this.persist(db);
      return true;
    });
  }

  // --- Feedback -----------------------------------------------------------

  async setFeedback(
    messageId: string,
    userId: string,
    rating: FeedbackRating | null,
    note?: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.messages.find(
        (message) => message.id === messageId && message.userId === userId,
      );

      if (!row) {
        return false;
      }

      row.feedback = rating;
      row.feedbackNote = note ?? null;
      await this.persist(db);
      return true;
    });
  }

  // --- Usage and safety ---------------------------------------------------

  async recordUsage(input: UsageEventInput): Promise<void> {
    await this.run(async (db) => {
      db.usageEvents.push({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await this.persist(db);
    });
  }

  async recordSafetyEvent(input: SafetyEventInput): Promise<void> {
    await this.run(async (db) => {
      db.safetyEvents.push({
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      });
      await this.persist(db);
    });
  }

  async countRecentMessages(userId: string, sinceIso: string): Promise<number> {
    return this.run(
      (db) =>
        db.messages.filter(
          (message) =>
            message.userId === userId &&
            message.role === "user" &&
            message.createdAt >= sinceIso,
        ).length,
    );
  }

  // --- Attachments --------------------------------------------------------

  async createAttachment(input: AttachmentInput): Promise<AttachmentRecord> {
    return this.run(async (db) => {
      const owns = db.conversations.some(
        (candidate) =>
          candidate.id === input.conversationId &&
          candidate.userId === input.userId &&
          candidate.deletedAt === null,
      );

      if (!owns) {
        throw new Error("Conversation not found for this user.");
      }

      const row: StoredAttachment = {
        id: randomUUID(),
        userId: input.userId,
        conversationId: input.conversationId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        // Starts pending. Nothing may treat the file as readable until the
        // processing step marks it ready.
        status: "pending",
        failureReason: null,
        createdAt: new Date().toISOString(),
      };

      db.attachments.push(row);
      await this.persist(db);
      return stripUserId(row);
    });
  }

  async updateAttachmentStatus(
    attachmentId: string,
    userId: string,
    status: AttachmentRecord["status"],
    failureReason?: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.attachments.find(
        (attachment) =>
          attachment.id === attachmentId && attachment.userId === userId,
      );

      if (!row) {
        return false;
      }

      row.status = status;
      row.failureReason = failureReason ?? null;
      await this.persist(db);
      return true;
    });
  }

  async listAttachments(
    conversationId: string,
    userId: string,
  ): Promise<AttachmentRecord[]> {
    return this.run((db) =>
      db.attachments
        .filter(
          (attachment) =>
            attachment.conversationId === conversationId &&
            attachment.userId === userId,
        )
        .map(stripUserId),
    );
  }

  async deleteAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const before = db.attachments.length;

      db.attachments = db.attachments.filter(
        (attachment) =>
          !(attachment.id === attachmentId && attachment.userId === userId),
      );

      if (db.attachments.length === before) {
        return false;
      }

      await this.persist(db);
      return true;
    });
  }

  // --- Administration -----------------------------------------------------

  async getAdminMetrics(): Promise<AdminMetrics> {
    return this.run((db) => {
      const usageByModel = new Map<string, AdminMetrics["usageByModel"][number]>();

      for (const event of db.usageEvents) {
        const key = `${event.provider}:${event.model}`;
        const existing = usageByModel.get(key) ?? {
          provider: event.provider,
          model: event.model,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        };

        existing.requests += 1;
        existing.inputTokens += event.inputTokens;
        existing.outputTokens += event.outputTokens;
        existing.estimatedCostUsd += event.estimatedCostUsd;
        usageByModel.set(key, existing);
      }

      const errorCounts = new Map<string, number>();
      for (const message of db.messages) {
        if (message.errorCode) {
          errorCounts.set(
            message.errorCode,
            (errorCounts.get(message.errorCode) ?? 0) + 1,
          );
        }
      }

      const safetyCounts = new Map<
        string,
        AdminMetrics["safetyEvents"][number]
      >();
      for (const event of db.safetyEvents) {
        const key = `${event.kind}:${event.severity}`;
        const existing = safetyCounts.get(key) ?? {
          kind: event.kind,
          severity: event.severity,
          count: 0,
        };
        existing.count += 1;
        safetyCounts.set(key, existing);
      }

      return {
        userCount: db.profiles.length,
        conversationCount: db.conversations.filter(
          (row) => row.deletedAt === null,
        ).length,
        messageCount: db.messages.length,
        usageByModel: [...usageByModel.values()].sort(
          (a, b) => b.estimatedCostUsd - a.estimatedCostUsd,
        ),
        feedback: {
          up: db.messages.filter((message) => message.feedback === "up").length,
          down: db.messages.filter((message) => message.feedback === "down")
            .length,
        },
        recentErrors: [...errorCounts.entries()]
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
        safetyEvents: [...safetyCounts.values()].sort(
          (a, b) => b.count - a.count,
        ),
      };
    });
  }

  async deleteAllUserData(userId: string): Promise<void> {
    await this.run(async (db) => {
      db.conversations = db.conversations.filter((row) => row.userId !== userId);
      db.messages = db.messages.filter((row) => row.userId !== userId);
      db.attachments = db.attachments.filter((row) => row.userId !== userId);
      db.profiles = db.profiles.filter((row) => row.id !== userId);
      // Usage events are retained but unlinked, so aggregate cost reporting
      // survives an account deletion without keeping personal data.
      db.usageEvents = db.usageEvents.map((event) =>
        event.userId === userId ? { ...event, userId: "deleted-user" } : event,
      );
      db.safetyEvents = db.safetyEvents.map((event) =>
        event.userId === userId ? { ...event, userId: null } : event,
      );

      await this.persist(db);
    });
  }
}

function toConversation(row: StoredConversation): Omit<Conversation, "messages"> {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toChatMessage(row: StoredMessage): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
    ...(row.model ? { model: row.model } : {}),
    ...(row.feedback ? { feedback: row.feedback } : {}),
  };
}

/**
 * Drop the owner id before returning a row to a caller.
 *
 * Built by copying the public fields rather than destructuring the owner away,
 * because an unused binding is itself lint noise and this states the returned
 * shape explicitly.
 */
function stripUserId(row: StoredAttachment): AttachmentRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath: row.storagePath,
    status: row.status,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  };
}

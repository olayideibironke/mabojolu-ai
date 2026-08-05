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
  AddPrepaidCreditInput,
  AdminMetrics,
  AppendMessageInput,
  AttachmentInput,
  AttachmentRecord,
  BillingAccount,
  BillingUsageReservation,
  CreateConversationInput,
  DatabaseAdapter,
  Profile,
  ReserveBillingUsageInput,
  SafetyEventInput,
  SettleBillingUsageInput,
  UpdateBillingSubscriptionInput,
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

interface StoredBillingCreditEvent {
  id: string;
  userId: string;
  externalReference: string;
  amountMicros: number;
  createdAt: string;
}

interface Database {
  version: 1;
  profiles: Profile[];
  conversations: StoredConversation[];
  messages: StoredMessage[];
  usageEvents: StoredUsageEvent[];
  safetyEvents: StoredSafetyEvent[];
  attachments: StoredAttachment[];
  billingAccounts: BillingAccount[];
  billingReservations: BillingUsageReservation[];
  billingCreditEvents: StoredBillingCreditEvent[];
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
    billingAccounts: [],
    billingReservations: [],
    billingCreditEvents: [],
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
  private run<T>(
    operation: (db: Database) => Promise<T> | T,
  ): Promise<T> {
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
      if (parsed.version !== 1) {
        this.cache = emptyDatabase();

        return this.cache;
      }

      // Attachments created before message-level persistence did not contain a
      // `messageId`. Normalize those development rows to the current shape so
      // existing local conversations remain readable after this upgrade.
      parsed.attachments = parsed.attachments.map((attachment) => ({
        ...attachment,
        messageId: attachment.messageId ?? null,
      }));

      /*
       * Billing collections were added after the original local schema. Keep
       * existing development data intact by normalizing missing arrays instead
       * of bumping the file version and discarding the store.
       */
      parsed.billingAccounts ??= [];
      parsed.billingReservations ??= [];
      parsed.billingCreditEvents ??= [];

      this.cache = parsed;
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
    await mkdir(path.dirname(this.filePath), {
      recursive: true,
    });

    const temporary = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(
      temporary,
      JSON.stringify(db, null, 2),
      "utf8",
    );

    await rename(temporary, this.filePath);
  }

  // --- Profiles -----------------------------------------------------------

  async getProfile(
    userId: string,
  ): Promise<Profile | null> {
    return this.run(
      (db) =>
        db.profiles.find(
          (profile) => profile.id === userId,
        ) ?? null,
    );
  }

  async upsertProfile(input: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<Profile> {
    return this.run(async (db) => {
      const existing = db.profiles.find(
        (profile) => profile.id === input.id,
      );

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
        role:
          db.profiles.length === 0
            ? "admin"
            : "user",

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
      const now =
        new Date().toISOString();

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

      return {
        ...toConversation(row),
        messages: [],
      };
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
        .filter(
          (message) =>
            message.conversationId === conversationId,
        )
        .sort(
          (first, second) =>
            first.sequence - second.sequence,
        )
        .map(toChatMessage);

      return {
        ...toConversation(row),
        messages,
      };
    });
  }

  async listConversations(
    userId: string,
    options: {
      search?: string;
      limit?: number;
    } = {},
  ): Promise<ConversationSummary[]> {
    return this.run((db) => {
      const search =
        options.search
          ?.trim()
          .toLowerCase();

      let rows = db.conversations.filter(
        (row) =>
          row.userId === userId &&
          row.deletedAt === null,
      );

      if (search) {
        // Title match, plus message bodies so a user can find a conversation by
        // something they remember saying in it.
        const matchingIds = new Set(
          db.messages
            .filter(
              (message) =>
                message.userId === userId &&
                message.content
                  .toLowerCase()
                  .includes(search),
            )
            .map(
              (message) =>
                message.conversationId,
            ),
        );

        rows = rows.filter(
          (row) =>
            row.title
              .toLowerCase()
              .includes(search) ||
            matchingIds.has(row.id),
        );
      }

      return rows
        .sort((first, second) =>
          second.updatedAt.localeCompare(
            first.updatedAt,
          ),
        )
        .slice(
          0,
          options.limit ?? 100,
        )
        .map((row) => ({
          id: row.id,
          title: row.title,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,

          messageCount:
            db.messages.filter(
              (message) =>
                message.conversationId === row.id,
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

      row.updatedAt =
        new Date().toISOString();

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
          candidate.id === conversationId &&
          candidate.userId === userId,
      );

      if (
        !row ||
        row.deletedAt !== null
      ) {
        return false;
      }

      // A hard delete of the conversation and its messages, because the user
      // asked for deletion and a soft-deleted row that still holds their words
      // would not honor that.
      db.conversations =
        db.conversations.filter(
          (candidate) =>
            candidate.id !== conversationId,
        );

      db.messages =
        db.messages.filter(
          (message) =>
            message.conversationId !==
            conversationId,
        );

      db.attachments =
        db.attachments.filter(
          (attachment) =>
            attachment.conversationId !==
            conversationId,
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
          candidate.id === conversationId &&
          candidate.userId === userId,
      );

      if (row) {
        row.updatedAt =
          new Date().toISOString();

        await this.persist(db);
      }
    });
  }

  // --- Messages -----------------------------------------------------------

  async appendMessage(
    input: AppendMessageInput,
  ): Promise<ChatMessage> {
    return this.run(async (db) => {
      const conversation =
        db.conversations.find(
          (candidate) =>
            candidate.id === input.conversationId &&
            candidate.userId === input.userId &&
            candidate.deletedAt === null,
        );

      // Refuse to write into a conversation the caller does not own, rather than
      // silently creating an orphaned message.
      if (!conversation) {
        throw new Error(
          "Conversation not found for this user.",
        );
      }

      // Idempotency: a retry carrying the same client id returns the existing
      // row instead of duplicating the message.
      if (input.clientId) {
        const existing = db.messages.find(
          (message) =>
            message.conversationId ===
              input.conversationId &&
            message.clientId === input.clientId,
        );

        if (existing) {
          return toChatMessage(
            existing,
          );
        }
      }

      const now =
        new Date().toISOString();

      const row: StoredMessage = {
        id: randomUUID(),
        conversationId:
          input.conversationId,
        userId: input.userId,
        clientId:
          input.clientId ?? null,
        role: input.role,
        content: input.content,
        status: input.status,
        model: input.model ?? null,
        promptVersion:
          input.promptVersion ?? null,
        usage: input.usage ?? null,
        errorCode:
          input.errorCode ?? null,
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
        (message) =>
          message.id === messageId &&
          message.userId === userId,
      );

      if (!row) {
        return false;
      }

      if (
        patch.content !== undefined
      ) {
        row.content = patch.content;
      }

      if (
        patch.status !== undefined
      ) {
        row.status = patch.status;
      }

      if (
        patch.usage !== undefined
      ) {
        row.usage = patch.usage;
      }

      if (
        patch.errorCode !== undefined
      ) {
        row.errorCode =
          patch.errorCode;
      }

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

      return row
        ? toChatMessage(row)
        : null;
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

      const removedMessageIds =
        new Set(
          db.messages
            .filter(
              (message) =>
                message.conversationId === conversationId &&
                message.userId === userId &&
                message.sequence >= anchor.sequence,
            )
            .map(
              (message) =>
                message.id,
            ),
        );

      // Everything from the anchor onward is dropped, because those turns
      // answered a question that no longer exists.
      db.messages =
        db.messages.filter(
          (message) =>
            message.conversationId !== conversationId ||
            message.sequence < anchor.sequence,
        );

      // Message-owned attachments must follow the messages they belong to.
      // Conversation-level attachments have a null message id and remain.
      db.attachments =
        db.attachments.filter(
          (attachment) =>
            attachment.userId !== userId ||
            attachment.conversationId !== conversationId ||
            attachment.messageId === null ||
            !removedMessageIds.has(
              attachment.messageId,
            ),
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
        (message) =>
          message.id === messageId &&
          message.userId === userId,
      );

      if (!row) {
        return false;
      }

      row.feedback = rating;

      row.feedbackNote =
        note ?? null;

      await this.persist(db);

      return true;
    });
  }

  // --- Usage and safety ---------------------------------------------------

  async recordUsage(
    input: UsageEventInput,
  ): Promise<void> {
    await this.run(async (db) => {
      db.usageEvents.push({
        ...input,
        id: randomUUID(),
        createdAt:
          new Date().toISOString(),
      });

      await this.persist(db);
    });
  }

  async recordSafetyEvent(
    input: SafetyEventInput,
  ): Promise<void> {
    await this.run(async (db) => {
      db.safetyEvents.push({
        ...input,
        id: randomUUID(),
        createdAt:
          new Date().toISOString(),
      });

      await this.persist(db);
    });
  }

  async countRecentMessages(
    userId: string,
    sinceIso: string,
  ): Promise<number> {
    return this.run(
      (db) =>
        db.messages.filter(
          (message) =>
            message.userId === userId &&
            message.role === "assistant" &&
            message.status === "complete" &&
            message.createdAt >= sinceIso,
        ).length,
    );
  }


  // --- Billing ------------------------------------------------------------

  async getBillingAccount(
    userId: string,
  ): Promise<BillingAccount | null> {
    return this.run((db) => {
      const account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId === userId,
        );

      return account
        ? cloneBillingAccount(account)
        : null;
    });
  }

  async ensureBillingAccount(
    userId: string,
  ): Promise<BillingAccount> {
    return this.run(async (db) => {
      const existing =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId === userId,
        );

      if (existing) {
        return cloneBillingAccount(
          existing,
        );
      }

      if (
        !db.profiles.some(
          (profile) =>
            profile.id === userId,
        )
      ) {
        throw new Error(
          "Profile not found for this user.",
        );
      }

      const account =
        createBillingAccount(
          userId,
        );

      db.billingAccounts.push(
        account,
      );

      await this.persist(db);

      return cloneBillingAccount(
        account,
      );
    });
  }

  async reserveBillingUsage(
    input: ReserveBillingUsageInput,
  ): Promise<BillingUsageReservation | null> {
    assertPositiveMicros(
      input.amountMicros,
      "Reservation amount",
    );

    return this.run(async (db) => {
      const existingReservation =
        db.billingReservations.find(
          (reservation) =>
            reservation.id === input.id,
        );

      if (existingReservation) {
        if (
          existingReservation.userId !==
          input.userId
        ) {
          throw new Error(
            "Billing reservation identifier is already in use.",
          );
        }

        return cloneBillingReservation(
          existingReservation,
        );
      }

      const account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId ===
            input.userId,
        );

      if (!account) {
        return null;
      }

      const now =
        new Date();

      const availableSubscriptionMicros =
        hasActiveSubscription(
          account,
          now,
        )
          ? Math.max(
              0,
              account.includedUsageMicros -
                account.usedUsageMicros,
            )
          : 0;

      let fundingSource:
        | BillingUsageReservation["fundingSource"]
        | null = null;

      if (
        availableSubscriptionMicros >=
        input.amountMicros
      ) {
        account.usedUsageMicros =
          checkedAddMicros(
            account.usedUsageMicros,
            input.amountMicros,
            "Subscription usage",
          );

        fundingSource =
          "subscription";
      } else if (
        account.prepaidBalanceMicros >=
        input.amountMicros
      ) {
        account.prepaidBalanceMicros -=
          input.amountMicros;

        fundingSource =
          "prepaid";
      }

      if (!fundingSource) {
        return null;
      }

      const nowIso =
        now.toISOString();

      const reservation:
        BillingUsageReservation = {
          id: input.id,
          userId: input.userId,
          conversationId:
            input.conversationId,
          modelId: input.modelId,
          fundingSource,
          reservedMicros:
            input.amountMicros,
          actualMicros: null,
          status: "reserved",
          createdAt: nowIso,
          settledAt: null,
        };

      account.updatedAt =
        nowIso;

      db.billingReservations.push(
        reservation,
      );

      await this.persist(db);

      return cloneBillingReservation(
        reservation,
      );
    });
  }

  async settleBillingUsage(
    input: SettleBillingUsageInput,
  ): Promise<boolean> {
    assertNonnegativeMicros(
      input.actualMicros,
      "Actual usage",
    );

    return this.run(async (db) => {
      const reservation =
        db.billingReservations.find(
          (candidate) =>
            candidate.id ===
              input.reservationId &&
            candidate.userId ===
              input.userId,
        );

      if (!reservation) {
        return false;
      }

      if (
        reservation.status ===
        "settled"
      ) {
        return (
          reservation.actualMicros ===
          input.actualMicros
        );
      }

      if (
        reservation.status !==
        "reserved" ||
        input.actualMicros >
          reservation.reservedMicros
      ) {
        return false;
      }

      const account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId ===
            input.userId,
        );

      if (!account) {
        return false;
      }

      const refundMicros =
        reservation.reservedMicros -
        input.actualMicros;

      refundReservation(
        account,
        reservation,
        refundMicros,
      );

      const nowIso =
        new Date().toISOString();

      reservation.actualMicros =
        input.actualMicros;

      reservation.status =
        "settled";

      reservation.settledAt =
        nowIso;

      account.updatedAt =
        nowIso;

      await this.persist(db);

      return true;
    });
  }

  async releaseBillingUsage(
    reservationId: string,
    userId: string,
  ): Promise<boolean> {
    return this.run(async (db) => {
      const reservation =
        db.billingReservations.find(
          (candidate) =>
            candidate.id ===
              reservationId &&
            candidate.userId ===
              userId,
        );

      if (!reservation) {
        return false;
      }

      if (
        reservation.status ===
        "released"
      ) {
        return true;
      }

      if (
        reservation.status !==
        "reserved"
      ) {
        return false;
      }

      const account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId ===
            userId,
        );

      if (!account) {
        return false;
      }

      refundReservation(
        account,
        reservation,
        reservation.reservedMicros,
      );

      const nowIso =
        new Date().toISOString();

      reservation.status =
        "released";

      reservation.actualMicros =
        0;

      reservation.settledAt =
        nowIso;

      account.updatedAt =
        nowIso;

      await this.persist(db);

      return true;
    });
  }

  async updateBillingSubscription(
    input: UpdateBillingSubscriptionInput,
  ): Promise<BillingAccount> {
    assertNonnegativeMicros(
      input.includedUsageMicros,
      "Included usage",
    );

    return this.run(async (db) => {
      let account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId ===
            input.userId,
        );

      if (!account) {
        if (
          !db.profiles.some(
            (profile) =>
              profile.id ===
              input.userId,
          )
        ) {
          throw new Error(
            "Profile not found for this user.",
          );
        }

        account =
          createBillingAccount(
            input.userId,
          );

        db.billingAccounts.push(
          account,
        );
      }

      account.planId =
        input.planId;

      account.subscriptionStatus =
        input.subscriptionStatus;

      if (
        input.stripeCustomerId !==
        undefined
      ) {
        account.stripeCustomerId =
          input.stripeCustomerId;
      }

      if (
        input.stripeSubscriptionId !==
        undefined
      ) {
        account.stripeSubscriptionId =
          input.stripeSubscriptionId;
      }

      if (
        input.currentPeriodStart !==
        undefined
      ) {
        account.currentPeriodStart =
          input.currentPeriodStart;
      }

      if (
        input.currentPeriodEnd !==
        undefined
      ) {
        account.currentPeriodEnd =
          input.currentPeriodEnd;
      }

      account.includedUsageMicros =
        input.includedUsageMicros;

      if (
        input.resetPeriodUsage
      ) {
        account.usedUsageMicros =
          0;
      }

      account.updatedAt =
        new Date().toISOString();

      await this.persist(db);

      return cloneBillingAccount(
        account,
      );
    });
  }

  async addPrepaidCredit(
    input: AddPrepaidCreditInput,
  ): Promise<BillingAccount> {
    assertPositiveMicros(
      input.amountMicros,
      "Prepaid credit",
    );

    const externalReference =
      input.externalReference.trim();

    if (!externalReference) {
      throw new Error(
        "A payment reference is required.",
      );
    }

    return this.run(async (db) => {
      const existingCredit =
        db.billingCreditEvents.find(
          (event) =>
            event.externalReference ===
            externalReference,
        );

      if (existingCredit) {
        if (
          existingCredit.userId !==
          input.userId
        ) {
          throw new Error(
            "Payment reference is already associated with another user.",
          );
        }

        const existingAccount =
          db.billingAccounts.find(
            (candidate) =>
              candidate.userId ===
              input.userId,
          );

        if (!existingAccount) {
          throw new Error(
            "Billing account not found for an existing payment.",
          );
        }

        return cloneBillingAccount(
          existingAccount,
        );
      }

      let account =
        db.billingAccounts.find(
          (candidate) =>
            candidate.userId ===
            input.userId,
        );

      if (!account) {
        if (
          !db.profiles.some(
            (profile) =>
              profile.id ===
              input.userId,
          )
        ) {
          throw new Error(
            "Profile not found for this user.",
          );
        }

        account =
          createBillingAccount(
            input.userId,
          );

        db.billingAccounts.push(
          account,
        );
      }

      account.prepaidBalanceMicros =
        checkedAddMicros(
          account.prepaidBalanceMicros,
          input.amountMicros,
          "Prepaid balance",
        );

      const nowIso =
        new Date().toISOString();

      account.updatedAt =
        nowIso;

      db.billingCreditEvents.push({
        id: randomUUID(),
        userId: input.userId,
        externalReference,
        amountMicros:
          input.amountMicros,
        createdAt: nowIso,
      });

      await this.persist(db);

      return cloneBillingAccount(
        account,
      );
    });
  }

  // --- Attachments --------------------------------------------------------

  async createAttachment(
    input: AttachmentInput,
  ): Promise<AttachmentRecord> {
    return this.run(async (db) => {
      const ownsConversation =
        db.conversations.some(
          (candidate) =>
            candidate.id === input.conversationId &&
            candidate.userId === input.userId &&
            candidate.deletedAt === null,
        );

      if (!ownsConversation) {
        throw new Error(
          "Conversation not found for this user.",
        );
      }

      if (input.messageId) {
        const ownsMessage =
          db.messages.some(
            (message) =>
              message.id === input.messageId &&
              message.conversationId === input.conversationId &&
              message.userId === input.userId,
          );

        if (!ownsMessage) {
          throw new Error(
            "Message not found for this user.",
          );
        }
      }

      const row: StoredAttachment = {
        id: randomUUID(),
        userId: input.userId,
        conversationId:
          input.conversationId,
        messageId:
          input.messageId ?? null,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath:
          input.storagePath,

        // Starts pending. Nothing may treat the file as readable until the
        // processing step marks it ready.
        status: "pending",

        failureReason: null,
        createdAt:
          new Date().toISOString(),
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
    options: {
      failureReason?: string;
      storagePath?: string;
    } = {},
  ): Promise<boolean> {
    return this.run(async (db) => {
      const row = db.attachments.find(
        (attachment) =>
          attachment.id === attachmentId &&
          attachment.userId === userId,
      );

      if (!row) {
        return false;
      }

      row.status = status;

      row.failureReason =
        options.failureReason ?? null;

      // Recorded only once the bytes are actually in storage, so the row cannot
      // point at an object that does not exist.
      if (
        options.storagePath !== undefined
      ) {
        row.storagePath =
          options.storagePath;
      }

      await this.persist(db);

      return true;
    });
  }

  async getAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<AttachmentRecord | null> {
    return this.run((db) => {
      const row = db.attachments.find(
        (attachment) =>
          attachment.id === attachmentId &&
          attachment.userId === userId,
      );

      return row
        ? stripUserId(row)
        : null;
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
      const before =
        db.attachments.length;

      db.attachments =
        db.attachments.filter(
          (attachment) =>
            !(
              attachment.id === attachmentId &&
              attachment.userId === userId
            ),
        );

      if (
        db.attachments.length === before
      ) {
        return false;
      }

      await this.persist(db);

      return true;
    });
  }

  // --- Administration -----------------------------------------------------

  async getAdminMetrics(): Promise<AdminMetrics> {
    return this.run((db) => {
      const usageByModel =
        new Map<
          string,
          AdminMetrics["usageByModel"][number]
        >();

      for (
        const event of db.usageEvents
      ) {
        const key =
          `${event.provider}:${event.model}`;

        const existing =
          usageByModel.get(key) ?? {
            provider:
              event.provider,
            model: event.model,
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
          };

        existing.requests += 1;

        existing.inputTokens +=
          event.inputTokens;

        existing.outputTokens +=
          event.outputTokens;

        existing.estimatedCostUsd +=
          event.estimatedCostUsd;

        usageByModel.set(
          key,
          existing,
        );
      }

      const errorCounts =
        new Map<string, number>();

      for (
        const message of db.messages
      ) {
        if (message.errorCode) {
          errorCounts.set(
            message.errorCode,
            (errorCounts.get(
              message.errorCode,
            ) ?? 0) + 1,
          );
        }
      }

      const safetyCounts =
        new Map<
          string,
          AdminMetrics["safetyEvents"][number]
        >();

      for (
        const event of db.safetyEvents
      ) {
        const key =
          `${event.kind}:${event.severity}`;

        const existing =
          safetyCounts.get(key) ?? {
            kind: event.kind,
            severity:
              event.severity,
            count: 0,
          };

        existing.count += 1;

        safetyCounts.set(
          key,
          existing,
        );
      }

      return {
        userCount:
          db.profiles.length,

        conversationCount:
          db.conversations.filter(
            (row) =>
              row.deletedAt === null,
          ).length,

        messageCount:
          db.messages.length,

        usageByModel: [
          ...usageByModel.values(),
        ].sort(
          (first, second) =>
            second.estimatedCostUsd -
            first.estimatedCostUsd,
        ),

        feedback: {
          up: db.messages.filter(
            (message) =>
              message.feedback === "up",
          ).length,

          down: db.messages.filter(
            (message) =>
              message.feedback === "down",
          ).length,
        },

        recentErrors: [
          ...errorCounts.entries(),
        ]
          .map(
            ([code, count]) => ({
              code,
              count,
            }),
          )
          .sort(
            (first, second) =>
              second.count -
              first.count,
          ),

        safetyEvents: [
          ...safetyCounts.values(),
        ].sort(
          (first, second) =>
            second.count -
            first.count,
        ),
      };
    });
  }

  async deleteAllUserData(
    userId: string,
  ): Promise<void> {
    await this.run(async (db) => {
      db.conversations =
        db.conversations.filter(
          (row) =>
            row.userId !== userId,
        );

      db.messages =
        db.messages.filter(
          (row) =>
            row.userId !== userId,
        );

      db.attachments =
        db.attachments.filter(
          (row) =>
            row.userId !== userId,
        );

      db.profiles =
        db.profiles.filter(
          (row) =>
            row.id !== userId,
        );

      db.billingAccounts =
        db.billingAccounts.filter(
          (account) =>
            account.userId !==
            userId,
        );

      db.billingReservations =
        db.billingReservations.filter(
          (reservation) =>
            reservation.userId !==
            userId,
        );

      db.billingCreditEvents =
        db.billingCreditEvents.filter(
          (event) =>
            event.userId !==
            userId,
        );

      // Usage events are retained but unlinked, so aggregate cost reporting
      // survives an account deletion without keeping personal data.
      db.usageEvents =
        db.usageEvents.map(
          (event) =>
            event.userId === userId
              ? {
                  ...event,
                  userId:
                    "deleted-user",
                }
              : event,
        );

      db.safetyEvents =
        db.safetyEvents.map(
          (event) =>
            event.userId === userId
              ? {
                  ...event,
                  userId: null,
                }
              : event,
        );

      await this.persist(db);
    });
  }
}


function createBillingAccount(
  userId: string,
): BillingAccount {
  const now =
    new Date().toISOString();

  return {
    userId,
    planId: "none",
    subscriptionStatus:
      "none",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    includedUsageMicros: 0,
    usedUsageMicros: 0,
    prepaidBalanceMicros: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function cloneBillingAccount(
  account: BillingAccount,
): BillingAccount {
  return {
    ...account,
  };
}

function cloneBillingReservation(
  reservation: BillingUsageReservation,
): BillingUsageReservation {
  return {
    ...reservation,
  };
}

function hasActiveSubscription(
  account: BillingAccount,
  now: Date,
): boolean {
  if (
    account.subscriptionStatus !==
      "active" &&
    account.subscriptionStatus !==
      "trialing"
  ) {
    return false;
  }

  if (
    !account.currentPeriodEnd
  ) {
    return true;
  }

  const periodEnd =
    Date.parse(
      account.currentPeriodEnd,
    );

  return (
    Number.isFinite(periodEnd) &&
    periodEnd > now.getTime()
  );
}

function refundReservation(
  account: BillingAccount,
  reservation: BillingUsageReservation,
  amountMicros: number,
): void {
  if (amountMicros <= 0) {
    return;
  }

  if (
    reservation.fundingSource ===
    "subscription"
  ) {
    account.usedUsageMicros =
      Math.max(
        0,
        account.usedUsageMicros -
          amountMicros,
      );

    return;
  }

  account.prepaidBalanceMicros =
    checkedAddMicros(
      account.prepaidBalanceMicros,
      amountMicros,
      "Prepaid balance",
    );
}

function assertPositiveMicros(
  value: number,
  label: string,
): void {
  assertNonnegativeMicros(
    value,
    label,
  );

  if (value === 0) {
    throw new Error(
      `${label} must be greater than zero.`,
    );
  }
}

function assertNonnegativeMicros(
  value: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${label} must be a nonnegative integer number of microdollars.`,
    );
  }
}

function checkedAddMicros(
  current: number,
  amount: number,
  label: string,
): number {
  assertNonnegativeMicros(
    current,
    label,
  );

  assertNonnegativeMicros(
    amount,
    label,
  );

  const result =
    current + amount;

  if (
    !Number.isSafeInteger(
      result,
    )
  ) {
    throw new Error(
      `${label} exceeds the supported maximum.`,
    );
  }

  return result;
}

function toConversation(
  row: StoredConversation,
): Omit<Conversation, "messages"> {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toChatMessage(
  row: StoredMessage,
): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,

    ...(row.model
      ? {
          model: row.model,
        }
      : {}),

    ...(row.feedback
      ? {
          feedback: row.feedback,
        }
      : {}),
  };
}

/**
 * Drop the owner id before returning a row to a caller.
 *
 * Built by copying the public fields rather than destructuring the owner away,
 * because an unused binding is itself lint noise and this states the returned
 * shape explicitly.
 */
function stripUserId(
  row: StoredAttachment,
): AttachmentRecord {
  return {
    id: row.id,
    conversationId:
      row.conversationId,
    messageId: row.messageId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storagePath:
      row.storagePath,
    status: row.status,
    failureReason:
      row.failureReason,
    createdAt: row.createdAt,
  };
}
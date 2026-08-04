import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/auth/supabase-server";
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
 * Supabase persistence.
 *
 * Two clients are used deliberately:
 *
 *   User-scoped   Everything touching conversations, messages, attachments, and
 *                 feedback. Row-level security applies, so a bug in an
 *                 application filter is still caught by the database.
 *
 *   Service role  Only usage rows, safety rows, attachment status transitions,
 *                 and admin aggregates. Each is an operation the user genuinely
 *                 cannot perform: a client that could write usage rows could
 *                 forge cost data, and one that could set an attachment to
 *                 `ready` could make the model treat an unvalidated file as
 *                 readable.
 *
 * The `userId` parameters are not redundant with RLS. They keep ownership
 * enforced in application code too, so the two layers have to fail together for
 * data to leak.
 *
 * Not yet verified against a live project: see docs/KNOWN_LIMITATIONS.md.
 */
export class SupabaseDatabaseAdapter implements DatabaseAdapter {
  readonly kind = "supabase" as const;

  isReady(): boolean {
    return createServiceRoleClient() !== null;
  }

  /** The user-scoped client. Throws when unconfigured, since callers need a row. */
  private async userClient(): Promise<SupabaseClient> {
    const client = await createServerSupabaseClient();

    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    return client;
  }

  private serviceClient(): SupabaseClient {
    const client = createServiceRoleClient();

    if (!client) {
      throw new Error("Supabase service role is not configured.");
    }

    return client;
  }

  // --- Profiles -----------------------------------------------------------

  async getProfile(
    userId: string,
  ): Promise<Profile | null> {
    const client = await this.userClient();

    const { data, error } = await client
      .from("profiles")
      .select(
        "id, email, display_name, role, created_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return toProfile(data);
  }

  async upsertProfile(input: {
    id: string;
    email: string;
    displayName?: string | null;
  }): Promise<Profile> {
    /*
     * Service role, for a specific reason: a brand-new user has no profile row
     * yet, and the RLS select policy on `profiles` matches on the row existing.
     * The signup trigger normally creates it; this call is the fallback for a
     * user who predates the trigger.
     *
     * `role` is deliberately never written here, so this path cannot escalate a
     * user's privileges.
     */
    const client = this.serviceClient();

    const { data, error } = await client
      .from("profiles")
      .upsert(
        {
          id: input.id,
          email: input.email,

          ...(input.displayName === undefined
            ? {}
            : {
                display_name:
                  input.displayName,
              }),
        },
        {
          onConflict: "id",
        },
      )
      .select(
        "id, email, display_name, role, created_at",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Could not upsert profile: ${
          error?.message ?? "unknown"
        }`,
      );
    }

    return toProfile(data);
  }

  // --- Conversations ------------------------------------------------------

  async createConversation(
    input: CreateConversationInput,
  ): Promise<Conversation> {
    const client = await this.userClient();

    const { data, error } = await client
      .from("conversations")
      .insert({
        ...(input.id
          ? {
              id: input.id,
            }
          : {}),

        user_id: input.userId,
        title: input.title,
      })
      .select(
        "id, title, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Could not create conversation: ${
          error?.message ?? "unknown"
        }`,
      );
    }

    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messages: [],
    };
  }

  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation | null> {
    const client = await this.userClient();

    const { data, error } = await client
      .from("conversations")
      .select(
        "id, title, created_at, updated_at",
      )
      .eq("id", conversationId)

      // Explicit ownership filter alongside RLS.
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const { data: messageRows } = await client
      .from("messages")
      .select(
        "id, role, content, status, model_id, created_at",
      )
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    // Feedback lives in its own table, so it is fetched and merged here rather
    // than joined, which keeps the transcript query simple.
    const { data: feedbackRows } = await client
      .from("message_feedback")
      .select("message_id, rating")
      .eq("user_id", userId);

    const feedbackByMessage =
      new Map(
        (feedbackRows ?? []).map(
          (row) => [
            row.message_id,
            row.rating,
          ],
        ),
      );

    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,

      messages: (
        messageRows ?? []
      ).map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        status:
          row.status as MessageStatus,
        createdAt: row.created_at,

        ...(row.model_id
          ? {
              model: row.model_id,
            }
          : {}),

        ...(feedbackByMessage.has(
          row.id,
        )
          ? {
              feedback:
                feedbackByMessage.get(
                  row.id,
                ) as FeedbackRating,
            }
          : {}),
      })),
    };
  }

  async listConversations(
    userId: string,
    options: {
      search?: string;
      limit?: number;
    } = {},
  ): Promise<ConversationSummary[]> {
    const client =
      await this.userClient();

    const search =
      options.search?.trim();

    let matchingIds:
      | string[]
      | null = null;

    if (search) {
      // Search message bodies too, so a conversation can be found by something
      // the user remembers saying in it rather than only by title.
      const { data: hits } = await client
        .from("messages")
        .select("conversation_id")
        .eq("user_id", userId)
        .ilike(
          "content",
          `%${search}%`,
        )
        .limit(500);

      matchingIds = [
        ...new Set(
          (hits ?? []).map(
            (row) =>
              row.conversation_id,
          ),
        ),
      ];
    }

    let query = client
      .from("conversations")
      .select(
        "id, title, created_at, updated_at, messages(count)",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", {
        ascending: false,
      })
      .limit(
        options.limit ?? 100,
      );

    if (search) {
      const escaped =
        search.replace(
          /[%,()]/g,
          "",
        );

      const clauses = [
        `title.ilike.%${escaped}%`,
      ];

      if (
        matchingIds &&
        matchingIds.length > 0
      ) {
        clauses.push(
          `id.in.(${matchingIds.join(
            ",",
          )})`,
        );
      }

      query = query.or(
        clauses.join(","),
      );
    }

    const { data, error } =
      await query;

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,

      messageCount:
        Array.isArray(
          row.messages,
        ) &&
        row.messages.length > 0
          ? (
              row.messages[0] as {
                count?: number;
              }
            ).count ?? 0
          : 0,
    }));
  }

  async renameConversation(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<boolean> {
    const client =
      await this.userClient();

    const { error, count } =
      await client
        .from("conversations")
        .update(
          {
            title,
          },
          {
            count: "exact",
          },
        )
        .eq("id", conversationId)
        .eq("user_id", userId)
        .is("deleted_at", null);

    return (
      !error &&
      (count ?? 0) > 0
    );
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const client =
      await this.userClient();

    // Soft delete, so an undo window exists. Every read filters deleted rows,
    // and a scheduled purge removes them permanently.
    const { error, count } =
      await client
        .from("conversations")
        .update(
          {
            deleted_at:
              new Date().toISOString(),
          },
          {
            count: "exact",
          },
        )
        .eq("id", conversationId)
        .eq("user_id", userId)
        .is("deleted_at", null);

    return (
      !error &&
      (count ?? 0) > 0
    );
  }

  async touchConversation(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const client =
      await this.userClient();

    await client
      .from("conversations")
      .update({
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", userId);
  }

  // --- Messages -----------------------------------------------------------

  async appendMessage(
    input: AppendMessageInput,
  ): Promise<ChatMessage> {
    const client =
      await this.userClient();

    // Idempotency: return the existing row rather than inserting a duplicate.
    // The unique index also enforces this, so a race loses at the database.
    if (input.clientId) {
      const existing =
        await this.findMessageByClientId(
          input.conversationId,
          input.userId,
          input.clientId,
        );

      if (existing) {
        return existing;
      }
    }

    const { data, error } = await client
      .from("messages")
      .insert({
        conversation_id:
          input.conversationId,
        user_id: input.userId,
        role: input.role,
        content: input.content,
        status: input.status,
        client_id:
          input.clientId ?? null,
        model_id:
          input.model ?? null,
        prompt_version:
          input.promptVersion ?? null,
        input_tokens:
          input.usage
            ?.inputTokens ?? null,
        output_tokens:
          input.usage
            ?.outputTokens ?? null,
        cache_read_tokens:
          input.usage
            ?.cacheReadTokens ??
          null,
        cache_write_tokens:
          input.usage
            ?.cacheWriteTokens ??
          null,
        error_code:
          input.errorCode ?? null,
      })
      .select(
        "id, role, content, status, model_id, created_at",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Could not append message: ${
          error?.message ?? "unknown"
        }`,
      );
    }

    return {
      id: data.id,
      role: data.role,
      content: data.content,
      status:
        data.status as MessageStatus,
      createdAt: data.created_at,

      ...(data.model_id
        ? {
            model: data.model_id,
          }
        : {}),
    };
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
    const client =
      await this.userClient();

    const { error, count } =
      await client
        .from("messages")
        .update(
          {
            ...(patch.content ===
            undefined
              ? {}
              : {
                  content:
                    patch.content,
                }),

            ...(patch.status ===
            undefined
              ? {}
              : {
                  status:
                    patch.status,
                }),

            ...(patch.usage ===
            undefined
              ? {}
              : {
                  input_tokens:
                    patch.usage
                      .inputTokens,

                  output_tokens:
                    patch.usage
                      .outputTokens,

                  cache_read_tokens:
                    patch.usage
                      .cacheReadTokens ??
                    null,

                  cache_write_tokens:
                    patch.usage
                      .cacheWriteTokens ??
                    null,
                }),

            // Explicit null clears a previous error when a retry succeeds,
            // which the schema status and error constraint requires.
            ...(patch.errorCode ===
            undefined
              ? {}
              : {
                  error_code:
                    patch.errorCode ||
                    null,
                }),
          },
          {
            count: "exact",
          },
        )
        .eq("id", messageId)
        .eq("user_id", userId);

    return (
      !error &&
      (count ?? 0) > 0
    );
  }

  async findMessageByClientId(
    conversationId: string,
    userId: string,
    clientId: string,
  ): Promise<ChatMessage | null> {
    const client =
      await this.userClient();

    const { data, error } = await client
      .from("messages")
      .select(
        "id, role, content, status, model_id, created_at",
      )
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .eq(
        "client_id",
        clientId,
      )
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      role: data.role,
      content: data.content,
      status:
        data.status as MessageStatus,
      createdAt: data.created_at,

      ...(data.model_id
        ? {
            model: data.model_id,
          }
        : {}),
    };
  }

  async deleteMessagesFrom(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<boolean> {
    const client =
      await this.userClient();

    const {
      data: anchor,
      error: anchorError,
    } = await client
      .from("messages")
      .select("created_at")
      .eq("id", messageId)
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (
      anchorError ||
      !anchor
    ) {
      return false;
    }

    const {
      data: messageRows,
      error: messageLookupError,
    } = await client
      .from("messages")
      .select("id")
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .gte(
        "created_at",
        anchor.created_at,
      );

    if (messageLookupError) {
      return false;
    }

    const removedMessageIds = (
      messageRows ?? []
    ).map((row) => row.id);

    let attachmentPaths:
      string[] = [];

    if (
      removedMessageIds.length >
      0
    ) {
      const {
        data: attachmentRows,
        error:
          attachmentLookupError,
      } = await client
        .from("attachments")
        .select("storage_path")
        .eq(
          "conversation_id",
          conversationId,
        )
        .eq("user_id", userId)
        .in(
          "message_id",
          removedMessageIds,
        );

      if (
        attachmentLookupError
      ) {
        return false;
      }

      attachmentPaths = (
        attachmentRows ?? []
      ).map(
        (row) =>
          row.storage_path,
      );
    }

    const { error } = await client
      .from("messages")
      .delete()
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .gte(
        "created_at",
        anchor.created_at,
      );

    if (error) {
      return false;
    }

    /*
     * The message foreign key removes attachment rows. Storage objects live
     * outside Postgres, so their bytes must be removed separately.
     */
    if (
      attachmentPaths.length > 0
    ) {
      const {
        error: storageError,
      } = await client.storage
        .from("attachments")
        .remove(
          attachmentPaths,
        );

      if (storageError) {
        // The transcript edit succeeded. An orphan sweeper can retry storage
        // cleanup without restoring messages the user deliberately removed.
        console.error(
          "[mabojolu] edited-message storage cleanup failed",
          {
            message:
              storageError.message,
          },
        );
      }
    }

    return true;
  }

  // --- Feedback -----------------------------------------------------------

  async setFeedback(
    messageId: string,
    userId: string,
    rating:
      | FeedbackRating
      | null,
    note?: string,
  ): Promise<boolean> {
    const client =
      await this.userClient();

    // Null clears the rating, so feedback is reversible.
    if (rating === null) {
      const { error } = await client
        .from("message_feedback")
        .delete()
        .eq(
          "message_id",
          messageId,
        )
        .eq("user_id", userId);

      return !error;
    }

    const { error } = await client
      .from("message_feedback")
      .upsert(
        {
          message_id: messageId,
          user_id: userId,
          rating,
          note: note ?? null,
        },
        {
          onConflict:
            "message_id,user_id",
        },
      );

    return !error;
  }

  // --- Usage and safety ---------------------------------------------------

  async recordUsage(
    input: UsageEventInput,
  ): Promise<void> {
    // Service role: usage rows are cost-accounting truth, and there is no insert
    // policy for clients precisely so they cannot be forged.
    const client =
      this.serviceClient();

    const { error } = await client
      .from("usage_events")
      .insert({
        user_id: input.userId,
        conversation_id:
          input.conversationId,
        provider: input.provider,
        model_id: input.model,
        input_tokens:
          input.inputTokens,
        output_tokens:
          input.outputTokens,
        cache_read_tokens:
          input.cacheReadTokens ??
          0,
        cache_write_tokens:
          input.cacheWriteTokens ??
          0,
        estimated_cost_usd:
          input.estimatedCostUsd,
        finish_reason:
          input.finishReason,
      });

    if (error) {
      // Logged, never thrown: losing a usage row must not fail the user's reply.
      console.error(
        "[mabojolu] usage write failed",
        {
          code: error.code,
        },
      );
    }
  }

  async recordSafetyEvent(
    input: SafetyEventInput,
  ): Promise<void> {
    const client =
      this.serviceClient();

    const { error } = await client
      .from("safety_events")
      .insert({
        user_id: input.userId,
        conversation_id:
          input.conversationId,
        kind: input.kind,
        severity: input.severity,
        detail: input.detail,
      });

    if (error) {
      console.error(
        "[mabojolu] safety write failed",
        {
          code: error.code,
        },
      );
    }
  }

  async countRecentMessages(
    userId: string,
    sinceIso: string,
  ): Promise<number> {
    // Service role, so the quota counts every message even if a future policy
    // narrows what a user can read about themselves.
    const client =
      this.serviceClient();

    const { count, error } =
      await client
        .from("messages")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId)
        .eq("role", "user")
        .gte(
          "created_at",
          sinceIso,
        );

    if (error) {
      // Fail closed on an unknown count: treating an error as zero would turn a
      // database blip into an unlimited quota.
      console.error(
        "[mabojolu] quota count failed",
        {
          code: error.code,
        },
      );

      return Number.MAX_SAFE_INTEGER;
    }

    return count ?? 0;
  }

  // --- Attachments --------------------------------------------------------

  async createAttachment(
    input: AttachmentInput,
  ): Promise<AttachmentRecord> {
    const client =
      await this.userClient();

    const {
      data: conversation,
      error: conversationError,
    } = await client
      .from("conversations")
      .select("id")
      .eq(
        "id",
        input.conversationId,
      )
      .eq(
        "user_id",
        input.userId,
      )
      .is("deleted_at", null)
      .maybeSingle();

    if (
      conversationError ||
      !conversation
    ) {
      throw new Error(
        "Conversation not found for this user.",
      );
    }

    if (input.messageId) {
      const {
        data: message,
        error: messageError,
      } = await client
        .from("messages")
        .select("id")
        .eq(
          "id",
          input.messageId,
        )
        .eq(
          "conversation_id",
          input.conversationId,
        )
        .eq(
          "user_id",
          input.userId,
        )
        .maybeSingle();

      if (
        messageError ||
        !message
      ) {
        throw new Error(
          "Message not found for this user.",
        );
      }
    }

    const { data, error } = await client
      .from("attachments")
      .insert({
        conversation_id:
          input.conversationId,
        message_id:
          input.messageId ?? null,
        user_id: input.userId,
        filename: input.filename,
        mime_type: input.mimeType,
        size_bytes:
          input.sizeBytes,
        storage_path:
          input.storagePath,
      })
      .select(
        "id, conversation_id, message_id, filename, mime_type, size_bytes, storage_path, status, failure_reason, created_at",
      )
      .single();

    if (error || !data) {
      throw new Error(
        `Could not create attachment: ${
          error?.message ?? "unknown"
        }`,
      );
    }

    return toAttachment(data);
  }

  async updateAttachmentStatus(
    attachmentId: string,
    userId: string,
    status:
      AttachmentRecord["status"],
    options: {
      failureReason?: string;
      storagePath?: string;
    } = {},
  ): Promise<boolean> {
    /*
     * Service role by design. There is no client update policy on attachments,
     * because a client that could set status to `ready` could make the model
     * treat an unvalidated file as readable. Only server processing advances it.
     */
    const client =
      this.serviceClient();

    const { error, count } =
      await client
        .from("attachments")
        .update(
          {
            status,

            failure_reason:
              options.failureReason ??
              null,

            // Written only once the object exists in storage.
            ...(options.storagePath ===
            undefined
              ? {}
              : {
                  storage_path:
                    options.storagePath,
                }),
          },
          {
            count: "exact",
          },
        )
        .eq("id", attachmentId)

        // Ownership remains explicit even though the service role bypasses RLS.
        .eq("user_id", userId);

    return (
      !error &&
      (count ?? 0) > 0
    );
  }

  async getAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<AttachmentRecord | null> {
    const client =
      await this.userClient();

    const { data, error } = await client
      .from("attachments")
      .select(
        "id, conversation_id, message_id, filename, mime_type, size_bytes, storage_path, status, failure_reason, created_at",
      )
      .eq("id", attachmentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return toAttachment(data);
  }

  async listAttachments(
    conversationId: string,
    userId: string,
  ): Promise<AttachmentRecord[]> {
    const client =
      await this.userClient();

    const { data, error } = await client
      .from("attachments")
      .select(
        "id, conversation_id, message_id, filename, mime_type, size_bytes, storage_path, status, failure_reason, created_at",
      )
      .eq(
        "conversation_id",
        conversationId,
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: true,
      });

    if (error || !data) {
      return [];
    }

    return data.map(
      toAttachment,
    );
  }

  async deleteAttachment(
    attachmentId: string,
    userId: string,
  ): Promise<boolean> {
    const client =
      await this.userClient();

    const {
      data: row,
      error: lookupError,
    } = await client
      .from("attachments")
      .select("storage_path")
      .eq("id", attachmentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (
      lookupError ||
      !row
    ) {
      return false;
    }

    const { error } = await client
      .from("attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("user_id", userId);

    if (error) {
      return false;
    }

    // Remove the stored object too. A deleted row with a surviving file would
    // leave user data behind after they asked for it to be gone.
    const {
      error: storageError,
    } = await client.storage
      .from("attachments")
      .remove([
        row.storage_path,
      ]);

    if (storageError) {
      // The row is already gone, so report success. The orphan sweeper can
      // collect the remaining object later.
      console.error(
        "[mabojolu] storage delete failed",
        {
          message:
            storageError.message,
        },
      );
    }

    return true;
  }

  // --- Administration -----------------------------------------------------

  async getAdminMetrics(): Promise<AdminMetrics> {
    // Service role: these are cross-user aggregates, which no user-scoped query
    // can produce under RLS. The route already requires an admin session.
    const client =
      this.serviceClient();

    const [
      users,
      conversations,
      messages,
      usage,
      feedback,
      errors,
      safety,
    ] = await Promise.all([
      client
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true,
        }),

      client
        .from("conversations")
        .select("id", {
          count: "exact",
          head: true,
        })
        .is("deleted_at", null),

      client
        .from("messages")
        .select("id", {
          count: "exact",
          head: true,
        }),

      client
        .from("usage_events")
        .select(
          "provider, model_id, input_tokens, output_tokens, estimated_cost_usd",
        )
        .limit(10_000),

      client
        .from("message_feedback")
        .select("rating")
        .limit(10_000),

      client
        .from("messages")
        .select("error_code")
        .not(
          "error_code",
          "is",
          null,
        )
        .limit(1_000),

      client
        .from("safety_events")
        .select(
          "kind, severity",
        )
        .limit(5_000),
    ]);

    const usageByModel =
      new Map<
        string,
        AdminMetrics["usageByModel"][number]
      >();

    for (
      const row of usage.data ??
      []
    ) {
      const key =
        `${row.provider}:${row.model_id}`;

      const existing =
        usageByModel.get(key) ?? {
          provider: row.provider,
          model: row.model_id,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
        };

      existing.requests += 1;

      existing.inputTokens +=
        row.input_tokens ?? 0;

      existing.outputTokens +=
        row.output_tokens ?? 0;

      existing.estimatedCostUsd +=
        Number(
          row.estimated_cost_usd ??
            0,
        );

      usageByModel.set(
        key,
        existing,
      );
    }

    const errorCounts =
      new Map<string, number>();

    for (
      const row of errors.data ??
      []
    ) {
      if (row.error_code) {
        errorCounts.set(
          row.error_code,
          (errorCounts.get(
            row.error_code,
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
      const row of safety.data ??
      []
    ) {
      const key =
        `${row.kind}:${row.severity}`;

      const existing =
        safetyCounts.get(key) ?? {
          kind: row.kind,
          severity:
            row.severity,
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
        users.count ?? 0,

      conversationCount:
        conversations.count ?? 0,

      messageCount:
        messages.count ?? 0,

      usageByModel: [
        ...usageByModel.values(),
      ].sort(
        (first, second) =>
          second.estimatedCostUsd -
          first.estimatedCostUsd,
      ),

      feedback: {
        up: (
          feedback.data ?? []
        ).filter(
          (row) =>
            row.rating === "up",
        ).length,

        down: (
          feedback.data ?? []
        ).filter(
          (row) =>
            row.rating === "down",
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
  }

  async deleteAllUserData(
    userId: string,
  ): Promise<void> {
    /*
     * Service role, because this must succeed completely. A partial deletion
     * driven by per-table policies could leave rows behind, which would break
     * the promise made in the privacy documentation.
     *
     * Cascades from auth.users handle most of this, but attachments in storage
     * are removed explicitly first because no foreign key reaches into a bucket.
     */
    const client =
      this.serviceClient();

    const {
      data: attachments,
    } = await client
      .from("attachments")
      .select("storage_path")
      .eq("user_id", userId);

    if (
      attachments &&
      attachments.length > 0
    ) {
      await client.storage
        .from("attachments")
        .remove(
          attachments.map(
            (row) =>
              row.storage_path,
          ),
        );
    }

    await client
      .from("attachments")
      .delete()
      .eq("user_id", userId);

    await client
      .from("message_feedback")
      .delete()
      .eq("user_id", userId);

    await client
      .from("messages")
      .delete()
      .eq("user_id", userId);

    await client
      .from("conversations")
      .delete()
      .eq("user_id", userId);

    await client
      .from("profiles")
      .delete()
      .eq("id", userId);

    // Usage and safety rows use on-delete-set-null, so they survive
    // de-identified. This keeps aggregate cost history without personal data.
  }
}

interface ProfileRow {
  id: string;
  email: string;
  display_name:
    | string
    | null;
  role: string;
  created_at: string;
}

function toProfile(
  row: ProfileRow,
): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName:
      row.display_name,
    role:
      row.role === "admin"
        ? "admin"
        : "user",
    createdAt:
      row.created_at,
  };
}

interface AttachmentRow {
  id: string;
  conversation_id: string;
  message_id:
    | string
    | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: string;
  failure_reason:
    | string
    | null;
  created_at: string;
}

function toAttachment(
  row: AttachmentRow,
): AttachmentRecord {
  return {
    id: row.id,
    conversationId:
      row.conversation_id,
    messageId:
      row.message_id,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes:
      Number(row.size_bytes),
    storagePath:
      row.storage_path,
    status:
      row.status as AttachmentRecord["status"],
    failureReason:
      row.failure_reason,
    createdAt:
      row.created_at,
  };
}
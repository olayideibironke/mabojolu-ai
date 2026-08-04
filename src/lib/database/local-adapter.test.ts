import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalDatabaseAdapter } from "./local-adapter";

/**
 * Persistence tests.
 *
 * The ownership cases are the important ones. The local adapter has no row-level
 * security to fall back on, so its application-level filtering is the only control
 * protecting one user's conversations from another. If these pass, the same
 * ownership contract is what the Supabase adapter is written against.
 *
 * Each test gets its own temporary directory, so no state leaks between cases.
 */

const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";

let directory: string;
let database: LocalDatabaseAdapter;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "mabojolu-test-"));
  database = new LocalDatabaseAdapter({ directory });
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("conversations", () => {
  it("creates and reads back a conversation", async () => {
    const created = await database.createConversation({
      userId: USER_A,
      title: "First chat",
    });

    const loaded = await database.getConversation(created.id, USER_A);

    expect(loaded?.title).toBe("First chat");
    expect(loaded?.messages).toEqual([]);
  });

  it("does not return another user's conversation", async () => {
    // The core ownership guarantee: knowing an id is not enough.
    const created = await database.createConversation({
      userId: USER_A,
      title: "Private",
    });

    expect(await database.getConversation(created.id, USER_B)).toBeNull();
  });

  it("excludes another user's conversations from the list", async () => {
    await database.createConversation({ userId: USER_A, title: "A chat" });
    await database.createConversation({ userId: USER_B, title: "B chat" });

    const listForA = await database.listConversations(USER_A);

    expect(listForA).toHaveLength(1);
    expect(listForA[0].title).toBe("A chat");
  });

  it("refuses to rename another user's conversation", async () => {
    const created = await database.createConversation({
      userId: USER_A,
      title: "Original",
    });

    expect(await database.renameConversation(created.id, USER_B, "Hijacked")).toBe(
      false,
    );

    // Confirm the title genuinely did not change.
    const loaded = await database.getConversation(created.id, USER_A);
    expect(loaded?.title).toBe("Original");
  });

  it("refuses to delete another user's conversation", async () => {
    const created = await database.createConversation({
      userId: USER_A,
      title: "Keep me",
    });

    expect(await database.deleteConversation(created.id, USER_B)).toBe(false);
    expect(await database.getConversation(created.id, USER_A)).not.toBeNull();
  });

  it("deletes a conversation and its messages for the owner", async () => {
    const created = await database.createConversation({
      userId: USER_A,
      title: "Temporary",
    });
    await database.appendMessage({
      conversationId: created.id,
      userId: USER_A,
      role: "user",
      content: "Hello",
      status: "complete",
    });

    expect(await database.deleteConversation(created.id, USER_A)).toBe(true);
    expect(await database.getConversation(created.id, USER_A)).toBeNull();
  });

  it("orders the list by most recent activity", async () => {
    const first = await database.createConversation({
      userId: USER_A,
      title: "Older",
    });
    const second = await database.createConversation({
      userId: USER_A,
      title: "Newer",
    });

    // A message on the older conversation should lift it to the top.
    await database.appendMessage({
      conversationId: first.id,
      userId: USER_A,
      role: "user",
      content: "Bump",
      status: "complete",
    });

    const list = await database.listConversations(USER_A);
    expect(list[0].id).toBe(first.id);
    expect(list[1].id).toBe(second.id);
  });
});

describe("search", () => {
  it("matches on title", async () => {
    await database.createConversation({
      userId: USER_A,
      title: "Quarterly revenue plan",
    });
    await database.createConversation({ userId: USER_A, title: "Holiday recipes" });

    const results = await database.listConversations(USER_A, { search: "revenue" });

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Quarterly revenue plan");
  });

  it("matches on message content, not only title", async () => {
    // This is why search is a server query rather than a local filter: a user
    // remembers what they said more often than what the chat was titled.
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Untitled chat",
    });
    await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "user",
      content: "Tell me about photosynthesis",
      status: "complete",
    });

    const results = await database.listConversations(USER_A, {
      search: "photosynthesis",
    });

    expect(results).toHaveLength(1);
  });

  it("does not match another user's messages", async () => {
    const conversation = await database.createConversation({
      userId: USER_B,
      title: "B chat",
    });
    await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_B,
      role: "user",
      content: "secret keyword",
      status: "complete",
    });

    expect(
      await database.listConversations(USER_A, { search: "secret keyword" }),
    ).toEqual([]);
  });

  it("is case insensitive", async () => {
    await database.createConversation({ userId: USER_A, title: "Budget Review" });

    expect(
      await database.listConversations(USER_A, { search: "budget review" }),
    ).toHaveLength(1);
  });
});

describe("messages", () => {
  it("refuses to write into a conversation the user does not own", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "A chat",
    });

    // Rejected rather than silently creating an orphaned row.
    await expect(
      database.appendMessage({
        conversationId: conversation.id,
        userId: USER_B,
        role: "user",
        content: "Injected",
        status: "complete",
      }),
    ).rejects.toThrow();
  });

  it("returns the existing row for a repeated client id", async () => {
    // The idempotency guarantee: a retry must not duplicate a message.
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Retry test",
    });

    const first = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "user",
      content: "Only once",
      status: "complete",
      clientId: "client-key-1",
    });

    const second = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "user",
      content: "Only once",
      status: "complete",
      clientId: "client-key-1",
    });

    expect(second.id).toBe(first.id);

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages).toHaveLength(1);
  });

  it("preserves insertion order", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Ordering",
    });

    for (const content of ["one", "two", "three", "four"]) {
      await database.appendMessage({
        conversationId: conversation.id,
        userId: USER_A,
        role: "user",
        content,
        status: "complete",
      });
    }

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages.map((message) => message.content)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
  });

  it("updates a streaming message in place rather than inserting a second", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Streaming",
    });

    const message = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "assistant",
      content: "",
      status: "streaming",
    });

    expect(
      await database.updateMessage(message.id, USER_A, {
        content: "Finished reply",
        status: "complete",
      }),
    ).toBe(true);

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe("Finished reply");
    expect(loaded?.messages[0].status).toBe("complete");
  });

  it("refuses to update another user's message", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "A chat",
    });
    const message = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "assistant",
      content: "Original",
      status: "complete",
    });

    expect(
      await database.updateMessage(message.id, USER_B, { content: "Tampered" }),
    ).toBe(false);
  });

  it("preserves an interrupted message rather than discarding it", async () => {
    // Interruption is a legitimate outcome, so the partial text must survive.
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Stopped",
    });
    const message = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "assistant",
      content: "",
      status: "streaming",
    });

    await database.updateMessage(message.id, USER_A, {
      content: "Half an answer",
      status: "interrupted",
    });

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages[0].status).toBe("interrupted");
    expect(loaded?.messages[0].content).toBe("Half an answer");
  });

  it("deletes from an anchor onward, for edit and regenerate", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Edit test",
    });

    const ids: string[] = [];
    for (const content of ["first", "second", "third"]) {
      const message = await database.appendMessage({
        conversationId: conversation.id,
        userId: USER_A,
        role: "user",
        content,
        status: "complete",
      });
      ids.push(message.id);
    }

    // Removing from the second message should leave only the first.
    expect(
      await database.deleteMessagesFrom(conversation.id, USER_A, ids[1]),
    ).toBe(true);

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages.map((message) => message.content)).toEqual(["first"]);
  });
});

describe("feedback", () => {
  it("stores and clears a rating", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Feedback",
    });
    const message = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "assistant",
      content: "An answer",
      status: "complete",
    });

    expect(await database.setFeedback(message.id, USER_A, "up")).toBe(true);

    let loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages[0].feedback).toBe("up");

    // Null clears it, so a mis-click is reversible.
    await database.setFeedback(message.id, USER_A, null);
    loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages[0].feedback).toBeUndefined();
  });

  it("refuses feedback on another user's message", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Feedback",
    });
    const message = await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "assistant",
      content: "An answer",
      status: "complete",
    });

    expect(await database.setFeedback(message.id, USER_B, "down")).toBe(false);
  });
});

describe("usage and quotas", () => {
  it("counts only the user's own recent messages", async () => {
    const conversationA = await database.createConversation({
      userId: USER_A,
      title: "A",
    });
    const conversationB = await database.createConversation({
      userId: USER_B,
      title: "B",
    });

    await database.appendMessage({
      conversationId: conversationA.id,
      userId: USER_A,
      role: "user",
      content: "one",
      status: "complete",
    });
    await database.appendMessage({
      conversationId: conversationB.id,
      userId: USER_B,
      role: "user",
      content: "two",
      status: "complete",
    });

    const since = new Date(Date.now() - 60_000).toISOString();

    // A quota that counted another user's messages would lock people out for
    // someone else's activity.
    expect(await database.countRecentMessages(USER_A, since)).toBe(1);
  });

  it("aggregates usage and cost for the admin view", async () => {
    await database.recordUsage({
      userId: USER_A,
      conversationId: null,
      provider: "mock",
      model: "mabojolu-mock",
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.001,
      finishReason: "end_turn",
    });
    await database.recordUsage({
      userId: USER_A,
      conversationId: null,
      provider: "mock",
      model: "mabojolu-mock",
      inputTokens: 200,
      outputTokens: 75,
      estimatedCostUsd: 0.002,
      finishReason: "end_turn",
    });

    const metrics = await database.getAdminMetrics();

    expect(metrics.usageByModel).toHaveLength(1);
    expect(metrics.usageByModel[0].requests).toBe(2);
    expect(metrics.usageByModel[0].inputTokens).toBe(300);
    expect(metrics.usageByModel[0].estimatedCostUsd).toBeCloseTo(0.003);
  });
});

describe("attachments", () => {
  it("refuses to attach to a conversation the user does not own", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "A chat",
    });

    await expect(
      database.createAttachment({
        userId: USER_B,
        conversationId: conversation.id,
        filename: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        storagePath: `${USER_B}/x/x.pdf`,
      }),
    ).rejects.toThrow();
  });

  it("starts an attachment as pending, not ready", async () => {
    // Nothing may treat a file as readable before processing succeeds.
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Files",
    });

    const attachment = await database.createAttachment({
      userId: USER_A,
      conversationId: conversation.id,
      filename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      storagePath: `${USER_A}/${conversation.id}/report.pdf`,
    });

    expect(attachment.status).toBe("pending");
  });

  it("does not expose the owner id on a returned attachment", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Files",
    });

    const attachment = await database.createAttachment({
      userId: USER_A,
      conversationId: conversation.id,
      filename: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      storagePath: `${USER_A}/${conversation.id}/report.pdf`,
    });

    expect(attachment).not.toHaveProperty("userId");
  });

  it("does not list another user's attachments", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Files",
    });
    await database.createAttachment({
      userId: USER_A,
      conversationId: conversation.id,
      filename: "private.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      storagePath: `${USER_A}/${conversation.id}/private.pdf`,
    });

    expect(await database.listAttachments(conversation.id, USER_B)).toEqual([]);
  });
});

describe("account deletion", () => {
  it("removes the user's data but keeps de-identified usage history", async () => {
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "To delete",
    });
    await database.appendMessage({
      conversationId: conversation.id,
      userId: USER_A,
      role: "user",
      content: "Personal content",
      status: "complete",
    });
    await database.recordUsage({
      userId: USER_A,
      conversationId: conversation.id,
      provider: "mock",
      model: "mabojolu-mock",
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.0001,
      finishReason: "end_turn",
    });

    await database.deleteAllUserData(USER_A);

    expect(await database.listConversations(USER_A)).toEqual([]);
    expect(await database.getConversation(conversation.id, USER_A)).toBeNull();

    // Aggregate cost history survives, which is why the row is de-identified
    // rather than deleted.
    const metrics = await database.getAdminMetrics();
    expect(metrics.usageByModel).toHaveLength(1);
  });
});

describe("durability", () => {
  it("persists across adapter instances", async () => {
    // Proves refresh restoration is real: a new process reads the same data.
    const created = await database.createConversation({
      userId: USER_A,
      title: "Survives restart",
    });
    await database.appendMessage({
      conversationId: created.id,
      userId: USER_A,
      role: "user",
      content: "Still here",
      status: "complete",
    });

    const reopened = new LocalDatabaseAdapter({ directory });
    const loaded = await reopened.getConversation(created.id, USER_A);

    expect(loaded?.title).toBe("Survives restart");
    expect(loaded?.messages[0].content).toBe("Still here");
  });

  it("handles concurrent writes without losing any", async () => {
    // The adapter serializes operations because two overlapping
    // read-modify-write cycles on one JSON file would drop rows.
    const conversation = await database.createConversation({
      userId: USER_A,
      title: "Concurrent",
    });

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        database.appendMessage({
          conversationId: conversation.id,
          userId: USER_A,
          role: "user",
          content: `message ${index}`,
          status: "complete",
        }),
      ),
    );

    const loaded = await database.getConversation(conversation.id, USER_A);
    expect(loaded?.messages).toHaveLength(25);
  });
});

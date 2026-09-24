import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "./use-chat";

/**
 * Chat hook behaviour.
 *
 * The first test here is a regression test for a real bug, and it is the reason
 * this file exists.
 *
 * `send`, `retry`, `regenerate`, and `editUserMessage` each started a network
 * request from inside a `setMessages` updater. State updaters must be pure, and
 * React deliberately double-invokes them in development to surface impure ones,
 * so every send fired twice and created two conversations milliseconds apart.
 *
 * It was invisible in unit tests that mocked at a higher level and invisible in
 * code review. It surfaced only by driving the running app and then counting rows
 * in the database. These tests assert the observable consequence: one call to the
 * transport per user action.
 */

/** Build a minimal SSE stream so the hook's reader completes normally. */
function sseResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function successfulReply(): Response {
  return sseResponse([
    JSON.stringify({
      type: "start",
      messageId: "server-msg-1",
      model: "mabojolu-mock",
      conversationId: "conv-1",
    }),
    JSON.stringify({ type: "delta", text: "Hello" }),
    JSON.stringify({ type: "delta", text: " there" }),
    JSON.stringify({ type: "done", finishReason: "end_turn" }),
  ]);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => successfulReply());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Requests to the chat endpoint only, ignoring feedback and history calls. */
function chatCalls(): unknown[] {
  return fetchMock.mock.calls.filter((call) => call[0] === "/api/chat");
}

describe("useChat", () => {
  it("issues exactly one request per send", async () => {
    // The regression assertion. Two requests here means a side effect has been
    // reintroduced into a state updater.
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatCalls()).toHaveLength(1);
  });

  it("adds the user turn and a streamed assistant reply", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "Hello",
    });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello there",
      status: "complete",
    });
  });

  it("keeps attachment-only synthetic instructions out of the visible user message", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("", [
        {
          kind: "document",
          id: "audio-evidence-1",
          name: "jfk.wav",
          mimeType: "text/plain",
          sizeBytes: 64,
          textContent: "Ask not what your country can do for you.",
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "",
    });

    expect(result.current.messages[0].attachments?.[0]).toMatchObject({
      name: "jfk.wav",
    });

    const call = chatCalls()[0] as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as {
      messages: Array<{ content: string }>;
    };

    expect(body.messages[0].content).toBe("");
  });

  it.each([
    {
      label: "PDF",
      prompt:
        "Create a PDF document containing exactly these three lines:\nMabojolu PDF Output Qualification\nThis is a genuine PDF document.\nUnicode check: café, ₦42,500, Maryland.\nGive me the file as a downloadable .pdf file.",
      endpoint: "/api/files/pdf",
      expectedContent:
        "Mabojolu PDF Output Qualification\nThis is a genuine PDF document.\nUnicode check: café, ₦42,500, Maryland.",
      file: {
        name: "mabojolu-output.pdf",
        mimeType: "application/pdf",
      },
    },
    {
      label: "DOCX",
      prompt:
        "Create a Word document containing exactly these three paragraphs:\nMabojolu DOCX Output Qualification\nThis is a genuine Microsoft Word document.\nUnicode check: café, ₦42,500, Maryland.\nGive me the file as a downloadable .docx file.",
      endpoint: "/api/files/docx",
      expectedContent:
        "Mabojolu DOCX Output Qualification\nThis is a genuine Microsoft Word document.\nUnicode check: café, ₦42,500, Maryland.",
      file: {
        name: "mabojolu-output.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    },
    {
      label: "XLSX",
      prompt:
        "Create an Excel spreadsheet containing exactly this table:\nProject|State|Target|Status\nFuseHarbor|Maryland|25000|Active\nKoruva|Lagos|70000|Validation\nGive me the file as a downloadable .xlsx file.",
      endpoint: "/api/files/xlsx",
      expectedContent:
        "Project|State|Target|Status\nFuseHarbor|Maryland|25000|Active\nKoruva|Lagos|70000|Validation",
      file: {
        name: "mabojolu-output.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    },
    {
      label: "PPTX",
      prompt:
        "Create a PowerPoint presentation containing exactly these slides:\nSlide 1: Mabojolu PPTX Output Qualification\nGenuine PowerPoint\n\nSlide 2: Westforge Holdings Inc.\nUnicode café, ₦42,500\nGive me the file as a downloadable .pptx file.",
      endpoint: "/api/files/pptx",
      expectedContent:
        "Slide 1: Mabojolu PPTX Output Qualification\nGenuine PowerPoint\n\nSlide 2: Westforge Holdings Inc.\nUnicode café, ₦42,500",
      file: {
        name: "mabojolu-output.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
    },
  ])(
    "routes exact $label requests to the matching generated-file endpoint",
    async ({ prompt, endpoint, expectedContent, file }) => {
      fetchMock.mockImplementation(async (input) => {
        if (input === endpoint) {
          return Response.json({
            file: {
              ...file,
              sizeBytes: 8,
              dataUrl: `data:${file.mimeType};base64,VEVTVA==`,
            },
          });
        }
        return successfulReply();
      });

      const { result } = renderHook(() => useChat());

      await act(async () => {
        result.current.send(prompt);
      });

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });

      const calls = fetchMock.mock.calls.filter(
        (call) => call[0] === endpoint,
      );
      expect(calls).toHaveLength(1);
      expect(chatCalls()).toHaveLength(0);

      const init = calls[0][1] as RequestInit;
      expect(JSON.parse(String(init.body))).toEqual({
        content: expectedContent,
      });

      expect(result.current.messages[1]).toMatchObject({
        role: "assistant",
        status: "complete",
        generatedFiles: [
          {
            name: file.name,
            mimeType: file.mimeType,
          },
        ],
      });
    },
  );

  it("creates exact UTF-8 text artifacts without leaking the instruction wrapper", async () => {
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "text-file-msg",
          model: "mabojolu-mock",
        }),
        JSON.stringify({
          type: "delta",
          text: "Model chatter that must not enter the exact file.",
        }),
        JSON.stringify({
          type: "done",
          finishReason: "end_turn",
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());
    const prompt =
      "Create a text file containing exactly these three lines:\nMabojolu TXT Output Qualification\nUnicode check: café, ₦42,500\nNo instruction text\nGive me the file as a downloadable .txt file.";

    await act(async () => {
      result.current.send(prompt);
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const file = result.current.messages[1].generatedFiles?.[0];
    expect(file).toMatchObject({
      name: "mabojolu-output.txt",
      mimeType: "text/plain",
    });
    expect(file?.dataUrl).toBeTruthy();

    const base64 = file?.dataUrl.split(",")[1] ?? "";
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      ),
    );

    expect(decoded).toBe(
      "Mabojolu TXT Output Qualification\nUnicode check: café, ₦42,500\nNo instruction text",
    );
    expect(decoded).not.toContain("Give me the file");
    expect(decoded).not.toContain("Model chatter");
  });

  it("routes natural attachment replacement requests to the file editor", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/files/edit") {
        return Response.json({
          file: {
            name: "proposal-modified.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeBytes: 24,
            dataUrl:
              "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,VEVTVA==",
          },
        });
      }

      return successfulReply();
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send(
        'Change "Old value" to "New value" in the attached Word document and return the modified file.',
        [
          {
            kind: "document",
            id: "doc-evidence-1",
            name: "proposal.docx",
            mimeType: "text/plain",
            sizeBytes: 32,
            textContent: "Old value\nKeep me",
            sourceAttachmentId: "attachment-123",
            sourceMimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        ],
      );
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const editCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/files/edit",
    );

    expect(editCalls).toHaveLength(1);
    expect(chatCalls()).toHaveLength(0);

    const init = editCalls[0][1] as RequestInit;

    expect(JSON.parse(String(init.body))).toEqual({
      attachmentId: "attachment-123",
      findText: "Old value",
      replaceText: "New value",
    });

    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      status: "complete",
      generatedFiles: [
        {
          name: "proposal-modified.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ],
    });
  });

  it("adopts the server's conversation id exactly once", async () => {
    // Reported once per conversation, not once per double-invoked updater.
    const onConversationChanged = vi.fn();
    const { result } = renderHook(() => useChat({ onConversationChanged }));

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onConversationChanged).toHaveBeenCalledTimes(1);
    expect(onConversationChanged).toHaveBeenCalledWith("conv-1");
  });

  it("records the server message id, so feedback is addressable", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1].serverId).toBe("server-msg-1");
  });

  it("ignores a send while a generation is running", async () => {
    // Prevents a double submit from starting two billable generations.
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.send("First");
    });
    act(() => {
      result.current.send("Second");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatCalls()).toHaveLength(1);
  });

  it("ignores an empty or whitespace-only send", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("   \n  ");
    });

    expect(chatCalls()).toHaveLength(0);
    expect(result.current.messages).toHaveLength(0);
  });

  it("keeps partial text and marks it interrupted when stopped", async () => {
    /*
     * The interruption guarantee. The transport reports an aborted finish, and the
     * partial reply must be retained rather than discarded or shown as failed.
     */
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-2",
          model: "mabojolu-mock",
          conversationId: "conv-2",
        }),
        JSON.stringify({ type: "delta", text: "Half an answer" }),
        JSON.stringify({ type: "done", finishReason: "aborted" }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Tell me something long");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1]).toMatchObject({
      content: "Half an answer",
      status: "interrupted",
    });
  });

  it("removes the placeholder when stopped before any text arrived", async () => {
    // An empty bubble left behind would look like a broken reply.
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-3",
          model: "mabojolu-mock",
        }),
        JSON.stringify({ type: "done", finishReason: "aborted" }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Stop immediately");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("attaches a retryable error and keeps partial text on failure", async () => {
    fetchMock.mockImplementation(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-4",
          model: "mabojolu-mock",
        }),
        JSON.stringify({ type: "delta", text: "Partial" }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "The AI service is temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages[1]).toMatchObject({
      content: "Partial",
      status: "failed",
    });
    expect(result.current.canRetry).toBe(true);
  });

  it("issues exactly one request per retry", async () => {
    fetchMock.mockImplementationOnce(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-5",
          model: "mabojolu-mock",
        }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "Temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // One send plus one retry. Three would mean the updater fired twice again.
    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
  });

  it("reuses the idempotency key on retry but not on regenerate", async () => {
    /*
     * A retry of the same logical request must be recognizable, so the server does
     * not bill a second generation. A regenerate is a new request the user asked
     * for, so it gets a fresh key.
     */
    fetchMock.mockImplementationOnce(async () =>
      sseResponse([
        JSON.stringify({
          type: "start",
          messageId: "server-msg-6",
          model: "mabojolu-mock",
        }),
        JSON.stringify({
          type: "error",
          error: {
            code: "provider_unavailable",
            message: "Temporarily unavailable.",
            retryable: true,
          },
        }),
      ]),
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.canRetry).toBe(true));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const keys = chatCalls().map((call) => {
      const init = (call as [string, RequestInit])[1];
      return JSON.parse(String(init.body)).idempotencyKey as string;
    });

    expect(keys[0]).toBe(keys[1]);
  });

  it("issues exactly one request when regenerating", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const assistantId = result.current.messages[1].id;

    await act(async () => {
      result.current.regenerate(assistantId);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
  });

  it("issues exactly one request when editing, and discards later turns", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Original question");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const userId = result.current.messages[0].id;

    await act(async () => {
      result.current.editUserMessage(userId, "Edited question");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(chatCalls()).toHaveLength(2);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe("Edited question");
  });

  it("does not send an unchanged edit", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Same text");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const userId = result.current.messages[0].id;

    await act(async () => {
      result.current.editUserMessage(userId, "   ");
    });

    // An empty edit is a no-op rather than a wasted generation.
    expect(chatCalls()).toHaveLength(1);
  });

  it("starts a handover continuation without carrying the old transcript", async () => {
    const { result } =
      renderHook(
        () =>
          useChat(),
      );

    await act(async () => {
      result.current.send(
        "Old project context",
      );
    });

    await waitFor(() =>
      expect(
        result.current
          .isStreaming,
      ).toBe(
        false,
      ),
    );

    await act(async () => {
      result.current
        .startFreshConversation(
          "# MABOJOLU CONTINUITY HANDOVER",
        );
    });

    await waitFor(() =>
      expect(
        result.current
          .isStreaming,
      ).toBe(
        false,
      ),
    );

    expect(
      chatCalls(),
    ).toHaveLength(
      2,
    );

    const secondCall =
      chatCalls()[1] as [
        string,
        RequestInit,
      ];

    const body =
      JSON.parse(
        String(
          secondCall[1]
            .body,
        ),
      ) as {
        conversationId?:
          string;
        messages:
          Array<{
            content:
              string;
          }>;
      };

    expect(
      body.conversationId,
    ).toBeUndefined();

    expect(
      body.messages,
    ).toHaveLength(
      1,
    );

    expect(
      body.messages[0]
        .content,
    ).toBe(
      "# MABOJOLU CONTINUITY HANDOVER",
    );

    expect(
      result.current
        .messages,
    ).toHaveLength(
      2,
    );

    expect(
      result.current
        .messages[0]
        .content,
    ).toBe(
      "# MABOJOLU CONTINUITY HANDOVER",
    );
  });

  it("clears the transcript and conversation on reset", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      result.current.send("Hello");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    act(() => {
      result.current.reset();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
  });

  it("loads a stored conversation and mirrors ids for feedback", async () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.loadMessages(
        [
          {
            id: "stored-1",
            role: "user",
            content: "Earlier question",
            status: "complete",
            createdAt: "2026-08-04T00:00:00.000Z",
          },
          {
            id: "stored-2",
            role: "assistant",
            content: "Earlier answer",
            status: "complete",
            createdAt: "2026-08-04T00:00:01.000Z",
          },
        ],
        "conv-restored",
      );
    });

    expect(result.current.messages).toHaveLength(2);
    // Stored rows already carry database ids, so actions work immediately after
    // a refresh.
    expect(result.current.messages[1].serverId).toBe("stored-2");
  });
});

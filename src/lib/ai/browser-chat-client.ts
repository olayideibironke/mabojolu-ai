"use client";

import {
  detectBrowserComputeCapabilities,
} from "./browser-compute";

import {
  selectComputeRoute,
} from "./compute-router";

import type {
  StreamCallbacks,
} from "./client-stream";

import type {
  ChatErrorPayload,
  ChatMessage,
} from "@/types/chat";

const BROWSER_MODEL_ID =
  "Llama-3.2-1B-Instruct-q4f16_1-MLC";

const BROWSER_DISPLAY_MODEL =
  "mabojolu-browser-fast";

const SYSTEM_PROMPT =
  "You are Mabojolu, a helpful on-device AI assistant. " +
  "Answer accurately and clearly. You are running entirely on the user's device. " +
  "Do not claim to have live web access or external tools unless the application explicitly provides them.";

interface BrowserChatBody {
  conversationId?:
    string;

  messages:
    Array<
      Pick<
        ChatMessage,
        | "id"
        | "role"
        | "content"
        | "createdAt"
        | "attachments"
      >
    >;

  modelId?:
    string;

  idempotencyKey:
    string;
}

interface WorkerEvent {
  type:
    | "status"
    | "delta"
    | "done"
    | "error";

  requestId:
    string;

  label?:
    string;

  text?:
    string;

  finishReason?:
    | "end_turn"
    | "max_tokens"
    | "aborted";

  message?:
    string;
}

interface BrowserBeginResponse {
  conversationId:
    string;

  messageId:
    string;

  model:
    string;
}

let sharedWorker:
  Worker |
  null = null;

function workerInstance():
  Worker {
  if (
    sharedWorker
  ) {
    return sharedWorker;
  }

  sharedWorker =
    new Worker(
      "/workers/mabojolu-webllm-worker.js",
      {
        type:
          "module",

        name:
          "mabojolu-webllm",
      },
    );

  return sharedWorker;
}

function browserRouteAvailable():
  boolean {
  if (
    typeof Worker ===
      "undefined"
  ) {
    return false;
  }

  const capabilities =
    detectBrowserComputeCapabilities();

  const route =
    selectComputeRoute([
      {
        id:
          "browser-webgpu",

        backend:
          "browser-webgpu",

        owner:
          "user",

        available:
          capabilities
            .eligible,

        supportsStreaming:
          true,

        requiresCredential:
          false,

        externalMeteredCost:
          false,
      },

      {
        id:
          "local-ollama",

        backend:
          "local-ollama",

        owner:
          "operator",

        available:
          true,

        supportsStreaming:
          true,

        requiresCredential:
          false,

        externalMeteredCost:
          false,
      },
    ]);

  return (
    route?.candidate
      .backend ===
    "browser-webgpu"
  );
}

/**
 * Browser inference v0.1 intentionally activates only for Mabojolu Fast and
 * text-only conversations.
 *
 * Fast uses the smallest verified WebLLM model in this checkpoint. Image
 * requests and the larger response modes stay on the configured Ollama server
 * until browser VLM and device-tier selection are verified separately.
 */
export function shouldUseBrowserChat(
  body:
    BrowserChatBody,
): boolean {
  if (
    body.modelId !==
      "mabojolu-fast"
  ) {
    return false;
  }

  if (
    body.messages.some(
      (message) =>
        (
          message
            .attachments
            ?.length ??
          0
        ) >
        0,
    )
  ) {
    return false;
  }

  return browserRouteAvailable();
}

async function responseError(
  response:
    Response,
):
  Promise<
    ChatErrorPayload
  > {
  try {
    const data =
      await response.json() as {
        error?:
          ChatErrorPayload;
      };

    if (
      data.error
    ) {
      return data.error;
    }
  } catch {
    // Fall through to the generic safe error.
  }

  return {
    code:
      "internal_error",

    message:
      "Mabojolu could not prepare the on-device conversation.",
    
    retryable:
      true,
  };
}

async function beginPersistence(
  body:
    BrowserChatBody,

  signal:
    AbortSignal,
):
  Promise<
    BrowserBeginResponse
  > {
  const userMessage =
    [...body.messages]
      .reverse()
      .find(
        (message) =>
          message.role ===
          "user",
      );

  if (
    !userMessage
  ) {
    throw new Error(
      "Browser inference requires a user message.",
    );
  }

  const response =
    await fetch(
      "/api/chat/browser",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        signal,

        body:
          JSON.stringify({
            action:
              "begin",

            ...(body
                .conversationId
              ? {
                  conversationId:
                    body
                      .conversationId,
                }
              : {}),

            proposedConversationId:
              body
                .idempotencyKey,

            idempotencyKey:
              body
                .idempotencyKey,

            userMessage: {
              id:
                userMessage.id,

              content:
                userMessage
                  .content,

              createdAt:
                userMessage
                  .createdAt,
            },
          }),
      },
    );

  if (
    !response.ok
  ) {
    throw await responseError(
      response,
    );
  }

  return await response.json() as
    BrowserBeginResponse;
}

async function settlePersistence(input: {
  conversationId:
    string;

  assistantMessageId:
    string;

  content:
    string;

  status:
    | "complete"
    | "interrupted"
    | "failed";

  errorCode?:
    string;
}):
  Promise<void> {
  try {
    await fetch(
      "/api/chat/browser",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            action:
              "settle",

            conversationId:
              input
                .conversationId,

            assistantMessageId:
              input
                .assistantMessageId,

            content:
              input.content,

            status:
              input.status,

            ...(input.errorCode
              ? {
                  errorCode:
                    input
                      .errorCode,
                }
              : {}),
          }),
      },
    );
  } catch {
    /*
     * Persistence failure must not destroy an answer already computed on the
     * user's device. This mirrors the server streaming contract.
     */
  }
}

function browserMessages(
  body:
    BrowserChatBody,
) {
  return [
    {
      role:
        "system" as const,

      content:
        SYSTEM_PROMPT,
    },

    ...body.messages
      .filter(
        (message) =>
          message.content
            .trim()
            .length >
          0,
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            message.content,
        }),
      ),
  ];
}

export async function streamBrowserChat(
  body:
    BrowserChatBody,

  signal:
    AbortSignal,

  callbacks:
    StreamCallbacks,
):
  Promise<void> {
  let start:
    BrowserBeginResponse;

  try {
    start =
      await beginPersistence(
        body,
        signal,
      );
  } catch (
    cause
  ) {
    if (
      signal.aborted
    ) {
      callbacks.onDone({
        finishReason:
          "aborted",
      });

      return;
    }

    const error:
      ChatErrorPayload =
        typeof cause ===
          "object" &&
        cause !==
          null &&
        "code" in
          cause &&
        "message" in
          cause
          ? cause as
              ChatErrorPayload
          : {
              code:
                "internal_error",

              message:
                "Mabojolu could not start on-device inference.",

              retryable:
                true,
            };

    callbacks.onError(
      error,
    );

    return;
  }

  callbacks.onStart?.({
    messageId:
      start.messageId,

    model:
      start.model,

    conversationId:
      start
        .conversationId,
  });

  const requestId =
    body.idempotencyKey;

  const worker =
    workerInstance();

  let accumulated =
    "";

  let settled =
    false;

  await new Promise<void>(
    (resolve) => {
      const cleanup =
        () => {
          worker
            .removeEventListener(
              "message",
              onMessage,
            );

          signal
            .removeEventListener(
              "abort",
              onAbort,
            );
        };

      const finish =
        async (
          finishReason:
            | "end_turn"
            | "max_tokens"
            | "aborted",
        ) => {
          if (
            settled
          ) {
            return;
          }

          settled =
            true;

          cleanup();

          await settlePersistence({
            conversationId:
              start
                .conversationId,

            assistantMessageId:
              start.messageId,

            content:
              accumulated,

            status:
              finishReason ===
                "aborted"
                ? "interrupted"
                : "complete",
          });

          callbacks.onDone({
            finishReason,
          });

          resolve();
        };

      const fail =
        async (
          message:
            string,
        ) => {
          if (
            settled
          ) {
            return;
          }

          settled =
            true;

          cleanup();

          await settlePersistence({
            conversationId:
              start
                .conversationId,

            assistantMessageId:
              start.messageId,

            content:
              accumulated,

            status:
              "failed",

            errorCode:
              "browser_compute_failed",
          });

          callbacks.onError({
            code:
              "provider_unavailable",

            message:
              message ||
              "On-device inference could not run on this device. Try another response mode.",

            retryable:
              true,
          });

          resolve();
        };

      const onAbort =
        () => {
          worker.postMessage({
            type:
              "abort",

            requestId,
          });
        };

      const onMessage =
        (
          event:
            MessageEvent<
              WorkerEvent
            >,
        ) => {
          const message =
            event.data;

          if (
            message
              .requestId !==
            requestId
          ) {
            return;
          }

          switch (
            message.type
          ) {
            case "status":
              if (
                message.label
              ) {
                callbacks
                  .onStatus?.(
                    message
                      .label,
                  );
              }

              break;

            case "delta":
              if (
                message.text
              ) {
                accumulated +=
                  message.text;

                callbacks.onDelta(
                  message.text,
                );
              }

              break;

            case "done":
              void finish(
                message
                  .finishReason ??
                "end_turn",
              );

              break;

            case "error":
              void fail(
                message.message ??
                "On-device inference failed.",
              );

              break;
          }
        };

      worker
        .addEventListener(
          "message",
          onMessage,
        );

      signal
        .addEventListener(
          "abort",
          onAbort,
          {
            once:
              true,
          },
        );

      worker.postMessage({
        type:
          "generate",

        requestId,

        modelId:
          BROWSER_MODEL_ID,

        messages:
          browserMessages(
            body,
          ),

        maxOutputTokens:
          1024,
      });
    },
  );
}

export {
  BROWSER_DISPLAY_MODEL,
  BROWSER_MODEL_ID,
};

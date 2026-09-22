"use client";

import {
  buildBrowserContext,
} from "./browser-context";

import {
  BROWSER_SYSTEM_PROMPT,
  mabojoluIdentityResponse,
} from "./browser-identity";

import {
  latestChromePrompt,
  startChromePromptSession,
  streamChromePrompt,
  type ChromeMultimodalPromptMessage,
} from "./chrome-prompt-client";

import {
  profileBrowserDevice,
} from "./browser-device-profile";

import {
  browserModePlan,
  isBrowserOwnedModel,
  type BrowserOwnedModelId,
} from "./browser-mode-policy";

import type {
  StreamCallbacks,
} from "./client-stream";

import {
  isChatImageAttachment,
  type ChatErrorPayload,
  type ChatMessage,
} from "@/types/chat";

const BROWSER_FAILURE_STORAGE_KEY =
  "mabojolu-browser-compute-disabled-until";

const BROWSER_FAILURE_COOLDOWN_MS =
  30 * 60 * 1_000;

const BROWSER_ARTIFACT_MANIFEST_URL =
  process.env
    .NEXT_PUBLIC_MABOJOLU_ARTIFACT_MANIFEST_URL
    ?.trim() ||
  null;

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
      new URL(
        "./mabojolu-webllm-worker.ts",
        import.meta.url,
      ),
      {
        type:
          "module",

        name:
          "mabojolu-webllm",
      },
    );

  return sharedWorker;
}

function browserComputeTemporarilyDisabled():
  boolean {
  try {
    if (
      typeof window ===
        "undefined"
    ) {
      return false;
    }

    const raw =
      window.localStorage
        .getItem(
          BROWSER_FAILURE_STORAGE_KEY,
        );

    if (
      !raw
    ) {
      return false;
    }

    const disabledUntil =
      Number(raw);

    if (
      !Number.isFinite(
        disabledUntil,
      ) ||
      disabledUntil <=
        Date.now()
    ) {
      window.localStorage
        .removeItem(
          BROWSER_FAILURE_STORAGE_KEY,
        );

      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function markBrowserComputeFailure():
  void {
  try {
    if (
      typeof window ===
        "undefined"
    ) {
      return;
    }

    window.localStorage
      .setItem(
        BROWSER_FAILURE_STORAGE_KEY,
        String(
          Date.now() +
            BROWSER_FAILURE_COOLDOWN_MS,
        ),
      );
  } catch {
    // Routing still falls back after the current failed request.
  }
}

function clearBrowserComputeFailure():
  void {
  try {
    if (
      typeof window ===
        "undefined"
    ) {
      return;
    }

    window.localStorage
      .removeItem(
        BROWSER_FAILURE_STORAGE_KEY,
      );
  } catch {
    // A successful generation does not depend on storage cleanup.
  }
}

/**
 * Browser-owned text inference for Mabojolu Fast, Regular, and Quality.
 *
 * Each mode stays on user-owned browser compute. Text requests use Chrome's
 * built-in model when available and WebLLM as the fallback. Image requests use
 * Chrome's multimodal Prompt API so image bytes remain on the user's device.
 */
export function shouldUseBrowserChat(
  body:
    BrowserChatBody,
): boolean {
  return isBrowserOwnedModel(
    body.modelId,
  );
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

            modelId:
              isBrowserOwnedModel(
                body.modelId,
              )
                ? body.modelId
                : "mabojolu-fast",

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

function browserContext(
  body:
    BrowserChatBody,

  maxOutputTokens:
    number,
) {
  return buildBrowserContext({
    systemPrompt:
      BROWSER_SYSTEM_PROMPT,

    messages:
      body.messages,

    maxOutputTokens,
  });
}

function imageDataUrlToBlob(
  dataUrl:
    string,
): Blob {
  const separator =
    dataUrl.indexOf(
      ",",
    );

  if (
    separator <=
      0
  ) {
    throw new Error(
      "Invalid image data URL.",
    );
  }

  const header =
    dataUrl.slice(
      0,
      separator,
    );

  const encoded =
    dataUrl.slice(
      separator +
        1,
    );

  const mimeMatch =
    /^data:(image\/(?:png|jpeg|webp));base64$/i.exec(
      header,
    );

  if (
    !mimeMatch
  ) {
    throw new Error(
      "Unsupported image data URL.",
    );
  }

  const binary =
    atob(
      encoded,
    );

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index =
      0;
    index <
      binary.length;
    index +=
      1
  ) {
    bytes[
      index
    ] =
      binary.charCodeAt(
        index,
      );
  }

  return new Blob(
    [
      bytes,
    ],
    {
      type:
        mimeMatch[
          1
        ]!
          .toLowerCase(),
    },
  );
}

function latestImagePrompt(
  body:
    BrowserChatBody,
):
  ChromeMultimodalPromptMessage[] |
  null {
  const latestUser =
    [
      ...body
        .messages,
    ]
      .reverse()
      .find(
        (message) =>
          message.role ===
          "user" &&
          (
            message
              .attachments
              ?.some(
                isChatImageAttachment,
              ) ??
            false
          ),
      );

  if (
    !latestUser ||
    !latestUser
      .attachments ||
    !latestUser
      .attachments
      .some(
        isChatImageAttachment,
      )
  ) {
    return null;
  }

  const content:
    ChromeMultimodalPromptMessage[
      "content"
    ] = [
      {
        type:
          "text",

        value:
          latestUser
            .content
            .trim()
            .length >
            0
            ? latestUser
                .content
            : "Describe and analyze the attached image.",
      },
  ];

  for (
    const attachment of
      latestUser
        .attachments
        .filter(
          isChatImageAttachment,
        )
  ) {
    content.push({
      type:
        "image",

      value:
        imageDataUrlToBlob(
          attachment
            .dataUrl,
        ),
    });
  }

  return [
    {
      role:
        "user",

      content,
    },
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
  const selectedMode:
    BrowserOwnedModelId =
      isBrowserOwnedModel(
        body.modelId,
      )
        ? body.modelId
        : "mabojolu-fast";

  const identityResponse =
    mabojoluIdentityResponse(
      body.messages,
    );

  const hasImages =
    body.messages.some(
      (
        message,
      ) =>
        (
          message
            .attachments
            ?.some(
              isChatImageAttachment,
            ) ??
          false
        ),
    );

  const chromeContext =
    !identityResponse &&
    (
      selectedMode ===
        "mabojolu-fast" ||
      hasImages
    )
      ? browserContext(
          body,
          hasImages
            ? 1_024
            : 768,
        )
      : null;

  const chromeSessionPromise =
    chromeContext
      ?.fits
      ? startChromePromptSession(
          chromeContext
            .messages,

          signal,

          callbacks
            .onStatus,

          hasImages
            ? [
                "text",
                "image",
              ]
            : [
                "text",
              ],
        )
      : Promise.resolve(
          null,
        );

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

  if (
    identityResponse
  ) {
    callbacks.onDelta(
      identityResponse,
    );

    await settlePersistence({
      conversationId:
        start.conversationId,

      assistantMessageId:
        start.messageId,

      content:
        identityResponse,

      status:
        "complete",
    });

    callbacks.onDone({
      finishReason:
        "end_turn",
    });

    return;
  }

  if (
    hasImages &&
    chromeContext
      ?.fits
  ) {
    const chromeSession =
      await chromeSessionPromise;

    if (
      signal.aborted
    ) {
      chromeSession
        ?.destroy?.();

      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          "",

        status:
          "interrupted",
      });

      callbacks.onDone({
        finishReason:
          "aborted",
      });

      return;
    }

    let prompt:
      ChromeMultimodalPromptMessage[] |
      null = null;

    try {
      prompt =
        latestImagePrompt(
          body,
        );
    } catch {
      chromeSession
        ?.destroy?.();

      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          "",

        status:
          "failed",

        errorCode:
          "invalid_image_data",
      });

      callbacks.onError({
        code:
          "invalid_request",

        message:
          "The attached image data could not be read.",

        retryable:
          false,
      });

      return;
    }

    if (
      !chromeSession ||
      !prompt
    ) {
      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          "",

        status:
          "failed",

        errorCode:
          "browser_multimodal_unavailable",
      });

      callbacks.onError({
        code:
          "provider_unavailable",

        message:
          "On-device image understanding is not available in this browser. Update Chrome and try again.",

        retryable:
          true,
      });

      return;
    }

    let chromeText =
      "";

    try {
      callbacks
        .onStatus?.(
          "Analyzing image on this device...",
        );

      chromeText =
        await streamChromePrompt(
          chromeSession,
          prompt,
          signal,
          (
            text,
          ) => {
            chromeText +=
              text;

            callbacks.onDelta(
              text,
            );
          },
        );

      chromeSession
        .destroy?.();

      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          chromeText,

        status:
          signal.aborted
            ? "interrupted"
            : "complete",
      });

      callbacks.onDone({
        finishReason:
          signal.aborted
            ? "aborted"
            : "end_turn",
      });

      return;
    } catch {
      chromeSession
        .destroy?.();

      if (
        signal.aborted
      ) {
        await settlePersistence({
          conversationId:
            start.conversationId,

          assistantMessageId:
            start.messageId,

          content:
            chromeText,

          status:
            "interrupted",
        });

        callbacks.onDone({
          finishReason:
            "aborted",
        });

        return;
      }

      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          chromeText,

        status:
          "failed",

        errorCode:
          "browser_multimodal_failed",
      });

      callbacks.onError({
        code:
          "provider_unavailable",

        message:
          chromeText.length >
            0
            ? "On-device image analysis stopped unexpectedly after beginning the response."
            : "On-device image analysis could not run in this browser.",

        retryable:
          true,
      });

      return;
    }
  }

  if (
    selectedMode ===
      "mabojolu-fast" &&
    chromeContext
      ?.fits
  ) {
    const chromeSession =
      await chromeSessionPromise;

    if (
      signal.aborted
    ) {
      chromeSession
        ?.destroy?.();

      await settlePersistence({
        conversationId:
          start.conversationId,

        assistantMessageId:
          start.messageId,

        content:
          "",

        status:
          "interrupted",
      });

      callbacks.onDone({
        finishReason:
          "aborted",
      });

      return;
    }

    const prompt =
      latestChromePrompt(
        chromeContext
          .messages,
      );

    if (
      chromeSession &&
      prompt
    ) {
      let chromeText =
        "";

      try {
        callbacks
          .onStatus?.(
            "Thinking on this device with Chrome AI...",
          );

        chromeText =
          await streamChromePrompt(
            chromeSession,
            prompt,
            signal,
            (
              text,
            ) => {
              chromeText +=
                text;

              callbacks.onDelta(
                text,
              );
            },
          );

        chromeSession
          .destroy?.();

        await settlePersistence({
          conversationId:
            start.conversationId,

          assistantMessageId:
            start.messageId,

          content:
            chromeText,

          status:
            signal.aborted
              ? "interrupted"
              : "complete",
        });

        clearBrowserComputeFailure();

        callbacks.onDone({
          finishReason:
            signal.aborted
              ? "aborted"
              : "end_turn",
        });

        return;
      } catch {
        chromeSession
          .destroy?.();

        if (
          signal.aborted
        ) {
          await settlePersistence({
            conversationId:
              start.conversationId,

            assistantMessageId:
              start.messageId,

            content:
              chromeText,

            status:
              "interrupted",
          });

          callbacks.onDone({
            finishReason:
              "aborted",
          });

          return;
        }

        if (
          chromeText
            .length >
          0
        ) {
          await settlePersistence({
            conversationId:
              start.conversationId,

            assistantMessageId:
              start.messageId,

            content:
              chromeText,

            status:
              "failed",

            errorCode:
              "chrome_prompt_failed",
          });

          callbacks.onError({
            code:
              "provider_unavailable",

            message:
              "Chrome on-device AI stopped unexpectedly after beginning the response.",

            retryable:
              true,
          });

          return;
        }

        callbacks
          .onStatus?.(
            "Chrome on-device AI was unavailable. Preparing Mabojolu browser fallback...",
          );
      }
    }
  }

  if (
    browserComputeTemporarilyDisabled()
  ) {
    await settlePersistence({
      conversationId:
        start.conversationId,

      assistantMessageId:
        start.messageId,

      content:
        "",

      status:
        "failed",

      errorCode:
        "browser_compute_cooldown",
    });

    callbacks.onError({
      code:
        "provider_unavailable",

      message:
        "Mabojolu's browser fallback is temporarily paused after a compute failure. Try again shortly.",

      retryable:
        true,
    });

    return;
  }

  const deviceProfile =
    profileBrowserDevice();

  const modePlan =
    browserModePlan(
      selectedMode,
      deviceProfile,
    );

  if (
    !modePlan
      .available
  ) {
    await settlePersistence({
      conversationId:
        start.conversationId,

      assistantMessageId:
        start.messageId,

      content: "",

      status:
        "failed",

      errorCode:
        "browser_compute_unavailable",
    });

    callbacks.onError({
      code:
        "provider_unavailable",

      message:
        modePlan
          .unavailableReason ??
        "This device cannot run the selected Mabojolu mode on-device.",

      retryable:
        true,
    });

    return;
  }

  const context =
    browserContext(
      body,
      modePlan
        .maxOutputTokens,
    );

  if (
    !context.fits
  ) {
    await settlePersistence({
      conversationId:
        start.conversationId,

      assistantMessageId:
        start.messageId,

      content: "",

      status:
        "failed",

      errorCode:
        "browser_context_too_large",
    });

    callbacks.onError({
      code:
        "provider_unavailable",

      message:
        "This conversation is too large for the selected on-device model. Start a new chat, use Mabojolu's handover, or shorten the conversation before retrying.",

      retryable:
        true,
    });

    return;
  }

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

          if (
            finishReason !==
              "aborted"
          ) {
            clearBrowserComputeFailure();
          }

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

          markBrowserComputeFailure();

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

        modelCandidates:
          modePlan
            .modelCandidates,

        artifactManifestUrl:
          BROWSER_ARTIFACT_MANIFEST_URL,

        messages:
          context.messages,

        maxOutputTokens:
          modePlan
            .maxOutputTokens,
      });
    },
  );
}

export {
  BROWSER_FAILURE_COOLDOWN_MS,
  BROWSER_FAILURE_STORAGE_KEY,
};

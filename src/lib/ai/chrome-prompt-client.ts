"use client";

export interface ChromePromptMessage {
  role:
    "system" |
    "user" |
    "assistant";

  content:
    string;
}

export type ChromeExpectedInputType =
  | "text"
  | "image"
  | "audio";

export type ChromePromptContentPart =
  | {
      type:
        "text";

      value:
        string;
    }
  | {
      type:
        "image";

      value:
        Blob;
    }
  | {
      type:
        "audio";

      value:
        Blob;
    };

export interface ChromeMultimodalPromptMessage {
  role:
    "user";

  content:
    ChromePromptContentPart[];
}

export type ChromePromptInput =
  | string
  | ChromeMultimodalPromptMessage[];

interface DownloadProgressEventLike {
  loaded:
    number;
}

interface DownloadMonitorLike {
  addEventListener(
    type:
      "downloadprogress",

    listener:
      (
        event:
          DownloadProgressEventLike,
      ) => void,
  ):
    void;
}

export interface ChromeLanguageModelSession {
  promptStreaming(
    prompt:
      ChromePromptInput,

    options?: {
      signal?:
        AbortSignal;
    },
  ):
    ReadableStream<
      string
    >;

  destroy?():
    void;
}

interface ChromeLanguageModelApi {
  create(
    options?: {
      signal?:
        AbortSignal;

      initialPrompts?:
        ChromePromptMessage[];

      expectedInputs?: Array<
        | {
            type:
              "text";

            languages:
              string[];
          }
        | {
            type:
              "image";
          }
        | {
            type:
              "audio";
          }
      >;

      expectedOutputs?: Array<{
        type:
          "text";

        languages:
          string[];
      }>;

      monitor?(
        monitor:
          DownloadMonitorLike,
      ):
        void;
    },
  ):
    Promise<
      ChromeLanguageModelSession
    >;
}

function languageModelApi():
  ChromeLanguageModelApi |
  null {
  if (
    typeof window ===
      "undefined"
  ) {
    return null;
  }

  const candidate =
    Reflect.get(
      window,
      "LanguageModel",
    ) as
      ChromeLanguageModelApi |
      undefined;

  return (
    candidate &&
    typeof candidate
      .create ===
      "function"
      ? candidate
      : null
  );
}

function progressLabel(
  loaded:
    number,
):
  string {
  const fraction =
    Number.isFinite(
      loaded,
    )
      ? Math.max(
          0,
          Math.min(
            1,
            loaded,
          ),
        )
      : 0;

  return (
    "Preparing Chrome on-device model... " +
    Math.round(
      fraction * 100,
    ) +
    "%"
  );
}

/**
 * Starts Chrome's built-in Prompt API immediately so the call remains tied to
 * the user's send action. Returning null means Mabojolu should use its WebLLM
 * fallback instead.
 */
export function startChromePromptSession(
  messages:
    ChromePromptMessage[],

  signal:
    AbortSignal,

  onStatus?:
    (
      label:
        string,
    ) => void,

  expectedInputTypes:
    readonly ChromeExpectedInputType[] = [
      "text",
    ],
):
  Promise<
    ChromeLanguageModelSession |
    null
  > {
  const api =
    languageModelApi();

  if (
    !api
  ) {
    return Promise.resolve(
      null,
    );
  }

  const initialPrompts =
    messages.slice(
      0,
      -1,
    );

  onStatus?.(
    "Preparing Chrome on-device AI...",
  );

  try {
    return api
      .create({
        signal,

        initialPrompts,

        expectedInputs:
          Array.from(
            new Set(
              expectedInputTypes,
            ),
          ).map(
            (
              type,
            ) =>
              type ===
                "text"
                ? {
                    type:
                      "text" as const,

                    languages: [
                      "en",
                    ],
                  }
                : {
                    type,
                  },
          ),

        expectedOutputs: [
          {
            type:
              "text",

            languages: [
              "en",
            ],
          },
        ],

        monitor(
          monitor,
        ) {
          monitor
            .addEventListener(
              "downloadprogress",
              (
                event,
              ) => {
                onStatus?.(
                  progressLabel(
                    event.loaded,
                  ),
                );
              },
            );
        },
      })
      .catch(
        () =>
          null,
      );
  } catch {
    return Promise.resolve(
      null,
    );
  }
}

export async function streamChromePrompt(
  session:
    ChromeLanguageModelSession,

  prompt:
    ChromePromptInput,

  signal:
    AbortSignal,

  onDelta:
    (
      text:
        string,
    ) => void,
):
  Promise<
    string
  > {
  const stream =
    session
      .promptStreaming(
        prompt,
        {
          signal,
        },
      );

  const reader =
    stream.getReader();

  let accumulated =
    "";

  try {
    while (
      true
    ) {
      const {
        done,
        value,
      } =
        await reader.read();

      if (
        done
      ) {
        break;
      }

      if (
        value
      ) {
        accumulated +=
          value;

        onDelta(
          value,
        );
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

export function latestChromePrompt(
  messages:
    ChromePromptMessage[],
):
  string |
  null {
  const latest =
    [...messages]
      .reverse()
      .find(
        (
          message,
        ) =>
          message.role ===
          "user",
      );

  return latest
    ?.content ??
    null;
}

"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { MabojoluModelId } from "@/components/layout/settings-dialog";
import type { ChatImageAttachment } from "@/types/chat";

interface ComposerProps {
  isStreaming: boolean;

  onSend: (
    content: string,
    attachments: ChatImageAttachment[],
  ) => void;

  onStop: () => void;
  focusKey?: number;
  disabled?: boolean;
  disabledReason?: string;
  selectedModelId: MabojoluModelId;

  onModelChange: (
    modelId: MabojoluModelId,
  ) => void;
}

type SpeechRecognitionResultAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionResultAlternativeLike;
  length: number;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;

  onresult:
    | ((
        event: SpeechRecognitionEventLike,
      ) => void)
    | null;

  onerror:
    | ((
        event: SpeechRecognitionErrorEventLike,
      ) => void)
    | null;

  onend:
    | (() => void)
    | null;

  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike =
  new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?:
      SpeechRecognitionConstructorLike;

    webkitSpeechRecognition?:
      SpeechRecognitionConstructorLike;
  }
}

const MODEL_OPTIONS: Array<{
  id: MabojoluModelId;
  label: string;
}> = [
  {
    id: "mabojolu-fast",
    label: "Fast",
  },
  {
    id: "mabojolu-regular",
    label: "Regular",
  },
  {
    id: "mabojolu-local",
    label: "Quality",
  },
];

const ACCEPTED_IMAGE_TYPES = new Set<
  ChatImageAttachment["mimeType"]
>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function createAttachmentId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `image-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatMegabytes(
  bytes: number,
): string {
  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function readFileAsDataUrl(
  file: File,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result ===
          "string"
        ) {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            "The image could not be read.",
          ),
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "The image could not be read.",
          ),
        );
      };

      reader.readAsDataURL(file);
    },
  );
}

function removeTextareaChrome(
  textarea: HTMLTextAreaElement,
): void {
  textarea.style.setProperty(
    "border",
    "0",
    "important",
  );

  textarea.style.setProperty(
    "border-width",
    "0",
    "important",
  );

  textarea.style.setProperty(
    "border-color",
    "transparent",
    "important",
  );

  textarea.style.setProperty(
    "outline",
    "none",
    "important",
  );

  textarea.style.setProperty(
    "box-shadow",
    "none",
    "important",
  );

  textarea.style.setProperty(
    "background",
    "transparent",
    "important",
  );

  textarea.style.setProperty(
    "appearance",
    "none",
    "important",
  );

  textarea.style.setProperty(
    "-webkit-appearance",
    "none",
    "important",
  );
}

function PaperclipIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 1 1 5.66 5.66L8.7 18.12a2 2 0 1 1-2.83-2.83l9.2-9.19" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 7 5 5 5-5" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="currentColor"
    >
      <rect
        x="6.5"
        y="6.5"
        width="11"
        height="11"
        rx="1.75"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="m5 5 10 10" />
      <path d="M15 5 5 15" />
    </svg>
  );
}

export function Composer({
  isStreaming,
  onSend,
  onStop,
  focusKey = 0,
  disabled = false,
  disabledReason,
  selectedModelId,
  onModelChange,
}: ComposerProps) {
  const [draft, setDraft] =
    useState("");

  const [
    attachments,
    setAttachments,
  ] = useState<
    ChatImageAttachment[]
  >([]);

  const [
    attachmentError,
    setAttachmentError,
  ] = useState<string | null>(
    null,
  );

  const [
    isListening,
    setIsListening,
  ] = useState(false);

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null,
    );

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const recognitionRef =
    useRef<SpeechRecognitionLike | null>(
      null,
    );

  const recognitionConstructor =
    useMemo(() => {
      if (
        typeof window === "undefined"
      ) {
        return null;
      }

      return (
        window.SpeechRecognition ??
        window.webkitSpeechRecognition ??
        null
      );
    }, []);

  const assignTextareaRef =
    useCallback(
      (
        textarea:
          | HTMLTextAreaElement
          | null,
      ) => {
        textareaRef.current =
          textarea;

        if (textarea) {
          removeTextareaChrome(
            textarea,
          );
        }
      },
      [],
    );

  const resizeTextarea =
    useCallback(() => {
      const textarea =
        textareaRef.current;

      if (!textarea) {
        return;
      }

      removeTextareaChrome(
        textarea,
      );

      textarea.style.height =
        "0px";

      textarea.style.height =
        `${Math.min(
          textarea.scrollHeight,
          220,
        )}px`;
    }, []);

  useEffect(() => {
    resizeTextarea();
  }, [
    draft,
    resizeTextarea,
  ]);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) {
      return;
    }

    removeTextareaChrome(
      textarea,
    );

    textarea.focus();
  }, [focusKey]);

  useEffect(() => {
    return () => {
      const recognition =
        recognitionRef.current;

      if (!recognition) {
        return;
      }

      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();

      recognitionRef.current =
        null;
    };
  }, []);

  const sendDraft =
    useCallback(() => {
      const trimmed =
        draft.trim();

      if (
        (!trimmed &&
          attachments.length === 0) ||
        disabled ||
        isStreaming
      ) {
        return;
      }

      recognitionRef.current?.stop();

      onSend(
        trimmed,
        attachments,
      );

      setDraft("");
      setAttachments([]);
      setAttachmentError(null);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }, [
      attachments,
      disabled,
      draft,
      isStreaming,
      onSend,
    ]);

  const handleSubmit =
    useCallback(
      (
        event:
          FormEvent<HTMLFormElement>,
      ) => {
        event.preventDefault();
        sendDraft();
      },
      [sendDraft],
    );

  const handleKeyDown =
    useCallback(
      (
        event:
          KeyboardEvent<HTMLTextAreaElement>,
      ) => {
        removeTextareaChrome(
          event.currentTarget,
        );

        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.nativeEvent
            .isComposing
        ) {
          return;
        }

        event.preventDefault();
        sendDraft();
      },
      [sendDraft],
    );

  const handleDraftChange =
    useCallback(
      (
        event:
          ChangeEvent<HTMLTextAreaElement>,
      ) => {
        removeTextareaChrome(
          event.currentTarget,
        );

        setDraft(
          event.currentTarget.value,
        );
      },
      [],
    );

  const openImagePicker =
    useCallback(() => {
      if (
        disabled ||
        isStreaming
      ) {
        return;
      }

      setAttachmentError(null);

      fileInputRef.current?.click();
    }, [
      disabled,
      isStreaming,
    ]);

  const handleImageSelection =
    useCallback(
      async (
        event:
          ChangeEvent<HTMLInputElement>,
      ) => {
        const selectedFiles =
          Array.from(
            event.currentTarget
              .files ?? [],
          );

        event.currentTarget.value =
          "";

        if (
          selectedFiles.length === 0
        ) {
          return;
        }

        const remainingSlots =
          MAX_IMAGE_COUNT -
          attachments.length;

        if (
          remainingSlots <= 0
        ) {
          setAttachmentError(
            `You can attach up to ${MAX_IMAGE_COUNT} images to one message.`,
          );

          return;
        }

        const filesToRead =
          selectedFiles.slice(
            0,
            remainingSlots,
          );

        if (
          selectedFiles.length >
          remainingSlots
        ) {
          setAttachmentError(
            `Only ${remainingSlots} more image${
              remainingSlots === 1
                ? ""
                : "s"
            } can be added.`,
          );
        } else {
          setAttachmentError(null);
        }

        const nextAttachments:
          ChatImageAttachment[] = [];

        for (const file of filesToRead) {
          if (
            !ACCEPTED_IMAGE_TYPES.has(
              file.type as ChatImageAttachment["mimeType"],
            )
          ) {
            setAttachmentError(
              "Only JPEG, PNG, and WebP images are supported.",
            );

            continue;
          }

          if (
            file.size >
            MAX_IMAGE_BYTES
          ) {
            setAttachmentError(
              `${file.name} is ${formatMegabytes(
                file.size,
              )}. Each image must be 10 MB or smaller.`,
            );

            continue;
          }

          try {
            const dataUrl =
              await readFileAsDataUrl(
                file,
              );

            nextAttachments.push({
              id: createAttachmentId(),
              name: file.name,
              mimeType:
                file.type as ChatImageAttachment["mimeType"],
              sizeBytes: file.size,
              dataUrl,
            });
          } catch {
            setAttachmentError(
              `${file.name} could not be read.`,
            );
          }
        }

        if (
          nextAttachments.length > 0
        ) {
          setAttachments(
            (current) => [
              ...current,
              ...nextAttachments,
            ],
          );
        }
      },
      [attachments.length],
    );

  const removeAttachment =
    useCallback(
      (
        attachmentId: string,
      ) => {
        setAttachments(
          (current) =>
            current.filter(
              (attachment) =>
                attachment.id !==
                attachmentId,
            ),
        );

        setAttachmentError(null);
      },
      [],
    );

  const handleToggleListening =
    useCallback(() => {
      if (disabled) {
        return;
      }

      if (isListening) {
        recognitionRef.current?.stop();
        return;
      }

      if (
        !recognitionConstructor
      ) {
        return;
      }

      const recognition =
        new recognitionConstructor();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (
        event,
      ) => {
        let finalText = "";
        let interimText = "";

        for (
          let index =
            event.resultIndex;
          index <
          event.results.length;
          index += 1
        ) {
          const result =
            event.results[index];

          const transcript =
            result[0]?.transcript ??
            "";

          if (result.isFinal) {
            finalText += transcript;
          } else {
            interimText +=
              transcript;
          }
        }

        const combined =
          `${finalText}${interimText}`.trim();

        if (!combined) {
          return;
        }

        setDraft(
          (current) => {
            const existing =
              current.trim();

            if (!existing) {
              return combined;
            }

            return `${existing} ${combined}`
              .replace(
                /\s+/g,
                " ",
              )
              .trim();
          },
        );
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);

        recognitionRef.current =
          null;

        textareaRef.current?.focus();
      };

      recognitionRef.current =
        recognition;

      recognition.start();
      setIsListening(true);
    }, [
      disabled,
      isListening,
      recognitionConstructor,
    ]);

  const canSend =
    !disabled &&
    !isStreaming &&
    (draft.trim().length > 0 ||
      attachments.length > 0);

  const placeholder = disabled
    ? (
        disabledReason ??
        "Message Mabojolu"
      )
    : attachments.length > 0
      ? "Ask Mabojolu about these images"
      : "Message Mabojolu";

  return (
    <div className="shrink-0 bg-surface-base/95 px-4 pb-5 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-[720px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-border-subtle bg-surface-raised px-4 pb-3 pt-3 shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={
              handleImageSelection
            }
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {attachments.length >
          0 ? (
            <div
              className="mb-3 flex gap-2 overflow-x-auto pb-1"
              aria-label="Selected images"
            >
              {attachments.map(
                (attachment) => (
                  <div
                    key={
                      attachment.id
                    }
                    className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-base"
                  >
                    <Image
                      src={
                        attachment.dataUrl
                      }
                      alt={
                        attachment.name
                      }
                      fill
                      unoptimized
                      sizes="64px"
                      className="object-cover"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeAttachment(
                          attachment.id,
                        )
                      }
                      aria-label={`Remove ${attachment.name}`}
                      title={`Remove ${attachment.name}`}
                      className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white shadow-sm transition-transform hover:scale-105"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ),
              )}
            </div>
          ) : null}

          <label
            htmlFor="composer"
            className="sr-only"
          >
            Message Mabojolu
          </label>

          <textarea
            id="composer"
            ref={assignTextareaRef}
            value={draft}
            onChange={
              handleDraftChange
            }
            onKeyDown={
              handleKeyDown
            }
            onFocus={(event) =>
              removeTextareaChrome(
                event.currentTarget,
              )
            }
            onClick={(event) =>
              removeTextareaChrome(
                event.currentTarget,
              )
            }
            rows={1}
            disabled={disabled}
            placeholder={placeholder}
            aria-describedby="composer-hint"
            className="block max-h-[220px] min-h-[32px] w-full resize-none appearance-none overflow-y-auto !border-0 bg-transparent p-0 text-[16px] leading-7 text-text-primary !outline-none !ring-0 placeholder:text-text-muted !shadow-none focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none focus-visible:!border-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!shadow-none disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={
                openImagePicker
              }
              disabled={
                disabled ||
                isStreaming ||
                attachments.length >=
                  MAX_IMAGE_COUNT
              }
              aria-label="Attach images"
              title="Attach images"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-base hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PaperclipIcon />
            </button>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={
                    selectedModelId
                  }
                  onChange={(event) =>
                    onModelChange(
                      event.target
                        .value as MabojoluModelId,
                    )
                  }
                  aria-label="Choose response mode"
                  className="h-9 appearance-none rounded-full border border-border-subtle bg-surface-base pl-3 pr-9 text-sm font-medium text-text-primary outline-none transition-colors focus:border-border-default focus:outline-none focus:ring-0"
                >
                  {MODEL_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <ChevronDownIcon />
                </span>
              </div>

              <button
                type="button"
                onClick={
                  handleToggleListening
                }
                aria-label={
                  isListening
                    ? "Stop voice input"
                    : "Start voice input"
                }
                title={
                  isListening
                    ? "Stop voice input"
                    : "Start voice input"
                }
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isListening
                    ? "border-border-default bg-surface-base text-text-primary"
                    : "border-border-subtle bg-surface-base text-text-muted hover:text-text-primary"
                }`}
              >
                <MicrophoneIcon />
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop response"
                  title="Stop response"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-inverse text-text-inverse transition-opacity hover:opacity-90"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  title="Send message"
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    canSend
                      ? "bg-surface-inverse text-text-inverse hover:opacity-90"
                      : "bg-surface-base text-text-muted"
                  }`}
                >
                  <ArrowUpIcon />
                </button>
              )}
            </div>
          </div>
        </form>

        {attachmentError ? (
          <p
            role="alert"
            className="mt-2 text-center text-[11px] leading-4 text-danger"
          >
            {attachmentError}
          </p>
        ) : null}

        <p
          id="composer-hint"
          className="sr-only"
        >
          Press Enter to send. Press Shift plus Enter
          for a new line. You may attach up to four
          JPEG, PNG, or WebP images.
        </p>
      </div>
    </div>
  );
}
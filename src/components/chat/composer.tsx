"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
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
  maxAlternatives: number;

  onstart: (() => void) | null;

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

  onend: (() => void) | null;

  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructorLike =
  new () => SpeechRecognitionLike;

type VoiceStatus =
  | "idle"
  | "requesting"
  | "listening";

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
const MAX_IMAGE_BYTES =
  10 * 1024 * 1024;

function createAttachmentId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
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

function joinTranscript(
  ...parts: string[]
): string {
  return parts
    .map((part) => part.trim())
    .filter(
      (part) => part.length > 0,
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function releaseMediaStream(
  stream: MediaStream,
): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function detachRecognitionHandlers(
  recognition: SpeechRecognitionLike,
): void {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}

function permissionErrorMessage(
  cause: unknown,
): string {
  if (!(cause instanceof DOMException)) {
    return "Mabojolu could not access the microphone. Check the browser microphone settings and try again.";
  }

  switch (cause.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow microphone access for this site in Chrome, then try again.";

    case "NotFoundError":
      return "No microphone was found. Connect or enable a microphone, then try again.";

    case "NotReadableError":
    case "AbortError":
      return "The microphone could not be opened. Close any other app using it, then try again.";

    case "TypeError":
      return "Microphone access requires localhost or a secure HTTPS connection.";

    default:
      return "Mabojolu could not access the microphone. Check the browser microphone settings and try again.";
  }
}

function recognitionErrorMessage(
  error: string,
): string | null {
  switch (error) {
    case "aborted":
      return null;

    case "not-allowed":
    case "service-not-allowed":
      return "Voice input is blocked. Allow microphone access for this site in Chrome, then try again.";

    case "audio-capture":
      return "The microphone is unavailable. Check that it is connected and not being used by another app.";

    case "no-speech":
      return "I did not hear any speech. Try again and speak after the microphone shows Listening.";

    case "network":
      return "Chrome's speech service could not be reached. Check your internet connection and try again.";

    case "language-not-supported":
      return "The browser speech service does not support the selected language.";

    default:
      return "Voice input stopped unexpectedly. Please try again.";
  }
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
    voiceStatus,
    setVoiceStatus,
  ] = useState<VoiceStatus>(
    "idle",
  );

  const [
    voiceError,
    setVoiceError,
  ] = useState<string | null>(
    null,
  );

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

  const voiceAttemptRef =
    useRef(0);

  const voiceBaseDraftRef =
    useRef("");

  const voiceFinalTranscriptRef =
    useRef("");

  const userStoppedVoiceRef =
    useRef(false);

  const isListening =
    voiceStatus === "listening";

  const isRequestingMicrophone =
    voiceStatus === "requesting";

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

  const abortVoiceInput =
    useCallback(() => {
      voiceAttemptRef.current += 1;
      userStoppedVoiceRef.current =
        true;

      const recognition =
        recognitionRef.current;

      recognitionRef.current =
        null;

      if (recognition) {
        detachRecognitionHandlers(
          recognition,
        );

        try {
          recognition.abort();
        } catch {
          // Recognition may already be closed.
        }
      }

      setVoiceStatus("idle");
    }, []);

  const stopVoiceInput =
    useCallback(() => {
      voiceAttemptRef.current += 1;
      userStoppedVoiceRef.current =
        true;

      const recognition =
        recognitionRef.current;

      if (!recognition) {
        setVoiceStatus("idle");
        return;
      }

      try {
        recognition.stop();
      } catch {
        detachRecognitionHandlers(
          recognition,
        );

        recognitionRef.current =
          null;

        setVoiceStatus("idle");
      }
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
    if (
      !disabled &&
      !isStreaming
    ) {
      return;
    }

    voiceAttemptRef.current += 1;
    userStoppedVoiceRef.current =
      true;

    const recognition =
      recognitionRef.current;

    if (!recognition) {
      return;
    }

    try {
      recognition.abort();
    } catch {
      // Recognition may already be ending.
    }
  }, [
    disabled,
    isStreaming,
  ]);

  useEffect(() => {
    return () => {
      voiceAttemptRef.current += 1;

      const recognition =
        recognitionRef.current;

      recognitionRef.current =
        null;

      if (!recognition) {
        return;
      }

      detachRecognitionHandlers(
        recognition,
      );

      try {
        recognition.abort();
      } catch {
        // Recognition may already be closed.
      }
    };
  }, []);

  const sendDraft =
    useCallback(() => {
      const trimmed =
        draft.trim();

      if (
        (!trimmed &&
          attachments.length ===
            0) ||
        disabled ||
        isStreaming
      ) {
        return;
      }

      abortVoiceInput();

      onSend(
        trimmed,
        attachments,
      );

      setDraft("");
      setAttachments([]);
      setAttachmentError(null);
      setVoiceError(null);

      voiceBaseDraftRef.current =
        "";

      voiceFinalTranscriptRef.current =
        "";

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }, [
      abortVoiceInput,
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

        if (
          voiceStatus !== "idle"
        ) {
          abortVoiceInput();
        }

        setVoiceError(null);

        setDraft(
          event.currentTarget.value,
        );
      },
      [
        abortVoiceInput,
        voiceStatus,
      ],
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

  const startVoiceInput =
    useCallback(async () => {
      if (
        disabled ||
        isStreaming
      ) {
        return;
      }

      const RecognitionConstructor =
        window.SpeechRecognition ??
        window.webkitSpeechRecognition ??
        null;

      if (
        !RecognitionConstructor
      ) {
        setVoiceError(
          "Voice input is not supported by this browser. Open Mabojolu in the latest Google Chrome.",
        );

        setVoiceStatus("idle");
        return;
      }

      if (
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        setVoiceError(
          "Microphone access is unavailable. Open Mabojolu through localhost or a secure HTTPS connection.",
        );

        setVoiceStatus("idle");
        return;
      }

      setVoiceError(null);
      setVoiceStatus("requesting");

      const attempt =
        voiceAttemptRef.current + 1;

      voiceAttemptRef.current =
        attempt;

      let permissionStream:
        MediaStream;

      try {
        permissionStream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
              video: false,
            },
          );
      } catch (cause) {
        if (
          voiceAttemptRef.current !==
          attempt
        ) {
          return;
        }

        setVoiceError(
          permissionErrorMessage(
            cause,
          ),
        );

        setVoiceStatus("idle");
        return;
      }

      releaseMediaStream(
        permissionStream,
      );

      if (
        voiceAttemptRef.current !==
          attempt ||
        disabled ||
        isStreaming
      ) {
        setVoiceStatus("idle");
        return;
      }

      const recognition =
        new RecognitionConstructor();

      recognition.continuous =
        true;

      recognition.interimResults =
        true;

      recognition.maxAlternatives =
        1;

      recognition.lang =
        navigator.language ||
        "en-US";

      voiceBaseDraftRef.current =
        draft.trim();

      voiceFinalTranscriptRef.current =
        "";

      userStoppedVoiceRef.current =
        false;

      recognition.onstart = () => {
        if (
          recognitionRef.current !==
          recognition
        ) {
          return;
        }

        setVoiceStatus(
          "listening",
        );
      };

      recognition.onresult = (
        event,
      ) => {
        if (
          recognitionRef.current !==
          recognition
        ) {
          return;
        }

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
            finalText =
              joinTranscript(
                finalText,
                transcript,
              );
          } else {
            interimText =
              joinTranscript(
                interimText,
                transcript,
              );
          }
        }

        if (
          finalText.length > 0
        ) {
          voiceFinalTranscriptRef.current =
            joinTranscript(
              voiceFinalTranscriptRef.current,
              finalText,
            );
        }

        setDraft(
          joinTranscript(
            voiceBaseDraftRef.current,
            voiceFinalTranscriptRef.current,
            interimText,
          ),
        );
      };

      recognition.onerror = (
        event,
      ) => {
        const message =
          recognitionErrorMessage(
            event.error,
          );

        const wasStoppedByUser =
          userStoppedVoiceRef.current;

        if (
          message &&
          !wasStoppedByUser
        ) {
          setVoiceError(message);
        }

        setVoiceStatus("idle");
      };

      recognition.onend = () => {
        if (
          recognitionRef.current ===
          recognition
        ) {
          recognitionRef.current =
            null;
        }

        setVoiceStatus("idle");

        userStoppedVoiceRef.current =
          false;

        textareaRef.current?.focus();
      };

      recognitionRef.current =
        recognition;

      try {
        recognition.start();
      } catch {
        detachRecognitionHandlers(
          recognition,
        );

        recognitionRef.current =
          null;

        setVoiceStatus("idle");

        setVoiceError(
          "Voice input could not start. Wait a moment and try again.",
        );
      }
    }, [
      disabled,
      draft,
      isStreaming,
    ]);

  const handleToggleListening =
    useCallback(() => {
      if (
        disabled ||
        isStreaming
      ) {
        return;
      }

      if (
        isListening ||
        isRequestingMicrophone
      ) {
        stopVoiceInput();
        return;
      }

      void startVoiceInput();
    }, [
      disabled,
      isListening,
      isRequestingMicrophone,
      isStreaming,
      startVoiceInput,
      stopVoiceInput,
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
      : isListening
        ? "Listening..."
        : "Message Mabojolu";

  const voiceStatusMessage =
    voiceError
      ? voiceError
      : isRequestingMicrophone
        ? "Requesting microphone access..."
        : isListening
          ? "Listening. Speak now, then click the microphone again to stop."
          : null;

  return (
    <div className="shrink-0 bg-surface-base/95 px-4 pb-5 pt-3 backdrop-blur">
      <div className="mx-auto w-full max-w-[1120px]">
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
            aria-describedby="composer-hint voice-input-status"
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
                disabled={
                  disabled ||
                  isStreaming
                }
                aria-label={
                  isListening ||
                  isRequestingMicrophone
                    ? "Stop voice input"
                    : "Start voice input"
                }
                aria-pressed={
                  isListening
                }
                title={
                  isListening
                    ? "Stop voice input"
                    : isRequestingMicrophone
                      ? "Cancel microphone request"
                      : "Start voice input"
                }
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isListening
                    ? "border-danger bg-danger-subtle text-danger"
                    : isRequestingMicrophone
                      ? "animate-pulse border-border-default bg-surface-base text-text-primary"
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
          id="voice-input-status"
          role={
            voiceError
              ? "alert"
              : undefined
          }
          aria-live="polite"
          className={`mt-2 text-center text-[11px] leading-4 ${
            voiceError
              ? "text-danger"
              : "text-text-muted"
          }`}
        >
          {voiceStatusMessage}
        </p>

        <p
          id="composer-hint"
          className="sr-only"
        >
          Press Enter to send. Press Shift plus Enter
          for a new line. Use the microphone for voice
          input. You may attach up to four JPEG, PNG, or
          WebP images.
        </p>
      </div>
    </div>
  );
}
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
import { useBrowserDeviceProfile } from "@/hooks/use-browser-device-profile";
import {
  browserModePlan,
} from "@/lib/ai/browser-mode-policy";
import {
  isChatImageAttachment,
  isChatTextDocumentAttachment,
  type ChatAttachment,
  type ChatImageAttachment,
  type ChatTextDocumentAttachment,
} from "@/types/chat";

interface ComposerProps {
  isStreaming: boolean;

  onSend: (
    content: string,
    attachments: ChatAttachment[],
  ) => void;

  onStop: () => void;
  focusKey?: number;
  disabled?: boolean;
  disabledReason?: string;
  attachmentsEnabled?: boolean;
  computeStatus?: string | null;
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

const ACCEPTED_TEXT_DOCUMENT_TYPES = new Set<
  ChatTextDocumentAttachment["mimeType"]
>([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_ATTACHMENT_COUNT = 6;
const MAX_IMAGE_COUNT = 4;
const MAX_IMAGE_BYTES =
  10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES =
  2 * 1024 * 1024;
const MAX_DOCUMENT_TEXT_CHARS =
  200_000;

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

function documentMimeType(
  file:
    File,
):
  ChatTextDocumentAttachment["mimeType"] |
  null {
  if (
    ACCEPTED_TEXT_DOCUMENT_TYPES.has(
      file.type as
        ChatTextDocumentAttachment[
          "mimeType"
        ],
    )
  ) {
    return file.type as
      ChatTextDocumentAttachment[
        "mimeType"
      ];
  }

  const extension =
    file.name
      .split(
        ".",
      )
      .pop()
      ?.toLowerCase();

  switch (
    extension
  ) {
    case "txt":
    case "text":
      return "text/plain";

    case "md":
    case "markdown":
      return "text/markdown";

    case "csv":
      return "text/csv";

    case "json":
      return "application/json";

    case "log":
    case "py":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "css":
    case "scss":
    case "sql":
    case "xml":
    case "yaml":
    case "yml":
    case "toml":
    case "ini":
      return "text/plain";

    default:
      return null;
  }
}

const SERVER_ANALYZED_MIME_BY_EXTENSION:
  Readonly<
    Record<
      string,
      string
    >
  > = {
  pdf:
    "application/pdf",

  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  xlsx:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  wav:
    "audio/wav",

  mp3:
    "audio/mpeg",

  flac:
    "audio/flac",

  ogg:
    "audio/ogg",

  oga:
    "audio/ogg",

  m4a:
    "audio/mp4",

  mp4:
    "video/mp4",

  m4v:
    "video/mp4",

  webm:
    "video/webm",

  mov:
    "video/quicktime",
};

const MAX_SERVER_ANALYSIS_BYTES =
  100 * 1024 * 1024;

function serverAnalyzedMimeType(
  file:
    File,
): string | null {
  const normalizedType =
    file.type
      .split(
        ";",
      )[0]
      .trim()
      .toLowerCase();

  if (
    [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "audio/wav",
      "audio/mpeg",
      "audio/flac",
      "audio/ogg",
      "audio/mp4",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ].includes(
      normalizedType,
    )
  ) {
    return normalizedType;
  }

  const extension =
    file.name
      .split(
        ".",
      )
      .pop()
      ?.toLowerCase();

  return extension
    ? (
        SERVER_ANALYZED_MIME_BY_EXTENSION[
          extension
        ] ??
        null
      )
    : null;
}

function isReturnedChatAttachment(
  value:
    unknown,
): value is
  ChatAttachment {
  if (
    typeof value !==
      "object" ||
    value ===
      null
  ) {
    return false;
  }

  const candidate =
    value as
      Record<
        string,
        unknown
      >;

  if (
    typeof candidate.id !==
      "string" ||
    typeof candidate.name !==
      "string" ||
    typeof candidate.mimeType !==
      "string" ||
    typeof candidate.sizeBytes !==
      "number"
  ) {
    return false;
  }

  if (
    candidate.kind ===
      "document"
  ) {
    return (
      typeof candidate.textContent ===
        "string" &&
      ACCEPTED_TEXT_DOCUMENT_TYPES.has(
        candidate.mimeType as
          ChatTextDocumentAttachment[
            "mimeType"
          ],
      )
    );
  }

  if (
    candidate.kind ===
      "image"
  ) {
    return (
      typeof candidate.dataUrl ===
        "string" &&
      ACCEPTED_IMAGE_TYPES.has(
        candidate.mimeType as
          ChatImageAttachment[
            "mimeType"
          ],
      )
    );
  }

  return false;
}

async function analyzeFileOnServer(
  file:
    File,
  mimeType:
    string,
): Promise<ChatAttachment[]> {
  const normalizedFile =
    file.type ===
      mimeType
      ? file
      : new File(
          [
            file,
          ],
          file.name,
          {
            type:
              mimeType,
          },
        );

  const form =
    new FormData();

  form.append(
    "file",
    normalizedFile,
  );

  const response =
    await fetch(
      "/api/attachments/analyze",
      {
        method:
          "POST",

        body:
          form,
      },
    );

  let payload:
    unknown;

  try {
    payload =
      await response
        .json();
  } catch {
    throw new Error(
      "Mabojolu could not read the local file-analysis response.",
    );
  }

  if (!response.ok) {
    const message =
      typeof payload ===
          "object" &&
        payload !==
          null &&
        "error" in
          payload &&
        typeof (
          payload as {
            error?:
              unknown;
          }
        ).error ===
          "object" &&
        (
          payload as {
            error?: {
              message?:
                unknown;
            };
          }
        ).error !==
          null &&
        typeof (
          payload as {
            error: {
              message?:
                unknown;
            };
          }
        ).error
          .message ===
          "string"
        ? (
            payload as {
              error: {
                message:
                  string;
              };
            }
          ).error
            .message
        : "Mabojolu could not analyze that file.";

    throw new Error(
      message,
    );
  }

  const attachments =
    typeof payload ===
        "object" &&
      payload !==
        null &&
      "attachments" in
        payload &&
      Array.isArray(
        (
          payload as {
            attachments?:
              unknown;
          }
        ).attachments,
      )
      ? (
          payload as {
            attachments:
              unknown[];
          }
        ).attachments
      : [];

  const normalized =
    attachments.filter(
      isReturnedChatAttachment,
    );

  if (
    normalized.length ===
      0
  ) {
    throw new Error(
      "Mabojolu found no usable evidence in that file.",
    );
  }

  return normalized;
}

async function readTextDocument(
  file:
    File,
): Promise<string> {
  const text =
    await file.text();

  if (
    text.length ===
      0
  ) {
    throw new Error(
      "The document is empty.",
    );
  }

  if (
    text.includes(
      "\u0000",
    )
  ) {
    throw new Error(
      "The document does not appear to be readable text.",
    );
  }

  if (
    text.length >
      MAX_DOCUMENT_TEXT_CHARS
  ) {
    throw new Error(
      "The document contains too much text.",
    );
  }

  return text;
}

async function generateImageOnServer(
  prompt:
    string,
): Promise<ChatImageAttachment> {
  const response =
    await fetch(
      "/api/media/image",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            prompt,
          }),
      },
    );

  let payload:
    unknown;

  try {
    payload =
      await response
        .json();
  } catch {
    throw new Error(
      "Mabojolu could not read the local image-generation response.",
    );
  }

  if (!response.ok) {
    const message =
      typeof payload ===
          "object" &&
        payload !==
          null &&
        "error" in
          payload &&
        typeof (
          payload as {
            error?:
              unknown;
          }
        ).error ===
          "object" &&
        (
          payload as {
            error?: {
              message?:
                unknown;
            };
          }
        ).error !==
          null &&
        typeof (
          payload as {
            error: {
              message?:
                unknown;
            };
          }
        ).error
          .message ===
          "string"
        ? (
            payload as {
              error: {
                message:
                  string;
              };
            }
          ).error
            .message
        : "Mabojolu could not generate that image.";

    throw new Error(
      message,
    );
  }

  if (
    typeof payload !==
      "object" ||
    payload ===
      null ||
    !(
      "image" in
      payload
    ) ||
    typeof (
      payload as {
        image?:
          unknown;
      }
    ).image !==
      "object" ||
    (
      payload as {
        image?:
          unknown;
      }
    ).image ===
      null
  ) {
    throw new Error(
      "Mabojolu returned an invalid generated-image response.",
    );
  }

  const image =
    (
      payload as {
        image: {
          filename?:
            unknown;

          mimeType?:
            unknown;

          dataUrl?:
            unknown;
        };
      }
    ).image;

  if (
    typeof image.filename !==
      "string" ||
    typeof image.mimeType !==
      "string" ||
    typeof image.dataUrl !==
      "string" ||
    !ACCEPTED_IMAGE_TYPES.has(
      image.mimeType as
        ChatImageAttachment[
          "mimeType"
        ],
    ) ||
    !image.dataUrl.startsWith(
      `data:${image.mimeType};base64,`,
    )
  ) {
    throw new Error(
      "Mabojolu returned invalid generated-image data.",
    );
  }

  const base64 =
    image.dataUrl.slice(
      image.dataUrl.indexOf(
        ",",
      ) +
        1,
    );

  const padding =
    base64.endsWith(
      "==",
    )
      ? 2
      : base64.endsWith(
            "=",
          )
        ? 1
        : 0;

  const sizeBytes =
    Math.max(
      0,
      Math.floor(
        (
          base64.length *
          3
        ) /
          4 -
          padding,
      ),
    );

  if (
    sizeBytes >
      MAX_IMAGE_BYTES
  ) {
    throw new Error(
      "The generated image is larger than Mabojolu's 10 MB chat-image limit.",
    );
  }

  return {
    kind:
      "image",

    id:
      createAttachmentId(),

    name:
      image.filename,

    mimeType:
      image.mimeType as
        ChatImageAttachment[
          "mimeType"
        ],

    sizeBytes,

    dataUrl:
      image.dataUrl,
  };
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

function ImageGenerationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="3"
      />
      <circle
        cx="9"
        cy="10"
        r="1.5"
      />
      <path d="m5 18 4.5-4.5 3 3 2.5-2.5 4 4" />
      <path d="M18 2v4" />
      <path d="M16 4h4" />
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
  attachmentsEnabled = false,
  computeStatus = null,
  selectedModelId,
  onModelChange,
}: ComposerProps) {
  const [draft, setDraft] =
    useState("");

  const deviceProfile =
    useBrowserDeviceProfile();

  const [
    attachments,
    setAttachments,
  ] = useState<
    ChatAttachment[]
  >([]);

  const [
    attachmentError,
    setAttachmentError,
  ] = useState<string | null>(
    null,
  );

  const [
    generatedImage,
    setGeneratedImage,
  ] = useState<
    ChatImageAttachment |
    null
  >(
    null,
  );

  const [
    isGeneratingImage,
    setIsGeneratingImage,
  ] = useState(
    false,
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
      setGeneratedImage(null);
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

  const openAttachmentPicker =
    useCallback(() => {
      if (
        disabled ||
        isStreaming ||
        !attachmentsEnabled
      ) {
        return;
      }

      setAttachmentError(null);

      fileInputRef.current?.click();
    }, [
      disabled,
      attachmentsEnabled,
      isStreaming,
    ]);

  const handleAttachmentSelection =
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
          MAX_ATTACHMENT_COUNT -
          attachments.length;

        if (
          remainingSlots <= 0
        ) {
          setAttachmentError(
            `You can attach up to ${MAX_ATTACHMENT_COUNT} files to one message.`,
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
            `Only ${remainingSlots} more file${remainingSlots === 1 ? "" : "s"} can be added.`,
          );
        } else {
          setAttachmentError(
            null,
          );
        }

        const existingImageCount =
          attachments.filter(
            isChatImageAttachment,
          ).length;

        let nextImageCount =
          existingImageCount;

        const nextAttachments:
          ChatAttachment[] = [];

        for (
          const file of
            filesToRead
        ) {
          if (
            ACCEPTED_IMAGE_TYPES.has(
              file.type as
                ChatImageAttachment[
                  "mimeType"
                ],
            )
          ) {
            if (
              nextImageCount >=
                MAX_IMAGE_COUNT
            ) {
              setAttachmentError(
                `You can attach up to ${MAX_IMAGE_COUNT} images to one message.`,
              );

              continue;
            }

            if (
              file.size >
                MAX_IMAGE_BYTES
            ) {
              setAttachmentError(
                `${file.name} is ${formatMegabytes(file.size)}. Each image must be 10 MB or smaller.`,
              );

              continue;
            }

            try {
              const dataUrl =
                await readFileAsDataUrl(
                  file,
                );

              nextAttachments.push({
                kind:
                  "image",

                id:
                  createAttachmentId(),

                name:
                  file.name,

                mimeType:
                  file.type as
                    ChatImageAttachment[
                      "mimeType"
                    ],

                sizeBytes:
                  file.size,

                dataUrl,
              });

              nextImageCount +=
                1;
            } catch {
              setAttachmentError(
                `${file.name} could not be read.`,
              );
            }

            continue;
          }

          const mimeType =
            documentMimeType(
              file,
            );

          if (
            !mimeType
          ) {
            const serverMimeType =
              serverAnalyzedMimeType(
                file,
              );

            if (
              !serverMimeType
            ) {
              setAttachmentError(
                `${file.name} is not a supported Mabojolu analysis format.`,
              );

              continue;
            }

            if (
              file.size >
                MAX_SERVER_ANALYSIS_BYTES
            ) {
              setAttachmentError(
                `${file.name} is ${formatMegabytes(file.size)}. Audio and video analysis is limited to 100 MB per file on this client.`,
              );

              continue;
            }

            try {
              setAttachmentError(
                `Analyzing ${file.name} locally...`,
              );

              const analyzed =
                await analyzeFileOnServer(
                  file,
                  serverMimeType,
                );

              const remainingCapacity =
                MAX_ATTACHMENT_COUNT -
                attachments.length -
                nextAttachments.length;

              if (
                remainingCapacity <=
                  0
              ) {
                setAttachmentError(
                  `There is no room to add the analyzed evidence for ${file.name}.`,
                );

                continue;
              }

              for (
                const attachment of
                  analyzed
              ) {
                if (
                  nextAttachments.length +
                    attachments.length >=
                  MAX_ATTACHMENT_COUNT
                ) {
                  break;
                }

                if (
                  isChatImageAttachment(
                    attachment,
                  )
                ) {
                  if (
                    nextImageCount >=
                      MAX_IMAGE_COUNT
                  ) {
                    continue;
                  }

                  nextImageCount +=
                    1;
                }

                nextAttachments.push(
                  attachment,
                );
              }

              setAttachmentError(
                null,
              );
            } catch (
              cause
            ) {
              setAttachmentError(
                cause instanceof
                  Error
                  ? `${file.name}: ${cause.message}`
                  : `${file.name} could not be analyzed.`,
              );
            }

            continue;
          }

          if (
            file.size >
              MAX_DOCUMENT_BYTES
          ) {
            setAttachmentError(
              `${file.name} is ${formatMegabytes(file.size)}. Text documents must be 2 MB or smaller.`,
            );

            continue;
          }

          try {
            const textContent =
              await readTextDocument(
                file,
              );

            nextAttachments.push({
              kind:
                "document",

              id:
                createAttachmentId(),

              name:
                file.name,

              mimeType,

              sizeBytes:
                file.size,

              textContent,
            });
          } catch (
            cause
          ) {
            setAttachmentError(
              cause instanceof
                Error
                ? `${file.name}: ${cause.message}`
                : `${file.name} could not be read.`,
            );
          }
        }

        if (
          nextAttachments.length >
            0
        ) {
          setAttachments(
            (
              current,
            ) => [
              ...current,
              ...nextAttachments,
            ],
          );
        }
      },
      [
        attachments,
      ],
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

  const handleGenerateImage =
    useCallback(async () => {
      const prompt =
        draft.trim();

      if (
        !prompt ||
        disabled ||
        isStreaming ||
        isGeneratingImage
      ) {
        return;
      }

      setAttachmentError(null);
      setIsGeneratingImage(
        true,
      );

      try {
        const image =
          await generateImageOnServer(
            prompt,
          );

        setGeneratedImage(
          image,
        );
      } catch (
        cause
      ) {
        setAttachmentError(
          cause instanceof
            Error
            ? cause.message
            : "Mabojolu could not generate that image.",
        );
      } finally {
        setIsGeneratingImage(
          false,
        );
      }
    }, [
      disabled,
      draft,
      isGeneratingImage,
      isStreaming,
    ]);

  const useGeneratedImageInChat =
    useCallback(() => {
      if (
        !generatedImage
      ) {
        return;
      }

      if (
        attachments.length >=
          MAX_ATTACHMENT_COUNT
      ) {
        setAttachmentError(
          `You can attach up to ${MAX_ATTACHMENT_COUNT} files to one message.`,
        );

        return;
      }

      const imageCount =
        attachments.filter(
          isChatImageAttachment,
        ).length;

      if (
        imageCount >=
          MAX_IMAGE_COUNT
      ) {
        setAttachmentError(
          `You can attach up to ${MAX_IMAGE_COUNT} images to one message.`,
        );

        return;
      }

      setAttachments(
        (
          current,
        ) => [
          ...current,
          generatedImage,
        ],
      );

      setGeneratedImage(
        null,
      );

      setAttachmentError(
        null,
      );
    }, [
      attachments,
      generatedImage,
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
    !isGeneratingImage &&
    (draft.trim().length > 0 ||
      attachments.length > 0);

  const placeholder = disabled
    ? (
        disabledReason ??
        "Message Mabojolu"
      )
    : attachments.length > 0
      ? "Ask Mabojolu about these files"
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
            accept="image/jpeg,image/png,image/webp,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,audio/wav,audio/mpeg,audio/flac,audio/ogg,audio/mp4,video/mp4,video/webm,video/quicktime,.txt,.text,.md,.markdown,.csv,.json,.log,.py,.js,.jsx,.ts,.tsx,.css,.scss,.sql,.xml,.yaml,.yml,.toml,.ini,.pdf,.docx,.xlsx,.pptx,.wav,.mp3,.flac,.ogg,.oga,.m4a,.mp4,.m4v,.webm,.mov"
            multiple
            onChange={
              handleAttachmentSelection
            }
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          {attachments.length >
          0 ? (
            <div
              className="mb-3 flex gap-2 overflow-x-auto pb-1"
              aria-label="Selected files"
            >
              {attachments.map(
                (
                  attachment,
                ) =>
                  isChatImageAttachment(
                    attachment,
                  )
                    ? (
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
                      )
                    : isChatTextDocumentAttachment(
                        attachment,
                      )
                      ? (
                          <div
                            key={
                              attachment.id
                            }
                            className="group relative flex h-16 max-w-48 shrink-0 items-center rounded-xl border border-border-subtle bg-surface-base px-3 pr-8"
                            title={
                              attachment.name
                            }
                          >
                            <span className="truncate text-xs font-medium text-text-primary">
                              {attachment.name}
                            </span>

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
                        )
                      : null,
              )}
            </div>
          ) : null}

          {generatedImage ? (
            <div className="mb-3 rounded-2xl border border-border-subtle bg-surface-base p-3">
              <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-surface-raised">
                <Image
                  src={
                    generatedImage.dataUrl
                  }
                  alt={
                    generatedImage.name
                  }
                  fill
                  unoptimized
                  sizes="320px"
                  className="object-contain"
                />
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={
                    useGeneratedImageInChat
                  }
                  className="rounded-full border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-base"
                >
                  Use in chat
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setGeneratedImage(
                      null,
                    )
                  }
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
                >
                  Remove
                </button>
              </div>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={
                  openAttachmentPicker
                }
                disabled={
                  disabled ||
                  isStreaming ||
                  isGeneratingImage ||
                  !attachmentsEnabled ||
                  attachments.length >=
                    MAX_ATTACHMENT_COUNT
                }
                aria-label={
                  attachmentsEnabled
                    ? "Attach files"
                    : "File attachments are unavailable"
                }
                title={
                  attachmentsEnabled
                    ? "Attach images, documents, audio, video, code, or data"
                    : "File attachments are unavailable"
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-base hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PaperclipIcon />
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleGenerateImage()
                }
                disabled={
                  disabled ||
                  isStreaming ||
                  isGeneratingImage ||
                  draft.trim().length ===
                    0
                }
                aria-label="Generate image from current prompt"
                title={
                  isGeneratingImage
                    ? "Generating image locally"
                    : "Generate image from current prompt"
                }
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-base hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 ${
                  isGeneratingImage
                    ? "animate-pulse"
                    : ""
                }`}
              >
                <ImageGenerationIcon />
              </button>
            </div>

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
                    (option) => {
                      const plan =
                        deviceProfile
                          ? browserModePlan(
                              option.id,
                              deviceProfile,
                            )
                          : null;

                      return (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={
                            plan !== null &&
                            !plan.available
                          }
                        >
                          {option.label}
                          {plan !== null &&
                          !plan.available
                            ? " · unavailable"
                            : ""}
                        </option>
                      );
                    },
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

        {computeStatus ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-2 text-center text-[11px] leading-4 text-text-muted"
          >
            {computeStatus}
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
          input. You may attach images, text, source code,
          PDF, DOCX, XLSX, PPTX, audio, and video files.
          Use the image button to generate an image locally
          from the current prompt.
        </p>
      </div>
    </div>
  );
}
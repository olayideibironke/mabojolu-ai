"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  shouldUseBrowserChat,
  streamBrowserChat,
} from "@/lib/ai/browser-chat-client";
import { streamChat } from "@/lib/ai/client-stream";
import {
  createId,
  nowIso,
} from "@/lib/utilities/ids";
import type {
  ChatErrorPayload,
  ChatAttachment,
  ChatGeneratedImage,
  ChatMessage,
  ChatSource,
  FeedbackRating,
} from "@/types/chat";

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  statusLabel: string | null;

  send: (
    content: string,
    attachments?: ChatAttachment[],
  ) => void;

  startFreshConversation: (
    content: string,
    attachments?: ChatAttachment[],
  ) => void;

  stop: () => void;
  retry: () => void;

  regenerate: (
    assistantMessageId: string,
  ) => void;

  editUserMessage: (
    messageId: string,
    content: string,
  ) => void;

  setFeedback: (
    messageId: string,
    rating: FeedbackRating,
  ) => void;

  reset: () => void;

  loadMessages: (
    messages: ChatMessage[],
    conversationId: string,
  ) => void;

  canRetry: boolean;
}

export interface UseChatOptions {
  onConversationChanged?: (
    conversationId: string,
  ) => void;

  modelId?: string;
}


const IMAGE_REQUEST_PATTERN = /\b(?:generate|create|draw|make|render|produce|show|print)\b[\s\S]{0,80}\b(?:image|picture|photo|photograph|illustration|artwork|portrait|graphic)\b|\b(?:image|picture|photo|photograph|illustration|artwork|portrait|graphic)\b[\s\S]{0,80}\b(?:of|showing|depicting|with)\b/i;
const IMAGE_ANALYSIS_PATTERN = /\b(?:analy[sz]e|describe|explain|inspect|read|identify|what|who|where|tell me|look at)\b[\s\S]{0,80}\b(?:image|picture|photo|photograph|attachment)\b/i;

function imageGenerationPrompt(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed || !IMAGE_REQUEST_PATTERN.test(trimmed) || IMAGE_ANALYSIS_PATTERN.test(trimmed)) return null;
  return trimmed;
}

async function generateChatImage(prompt: string, signal: AbortSignal): Promise<ChatGeneratedImage> {
  const response = await fetch("/api/media/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const payload = await response.json().catch(() => null) as { image?: { filename?: unknown; mimeType?: unknown; dataUrl?: unknown }; error?: { message?: unknown } } | null;
  if (!response.ok || !payload?.image) {
    const message = typeof payload?.error?.message === "string" ? payload.error.message : "Mabojolu could not generate that image.";
    throw new Error(message);
  }
  const { filename, mimeType, dataUrl } = payload.image;
  if (typeof filename !== "string" || typeof mimeType !== "string" || typeof dataUrl !== "string" || !["image/jpeg","image/png","image/webp"].includes(mimeType)) throw new Error("Mabojolu returned invalid generated-image data.");
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return { id: createId(), name: filename, mimeType: mimeType as ChatGeneratedImage["mimeType"], sizeBytes: Math.max(0, Math.floor(base64.length * 3 / 4 - padding)), dataUrl, prompt };
}

interface RequestMessage {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

/**
 * Prepare one browser message for the chat API.
 *
 * Image data is included only when attachments exist, keeping ordinary text
 * requests small. Source metadata is not sent back as conversation input
 * because Anthropic receives the visible assistant text as conversation
 * context and can perform a new search when current verification is required.
 */
function prepareRequestMessage(
  message: ChatMessage,
): RequestMessage {
  const attachments =
    message.attachments?.map(
      (
        attachment,
      ) => ({
        ...attachment,
      }),
    );

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,

    ...(attachments &&
    attachments.length > 0
      ? {
          attachments,
        }
      : {}),
  };
}

export function useChat(
  options: UseChatOptions = {},
): UseChatResult {
  const [messages, setMessages] = useState<
    ChatMessage[]
  >([]);

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [statusLabel, setStatusLabel] =
    useState<string | null>(null);

  const conversationIdRef =
    useRef<string | null>(null);

  const onConversationChangedRef = useRef(
    options.onConversationChanged,
  );

  useEffect(() => {
    onConversationChangedRef.current =
      options.onConversationChanged;
  }, [options.onConversationChanged]);

  const modelIdRef = useRef(
    options.modelId,
  );

  useEffect(() => {
    modelIdRef.current =
      options.modelId;
  }, [options.modelId]);

  const controllerRef =
    useRef<AbortController | null>(null);

  const idempotencyKeyRef =
    useRef<string | null>(null);

  const generationRef = useRef(0);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    (
      history: ChatMessage[],
      assistantId: string,
      idempotencyKey: string,
    ) => {
      const generation =
        generationRef.current + 1;

      generationRef.current =
        generation;

      const controller =
        new AbortController();

      controllerRef.current =
        controller;

      idempotencyKeyRef.current =
        idempotencyKey;

      setIsStreaming(true);
      setStatusLabel(null);

      let accumulated = "";
      let receivedText = false;

      /*
       * Preserve source discovery order while preventing duplicate cards when
       * one page supports several claims in the same answer.
       */
      const sourcesById =
        new Map<string, ChatSource>();

      const currentSources =
        (): ChatSource[] =>
          Array.from(
            sourcesById.values(),
          );

      const isCurrent = () =>
        generationRef.current ===
        generation;

      const patchAssistant = (
        patch: Partial<ChatMessage>,
      ) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  ...patch,
                }
              : message,
          ),
        );
      };

      const latestUser = [...history].reverse().find((message) => message.role === "user");
      const imagePrompt = latestUser && (!latestUser.attachments || latestUser.attachments.length === 0)
        ? imageGenerationPrompt(latestUser.content)
        : null;

      if (imagePrompt) {
        setStatusLabel("Generating image...");
        void generateChatImage(imagePrompt, controller.signal)
          .then((image) => {
            if (!isCurrent()) return;
            setIsStreaming(false);
            setStatusLabel(null);
            controllerRef.current = null;
            patchAssistant({
              content: "Here is the image you asked me to create.",
              generatedImages: [image],
              status: "complete",
              model: "mabojolu-image",
            });
          })
          .catch((cause) => {
            if (!isCurrent()) return;
            if (controller.signal.aborted) {
              setIsStreaming(false);
              setStatusLabel(null);
              controllerRef.current = null;
              patchAssistant({ status: "interrupted" });
              return;
            }
            setIsStreaming(false);
            setStatusLabel(null);
            controllerRef.current = null;
            patchAssistant({
              status: "failed",
              error: {
                code: "provider_unavailable",
                message: cause instanceof Error ? cause.message : "Mabojolu could not generate that image.",
                retryable: true,
              },
            });
          });
        return;
      }

      const requestMessages =
        history
          .filter(
            (message) =>
              message.id !==
              assistantId,
          )
          .map(
            prepareRequestMessage,
          );

      const requestBody = {
        ...(conversationIdRef.current
          ? {
              conversationId:
                conversationIdRef.current,
            }
          : {}),

        messages:
          requestMessages,

        ...(modelIdRef.current
          ? {
              modelId:
                modelIdRef.current,
            }
          : {}),

        idempotencyKey,
      };

      const transport =
        shouldUseBrowserChat(
          requestBody,
        )
          ? streamBrowserChat
          : streamChat;

      void transport(
        requestBody,
        controller.signal,
        {
          onStart: ({
            model,
            conversationId,
            messageId,
          }) => {
            if (!isCurrent()) {
              return;
            }

            if (
              conversationId &&
              conversationIdRef.current !==
                conversationId
            ) {
              conversationIdRef.current =
                conversationId;

              onConversationChangedRef.current?.(
                conversationId,
              );
            }

            patchAssistant({
              status: "streaming",
              model,
              serverId: messageId,
            });
          },

          onDelta: (text) => {
            if (!isCurrent()) {
              return;
            }

            receivedText = true;
            accumulated += text;

            setStatusLabel(null);

            patchAssistant({
              content: accumulated,
              status: "streaming",

              ...(sourcesById.size > 0
                ? {
                    sources:
                      currentSources(),
                  }
                : {}),
            });
          },

          onStatus: (label) => {
            if (!isCurrent()) {
              return;
            }

            setStatusLabel(label);
          },

          onSource: (source) => {
            if (!isCurrent()) {
              return;
            }

            if (
              sourcesById.has(
                source.id,
              )
            ) {
              return;
            }

            sourcesById.set(
              source.id,
              source,
            );

            patchAssistant({
              sources:
                currentSources(),
              status: "streaming",
            });
          },

          onDone: ({
            finishReason,
          }) => {
            if (!isCurrent()) {
              return;
            }

            setIsStreaming(false);
            setStatusLabel(null);

            controllerRef.current =
              null;

            const sources =
              currentSources();

            if (
              finishReason ===
              "aborted"
            ) {
              if (
                receivedText ||
                sources.length > 0
              ) {
                patchAssistant({
                  content: accumulated,
                  status:
                    "interrupted",

                  ...(sources.length > 0
                    ? {
                        sources,
                      }
                    : {
                        sources:
                          undefined,
                      }),
                });
              } else {
                setMessages(
                  (current) =>
                    current.filter(
                      (message) =>
                        message.id !==
                        assistantId,
                    ),
                );
              }

              return;
            }

            if (
              finishReason ===
                "refusal" &&
              !receivedText
            ) {
              patchAssistant({
                status: "failed",

                ...(sources.length > 0
                  ? {
                      sources,
                    }
                  : {
                      sources:
                        undefined,
                    }),

                error: {
                  code:
                    "provider_refused",

                  message:
                    "Mabojolu was unable to answer that request. Try rephrasing it.",

                  retryable: false,
                },
              });

              return;
            }

            patchAssistant({
              content: accumulated,
              status: "complete",

              ...(sources.length > 0
                ? {
                    sources,
                  }
                : {
                    sources:
                      undefined,
                  }),
            });
          },

          onError: (
            error: ChatErrorPayload,
          ) => {
            if (!isCurrent()) {
              return;
            }

            setIsStreaming(false);
            setStatusLabel(null);

            controllerRef.current =
              null;

            const sources =
              currentSources();

            patchAssistant({
              content: accumulated,
              status: "failed",
              error,

              ...(sources.length > 0
                ? {
                    sources,
                  }
                : {
                    sources:
                      undefined,
                  }),
            });
          },
        },
      );
    },
    [],
  );

  const send = useCallback(
    (
      content: string,
      attachments:
        ChatAttachment[] = [],
    ) => {
      const trimmed =
        content.trim();

      if (
        (trimmed.length === 0 &&
          attachments.length === 0) ||
        isStreaming
      ) {
        return;
      }

      const timestamp = nowIso();

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",

        content:
          trimmed,

        status: "complete",
        createdAt: timestamp,

        ...(attachments.length > 0
          ? {
              attachments:
                attachments.map(
                  (attachment) => ({
                    ...attachment,
                  }),
                ),
            }
          : {}),
      };

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        status: "pending",
        createdAt: timestamp,
      };

      const next = [
        ...messages,
        userMessage,
        assistantMessage,
      ];

      setMessages(next);

      run(
        next,
        assistantMessage.id,
        createId(),
      );
    },
    [
      isStreaming,
      messages,
      run,
    ],
  );

  const startFreshConversation = useCallback(
    (
      content: string,
      attachments:
        ChatAttachment[] = [],
    ) => {
      const trimmed =
        content.trim();

      if (
        (trimmed.length === 0 &&
          attachments.length === 0) ||
        isStreaming
      ) {
        return;
      }

      controllerRef.current?.abort();

      controllerRef.current =
        null;

      generationRef.current +=
        1;

      idempotencyKeyRef.current =
        null;

      conversationIdRef.current =
        null;

      const timestamp =
        nowIso();

      const userMessage:
        ChatMessage = {
        id: createId(),
        role: "user",

        content:
          trimmed,

        status: "complete",
        createdAt:
          timestamp,

        ...(attachments.length > 0
          ? {
              attachments:
                attachments.map(
                  (
                    attachment,
                  ) => ({
                    ...attachment,
                  }),
                ),
            }
          : {}),
      };

      const assistantMessage:
        ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        status: "pending",
        createdAt:
          timestamp,
      };

      const next = [
        userMessage,
        assistantMessage,
      ];

      setMessages(
        next,
      );

      setStatusLabel(
        null,
      );

      run(
        next,
        assistantMessage.id,
        createId(),
      );
    },
    [
      isStreaming,
      run,
    ],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (isStreaming) {
      return;
    }

    const lastIndex =
      messages.length - 1;

    const last =
      messages[lastIndex];

    if (
      !last ||
      last.role !== "assistant" ||
      last.status !== "failed"
    ) {
      return;
    }

    const resetMessage: ChatMessage = {
      ...last,
      content: "",
      status: "pending",
      error: undefined,
      sources: undefined,
    };

    const next = [
      ...messages.slice(
        0,
        lastIndex,
      ),
      resetMessage,
    ];

    setMessages(next);

    run(
      next,
      resetMessage.id,
      idempotencyKeyRef.current ??
        createId(),
    );
  }, [
    isStreaming,
    messages,
    run,
  ]);

  const regenerate = useCallback(
    (
      assistantMessageId: string,
    ) => {
      if (isStreaming) {
        return;
      }

      const index =
        messages.findIndex(
          (message) =>
            message.id ===
            assistantMessageId,
        );

      if (
        index < 1 ||
        messages[index].role !==
          "assistant"
      ) {
        return;
      }

      const placeholder: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        status: "pending",
        createdAt: nowIso(),
      };

      const next = [
        ...messages.slice(
          0,
          index,
        ),
        placeholder,
      ];

      setMessages(next);

      run(
        next,
        placeholder.id,
        createId(),
      );
    },
    [
      isStreaming,
      messages,
      run,
    ],
  );

  const editUserMessage = useCallback(
    (
      messageId: string,
      content: string,
    ) => {
      const trimmed =
        content.trim();

      if (
        trimmed.length === 0 ||
        isStreaming
      ) {
        return;
      }

      const index =
        messages.findIndex(
          (message) =>
            message.id ===
            messageId,
        );

      if (
        index === -1 ||
        messages[index].role !==
          "user"
      ) {
        return;
      }

      const edited: ChatMessage = {
        ...messages[index],
        content: trimmed,
        status: "complete",
      };

      const placeholder: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        status: "pending",
        createdAt: nowIso(),
      };

      const next = [
        ...messages.slice(
          0,
          index,
        ),
        edited,
        placeholder,
      ];

      setMessages(next);

      run(
        next,
        placeholder.id,
        createId(),
      );
    },
    [
      isStreaming,
      messages,
      run,
    ],
  );

  const setFeedback = useCallback(
    (
      messageId: string,
      rating: FeedbackRating,
    ) => {
      const target =
        messages.find(
          (message) =>
            message.id ===
            messageId,
        );

      if (!target) {
        return;
      }

      const nextRating =
        target.feedback === rating
          ? null
          : rating;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,

                feedback:
                  nextRating ??
                  undefined,
              }
            : message,
        ),
      );

      const serverId =
        target.serverId;

      if (!serverId) {
        return;
      }

      void (async () => {
        try {
          const response =
            nextRating
              ? await fetch(
                  "/api/feedback",
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",
                    },

                    body:
                      JSON.stringify({
                        messageId:
                          serverId,

                        rating:
                          nextRating,
                      }),
                  },
                )
              : await fetch(
                  `/api/feedback?messageId=${encodeURIComponent(
                    serverId,
                  )}`,
                  {
                    method:
                      "DELETE",
                  },
                );

          if (!response.ok) {
            setMessages(
              (current) =>
                current.map(
                  (message) =>
                    message.id ===
                    messageId
                      ? {
                          ...message,

                          feedback:
                            target.feedback,
                        }
                      : message,
                ),
            );
          }
        } catch {
          setMessages(
            (current) =>
              current.map(
                (message) =>
                  message.id ===
                  messageId
                    ? {
                        ...message,

                        feedback:
                          target.feedback,
                      }
                    : message,
              ),
          );
        }
      })();
    },
    [messages],
  );

  const loadMessages = useCallback(
    (
      loaded: ChatMessage[],
      conversationId: string,
    ) => {
      controllerRef.current?.abort();

      controllerRef.current =
        null;

      generationRef.current += 1;

      idempotencyKeyRef.current =
        null;

      conversationIdRef.current =
        conversationId;

      setMessages(
        loaded.map(
          (message) => ({
            ...message,

            ...(message.attachments
              ? {
                  attachments:
                    message.attachments.map(
                      (attachment) => ({
                        ...attachment,
                      }),
                    ),
                }
              : {}),

            ...(message.sources
              ? {
                  sources:
                    message.sources.map(
                      (source) => ({
                        ...source,
                      }),
                    ),
                }
              : {}),

            serverId:
              message.id,
          }),
        ),
      );

      setIsStreaming(false);
      setStatusLabel(null);
    },
    [],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();

    controllerRef.current =
      null;

    generationRef.current += 1;

    idempotencyKeyRef.current =
      null;

    conversationIdRef.current =
      null;

    setMessages([]);
    setIsStreaming(false);
    setStatusLabel(null);
  }, []);

  const last =
    messages.at(-1);

  const canRetry =
    !isStreaming &&
    last?.role === "assistant" &&
    last.status === "failed" &&
    (last.error?.retryable ??
      false);

  return {
    messages,
    isStreaming,
    statusLabel,
    send,
    startFreshConversation,
    stop,
    retry,
    regenerate,
    editUserMessage,
    setFeedback,
    reset,
    loadMessages,
    canRetry,
  };
}
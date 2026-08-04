"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { streamChat } from "@/lib/ai/client-stream";
import {
  createId,
  nowIso,
} from "@/lib/utilities/ids";
import type {
  ChatErrorPayload,
  ChatMessage,
  FeedbackRating,
} from "@/types/chat";

/**
 * Chat state and transport.
 *
 * All conversation mutation lives here so the components stay presentational.
 *
 * An interrupted generation must not corrupt the conversation. Partial text is
 * kept and marked interrupted.
 *
 * Retry must not duplicate a message. Retrying replaces the failed assistant
 * turn in place and reuses the same idempotency key.
 *
 * The selected model is supplied by the parent and included with every new
 * generation, retry, regeneration, and edited-message request.
 */

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;

  /** Progress label from the server, such as Thinking. */
  statusLabel: string | null;

  send: (content: string) => void;
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

  /** Replace the transcript when a stored conversation is opened. */
  loadMessages: (
    messages: ChatMessage[],
    conversationId: string,
  ) => void;

  /** True when the last assistant turn failed and can be retried. */
  canRetry: boolean;
}

export interface UseChatOptions {
  /** Called once the server has created or updated a conversation. */
  onConversationChanged?: (
    conversationId: string,
  ) => void;

  /**
   * Mabojolu model selected by the user.
   *
   * Examples:
   * mabojolu-fast
   * mabojolu-local
   */
  modelId?: string;
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

  /**
   * The conversation currently being appended to.
   *
   * A ref is used because asynchronous stream callbacks must always read the
   * latest conversation without depending on captured React state.
   */
  const conversationIdRef =
    useRef<string | null>(null);

  /**
   * Keep the conversation-changed callback current without forcing every chat
   * callback to be recreated whenever the parent renders.
   */
  const onConversationChangedRef = useRef(
    options.onConversationChanged,
  );

  useEffect(() => {
    onConversationChangedRef.current =
      options.onConversationChanged;
  }, [options.onConversationChanged]);

  /**
   * Keep the selected model current for future generations.
   *
   * A model change does not interrupt an answer already being generated. It
   * applies to the next send, retry, regeneration, or edited-message request.
   */
  const modelIdRef = useRef(
    options.modelId,
  );

  useEffect(() => {
    modelIdRef.current = options.modelId;
  }, [options.modelId]);

  const controllerRef =
    useRef<AbortController | null>(null);

  const idempotencyKeyRef =
    useRef<string | null>(null);

  /**
   * Guards against a late stream writing into a conversation that has already
   * changed.
   */
  const generationRef = useRef(0);

  /**
   * Abort any active generation when the component unmounts.
   */
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  /**
   * Run one generation against the supplied history.
   *
   * The history already contains the user turn and ends with the placeholder
   * assistant message identified by assistantId.
   */
  const run = useCallback(
    (
      history: ChatMessage[],
      assistantId: string,
      idempotencyKey: string,
    ) => {
      const generation =
        generationRef.current + 1;

      generationRef.current = generation;

      const controller =
        new AbortController();

      controllerRef.current = controller;
      idempotencyKeyRef.current =
        idempotencyKey;

      setIsStreaming(true);
      setStatusLabel(null);

      let accumulated = "";
      let receivedText = false;

      const isCurrent = () =>
        generationRef.current === generation;

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

      void streamChat(
        {
          ...(conversationIdRef.current
            ? {
                conversationId:
                  conversationIdRef.current,
              }
            : {}),

          messages: history
            .filter(
              (message) =>
                message.id !== assistantId,
            )
            .map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),

          ...(modelIdRef.current
            ? {
                modelId:
                  modelIdRef.current,
              }
            : {}),

          idempotencyKey,
        },
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
            });
          },

          onStatus: (label) => {
            if (!isCurrent()) {
              return;
            }

            setStatusLabel(label);
          },

          onDone: ({
            finishReason,
          }) => {
            if (!isCurrent()) {
              return;
            }

            setIsStreaming(false);
            setStatusLabel(null);
            controllerRef.current = null;

            if (
              finishReason === "aborted"
            ) {
              if (receivedText) {
                patchAssistant({
                  content: accumulated,
                  status: "interrupted",
                });
              } else {
                setMessages((current) =>
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
              finishReason === "refusal" &&
              !receivedText
            ) {
              patchAssistant({
                status: "failed",
                error: {
                  code: "provider_refused",
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
            controllerRef.current = null;

            patchAssistant({
              content: accumulated,
              status: "failed",
              error,
            });
          },
        },
      );
    },
    [],
  );

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim();

      if (
        trimmed.length === 0 ||
        isStreaming
      ) {
        return;
      }

      const timestamp = nowIso();

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
        status: "complete",
        createdAt: timestamp,
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

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  /**
   * Retry the last failed assistant turn.
   *
   * The previous idempotency key is reused so the server recognizes the same
   * logical request instead of creating a duplicate.
   */
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
    };

    const next = [
      ...messages.slice(0, lastIndex),
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

  /**
   * Regenerate an assistant reply.
   *
   * The selected reply and everything after it are discarded. Mabojolu then
   * responds again using the currently selected model.
   */
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
        ...messages.slice(0, index),
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

  /**
   * Edit a user message and generate a new response from that point.
   *
   * Later turns are discarded because they answered the previous wording.
   */
  const editUserMessage = useCallback(
    (
      messageId: string,
      content: string,
    ) => {
      const trimmed = content.trim();

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
        messages[index].role !== "user"
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
        ...messages.slice(0, index),
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

  /**
   * Record message feedback optimistically, then save it on the server.
   */
  const setFeedback = useCallback(
    (
      messageId: string,
      rating: FeedbackRating,
    ) => {
      const target =
        messages.find(
          (message) =>
            message.id === messageId,
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
          const response = nextRating
            ? await fetch(
                "/api/feedback",
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
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
                  method: "DELETE",
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
          setMessages((current) =>
            current.map((message) =>
              message.id === messageId
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

  /**
   * Replace the current transcript with a stored conversation.
   */
  const loadMessages = useCallback(
    (
      loaded: ChatMessage[],
      conversationId: string,
    ) => {
      controllerRef.current?.abort();
      controllerRef.current = null;

      generationRef.current += 1;
      idempotencyKeyRef.current = null;

      conversationIdRef.current =
        conversationId;

      setMessages(
        loaded.map((message) => ({
          ...message,
          serverId: message.id,
        })),
      );

      setIsStreaming(false);
      setStatusLabel(null);
    },
    [],
  );

  /**
   * Start a clean conversation.
   */
  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;

    generationRef.current += 1;
    idempotencyKeyRef.current = null;
    conversationIdRef.current = null;

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
    (last.error?.retryable ?? false);

  return {
    messages,
    isStreaming,
    statusLabel,
    send,
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
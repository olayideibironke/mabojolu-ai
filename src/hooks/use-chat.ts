"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { streamChat } from "@/lib/ai/client-stream";
import { createId, nowIso } from "@/lib/utilities/ids";
import type { ChatErrorPayload, ChatMessage, FeedbackRating } from "@/types/chat";

/**
 * Chat state and transport.
 *
 * All conversation mutation lives here so the components stay presentational.
 * Two invariants drive the design:
 *
 *  1. An interrupted generation must not corrupt the conversation. Partial text
 *     is kept and marked `interrupted`, never silently dropped or left looking
 *     complete.
 *  2. Retry must not duplicate a message. Retrying replaces the failed
 *     assistant turn in place and reuses the same idempotency key, so the server
 *     can recognize the repeat instead of billing a second generation.
 */

export interface UseChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** Progress label from the server, for example "Thinking". */
  statusLabel: string | null;
  send: (content: string) => void;
  stop: () => void;
  retry: () => void;
  regenerate: (assistantMessageId: string) => void;
  editUserMessage: (messageId: string, content: string) => void;
  setFeedback: (messageId: string, rating: FeedbackRating) => void;
  reset: () => void;
  /** Replace the transcript, when a stored conversation is opened. */
  loadMessages: (messages: ChatMessage[], conversationId: string) => void;
  /** True when the last assistant turn failed and can be retried. */
  canRetry: boolean;
}

export interface UseChatOptions {
  /** Called once the server has created or updated a conversation. */
  onConversationChanged?: (conversationId: string) => void;
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  /**
   * The conversation being appended to.
   *
   * A ref, not state: it is read inside async callbacks where a captured state
   * value would be stale, and changing it must not trigger a re-render.
   */
  const conversationIdRef = useRef<string | null>(null);

  /**
   * The conversation-changed callback, held in a ref.
   *
   * Kept in a ref so `run` does not take it as a dependency, which would rebuild
   * every callback whenever the parent re-rendered. Assigned in an effect rather
   * than during render: writing a ref during render is not allowed, because a
   * render may be thrown away and the write would still have happened.
   */
  const onConversationChangedRef = useRef(options.onConversationChanged);

  useEffect(() => {
    onConversationChangedRef.current = options.onConversationChanged;
  }, [options.onConversationChanged]);

  // Refs rather than state: these are read inside async callbacks where a
  // captured state value would be stale.
  const controllerRef = useRef<AbortController | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  /** Guards against a late stream writing into a conversation that moved on. */
  const generationRef = useRef(0);

  // Abort any in-flight generation when the component goes away, so a
  // navigation does not leave a request running and billing.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  /**
   * Run one generation against the given history.
   *
   * `history` must already contain the user turn and end with the placeholder
   * assistant message identified by `assistantId`.
   */
  const run = useCallback(
    (history: ChatMessage[], assistantId: string, idempotencyKey: string) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;

      const controller = new AbortController();
      controllerRef.current = controller;
      idempotencyKeyRef.current = idempotencyKey;

      setIsStreaming(true);
      setStatusLabel(null);

      // Tracked outside React state so the settle handlers see the final text
      // without depending on a state update having flushed.
      let accumulated = "";
      let receivedText = false;

      const isCurrent = () => generationRef.current === generation;

      const patchAssistant = (patch: Partial<ChatMessage>) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message,
          ),
        );
      };

      void streamChat(
        {
          // Absent on the first message, so the server creates the conversation
          // and returns its id in the start event.
          ...(conversationIdRef.current
            ? { conversationId: conversationIdRef.current }
            : {}),
          messages: history
            // Only completed turns are context. The placeholder must not be sent.
            .filter((message) => message.id !== assistantId)
            .map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })),
          idempotencyKey,
        },
        controller.signal,
        {
          onStart: ({ model, conversationId, messageId }) => {
            if (!isCurrent()) return;

            // Adopt the server's identifiers. The server-assigned message id is
            // what makes feedback and regeneration addressable after a refresh.
            if (conversationId && conversationIdRef.current !== conversationId) {
              conversationIdRef.current = conversationId;
              onConversationChangedRef.current?.(conversationId);
            }

            patchAssistant({ status: "streaming", model, serverId: messageId });
          },
          onDelta: (text) => {
            if (!isCurrent()) return;
            receivedText = true;
            accumulated += text;
            // Clear the progress label as soon as real text arrives.
            setStatusLabel(null);
            patchAssistant({ content: accumulated, status: "streaming" });
          },
          onStatus: (label) => {
            if (!isCurrent()) return;
            setStatusLabel(label);
          },
          onDone: ({ finishReason }) => {
            if (!isCurrent()) return;

            setIsStreaming(false);
            setStatusLabel(null);
            controllerRef.current = null;

            if (finishReason === "aborted") {
              // Keep whatever arrived. An empty stop removes the placeholder
              // rather than leaving a blank bubble behind.
              if (receivedText) {
                patchAssistant({ content: accumulated, status: "interrupted" });
              } else {
                setMessages((current) =>
                  current.filter((message) => message.id !== assistantId),
                );
              }
              return;
            }

            if (finishReason === "refusal" && !receivedText) {
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

            patchAssistant({ content: accumulated, status: "complete" });
          },
          onError: (error: ChatErrorPayload) => {
            if (!isCurrent()) return;

            setIsStreaming(false);
            setStatusLabel(null);
            controllerRef.current = null;

            // Text already shown is preserved and the failure is attached to
            // it, so a mid-stream error does not erase a partial answer.
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
      if (trimmed.length === 0 || isStreaming) {
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

      setMessages((current) => {
        const next = [...current, userMessage, assistantMessage];
        run(next, assistantMessage.id, createId());
        return next;
      });
    },
    [isStreaming, run],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  /**
   * Re-run the last assistant turn.
   *
   * Reuses the previous idempotency key so the server can tell this is the same
   * logical request rather than a new one.
   */
  const retry = useCallback(() => {
    if (isStreaming) {
      return;
    }

    setMessages((current) => {
      const lastIndex = current.length - 1;
      const last = current[lastIndex];

      if (!last || last.role !== "assistant" || last.status !== "failed") {
        return current;
      }

      const reset: ChatMessage = {
        ...last,
        content: "",
        status: "pending",
        error: undefined,
      };
      const next = [...current.slice(0, lastIndex), reset];

      run(next, reset.id, idempotencyKeyRef.current ?? createId());
      return next;
    });
  }, [isStreaming, run]);

  /**
   * Regenerate an assistant reply.
   *
   * Drops that reply and everything after it, then re-asks from the preceding
   * user turn. A fresh idempotency key is used because this is a genuinely new
   * request the user asked for.
   */
  const regenerate = useCallback(
    (assistantMessageId: string) => {
      if (isStreaming) {
        return;
      }

      setMessages((current) => {
        const index = current.findIndex(
          (message) => message.id === assistantMessageId,
        );

        if (index < 1 || current[index].role !== "assistant") {
          return current;
        }

        const placeholder: ChatMessage = {
          id: createId(),
          role: "assistant",
          content: "",
          status: "pending",
          createdAt: nowIso(),
        };
        const next = [...current.slice(0, index), placeholder];

        run(next, placeholder.id, createId());
        return next;
      });
    },
    [isStreaming, run],
  );

  /**
   * Edit a user message and re-ask from that point.
   *
   * Later turns are discarded because they answered the old wording and would
   * otherwise contradict the new question.
   */
  const editUserMessage = useCallback(
    (messageId: string, content: string) => {
      const trimmed = content.trim();
      if (trimmed.length === 0 || isStreaming) {
        return;
      }

      setMessages((current) => {
        const index = current.findIndex((message) => message.id === messageId);

        if (index === -1 || current[index].role !== "user") {
          return current;
        }

        const edited: ChatMessage = {
          ...current[index],
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
        const next = [...current.slice(0, index), edited, placeholder];

        run(next, placeholder.id, createId());
        return next;
      });
    },
    [isStreaming, run],
  );

  /**
   * Record feedback, optimistically and then on the server.
   *
   * Optimistic because the control should respond instantly. Persisted because a
   * thumb that only animates is a decorative control, and the point of feedback is
   * that someone can act on it.
   */
  const setFeedback = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      const target = messages.find((message) => message.id === messageId);

      if (!target) {
        return;
      }

      // Selecting the same rating again clears it, so a mis-click is reversible.
      const nextRating = target.feedback === rating ? null : rating;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, feedback: nextRating ?? undefined }
            : message,
        ),
      );

      // Only a stored message can carry feedback. A reply still streaming has no
      // server id yet, and there is nothing to attach it to.
      const serverId = target.serverId;
      if (!serverId) {
        return;
      }

      void (async () => {
        try {
          const response = nextRating
            ? await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: serverId, rating: nextRating }),
              })
            : await fetch(
                `/api/feedback?messageId=${encodeURIComponent(serverId)}`,
                { method: "DELETE" },
              );

          if (!response.ok) {
            // Roll back, so the UI does not claim to have saved something it did
            // not.
            setMessages((current) =>
              current.map((message) =>
                message.id === messageId
                  ? { ...message, feedback: target.feedback }
                  : message,
              ),
            );
          }
        } catch {
          setMessages((current) =>
            current.map((message) =>
              message.id === messageId
                ? { ...message, feedback: target.feedback }
                : message,
            ),
          );
        }
      })();
    },
    [messages],
  );

  /**
   * Replace the transcript with a stored conversation.
   *
   * Aborts any active generation first and bumps the guard, so a stream belonging
   * to the previous conversation cannot write into this one.
   */
  const loadMessages = useCallback(
    (loaded: ChatMessage[], conversationId: string) => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      generationRef.current += 1;
      idempotencyKeyRef.current = null;
      conversationIdRef.current = conversationId;

      // Stored rows already carry their database ids, so `serverId` mirrors `id`
      // and actions such as feedback work immediately after a refresh.
      setMessages(
        loaded.map((message) => ({ ...message, serverId: message.id })),
      );
      setIsStreaming(false);
      setStatusLabel(null);
    },
    [],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    // Invalidate any in-flight stream so it cannot write into the new chat.
    generationRef.current += 1;
    idempotencyKeyRef.current = null;
    // Clearing this is what makes the next message create a new conversation
    // rather than appending to the previous one.
    conversationIdRef.current = null;

    setMessages([]);
    setIsStreaming(false);
    setStatusLabel(null);
  }, []);

  const last = messages.at(-1);
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

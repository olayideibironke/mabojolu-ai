"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/ui/brand-mark";
import { Button, IconButton } from "@/components/ui/button";
import { AlertIcon, EditIcon } from "@/components/ui/icons";
import type { ChatMessage, FeedbackRating } from "@/types/chat";

import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";

/**
 * One turn in the conversation.
 *
 * User turns render as plain text in a bubble: their content is never parsed as
 * Markdown, so a user cannot inject formatting or markup into the transcript.
 * Assistant turns render Markdown through the safe renderer.
 */

interface MessageProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry: () => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}

export function Message({
  message,
  isLastAssistant,
  isStreaming,
  onRetry,
  onRegenerate,
  onEdit,
  onFeedback,
}: MessageProps) {
  if (message.role === "user") {
    return (
      <UserMessage
        message={message}
        disabled={isStreaming}
        onEdit={onEdit}
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      isLastAssistant={isLastAssistant}
      isStreaming={isStreaming}
      onRetry={onRetry}
      onRegenerate={onRegenerate}
      onFeedback={onFeedback}
    />
  );
}

function UserMessage({
  message,
  disabled,
  onEdit,
}: {
  message: ChatMessage;
  disabled: boolean;
  onEdit: (messageId: string, content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus and size the editor when it opens, and put the caret at the end so
  // the user can keep typing immediately.
  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const node = textareaRef.current;
    if (!node) {
      return;
    }

    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [isEditing]);

  const beginEdit = useCallback(() => {
    setDraft(message.content);
    setIsEditing(true);
  }, [message.content]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setDraft(message.content);
  }, [message.content]);

  const submit = useCallback(() => {
    const trimmed = draft.trim();

    // An unchanged or empty edit is a no-op rather than a wasted generation.
    if (trimmed.length === 0 || trimmed === message.content) {
      cancel();
      return;
    }

    setIsEditing(false);
    onEdit(message.id, trimmed);
  }, [cancel, draft, message.content, message.id, onEdit]);

  if (isEditing) {
    return (
      <article className="flex justify-end" aria-label="Editing your message">
        <div className="w-full max-w-[85%] rounded-2xl border border-border-default bg-surface-raised p-3 shadow-sm sm:max-w-[75%]">
          <label className="sr-only" htmlFor={`edit-${message.id}`}>
            Edit your message
          </label>
          <textarea
            id={`edit-${message.id}`}
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              const node = event.currentTarget;
              node.style.height = "auto";
              node.style.height = `${node.scrollHeight}px`;
            }}
            onKeyDown={(event) => {
              // Enter submits, Shift+Enter adds a line, Escape cancels: the
              // same contract as the main composer.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
            rows={1}
            className="max-h-64 w-full resize-none bg-transparent text-[15px] leading-6 text-text-primary outline-none"
          />

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={submit}>
              Send
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex justify-end gap-2">
      {/* Revealed on hover and on keyboard focus, so it is reachable without a
          pointer. */}
      <div className="flex items-end pb-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          size="sm"
          label="Edit message"
          onClick={beginEdit}
          disabled={disabled}
        >
          <EditIcon className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-surface-inverse px-4 py-3 text-sm leading-6 text-text-inverse sm:max-w-[75%]">
        {/* Plain text, never Markdown. `whitespace-pre-wrap` keeps the user's
            own line breaks without interpreting their content. */}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </article>
  );
}

function AssistantMessage({
  message,
  isLastAssistant,
  isStreaming,
  onRetry,
  onRegenerate,
  onFeedback,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry: () => void;
  onRegenerate: (messageId: string) => void;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
}) {
  const isActive = message.status === "streaming" || message.status === "pending";
  const hasContent = message.content.trim().length > 0;

  return (
    <article className="flex gap-3 sm:gap-4">
      <BrandMark size="sm" />

      <div className="min-w-0 flex-1 pt-0.5">
        {hasContent ? <Markdown content={message.content} /> : null}

        {/* Caret only while text is actively arriving, so it reads as progress
            rather than decoration. */}
        {message.status === "streaming" ? (
          <span className="mabojolu-caret" aria-hidden="true" />
        ) : null}

        {message.status === "interrupted" ? (
          <p className="mt-2 text-xs text-text-muted">
            Generation stopped. This response is incomplete.
          </p>
        ) : null}

        {message.status === "failed" && message.error ? (
          <div
            // `alert` announces the failure immediately, which matters when the
            // user is not looking at this part of the page.
            role="alert"
            className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-danger-subtle px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
              <AlertIcon className="h-4 w-4 shrink-0 text-danger" />
              <span className="min-w-0">{message.error.message}</span>
            </span>

            {message.error.retryable ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Actions appear once a reply has settled with content. Showing them
            mid-stream would offer controls that cannot work yet. */}
        {!isActive && hasContent && message.status !== "failed" ? (
          <div className="mt-2 -ml-1.5">
            <MessageActions
              content={message.content}
              feedback={message.feedback}
              disabled={isStreaming || !isLastAssistant}
              onRegenerate={() => onRegenerate(message.id)}
              onFeedback={(rating) => onFeedback(message.id, rating)}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

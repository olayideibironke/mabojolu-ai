"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BrandMark } from "@/components/ui/brand-mark";
import {
  Button,
  IconButton,
} from "@/components/ui/button";
import {
  AlertIcon,
  EditIcon,
} from "@/components/ui/icons";
import type {
  ChatImageAttachment,
  ChatMessage,
  FeedbackRating,
} from "@/types/chat";

import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";
import { ResponseModelLabel } from "./response-model-label";

/**
 * One turn in the conversation.
 *
 * User text is rendered as plain text so user-provided content is never
 * interpreted as Markdown. Assistant responses use Mabojolu's safe Markdown
 * renderer.
 *
 * User image attachments are displayed directly above the accompanying prompt.
 */

interface MessageProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry: () => void;

  onRegenerate: (
    messageId: string,
  ) => void;

  onEdit: (
    messageId: string,
    content: string,
  ) => void;

  onFeedback: (
    messageId: string,
    rating: FeedbackRating,
  ) => void;
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

function UserAttachmentGallery({
  attachments,
}: {
  attachments: ChatImageAttachment[];
}) {
  if (attachments.length === 0) {
    return null;
  }

  const isSingleImage =
    attachments.length === 1;

  return (
    <div
      aria-label={`${attachments.length} attached ${
        attachments.length === 1
          ? "image"
          : "images"
      }`}
      className={`grid max-w-full gap-2 ${
        isSingleImage
          ? "w-[300px] grid-cols-1"
          : "w-[360px] grid-cols-2"
      }`}
    >
      {attachments.map(
        (attachment) => (
          <figure
            key={attachment.id}
            title={attachment.name}
            className={`relative m-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base ${
              isSingleImage
                ? "aspect-[4/3]"
                : "aspect-square"
            }`}
          >
            <Image
              src={attachment.dataUrl}
              alt={attachment.name}
              fill
              unoptimized
              sizes={
                isSingleImage
                  ? "300px"
                  : "180px"
              }
              className="object-cover"
            />

            <figcaption className="sr-only">
              {attachment.name}
            </figcaption>
          </figure>
        ),
      )}
    </div>
  );
}

function UserMessage({
  message,
  disabled,
  onEdit,
}: {
  message: ChatMessage;
  disabled: boolean;

  onEdit: (
    messageId: string,
    content: string,
  ) => void;
}) {
  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    draft,
    setDraft,
  ] = useState(message.content);

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  const attachments =
    message.attachments ?? [];

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const node =
      textareaRef.current;

    if (!node) {
      return;
    }

    node.focus();

    node.setSelectionRange(
      node.value.length,
      node.value.length,
    );

    node.style.height = "auto";
    node.style.height =
      `${node.scrollHeight}px`;
  }, [isEditing]);

  const beginEdit =
    useCallback(() => {
      setDraft(message.content);
      setIsEditing(true);
    }, [message.content]);

  const cancel =
    useCallback(() => {
      setIsEditing(false);
      setDraft(message.content);
    }, [message.content]);

  const submit =
    useCallback(() => {
      const trimmed =
        draft.trim();

      if (
        trimmed.length === 0 ||
        trimmed === message.content
      ) {
        cancel();
        return;
      }

      setIsEditing(false);

      onEdit(
        message.id,
        trimmed,
      );
    }, [
      cancel,
      draft,
      message.content,
      message.id,
      onEdit,
    ]);

  if (isEditing) {
    return (
      <article
        className="flex justify-end"
        aria-label="Editing your message"
      >
        <div className="w-full max-w-[85%] rounded-2xl border border-border-default bg-surface-raised p-3 shadow-sm sm:max-w-[75%]">
          {attachments.length > 0 ? (
            <div className="mb-3">
              <UserAttachmentGallery
                attachments={attachments}
              />

              <p className="mt-2 text-[11px] leading-4 text-text-muted">
                Attached images will remain with the edited
                message.
              </p>
            </div>
          ) : null}

          <label
            className="sr-only"
            htmlFor={`edit-${message.id}`}
          >
            Edit your message
          </label>

          <textarea
            id={`edit-${message.id}`}
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(
                event.target.value,
              );

              const node =
                event.currentTarget;

              node.style.height =
                "auto";

              node.style.height =
                `${node.scrollHeight}px`;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                submit();
              }

              if (
                event.key === "Escape"
              ) {
                event.preventDefault();
                cancel();
              }
            }}
            rows={1}
            className="max-h-64 w-full resize-none border-0 bg-transparent text-[17px] leading-7 text-text-primary outline-none ring-0 shadow-none focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none"
          />

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
            >
              Cancel
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={submit}
            >
              Send
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex justify-end gap-2">
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

      <div
        className={`max-w-[88%] rounded-3xl rounded-br-lg border border-border-subtle bg-surface-raised text-[17px] leading-7 text-text-primary shadow-sm sm:max-w-[78%] ${
          attachments.length > 0
            ? "p-2"
            : "px-5 py-3.5"
        }`}
      >
        {attachments.length > 0 ? (
          <UserAttachmentGallery
            attachments={attachments}
          />
        ) : null}

        {message.content.trim().length >
        0 ? (
          <p
            className={`whitespace-pre-wrap break-words ${
              attachments.length > 0
                ? "px-3 pb-2 pt-3"
                : ""
            }`}
          >
            {message.content}
          </p>
        ) : null}
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

  onRegenerate: (
    messageId: string,
  ) => void;

  onFeedback: (
    messageId: string,
    rating: FeedbackRating,
  ) => void;
}) {
  const isActive =
    message.status === "streaming" ||
    message.status === "pending";

  const hasContent =
    message.content.trim().length > 0;

  const isThisMessageStreaming =
    isStreaming && isActive;

  return (
    <article className="flex gap-3 sm:gap-4">
      <BrandMark size="sm" />

      <div className="min-w-0 flex-1 pt-0.5 [&_.mabojolu-prose]:!text-[18px] [&_.mabojolu-prose]:!leading-[30px]">
        {hasContent ? (
          <Markdown
            content={message.content}
          />
        ) : null}

        {message.status ===
        "streaming" ? (
          <span
            className="mabojolu-caret"
            aria-hidden="true"
          />
        ) : null}

        <ResponseModelLabel
          model={message.model}
          isStreaming={
            isThisMessageStreaming
          }
        />

        {message.status ===
        "interrupted" ? (
          <p className="mt-2 text-xs text-text-muted">
            Generation stopped. This response is
            incomplete.
          </p>
        ) : null}

        {message.status === "failed" &&
        message.error ? (
          <div
            role="alert"
            className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-danger-subtle px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
              <AlertIcon className="h-4 w-4 shrink-0 text-danger" />

              <span className="min-w-0">
                {message.error.message}
              </span>
            </span>

            {message.error.retryable ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {!isActive &&
        hasContent &&
        message.status !== "failed" ? (
          <div className="mt-2 -ml-1.5">
            <MessageActions
              content={message.content}
              feedback={message.feedback}
              disabled={
                isStreaming ||
                !isLastAssistant
              }
              onRegenerate={() =>
                onRegenerate(
                  message.id,
                )
              }
              onFeedback={(rating) =>
                onFeedback(
                  message.id,
                  rating,
                )
              }
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
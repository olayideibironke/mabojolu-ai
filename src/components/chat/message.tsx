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
  ChatSource,
  FeedbackRating,
} from "@/types/chat";

import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";

/**
 * One turn in the conversation.
 *
 * User text is rendered as plain text so user-provided content is never
 * interpreted as Markdown. Assistant responses use Mabojolu's safe Markdown
 * renderer.
 *
 * User image attachments are displayed directly above the accompanying prompt.
 * Verified public sources are displayed beneath assistant responses as secure
 * external links.
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

const REASONING_DOTS = [
  "0ms",
  "120ms",
  "240ms",
  "360ms",
  "480ms",
  "600ms",
] as const;

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

function ReasoningStatus() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Mabojolu is reasoning"
      className="flex min-h-6 items-center gap-1 text-[15px] leading-6 text-text-muted"
    >
      <span>
        Make I Reason
      </span>

      <span
        className="inline-flex items-end gap-[2px]"
        aria-hidden="true"
      >
        {REASONING_DOTS.map(
          (delay, index) => (
            <span
              key={delay}
              style={{
                animationDelay:
                  delay,
              }}
              className="inline-block h-[3px] w-[3px] animate-bounce rounded-full bg-current [animation-duration:900ms]"
            >
              <span className="sr-only">
                {index + 1}
              </span>
            </span>
          ),
        )}
      </span>
    </div>
  );
}

/**
 * Supporting public pages used by Mabojolu during live web research.
 */
function SourceList({
  sources,
}: {
  sources: ChatSource[];
}) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Sources"
      className="mt-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Sources
        </h3>

        <span className="rounded-full border border-border-subtle bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-text-muted">
          {sources.length}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map(
          (source, index) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open source ${index + 1}: ${source.title}`}
              className="group/source min-w-0 rounded-xl border border-border-subtle bg-surface-raised px-3 py-3 text-left transition hover:border-border-default hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-base text-[11px] font-semibold text-text-muted"
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-5 text-text-primary group-hover/source:underline">
                    {source.title}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {getSourceHostname(
                      source.url,
                    )}
                  </p>

                  {source.citedText ? (
                    <p className="mt-2 break-words text-xs leading-5 text-text-secondary">
                      {source.citedText}
                    </p>
                  ) : null}
                </div>

                <span
                  aria-hidden="true"
                  className="shrink-0 text-sm text-text-muted transition-transform group-hover/source:-translate-y-0.5 group-hover/source:translate-x-0.5"
                >
                  ↗
                </span>
              </div>
            </a>
          ),
        )}
      </div>
    </section>
  );
}

function getSourceHostname(
  url: string,
): string {
  try {
    return new URL(url).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return "Web source";
  }
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

  const sources =
    message.sources ?? [];

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

        {isThisMessageStreaming &&
        !hasContent ? (
          <ReasoningStatus />
        ) : null}

        {sources.length > 0 ? (
          <SourceList
            sources={sources}
          />
        ) : null}

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
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { IconButton } from "@/components/ui/button";
import {
  ArrowUpIcon,
  AttachmentIcon,
  StopIcon,
} from "@/components/ui/icons";
import { finePointerStore } from "@/lib/utilities/media-query";
import { MAX_MESSAGE_CHARS } from "@/lib/validation/chat";

interface ComposerProps {
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  focusKey?: string | number;
  disabled?: boolean;
  disabledReason?: string;
}

const MAX_HEIGHT_PX = 200;
const WARN_THRESHOLD = Math.floor(MAX_MESSAGE_CHARS * 0.9);

export function Composer({
  isStreaming,
  onSend,
  onStop,
  focusKey,
  disabled = false,
  disabledReason,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasFinePointer = useSyncExternalStore(
    finePointerStore.subscribe,
    finePointerStore.getSnapshot,
    finePointerStore.getServerSnapshot,
  );

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";

    const nextHeight = Math.min(
      textarea.scrollHeight,
      MAX_HEIGHT_PX,
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_HEIGHT_PX
        ? "auto"
        : "hidden";
  }, [draft]);

  useEffect(() => {
    if (hasFinePointer) {
      textareaRef.current?.focus();
    }
  }, [focusKey, hasFinePointer]);

  const trimmedDraft = draft.trim();
  const isOverLimit = draft.length > MAX_MESSAGE_CHARS;

  const canSend =
    trimmedDraft.length > 0 &&
    !isStreaming &&
    !isOverLimit &&
    !disabled;

  const submit = useCallback(() => {
    if (!canSend) {
      return;
    }

    onSend(trimmedDraft);
    setDraft("");
  }, [canSend, onSend, trimmedDraft]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.nativeEvent.isComposing
      ) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <div className="shrink-0 bg-gradient-to-t from-surface-base via-surface-base to-transparent px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
      <div className="mx-auto w-full max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-[26px] border border-border-default bg-surface-raised p-2 shadow-md transition-[border-color,box-shadow] focus-within:border-border-strong focus-within:shadow-lg"
        >
          <label className="sr-only" htmlFor="composer">
            Message Mabojolu
          </label>

          <textarea
            id="composer"
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={
              disabled
                ? (disabledReason ?? "")
                : "Message Mabojolu"
            }
            aria-describedby="composer-hint"
            aria-invalid={isOverLimit}
            style={{
              outline: "none",
              boxShadow: "none",
            }}
            className="max-h-[200px] min-h-12 w-full resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 text-text-primary placeholder:text-text-muted disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1">
              <IconButton
                label="Attach a file (not available yet)"
                disabled
                aria-describedby="attachment-note"
              >
                <AttachmentIcon />
              </IconButton>

              <span id="attachment-note" className="sr-only">
                File attachments are not available in this version of
                Mabojolu.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {draft.length > WARN_THRESHOLD ? (
                <span
                  className={`text-xs tabular-nums ${
                    isOverLimit
                      ? "text-danger"
                      : "text-text-muted"
                  }`}
                  aria-live="polite"
                >
                  {draft.length.toLocaleString()} /{" "}
                  {MAX_MESSAGE_CHARS.toLocaleString()}
                </span>
              ) : null}

              {isStreaming ? (
                <IconButton
                  variant="primary"
                  label="Stop generating"
                  onClick={onStop}
                  className="rounded-full"
                >
                  <StopIcon />
                </IconButton>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  title="Send message"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-inverse text-text-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-border-default disabled:text-text-muted disabled:opacity-100"
                >
                  <ArrowUpIcon />
                </button>
              )}
            </div>
          </div>
        </form>

        <p
          id="composer-hint"
          className="mt-2 text-center text-[11px] leading-4 text-text-muted"
        >
          {disabled
            ? (disabledReason ??
              "Messaging is unavailable right now.")
            : isOverLimit
              ? "That message is too long to send. Please shorten it."
              : "Mabojolu can make mistakes. Review important information. Press Enter to send, Shift plus Enter for a new line."}
        </p>
      </div>
    </div>
  );
}
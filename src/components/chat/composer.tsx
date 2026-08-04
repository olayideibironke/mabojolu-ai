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

/**
 * Message composer.
 *
 * Keyboard contract: Enter sends, Shift+Enter inserts a newline. The textarea
 * grows to a bounded maximum and then scrolls, so the composer never pushes the
 * transcript off screen on a small viewport.
 *
 * While streaming, the send control becomes a stop control rather than being
 * disabled: stopping is the action a user most needs at that moment.
 */

interface ComposerProps {
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  /** Focused when this changes, so switching chats lands the caret here. */
  focusKey?: string | number;
  /** Blocks input, for example when not signed in. */
  disabled?: boolean;
  /** Why input is blocked. Shown in place of the usual hint. */
  disabledReason?: string;
}

/** Matches the CSS max-height, so the JS and CSS caps cannot drift apart. */
const MAX_HEIGHT_PX = 200;

/** Warn as the limit approaches rather than only on rejection. */
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

  // Resize before paint so the height never visibly jumps as the user types.
  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }

    node.style.height = "auto";
    const next = Math.min(node.scrollHeight, MAX_HEIGHT_PX);
    node.style.height = `${next}px`;
    node.style.overflowY = node.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [draft]);

  // Focus on mount and when the conversation changes. Skipped on touch devices,
  // where focusing opens the on-screen keyboard and hides the content the user
  // was about to read.
  useEffect(() => {
    if (hasFinePointer) {
      textareaRef.current?.focus();
    }
  }, [focusKey, hasFinePointer]);

  const trimmed = draft.trim();
  const isOverLimit = draft.length > MAX_MESSAGE_CHARS;
  const canSend = trimmed.length > 0 && !isStreaming && !isOverLimit && !disabled;

  const submit = useCallback(() => {
    if (!canSend) {
      return;
    }

    onSend(trimmed);
    setDraft("");
  }, [canSend, onSend, trimmed]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // `isComposing` guards IME input: committing a candidate with Enter must
      // not send the message.
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
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
          className="rounded-[26px] border border-border-default bg-surface-raised p-2 shadow-md transition-colors focus-within:border-border-strong"
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
            placeholder={disabled ? (disabledReason ?? "") : "Message Mabojolu"}
            aria-describedby="composer-hint"
            aria-invalid={isOverLimit}
            className="max-h-[200px] min-h-12 w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-6 text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1">
              {/* Attachments are not implemented yet. Rather than shipping a
                  control that silently does nothing, it is disabled and says
                  so, which is honest about the current capability. */}
              <IconButton
                label="Attach a file (not available yet)"
                disabled
                aria-describedby="attachment-note"
              >
                <AttachmentIcon />
              </IconButton>
              <span id="attachment-note" className="sr-only">
                File attachments are not available in this version of Mabojolu.
              </span>
            </div>

            <div className="flex items-center gap-2">
              {draft.length > WARN_THRESHOLD ? (
                <span
                  className={`text-xs tabular-nums ${
                    isOverLimit ? "text-danger" : "text-text-muted"
                  }`}
                  // Announced politely so it does not interrupt typing.
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
            ? (disabledReason ?? "Messaging is unavailable right now.")
            : isOverLimit
              ? "That message is too long to send. Please shorten it."
              : "Mabojolu can make mistakes. Review important information. Press Enter to send, Shift plus Enter for a new line."}
        </p>
      </div>
    </div>
  );
}

"use client";

import type { ChatMessage } from "@/types/chat";

/**
 * Narrow right-side map for navigating a long conversation.
 *
 * Each marker represents one user or assistant turn. Selecting a marker asks
 * the chat shell to scroll the corresponding message into view.
 */

interface ConversationMapProps {
  messages: ChatMessage[];
  activeMessageId?: string | null;
  onJumpToMessage: (
    messageId: string,
  ) => void;
}

function messageDescription(
  message: ChatMessage,
  index: number,
): string {
  const speaker =
    message.role === "user"
      ? "Your message"
      : "Mabojolu response";

  const normalizedContent =
    message.content
      .replace(/\s+/g, " ")
      .trim();

  const preview =
    normalizedContent.length > 80
      ? `${normalizedContent.slice(0, 80)}…`
      : normalizedContent;

  return preview
    ? `${speaker} ${index + 1}: ${preview}`
    : `${speaker} ${index + 1}`;
}

export function ConversationMap({
  messages,
  activeMessageId,
  onJumpToMessage,
}: ConversationMapProps) {
  if (messages.length < 2) {
    return null;
  }

  return (
    <nav
      aria-label="Current conversation map"
      className="fixed right-3 top-1/2 z-30 hidden max-h-[62dvh] -translate-y-1/2 flex-col items-end rounded-2xl border border-transparent bg-surface-base/70 px-2 py-3 backdrop-blur-sm transition-[border-color,background-color,box-shadow] hover:border-border-subtle hover:bg-surface-raised/95 hover:shadow-sm 2xl:flex"
    >
      <div className="mabojolu-conversation-map flex max-h-[56dvh] w-9 flex-col items-end gap-1.5 overflow-y-auto overscroll-contain px-1 py-1">
        {messages.map(
          (message, index) => {
            const isActive =
              message.id ===
              activeMessageId;

            const isUser =
              message.role === "user";

            const label =
              messageDescription(
                message,
                index,
              );

            return (
              <button
                key={message.id}
                type="button"
                title={label}
                aria-label={label}
                aria-current={
                  isActive
                    ? "location"
                    : undefined
                }
                onClick={() =>
                  onJumpToMessage(
                    message.id,
                  )
                }
                className={`group flex h-2.5 w-full shrink-0 items-center justify-end rounded-full outline-none transition-transform hover:scale-x-110 focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${
                  isActive
                    ? "scale-x-110"
                    : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`block h-[2px] rounded-full transition-[width,background-color,opacity] ${
                    isUser
                      ? "w-5"
                      : "w-7"
                  } ${
                    isActive
                      ? "bg-text-primary opacity-100"
                      : "bg-text-muted opacity-45 group-hover:bg-text-secondary group-hover:opacity-90"
                  }`}
                />
              </button>
            );
          },
        )}
      </div>

      <span className="mt-2 max-w-20 text-right text-[9px] leading-3 text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
        Conversation
      </span>
    </nav>
  );
}
"use client";

import { useCallback, useMemo, useState } from "react";

import { SettingsDialog } from "@/components/layout/settings-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { Button, IconButton } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useChat } from "@/hooks/use-chat";
import { deriveTitle } from "@/lib/utilities/ids";
import type { ConversationSummary } from "@/types/chat";

import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { Message } from "./message";

/**
 * Application shell.
 *
 * Owns layout and the wiring between the sidebar, transcript, and composer.
 * Conversation logic lives in `useChat`, and this component stays a coordinator
 * so the pieces can be tested and changed independently.
 *
 * The single conversation held here is session-scoped. Persistent, multi-chat
 * history arrives with the database work; the sidebar already takes the summary
 * shape that will come from the server, so that change stays contained.
 */
export function ChatShell() {
  const {
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
  } = useChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  /** Bumped on each new chat, to move focus back to the composer. */
  const [conversationEpoch, setConversationEpoch] = useState(0);

  // Follows the streamed text so the transcript keeps up, without stealing
  // control from a user who has scrolled up to read.
  const streamedLength = messages.at(-1)?.content.length ?? 0;
  const { containerRef, handleScroll } = useAutoScroll<HTMLDivElement>(
    streamedLength,
    isStreaming,
  );

  /**
   * Sidebar entries for the active session.
   *
   * A conversation appears only once it has a user message, so the sidebar never
   * shows an empty placeholder chat.
   */
  const conversations = useMemo<ConversationSummary[]>(() => {
    const firstUserMessage = messages.find((message) => message.role === "user");

    if (!firstUserMessage) {
      return [];
    }

    return [
      {
        id: "current",
        title: deriveTitle(firstUserMessage.content),
        createdAt: firstUserMessage.createdAt,
        updatedAt: messages.at(-1)?.createdAt ?? firstUserMessage.createdAt,
        messageCount: messages.length,
      },
    ];
  }, [messages]);

  const startNewChat = useCallback(() => {
    reset();
    setIsSidebarOpen(false);
    setConversationEpoch((value) => value + 1);
  }, [reset]);

  const handleSend = useCallback(
    (content: string) => {
      send(content);
      // Close the drawer so a mobile user sees their message land.
      setIsSidebarOpen(false);
    },
    [send],
  );

  const lastAssistantId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return messages[index].id;
      }
    }
    return null;
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="h-dvh overflow-hidden bg-surface-base text-text-primary">
      {/* Lets a keyboard user reach the composer without tabbing the sidebar. */}
      <a
        href="#composer"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to message input
      </a>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={hasMessages ? "current" : null}
        onSelectConversation={() => setIsSidebarOpen(false)}
        onNewChat={startNewChat}
        onDeleteConversation={startNewChat}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsSidebarOpen(false);
        }}
      />

      <div className="flex h-dvh flex-col lg:pl-[284px]">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface-base/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton
              label="Open navigation"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden"
            >
              <MenuIcon />
            </IconButton>

            {/* A label, not a heading: the h1 belongs to the page content. */}
            <p className="truncate px-1 text-sm font-semibold">Mabojolu</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={startNewChat}
              className="hidden sm:inline-flex"
            >
              New chat
            </Button>

            {/* Authentication is not built yet, so this states its status
                instead of pretending to be a working sign-in button. */}
            <Button variant="primary" size="sm" disabled title="Accounts are not available yet">
              Sign in
            </Button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {!hasMessages ? (
              <EmptyState onSelect={handleSend} disabled={isStreaming} />
            ) : (
              <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                {/*
                 * `feed` with `aria-busy` tells a screen reader this region
                 * updates over time and when it is settling, which is more
                 * usable than a live region announcing every token.
                 */}
                <div
                  role="feed"
                  aria-busy={isStreaming}
                  aria-label="Conversation"
                  className="space-y-7"
                >
                  {messages.map((message) => (
                    <Message
                      key={message.id}
                      message={message}
                      isLastAssistant={message.id === lastAssistantId}
                      isStreaming={isStreaming}
                      onRetry={retry}
                      onRegenerate={regenerate}
                      onEdit={editUserMessage}
                      onFeedback={setFeedback}
                    />
                  ))}
                </div>

                {/* Progress before any text arrives, so a slow first token does
                    not look like a hang. */}
                {isStreaming && messages.at(-1)?.content.length === 0 ? (
                  <p className="mt-6 flex items-center gap-2 pl-12 text-sm text-text-muted">
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
                    </span>
                    <span>{statusLabel ?? "Working"}</span>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <Composer
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={stop}
            focusKey={conversationEpoch}
          />
        </main>
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

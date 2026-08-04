"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SettingsDialog } from "@/components/layout/settings-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { Button, IconButton } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useChat } from "@/hooks/use-chat";
import { useConversations } from "@/hooks/use-conversations";

import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { Message } from "./message";

/**
 * Application shell.
 *
 * Coordinates the sidebar, transcript, and composer. Conversation logic lives in
 * `useChat`, history in `useConversations`, so this component stays a coordinator
 * and each piece can be changed independently.
 *
 * Refresh restoration works by keeping the active conversation id in the URL
 * (`?c=<id>`). That makes the current chat linkable and survivable across a
 * reload, which `sessionStorage` would not give.
 */

interface ChatShellProps {
  /** Whether a session exists. Drives sign-in versus sign-out affordances. */
  isSignedIn: boolean;
  userEmail?: string;
  isAdmin?: boolean;
  /** Shown so it is clear where conversations are stored. */
  persistenceKind: "local" | "supabase";
}

export function ChatShell({
  isSignedIn,
  userEmail,
  isAdmin = false,
  persistenceKind,
}: ChatShellProps) {
  const history = useConversations(isSignedIn);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [conversationEpoch, setConversationEpoch] = useState(0);

  /** Reload the sidebar once a reply settles, so titles and ordering are current. */
  const refreshHistory = history.refresh;

  const chat = useChat({
    onConversationChanged: useCallback(
      (conversationId: string) => {
        setActiveConversationId(conversationId);

        // Reflect the conversation in the URL so a refresh restores it. `replace`
        // rather than `push`, so the back button does not walk through every
        // message.
        const url = new URL(window.location.href);
        url.searchParams.set("c", conversationId);
        window.history.replaceState(null, "", url);

        void refreshHistory();
      },
      [refreshHistory],
    ),
  });

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
    loadMessages,
  } = chat;

  // Follows the streamed text without stealing control from a user who scrolled up.
  const streamedLength = messages.at(-1)?.content.length ?? 0;
  const { containerRef, handleScroll } = useAutoScroll<HTMLDivElement>(
    streamedLength,
    isStreaming,
  );

  /**
   * Restore the conversation named in the URL on first load.
   *
   * Runs once, guarded by a ref: re-running would discard whatever the user has
   * since typed or sent.
   */
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || !isSignedIn) {
      return;
    }
    restoredRef.current = true;

    const requested = new URL(window.location.href).searchParams.get("c");
    if (!requested) {
      return;
    }

    void (async () => {
      const restored = await history.loadConversation(requested);

      if (restored) {
        loadMessages(restored, requested);
        setActiveConversationId(requested);
      } else {
        // The id is stale or not ours. Clear it rather than leaving a URL that
        // silently does nothing.
        const url = new URL(window.location.href);
        url.searchParams.delete("c");
        window.history.replaceState(null, "", url);
      }
    })();
  }, [history, isSignedIn, loadMessages]);

  // Refresh the sidebar when a generation finishes, so message counts and
  // ordering settle without the user acting.
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      void refreshHistory();
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, refreshHistory]);

  const startNewChat = useCallback(() => {
    reset();
    setActiveConversationId(null);
    setIsSidebarOpen(false);
    setConversationEpoch((value) => value + 1);

    const url = new URL(window.location.href);
    url.searchParams.delete("c");
    window.history.replaceState(null, "", url);
  }, [reset]);

  const selectConversation = useCallback(
    async (conversationId: string) => {
      setIsSidebarOpen(false);

      if (conversationId === activeConversationId) {
        return;
      }

      const loaded = await history.loadConversation(conversationId);

      if (!loaded) {
        return;
      }

      loadMessages(loaded, conversationId);
      setActiveConversationId(conversationId);
      setConversationEpoch((value) => value + 1);

      const url = new URL(window.location.href);
      url.searchParams.set("c", conversationId);
      window.history.replaceState(null, "", url);
    },
    [activeConversationId, history, loadMessages],
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const removed = await history.remove(conversationId);

      // Only clear the transcript if the conversation on screen is the one that
      // was deleted.
      if (removed && conversationId === activeConversationId) {
        startNewChat();
      }
    },
    [activeConversationId, history, startNewChat],
  );

  const handleSend = useCallback(
    (content: string) => {
      send(content);
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
      <a
        href="#composer"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to message input
      </a>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={history.conversations}
        activeConversationId={activeConversationId}
        search={history.search}
        onSearchChange={history.setSearch}
        isSearching={history.isSearching}
        isLoading={history.isLoading}
        error={history.error}
        isSignedIn={isSignedIn}
        onSelectConversation={selectConversation}
        onNewChat={startNewChat}
        onDeleteConversation={deleteConversation}
        onRenameConversation={history.rename}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setIsSidebarOpen(false);
        }}
        isAdmin={isAdmin}
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

            {isSignedIn ? (
              <span className="hidden max-w-[16ch] truncate text-xs text-text-muted sm:inline">
                {userEmail}
              </span>
            ) : (
              /* A real link, not a button: it navigates, so it must be
                 middle-clickable and open in a new tab like any other link. */
              <a
                href="/sign-in"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl bg-surface-inverse px-3 text-xs font-medium text-text-inverse transition-opacity hover:opacity-90"
              >
                Sign in
              </a>
            )}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {!hasMessages ? (
              <EmptyState
                onSelect={handleSend}
                disabled={isStreaming || !isSignedIn}
                isSignedIn={isSignedIn}
              />
            ) : (
              <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                {/*
                 * `feed` with `aria-busy` tells a screen reader this region updates
                 * over time and when it is settling, which is more usable than a
                 * live region announcing every token.
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

                {/* Progress before any text arrives, so a slow first token does not
                    look like a hang. */}
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
            disabled={!isSignedIn}
            disabledReason="Sign in to start a conversation."
          />
        </main>
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isSignedIn={isSignedIn}
        userEmail={userEmail}
        persistenceKind={persistenceKind}
      />
    </div>
  );
}

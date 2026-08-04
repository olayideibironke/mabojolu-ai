"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  SettingsDialog,
  type MabojoluModelId,
} from "@/components/layout/settings-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Button,
  IconButton,
} from "@/components/ui/button";
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
 * Coordinates the sidebar, transcript, composer, model preference, and
 * settings dialog.
 *
 * Conversation logic lives in useChat and history logic lives in
 * useConversations.
 *
 * The selected local model is stored in the browser so Fast or Quality remains
 * selected after a refresh.
 */

interface ChatShellProps {
  /** Whether a session exists. */
  isSignedIn: boolean;

  userEmail?: string;
  isAdmin?: boolean;

  /** Indicates where conversation records are currently stored. */
  persistenceKind: "local" | "supabase";
}

const MODEL_STORAGE_KEY =
  "mabojolu-selected-model";

const MODEL_CHANGE_EVENT =
  "mabojolu-model-preference-change";

const DEFAULT_MODEL_ID: MabojoluModelId =
  "mabojolu-local";

/**
 * Provides a fallback when browser storage is restricted or unavailable.
 */
let inMemoryModelPreference: MabojoluModelId =
  DEFAULT_MODEL_ID;

function isMabojoluModelId(
  value: string | null,
): value is MabojoluModelId {
  return (
    value === "mabojolu-fast" ||
    value === "mabojolu-local"
  );
}

/**
 * Client snapshot for React's external-store integration.
 */
function getModelPreferenceSnapshot(): MabojoluModelId {
  try {
    const storedValue =
      window.localStorage.getItem(
        MODEL_STORAGE_KEY,
      );

    if (isMabojoluModelId(storedValue)) {
      inMemoryModelPreference =
        storedValue;

      return storedValue;
    }
  } catch {
    /*
     * Browser storage may be unavailable in restricted privacy environments.
     * The in-memory preference still works for the current session.
     */
  }

  return inMemoryModelPreference;
}

/**
 * Server snapshot must remain stable so server HTML and the first client render
 * match during hydration.
 */
function getServerModelPreferenceSnapshot(): MabojoluModelId {
  return DEFAULT_MODEL_ID;
}

/**
 * Subscribe to preference changes from this tab and other browser tabs.
 */
function subscribeToModelPreference(
  callback: () => void,
): () => void {
  const handleStorage = (
    event: StorageEvent,
  ) => {
    if (
      event.key === MODEL_STORAGE_KEY ||
      event.key === null
    ) {
      callback();
    }
  };

  window.addEventListener(
    "storage",
    handleStorage,
  );

  window.addEventListener(
    MODEL_CHANGE_EVENT,
    callback,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorage,
    );

    window.removeEventListener(
      MODEL_CHANGE_EVENT,
      callback,
    );
  };
}

function saveModelPreference(
  modelId: MabojoluModelId,
): void {
  inMemoryModelPreference = modelId;

  try {
    window.localStorage.setItem(
      MODEL_STORAGE_KEY,
      modelId,
    );
  } catch {
    /*
     * The current browser session can still use the in-memory preference.
     */
  }

  window.dispatchEvent(
    new Event(MODEL_CHANGE_EVENT),
  );
}

function modelLabel(
  modelId: MabojoluModelId,
): string {
  return modelId === "mabojolu-fast"
    ? "Fast"
    : "Quality";
}

export function ChatShell({
  isSignedIn,
  userEmail,
  isAdmin = false,
  persistenceKind,
}: ChatShellProps) {
  const history =
    useConversations(isSignedIn);

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(null);

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(false);

  const [
    isSettingsOpen,
    setIsSettingsOpen,
  ] = useState(false);

  const [
    conversationEpoch,
    setConversationEpoch,
  ] = useState(0);

  const selectedModelId =
    useSyncExternalStore(
      subscribeToModelPreference,
      getModelPreferenceSnapshot,
      getServerModelPreferenceSnapshot,
    );

  const changeModel = useCallback(
    (modelId: MabojoluModelId) => {
      saveModelPreference(modelId);
    },
    [],
  );

  /** Reload the sidebar after conversation changes. */
  const refreshHistory = history.refresh;

  const handleConversationChanged =
    useCallback(
      (conversationId: string) => {
        setActiveConversationId(
          conversationId,
        );

        const url = new URL(
          window.location.href,
        );

        url.searchParams.set(
          "c",
          conversationId,
        );

        window.history.replaceState(
          null,
          "",
          url,
        );

        void refreshHistory();
      },
      [refreshHistory],
    );

  const chat = useChat({
    modelId: selectedModelId,
    onConversationChanged:
      handleConversationChanged,
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

  const streamedLength =
    messages.at(-1)?.content.length ?? 0;

  const {
    containerRef,
    handleScroll,
  } = useAutoScroll<HTMLDivElement>(
    streamedLength,
    isStreaming,
  );

  /**
   * Restore the conversation identified in the URL.
   */
  const restoredRef = useRef(false);

  useEffect(() => {
    if (
      restoredRef.current ||
      !isSignedIn
    ) {
      return;
    }

    restoredRef.current = true;

    const requested = new URL(
      window.location.href,
    ).searchParams.get("c");

    if (!requested) {
      return;
    }

    void (async () => {
      const restored =
        await history.loadConversation(
          requested,
        );

      if (restored) {
        loadMessages(
          restored,
          requested,
        );

        setActiveConversationId(
          requested,
        );

        return;
      }

      const url = new URL(
        window.location.href,
      );

      url.searchParams.delete("c");

      window.history.replaceState(
        null,
        "",
        url,
      );
    })();
  }, [
    history,
    isSignedIn,
    loadMessages,
  ]);

  /**
   * Refresh the sidebar when a generation finishes.
   */
  const wasStreamingRef =
    useRef(false);

  useEffect(() => {
    if (
      wasStreamingRef.current &&
      !isStreaming
    ) {
      void refreshHistory();
    }

    wasStreamingRef.current =
      isStreaming;
  }, [
    isStreaming,
    refreshHistory,
  ]);

  const startNewChat =
    useCallback(() => {
      reset();

      setActiveConversationId(null);
      setIsSidebarOpen(false);

      setConversationEpoch(
        (value) => value + 1,
      );

      const url = new URL(
        window.location.href,
      );

      url.searchParams.delete("c");

      window.history.replaceState(
        null,
        "",
        url,
      );
    }, [reset]);

  const selectConversation =
    useCallback(
      async (
        conversationId: string,
      ) => {
        setIsSidebarOpen(false);

        if (
          conversationId ===
          activeConversationId
        ) {
          return;
        }

        const loaded =
          await history.loadConversation(
            conversationId,
          );

        if (!loaded) {
          return;
        }

        loadMessages(
          loaded,
          conversationId,
        );

        setActiveConversationId(
          conversationId,
        );

        setConversationEpoch(
          (value) => value + 1,
        );

        const url = new URL(
          window.location.href,
        );

        url.searchParams.set(
          "c",
          conversationId,
        );

        window.history.replaceState(
          null,
          "",
          url,
        );
      },
      [
        activeConversationId,
        history,
        loadMessages,
      ],
    );

  const deleteConversation =
    useCallback(
      async (
        conversationId: string,
      ) => {
        const removed =
          await history.remove(
            conversationId,
          );

        if (
          removed &&
          conversationId ===
            activeConversationId
        ) {
          startNewChat();
        }
      },
      [
        activeConversationId,
        history,
        startNewChat,
      ],
    );

  const handleSend = useCallback(
    (content: string) => {
      send(content);
      setIsSidebarOpen(false);
    },
    [send],
  );

  const lastAssistantId =
    useMemo(() => {
      for (
        let index =
          messages.length - 1;
        index >= 0;
        index -= 1
      ) {
        if (
          messages[index].role ===
          "assistant"
        ) {
          return messages[index].id;
        }
      }

      return null;
    }, [messages]);

  const hasMessages =
    messages.length > 0;

  const activeModelLabel =
    modelLabel(selectedModelId);

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
        onClose={() =>
          setIsSidebarOpen(false)
        }
        conversations={
          history.conversations
        }
        activeConversationId={
          activeConversationId
        }
        search={history.search}
        onSearchChange={
          history.setSearch
        }
        isSearching={
          history.isSearching
        }
        isLoading={history.isLoading}
        error={history.error}
        isSignedIn={isSignedIn}
        onSelectConversation={
          selectConversation
        }
        onNewChat={startNewChat}
        onDeleteConversation={
          deleteConversation
        }
        onRenameConversation={
          history.rename
        }
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
              onClick={() =>
                setIsSidebarOpen(true)
              }
              className="lg:hidden"
            >
              <MenuIcon />
            </IconButton>

            <p className="truncate px-1 text-sm font-semibold">
              Mabojolu
            </p>

            <button
              type="button"
              onClick={() =>
                setIsSettingsOpen(true)
              }
              aria-label={`Current response mode: ${activeModelLabel}. Open settings to change it.`}
              title="Change response mode"
              className="inline-flex h-7 items-center rounded-full border border-border-subtle bg-surface-raised px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {activeModelLabel}
            </button>
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
              <Link
                href="/sign-in"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-xl bg-surface-inverse px-3 text-xs font-medium text-text-inverse transition-opacity hover:opacity-90"
              >
                Sign in
              </Link>
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
                disabled={
                  isStreaming ||
                  !isSignedIn
                }
                isSignedIn={isSignedIn}
              />
            ) : (
              <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <div
                  role="feed"
                  aria-busy={
                    isStreaming
                  }
                  aria-label="Conversation"
                  className="space-y-7"
                >
                  {messages.map(
                    (message) => (
                      <Message
                        key={message.id}
                        message={message}
                        isLastAssistant={
                          message.id ===
                          lastAssistantId
                        }
                        isStreaming={
                          isStreaming
                        }
                        onRetry={retry}
                        onRegenerate={
                          regenerate
                        }
                        onEdit={
                          editUserMessage
                        }
                        onFeedback={
                          setFeedback
                        }
                      />
                    ),
                  )}
                </div>

                {isStreaming &&
                messages.at(-1)
                  ?.content.length ===
                  0 ? (
                  <p className="mt-6 flex items-center gap-2 pl-12 text-sm text-text-muted">
                    <span
                      className="flex gap-1"
                      aria-hidden="true"
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted [animation-delay:300ms]" />
                    </span>

                    <span>
                      {statusLabel ??
                        "Working"}
                    </span>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <Composer
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={stop}
            focusKey={
              conversationEpoch
            }
            disabled={!isSignedIn}
            disabledReason="Sign in to start a conversation."
          />
        </main>
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() =>
          setIsSettingsOpen(false)
        }
        isSignedIn={isSignedIn}
        userEmail={userEmail}
        persistenceKind={
          persistenceKind
        }
        selectedModelId={
          selectedModelId
        }
        onModelChange={
          changeModel
        }
      />
    </div>
  );
}
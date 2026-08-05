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
import { IconButton } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { useChat } from "@/hooks/use-chat";
import { useConversations } from "@/hooks/use-conversations";
import type { ChatImageAttachment } from "@/types/chat";

import { Composer } from "./composer";
import { ConversationMap } from "./conversation-map";
import { EmptyState } from "./empty-state";
import { Message } from "./message";

interface ChatShellProps {
  isSignedIn: boolean;
  isGuest?: boolean;
  userEmail?: string;
  isAdmin?: boolean;
  persistenceKind: "local" | "supabase";
}

const MODEL_STORAGE_KEY =
  "mabojolu-selected-model";

const MODEL_CHANGE_EVENT =
  "mabojolu-model-preference-change";

const DEFAULT_MODEL_ID: MabojoluModelId =
  "mabojolu-local";

let inMemoryModelPreference: MabojoluModelId =
  DEFAULT_MODEL_ID;

function isMabojoluModelId(
  value: string | null,
): value is MabojoluModelId {
  return (
    value === "mabojolu-fast" ||
    value === "mabojolu-regular" ||
    value === "mabojolu-local"
  );
}

function getModelPreferenceSnapshot(): MabojoluModelId {
  try {
    const storedValue =
      window.localStorage.getItem(
        MODEL_STORAGE_KEY,
      );

    if (
      isMabojoluModelId(
        storedValue,
      )
    ) {
      inMemoryModelPreference =
        storedValue;

      return storedValue;
    }
  } catch {
    /*
     * The in-memory preference remains available when browser storage is
     * restricted.
     */
  }

  return inMemoryModelPreference;
}

function getServerModelPreferenceSnapshot(): MabojoluModelId {
  return DEFAULT_MODEL_ID;
}

function subscribeToModelPreference(
  callback: () => void,
): () => void {
  const handleStorage = (
    event: StorageEvent,
  ) => {
    if (
      event.key ===
        MODEL_STORAGE_KEY ||
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
  inMemoryModelPreference =
    modelId;

  try {
    window.localStorage.setItem(
      MODEL_STORAGE_KEY,
      modelId,
    );
  } catch {
    /*
     * The selected mode still works for the current browser session.
     */
  }

  window.dispatchEvent(
    new Event(
      MODEL_CHANGE_EVENT,
    ),
  );
}

export function ChatShell({
  isSignedIn,
  isGuest = false,
  userEmail,
  isAdmin = false,
  persistenceKind,
}: ChatShellProps) {
  const history =
    useConversations(
      isSignedIn,
    );

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<
    string | null
  >(null);

  const [
    activeMessageId,
    setActiveMessageId,
  ] = useState<
    string | null
  >(null);

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

  const changeModel =
    useCallback(
      (
        modelId: MabojoluModelId,
      ) => {
        saveModelPreference(
          modelId,
        );
      },
      [],
    );

  const refreshHistory =
    history.refresh;

  const handleConversationChanged =
    useCallback(
      (
        conversationId: string,
      ) => {
        setActiveConversationId(
          conversationId,
        );

        const url =
          new URL(
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

  const chat =
    useChat({
      modelId:
        selectedModelId,

      onConversationChanged:
        handleConversationChanged,
    });

  const {
    messages,
    isStreaming,
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
    messages.at(-1)
      ?.content.length ?? 0;

  const {
    containerRef,
    handleScroll,
  } =
    useAutoScroll<HTMLDivElement>(
      streamedLength,
      isStreaming,
    );

  useEffect(() => {
    const root =
      containerRef.current;

    if (
      !root ||
      messages.length === 0
    ) {
      return;
    }

    const messageNodes =
      Array.from(
        root.querySelectorAll<HTMLElement>(
          "[data-message-id]",
        ),
      );

    if (
      messageNodes.length ===
      0
    ) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (
          entries,
        ) => {
          const visibleEntries =
            entries
              .filter(
                (
                  entry,
                ) =>
                  entry.isIntersecting,
              )
              .sort(
                (
                  first,
                  second,
                ) => {
                  if (
                    second.intersectionRatio !==
                    first.intersectionRatio
                  ) {
                    return (
                      second.intersectionRatio -
                      first.intersectionRatio
                    );
                  }

                  return (
                    Math.abs(
                      first
                        .boundingClientRect
                        .top,
                    ) -
                    Math.abs(
                      second
                        .boundingClientRect
                        .top,
                    )
                  );
                },
              );

          const mostVisible =
            visibleEntries[0];

          if (!mostVisible) {
            return;
          }

          const messageId = (
            mostVisible.target as HTMLElement
          ).dataset.messageId;

          if (!messageId) {
            return;
          }

          setActiveMessageId(
            (
              current,
            ) =>
              current ===
              messageId
                ? current
                : messageId,
          );
        },
        {
          root,

          rootMargin:
            "-12% 0px -45% 0px",

          threshold: [
            0.05,
            0.25,
            0.5,
            0.75,
          ],
        },
      );

    messageNodes.forEach(
      (
        node,
      ) => {
        observer.observe(
          node,
        );
      },
    );

    return () => {
      observer.disconnect();
    };
  }, [
    containerRef,
    messages,
  ]);

  const restoredRef =
    useRef(false);

  useEffect(() => {
    if (
      restoredRef.current ||
      !isSignedIn
    ) {
      return;
    }

    restoredRef.current =
      true;

    const requested =
      new URL(
        window.location.href,
      ).searchParams.get(
        "c",
      );

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

      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.delete(
        "c",
      );

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

      setActiveConversationId(
        null,
      );

      setActiveMessageId(
        null,
      );

      setIsSidebarOpen(
        false,
      );

      setConversationEpoch(
        (
          value,
        ) =>
          value + 1,
      );

      const url =
        new URL(
          window.location.href,
        );

      url.searchParams.delete(
        "c",
      );

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
        setIsSidebarOpen(
          false,
        );

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

        setActiveMessageId(
          null,
        );

        setConversationEpoch(
          (
            value,
          ) =>
            value + 1,
        );

        const url =
          new URL(
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

  const handleSend =
    useCallback(
      (
        content: string,
        attachments:
          ChatImageAttachment[] =
            [],
      ) => {
        send(
          content,
          attachments,
        );

        setIsSidebarOpen(
          false,
        );
      },
      [send],
    );

  const jumpToMessage =
    useCallback(
      (
        messageId: string,
      ) => {
        const target =
          document.getElementById(
            `message-${messageId}`,
          );

        if (!target) {
          return;
        }

        setActiveMessageId(
          messageId,
        );

        target.scrollIntoView({
          behavior:
            "smooth",

          block:
            "center",

          inline:
            "nearest",
        });
      },
      [],
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
          messages[index]
            .role ===
          "assistant"
        ) {
          return messages[
            index
          ].id;
        }
      }

      return null;
    }, [messages]);

  const hasMessages =
    messages.length > 0;

  const hasPermanentAccount =
    isSignedIn &&
    !isGuest;

  return (
    <div className="h-dvh overflow-hidden bg-surface-base text-text-primary">
      <a
        href="#composer"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to message input
      </a>

      <Sidebar
        isOpen={
          isSidebarOpen
        }
        onClose={() =>
          setIsSidebarOpen(
            false,
          )
        }
        conversations={
          history.conversations
        }
        activeConversationId={
          activeConversationId
        }
        search={
          history.search
        }
        onSearchChange={
          history.setSearch
        }
        isSearching={
          history.isSearching
        }
        isLoading={
          history.isLoading
        }
        error={
          history.error
        }
        isSignedIn={
          isSignedIn
        }
        isGuest={
          isGuest
        }
        onSelectConversation={
          selectConversation
        }
        onNewChat={
          startNewChat
        }
        onDeleteConversation={
          deleteConversation
        }
        onRenameConversation={
          history.rename
        }
        onOpenSettings={() => {
          setIsSettingsOpen(
            true,
          );

          setIsSidebarOpen(
            false,
          );
        }}
        isAdmin={
          isAdmin
        }
      />

      <div className="flex h-dvh flex-col lg:pl-[284px]">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface-base/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <IconButton
              label="Open navigation"
              onClick={() =>
                setIsSidebarOpen(
                  true,
                )
              }
              className="lg:hidden"
            >
              <MenuIcon />
            </IconButton>

            <p className="truncate px-1 text-sm font-semibold">
              Mabojolu
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasPermanentAccount ? (
              <span className="hidden max-w-[20ch] truncate text-xs text-text-muted sm:inline">
                {userEmail}
              </span>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
                >
                  Log in
                </Link>

                <Link
                  href="/sign-in?mode=sign-up"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-raised"
                >
                  Sign up for free
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div
            ref={
              containerRef
            }
            onScroll={
              handleScroll
            }
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {!hasMessages ? (
              <EmptyState
                onSelect={
                  handleSend
                }
                disabled={
                  isStreaming ||
                  !isSignedIn
                }
                isSignedIn={
                  isSignedIn
                }
              />
            ) : (
              <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
                <div
                  role="feed"
                  aria-busy={
                    isStreaming
                  }
                  aria-label="Conversation"
                  className="mx-auto max-w-[1040px] space-y-7"
                >
                  {messages.map(
                    (
                      message,
                    ) => (
                      <div
                        key={
                          message.id
                        }
                        id={`message-${message.id}`}
                        data-message-id={
                          message.id
                        }
                        className="scroll-mt-24"
                      >
                        <Message
                          message={
                            message
                          }
                          isLastAssistant={
                            message.id ===
                            lastAssistantId
                          }
                          isStreaming={
                            isStreaming
                          }
                          onRetry={
                            retry
                          }
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
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          <Composer
            isStreaming={
              isStreaming
            }
            onSend={
              handleSend
            }
            onStop={
              stop
            }
            focusKey={
              conversationEpoch
            }
            disabled={
              !isSignedIn
            }
            disabledReason="Preparing Mabojolu..."
            selectedModelId={
              selectedModelId
            }
            onModelChange={
              changeModel
            }
          />
        </main>
      </div>

      <ConversationMap
        messages={
          messages
        }
        activeMessageId={
          activeMessageId
        }
        onJumpToMessage={
          jumpToMessage
        }
      />

      <SettingsDialog
        isOpen={
          isSettingsOpen
        }
        onClose={() =>
          setIsSettingsOpen(
            false,
          )
        }
        isSignedIn={
          hasPermanentAccount
        }
        userEmail={
          userEmail
        }
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
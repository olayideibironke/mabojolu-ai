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

import { BrandLockup } from "@/components/ui/brand-mark";
import {
  Button,
  IconButton,
} from "@/components/ui/button";
import {
  CalendarIcon,
  ChevronDownIcon,
  CloseIcon,
  EditIcon,
  FolderIcon,
  LibraryIcon,
  NewChatIcon,
  PinIcon,
  PluginIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { desktopLayoutStore } from "@/lib/utilities/media-query";
import { MAX_TITLE_CHARS } from "@/lib/validation/chat";
import type { ConversationSummary } from "@/types/chat";

interface SidebarProps {
  isOpen: boolean;
  isCollapsed?: boolean;
  onClose: () => void;
  onCollapse?: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;
  isSignedIn: boolean;
  isGuest?: boolean;
  isAdmin: boolean;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (
    id: string,
    title: string,
  ) => Promise<boolean>;
  onOpenSettings: () => void;
  onPrepareHandover?: () => void;
}

const PINNED_STORAGE_KEY =
  "mabojolu-pinned-conversations";

const PROJECT_STORAGE_KEY =
  "mabojolu-project-conversations";

function readStoredIds(
  key:
    string,
):
  string[] {
  try {
    const parsed =
      JSON.parse(
        window.localStorage
          .getItem(
            key,
          ) ??
          "[]",
      );

    return Array.isArray(
      parsed,
    )
      ? parsed.filter(
          (
            value,
          ): value is string =>
            typeof value ===
            "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeStoredIds(
  key:
    string,

  ids:
    readonly string[],
): void {
  try {
    window.localStorage
      .setItem(
        key,
        JSON.stringify(
          ids,
        ),
      );
  } catch {
    /*
     * Navigation preferences remain usable in memory when browser storage is
     * unavailable.
     */
  }
}

export function Sidebar({
  isOpen,
  isCollapsed = false,
  onClose,
  onCollapse,
  conversations,
  activeConversationId,
  search,
  onSearchChange,
  isSearching,
  isLoading,
  error,
  isSignedIn,
  isGuest = false,
  isAdmin,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onPrepareHandover,
}: SidebarProps) {
  const [
    requestedDeleteId,
    setRequestedDeleteId,
  ] = useState<string | null>(null);

  const [
    renamingId,
    setRenamingId,
  ] = useState<string | null>(null);

  const [
    renameDraft,
    setRenameDraft,
  ] = useState("");

  const [
    pinnedIds,
    setPinnedIds,
  ] = useState<string[]>([]);

  const [
    projectIds,
    setProjectIds,
  ] = useState<string[]>([]);

  const [
    showAllChats,
    setShowAllChats,
  ] = useState(false);

  const closeButtonRef =
    useRef<HTMLButtonElement>(null);

  const renameInputRef =
    useRef<HTMLInputElement>(null);

  const isDesktopLayout =
    useSyncExternalStore(
      desktopLayoutStore.subscribe,
      desktopLayoutStore.getSnapshot,
      desktopLayoutStore.getServerSnapshot,
    );

  const isOffCanvas =
    (
      !isOpen &&
      !isDesktopLayout
    ) ||
    (
      isCollapsed &&
      isDesktopLayout
    );

  const hasPermanentAccount =
    isSignedIn &&
    !isGuest;

  useEffect(() => {
    setPinnedIds(
      readStoredIds(
        PINNED_STORAGE_KEY,
      ),
    );

    setProjectIds(
      readStoredIds(
        PROJECT_STORAGE_KEY,
      ),
    );
  }, []);

  useEffect(() => {
    const validIds =
      new Set(
        conversations.map(
          (conversation) =>
            conversation.id,
        ),
      );

    setPinnedIds(
      (
        current,
      ) => {
        const next =
          current.filter(
            (id) =>
              validIds.has(
                id,
              ),
          );

        if (
          next.length !==
            current.length
        ) {
          writeStoredIds(
            PINNED_STORAGE_KEY,
            next,
          );
        }

        return next;
      },
    );

    setProjectIds(
      (
        current,
      ) => {
        const next =
          current.filter(
            (id) =>
              validIds.has(
                id,
              ),
          );

        if (
          next.length !==
            current.length
        ) {
          writeStoredIds(
            PROJECT_STORAGE_KEY,
            next,
          );
        }

        return next;
      },
    );
  }, [
    conversations,
  ]);

  const pendingDeleteId =
    requestedDeleteId &&
    conversations.some(
      (conversation) =>
        conversation.id ===
        requestedDeleteId,
    )
      ? requestedDeleteId
      : null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
          "Escape"
      ) {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [
    isOpen,
    onClose,
  ]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current
        ?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current
        ?.focus();

      renameInputRef.current
        ?.select();
    }
  }, [renamingId]);

  const beginRename =
    useCallback(
      (
        conversation:
          ConversationSummary,
      ) => {
        setRenamingId(
          conversation.id,
        );

        setRenameDraft(
          conversation.title,
        );
      },
      [],
    );

  const cancelRename =
    useCallback(() => {
      setRenamingId(
        null,
      );

      setRenameDraft(
        "",
      );
    }, []);

  const commitRename =
    useCallback(
      async () => {
        if (!renamingId) {
          return;
        }

        const trimmed =
          renameDraft.trim();

        const original =
          conversations.find(
            (
              conversation,
            ) =>
              conversation.id ===
              renamingId,
          );

        if (
          trimmed.length ===
            0 ||
          trimmed ===
            original?.title
        ) {
          cancelRename();
          return;
        }

        await onRenameConversation(
          renamingId,
          trimmed,
        );

        cancelRename();
      },
      [
        cancelRename,
        conversations,
        onRenameConversation,
        renameDraft,
        renamingId,
      ],
    );

  const toggleStoredId =
    useCallback(
      (
        id:
          string,

        kind:
          "pinned" |
          "project",
      ) => {
        const setter =
          kind ===
            "pinned"
            ? setPinnedIds
            : setProjectIds;

        const storageKey =
          kind ===
            "pinned"
            ? PINNED_STORAGE_KEY
            : PROJECT_STORAGE_KEY;

        setter(
          (
            current,
          ) => {
            const next =
              current.includes(
                id,
              )
                ? current.filter(
                    (
                      value,
                    ) =>
                      value !==
                      id,
                  )
                : [
                    ...current,
                    id,
                  ];

            writeStoredIds(
              storageKey,
              next,
            );

            return next;
          },
        );
      },
      [],
    );

  const pinned =
    useMemo(
      () =>
        pinnedIds
          .map(
            (id) =>
              conversations.find(
                (
                  conversation,
                ) =>
                  conversation.id ===
                  id,
              ),
          )
          .filter(
            (
              value,
            ): value is ConversationSummary =>
              Boolean(
                value,
              ),
          ),
      [
        conversations,
        pinnedIds,
      ],
    );

  const projects =
    useMemo(
      () =>
        projectIds
          .map(
            (id) =>
              conversations.find(
                (
                  conversation,
                ) =>
                  conversation.id ===
                  id,
              ),
          )
          .filter(
            (
              value,
            ): value is ConversationSummary =>
              Boolean(
                value,
              ),
          ),
      [
        conversations,
        projectIds,
      ],
    );

  const visibleChats =
    showAllChats
      ? conversations
      : conversations.slice(
          0,
          8,
        );

  const navigationItemClass =
    "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary";

  function conversationButton(
    conversation:
      ConversationSummary,

    options?: {
      compact?: boolean;
    },
  ) {
    const isActive =
      conversation.id ===
      activeConversationId;

    if (
      pendingDeleteId ===
      conversation.id
    ) {
      return (
        <div className="rounded-xl border border-border-default bg-surface-raised p-2.5">
          <p className="text-xs leading-5 text-text-primary">
            Delete this chat? This cannot be undone.
          </p>

          <div className="mt-2 flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setRequestedDeleteId(
                  null,
                )
              }
            >
              Cancel
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                onDeleteConversation(
                  conversation.id,
                );

                setRequestedDeleteId(
                  null,
                );
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      );
    }

    if (
      renamingId ===
      conversation.id
    ) {
      return (
        <div className="rounded-xl border border-border-default bg-surface-raised p-2">
          <label
            className="sr-only"
            htmlFor={`rename-${conversation.id}`}
          >
            Conversation title
          </label>

          <input
            id={`rename-${conversation.id}`}
            ref={
              renameInputRef
            }
            value={
              renameDraft
            }
            maxLength={
              MAX_TITLE_CHARS
            }
            onChange={(
              event,
            ) =>
              setRenameDraft(
                event.target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                  "Enter"
              ) {
                event
                  .preventDefault();

                void commitRename();
              }

              if (
                event.key ===
                  "Escape"
              ) {
                event
                  .preventDefault();

                cancelRename();
              }
            }}
            onBlur={() =>
              void commitRename()
            }
            className="w-full rounded-lg bg-transparent px-1 py-1 text-sm text-text-primary outline-none"
          />
        </div>
      );
    }

    return (
      <div className="group relative">
        <button
          type="button"
          onClick={() =>
            onSelectConversation(
              conversation.id,
            )
          }
          aria-current={
            isActive
              ? "true"
              : undefined
          }
          className={`w-full truncate rounded-xl py-2 pl-3 text-left text-sm transition-colors ${
            options?.compact
              ? "pr-3"
              : "pr-[7.5rem]"
          } ${
            isActive
              ? "bg-surface-raised text-text-primary shadow-sm"
              : "text-text-secondary hover:bg-surface-raised/70 hover:text-text-primary"
          }`}
        >
          {conversation.title}
        </button>

        {!options?.compact ? (
          <span className="absolute right-1 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <IconButton
              size="sm"
              label={
                pinnedIds.includes(
                  conversation.id,
                )
                  ? `Unpin chat: ${conversation.title}`
                  : `Pin chat: ${conversation.title}`
              }
              onClick={() =>
                toggleStoredId(
                  conversation.id,
                  "pinned",
                )
              }
            >
              <PinIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              size="sm"
              label={
                projectIds.includes(
                  conversation.id,
                )
                  ? `Remove from projects: ${conversation.title}`
                  : `Add to projects: ${conversation.title}`
              }
              onClick={() =>
                toggleStoredId(
                  conversation.id,
                  "project",
                )
              }
            >
              <FolderIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              size="sm"
              label={`Rename chat: ${conversation.title}`}
              onClick={() =>
                beginRename(
                  conversation,
                )
              }
            >
              <EditIcon className="h-4 w-4" />
            </IconButton>

            <IconButton
              size="sm"
              label={`Delete chat: ${conversation.title}`}
              onClick={() =>
                setRequestedDeleteId(
                  conversation.id,
                )
              }
            >
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={
            onClose
          }
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        aria-label="Mabojolu navigation"
        inert={
          isOffCanvas
        }
        className={`fixed inset-y-0 left-0 z-50 flex w-[284px] flex-col border-r border-border-subtle bg-surface-sunken transition-transform duration-200 ${
          isOpen
            ? "translate-x-0"
            : "-translate-x-full"
        } ${
          isCollapsed
            ? "lg:-translate-x-full"
            : "lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <BrandLockup />

          <IconButton
            ref={
              closeButtonRef
            }
            label="Close sidebar"
            onClick={() => {
              if (
                isDesktopLayout
              ) {
                onCollapse?.();
                return;
              }

              onClose();
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className="space-y-1 px-3">
          <button
            type="button"
            onClick={
              onNewChat
            }
            className={
              navigationItemClass
            }
          >
            <NewChatIcon />

            <span>
              New chat
            </span>
          </button>

          {hasPermanentAccount ? (
            <>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />

                <label
                  className="sr-only"
                  htmlFor="conversation-search"
                >
                  Search conversations
                </label>

                <input
                  id="conversation-search"
                  type="search"
                  value={
                    search
                  }
                  onChange={(
                    event,
                  ) =>
                    onSearchChange(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search"
                  className="h-10 w-full rounded-xl border border-transparent bg-transparent pl-10 pr-8 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary hover:bg-surface-raised focus:border-border-subtle focus:bg-surface-raised"
                />

                {isSearching ? (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                ) : null}
              </div>

              <Link
                href="/library"
                className={
                  navigationItemClass
                }
              >
                <LibraryIcon />

                <span>
                  Library
                </span>
              </Link>

              <Link
                href="/scheduled"
                className={
                  navigationItemClass
                }
              >
                <CalendarIcon />

                <span>
                  Scheduled
                </span>
              </Link>

              <Link
                href="/plugins"
                className={
                  navigationItemClass
                }
              >
                <PluginIcon />

                <span>
                  Plugins
                </span>
              </Link>
            </>
          ) : null}
        </div>

        <nav
          aria-label="Conversation workspace"
          aria-busy={
            hasPermanentAccount
              ? isLoading
              : false
          }
          className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        >
          {!hasPermanentAccount ? null : error ? (
            <p
              role="alert"
              className="px-2 py-4 text-xs leading-5 text-danger"
            >
              {error}
            </p>
          ) : isLoading ? (
            <p className="px-2 py-4 text-xs text-text-muted">
              Loading chats...
            </p>
          ) : conversations.length ===
              0 &&
            search.trim().length >
              0 ? (
            <p className="px-2 py-4 text-center text-xs text-text-muted">
              No chats match &ldquo;
              {search.trim()}
              &rdquo;.
            </p>
          ) : (
            <div className="space-y-5">
              {pinned.length >
              0 ? (
                <section>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Pinned
                  </p>

                  <div className="space-y-0.5">
                    {pinned.map(
                      (
                        conversation,
                      ) => (
                        <div
                          key={
                            `pinned-${conversation.id}`
                          }
                        >
                          {conversationButton(
                            conversation,
                            {
                              compact:
                                true,
                            },
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ) : null}

              {projects.length >
              0 ? (
                <section>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Projects
                  </p>

                  <div className="space-y-0.5">
                    {projects.map(
                      (
                        conversation,
                      ) => (
                        <div
                          key={
                            `project-${conversation.id}`
                          }
                        >
                          {conversationButton(
                            conversation,
                            {
                              compact:
                                true,
                            },
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ) : null}

              {conversations.length >
              0 ? (
                <section>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Chats
                  </p>

                  <div className="space-y-0.5">
                    {visibleChats.map(
                      (
                        conversation,
                      ) => (
                        <div
                          key={
                            conversation.id
                          }
                        >
                          {conversationButton(
                            conversation,
                          )}
                        </div>
                      ),
                    )}
                  </div>

                  {conversations.length >
                    8 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllChats(
                          (
                            value,
                          ) =>
                            !value,
                        )
                      }
                      className="mt-1 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 transition-transform ${
                          showAllChats
                            ? "rotate-180"
                            : ""
                        }`}
                      />

                      {showAllChats
                        ? "Show less"
                        : "Show more"}
                    </button>
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </nav>

        <div className="border-t border-border-subtle px-3 pb-3 pt-2">
          {activeConversationId &&
          onPrepareHandover ? (
            <Button
              variant="ghost"
              onClick={
                onPrepareHandover
              }
              className="w-full justify-start px-3"
            >
              <FolderIcon />

              <span className="flex-1 text-left">
                Prepare handover
              </span>
            </Button>
          ) : null}

          {isAdmin ? (
            <Link
              href="/admin"
              className="flex h-10 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Admin
            </Link>
          ) : null}

          <Link
            href="/pricing"
            className="flex h-10 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            See plans and pricing
          </Link>

          <Button
            variant="ghost"
            onClick={
              onOpenSettings
            }
            className="w-full justify-start px-3"
          >
            <SettingsIcon />

            <span className="flex-1 text-left">
              Settings
            </span>
          </Button>

          <Link
            href="/help"
            className="flex h-10 w-full items-center rounded-xl px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Help
          </Link>

          {!hasPermanentAccount ? (
            <Link
              href="/sign-in"
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-raised"
            >
              Log in
            </Link>
          ) : null}
        </div>
      </aside>
    </>
  );
}

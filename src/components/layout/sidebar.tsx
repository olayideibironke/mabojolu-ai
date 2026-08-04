"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { BrandLockup } from "@/components/ui/brand-mark";
import { Button, IconButton } from "@/components/ui/button";
import {
  CloseIcon,
  EditIcon,
  NewChatIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { desktopLayoutStore } from "@/lib/utilities/media-query";
import { MAX_TITLE_CHARS } from "@/lib/validation/chat";
import type { ConversationSummary } from "@/types/chat";

/**
 * Conversation sidebar.
 *
 * One component serves both breakpoints: a persistent column from `lg` up, and an
 * overlay drawer below it. Two implementations would drift apart.
 *
 * Search is delegated upward rather than filtering locally, because the server can
 * also search message bodies, which is how a user finds a chat by something they
 * remember saying in it.
 */

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;
  isSignedIn: boolean;
  isAdmin: boolean;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<boolean>;
  onOpenSettings: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  search,
  onSearchChange,
  isSearching,
  isLoading,
  error,
  isSignedIn,
  isAdmin,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
}: SidebarProps) {
  /** Two-step delete, so a stray click cannot destroy a conversation. */
  const [requestedDeleteId, setRequestedDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const isDesktopLayout = useSyncExternalStore(
    desktopLayoutStore.subscribe,
    desktopLayoutStore.getSnapshot,
    desktopLayoutStore.getServerSnapshot,
  );

  /**
   * True when the sidebar is translated off-canvas.
   *
   * An off-canvas panel stays in the accessibility tree and its controls remain
   * tabbable, so it is marked `inert` to stop a keyboard user tabbing into an
   * invisible drawer.
   */
  const isOffCanvas = !isOpen && !isDesktopLayout;

  /**
   * Derived rather than stored, so a conversation removed elsewhere cannot leave a
   * confirmation prompt attached to a row that no longer exists.
   */
  const pendingDeleteId =
    requestedDeleteId &&
    conversations.some((conversation) => conversation.id === requestedDeleteId)
      ? requestedDeleteId
      : null;

  // Escape closes the drawer. Bound only while open, so it does not interfere with
  // other Escape handlers such as cancelling a rename.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Move focus into the drawer when it opens, so keyboard and screen reader users
  // are not left behind on the page underneath.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Focus and select the title when a rename starts, so typing replaces it.
  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const beginRename = useCallback((conversation: ConversationSummary) => {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameDraft("");
  }, []);

  const commitRename = useCallback(async () => {
    if (!renamingId) {
      return;
    }

    const trimmed = renameDraft.trim();
    const original = conversations.find(
      (conversation) => conversation.id === renamingId,
    );

    // An empty or unchanged title is a no-op rather than a pointless request.
    if (trimmed.length === 0 || trimmed === original?.title) {
      cancelRename();
      return;
    }

    await onRenameConversation(renamingId, trimmed);
    cancelRename();
  }, [cancelRename, conversations, onRenameConversation, renameDraft, renamingId]);

  return (
    <>
      {/* Scrim. A button rather than a div so dismissing by click is exposed to
          assistive technology too. */}
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        aria-label="Conversations"
        // `inert` removes the off-canvas drawer from the tab order and the
        // accessibility tree together, which `aria-hidden` alone would not do.
        inert={isOffCanvas}
        className={`fixed inset-y-0 left-0 z-50 flex w-[284px] flex-col border-r border-border-subtle bg-surface-sunken transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <BrandLockup />

          <IconButton
            ref={closeButtonRef}
            label="Close sidebar"
            onClick={onClose}
            className="lg:hidden"
          >
            <CloseIcon />
          </IconButton>
        </div>

        <div className="px-3">
          <Button
            variant="secondary"
            onClick={onNewChat}
            className="w-full justify-start shadow-sm"
          >
            <NewChatIcon />
            <span>New chat</span>
          </Button>
        </div>

        {/* Search only earns its space once there is something to search. */}
        {isSignedIn && (conversations.length > 0 || search.length > 0) ? (
          <div className="px-3 pt-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <label className="sr-only" htmlFor="conversation-search">
                Search conversations
              </label>
              <input
                id="conversation-search"
                type="search"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search chats"
                className="h-9 w-full rounded-xl border border-border-subtle bg-surface-raised pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-strong"
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
          </div>
        ) : null}

        <nav
          aria-label="Recent conversations"
          aria-busy={isLoading}
          className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3"
        >
          {!isSignedIn ? (
            <div className="rounded-xl border border-dashed border-border-default px-3 py-5 text-center">
              <p className="text-xs leading-5 text-text-muted">
                Sign in to save and revisit your conversations.
              </p>
            </div>
          ) : error ? (
            <p role="alert" className="px-2 py-4 text-xs leading-5 text-danger">
              {error}
            </p>
          ) : isLoading ? (
            <p className="px-2 py-4 text-xs text-text-muted">Loading chats...</p>
          ) : conversations.length === 0 && search.trim().length > 0 ? (
            <p className="px-2 py-4 text-center text-xs text-text-muted">
              No chats match &ldquo;{search.trim()}&rdquo;.
            </p>
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-default px-3 py-5 text-center">
              <p className="text-xs leading-5 text-text-muted">
                Your conversations will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const isPendingDelete = pendingDeleteId === conversation.id;
                const isRenaming = renamingId === conversation.id;

                if (isPendingDelete) {
                  return (
                    <li key={conversation.id}>
                      <div className="rounded-xl border border-border-default bg-surface-raised p-2.5">
                        <p className="text-xs leading-5 text-text-primary">
                          Delete this chat? This cannot be undone.
                        </p>
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRequestedDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              onDeleteConversation(conversation.id);
                              setRequestedDeleteId(null);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                }

                if (isRenaming) {
                  return (
                    <li key={conversation.id}>
                      <div className="rounded-xl border border-border-default bg-surface-raised p-2">
                        <label
                          className="sr-only"
                          htmlFor={`rename-${conversation.id}`}
                        >
                          Conversation title
                        </label>
                        <input
                          id={`rename-${conversation.id}`}
                          ref={renameInputRef}
                          value={renameDraft}
                          maxLength={MAX_TITLE_CHARS}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void commitRename();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                          // Committing on blur means clicking away saves rather
                          // than silently discarding the edit.
                          onBlur={() => void commitRename()}
                          className="w-full rounded-lg bg-transparent px-1 py-1 text-sm text-text-primary outline-none"
                        />
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={conversation.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      // Marks the current chat for assistive technology, not just
                      // visually.
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full truncate rounded-xl py-2.5 pl-3 pr-16 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-surface-raised text-text-primary shadow-sm"
                          : "text-text-secondary hover:bg-surface-raised/70 hover:text-text-primary"
                      }`}
                    >
                      {conversation.title}
                    </button>

                    {/* Revealed on hover and on keyboard focus, so the controls are
                        reachable without a pointer. */}
                    <span className="absolute right-1 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton
                        size="sm"
                        label={`Rename chat: ${conversation.title}`}
                        onClick={() => beginRename(conversation)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        label={`Delete chat: ${conversation.title}`}
                        onClick={() => setRequestedDeleteId(conversation.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="border-t border-border-subtle p-3">
          {isAdmin ? (
            <a
              href="/admin"
              className="mb-1 flex h-10 w-full items-center gap-2 rounded-xl px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <span className="flex-1 text-left">Admin</span>
            </a>
          ) : null}

          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="w-full justify-start"
          >
            <SettingsIcon />
            <span className="flex-1 text-left">Settings</span>
          </Button>

          <p className="mt-2 rounded-xl bg-surface-inverse px-3 py-2.5 text-[11px] leading-4 text-text-inverse/70">
            <span className="block text-xs font-semibold text-text-inverse">
              A Westforge Holdings Product
            </span>
            mabojolu.com
          </p>
        </div>
      </aside>
    </>
  );
}

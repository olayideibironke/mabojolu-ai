"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { BrandLockup } from "@/components/ui/brand-mark";
import { desktopLayoutStore } from "@/lib/utilities/media-query";
import { Button, IconButton } from "@/components/ui/button";
import {
  CloseIcon,
  NewChatIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/ui/icons";
import type { ConversationSummary } from "@/types/chat";

/**
 * Conversation sidebar.
 *
 * One component serves both breakpoints: a persistent column from `lg` up, and
 * an overlay drawer below it. Two implementations would drift apart.
 *
 * Search filters locally over the loaded summaries. Once history lives in the
 * database this becomes a server query; the prop shape is already compatible so
 * the swap does not change this component's contract.
 */

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onOpenSettings,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  /** Two-step delete, so a stray click cannot destroy a conversation. */
  const [requestedDeleteId, setRequestedDeleteId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isDesktopLayout = useSyncExternalStore(
    desktopLayoutStore.subscribe,
    desktopLayoutStore.getSnapshot,
    desktopLayoutStore.getServerSnapshot,
  );

  /**
   * True when the sidebar is translated off-canvas: closed, and below the `lg`
   * breakpoint where it becomes a permanent column.
   *
   * This matters because an off-canvas panel is still in the accessibility tree
   * and its controls stay tabbable, so it is marked `inert` to keep a keyboard
   * user from tabbing into an invisible drawer.
   */
  const isOffCanvas = !isOpen && !isDesktopLayout;

  /**
   * Derived rather than stored, so a conversation deleted from elsewhere cannot
   * leave a confirmation prompt attached to a row that no longer exists.
   */
  const pendingDeleteId =
    requestedDeleteId &&
    conversations.some((conversation) => conversation.id === requestedDeleteId)
      ? requestedDeleteId
      : null;

  // Escape closes the drawer. Only bound while open so it does not interfere
  // with other Escape handlers, such as cancelling a message edit.
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

  // Move focus into the drawer when it opens on small screens, so keyboard and
  // screen reader users are not left behind on the page underneath.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  return (
    <>
      {/* Scrim. A button rather than a div so dismissing by click is also
          exposed to assistive technology. */}
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
        {conversations.length > 0 ? (
          <div className="px-3 pt-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <label className="sr-only" htmlFor="conversation-search">
                Search conversations
              </label>
              <input
                id="conversation-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chats"
                className="h-9 w-full rounded-xl border border-border-subtle bg-surface-raised pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-strong"
              />
            </div>
          </div>
        ) : null}

        <nav aria-label="Recent conversations" className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-default px-3 py-5 text-center">
              <p className="text-xs leading-5 text-text-muted">
                Your conversations will appear here.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-text-muted">
              No chats match &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const isPendingDelete = pendingDeleteId === conversation.id;

                return (
                  <li key={conversation.id} className="group relative">
                    {isPendingDelete ? (
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
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectConversation(conversation.id)}
                          // Marks the current chat for assistive technology,
                          // not just visually.
                          aria-current={isActive ? "true" : undefined}
                          className={`w-full truncate rounded-xl py-2.5 pl-3 pr-10 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-surface-raised text-text-primary shadow-sm"
                              : "text-text-secondary hover:bg-surface-raised/70 hover:text-text-primary"
                          }`}
                        >
                          {conversation.title}
                        </button>

                        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <IconButton
                            size="sm"
                            label={`Delete chat: ${conversation.title}`}
                            onClick={() => setRequestedDeleteId(conversation.id)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="border-t border-border-subtle p-3">
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

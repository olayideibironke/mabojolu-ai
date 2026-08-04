"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage, ConversationSummary } from "@/types/chat";

/**
 * Conversation history.
 *
 * Owns the sidebar list and loading a selected conversation's transcript. Kept
 * separate from `useChat`, which owns the active generation: one deals with stored
 * conversations, the other with a live stream, and merging them made both harder
 * to reason about.
 *
 * Search is debounced and issued to the server rather than filtering a local
 * array, because the server can search message bodies too, which is how a user
 * finds a chat by something they remember saying in it.
 */

export interface UseConversationsResult {
  conversations: ConversationSummary[];
  isLoading: boolean;
  /** True while a search request is outstanding, for a subtle busy state. */
  isSearching: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  /** Reload the list, after sending a message or renaming. */
  refresh: () => Promise<void>;
  loadConversation: (id: string) => Promise<ChatMessage[] | null>;
  rename: (id: string, title: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

const SEARCH_DEBOUNCE_MS = 250;

export function useConversations(enabled: boolean): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  /**
   * Aborts the previous request when a newer one starts.
   *
   * Without this, a slow response for "ab" can land after the response for "abc"
   * and overwrite the list with stale results.
   */
  const requestRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(
    async (term: string, options: { quiet?: boolean } = {}) => {
      if (!enabled) {
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (!options.quiet) {
        setIsSearching(true);
      }

      try {
        const url = term.trim()
          ? `/api/conversations?search=${encodeURIComponent(term.trim())}`
          : "/api/conversations";

        const response = await fetch(url, { signal: controller.signal });

        // Not signed in is a normal state, not an error to display.
        if (response.status === 401) {
          setConversations([]);
          setError(null);
          return;
        }

        if (!response.ok) {
          setError("Could not load your conversations.");
          return;
        }

        const data = (await response.json()) as {
          conversations: ConversationSummary[];
        };

        setConversations(data.conversations);
        setError(null);
      } catch (cause) {
        // An abort is expected when a newer request supersedes this one.
        if (cause instanceof Error && cause.name === "AbortError") {
          return;
        }
        setError("Could not load your conversations.");
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    },
    [enabled],
  );

  /**
   * Load the list, and reload it as the search term changes.
   *
   * One effect covers both the initial load and search, because they are the same
   * operation with a different term. Every path schedules the fetch on a timer
   * rather than calling it synchronously in the effect body: a synchronous call
   * here sets state during the effect and triggers a cascading render. An empty
   * term uses a zero delay, so clearing the box still feels immediate.
   */
  useEffect(() => {
    if (!enabled) {
      // Nothing to load when signed out, so leave the loading state behind.
      const idle = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(idle);
    }

    const term = search.trim();
    const delay = term.length === 0 ? 0 : SEARCH_DEBOUNCE_MS;

    const timer = window.setTimeout(() => {
      void fetchList(term, { quiet: term.length === 0 });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [enabled, fetchList, search]);

  const refresh = useCallback(async () => {
    await fetchList(search, { quiet: true });
  }, [fetchList, search]);

  const loadConversation = useCallback(
    async (id: string): Promise<ChatMessage[] | null> => {
      try {
        const response = await fetch(`/api/conversations/${id}`);

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as {
          conversation: { messages: ChatMessage[] };
        };

        return data.conversation.messages;
      } catch {
        return null;
      }
    },
    [],
  );

  const rename = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      // Optimistic update, so the sidebar responds immediately.
      const previous = conversations;
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id ? { ...conversation, title } : conversation,
        ),
      );

      try {
        const response = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });

        if (!response.ok) {
          // Roll back rather than leaving the UI showing a title the server
          // rejected.
          setConversations(previous);
          return false;
        }

        return true;
      } catch {
        setConversations(previous);
        return false;
      }
    },
    [conversations],
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return false;
      }

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== id),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    conversations,
    isLoading,
    isSearching,
    error,
    search,
    setSearch,
    refresh,
    loadConversation,
    rename,
    remove,
  };
}

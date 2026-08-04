"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Follow a streaming transcript without trapping the user.
 *
 * The rule that matters: auto-scroll only while the user is already at the
 * bottom. If they have scrolled up to read something, new tokens must not yank
 * them back down. Scrolling up detaches; returning to the bottom re-attaches.
 */

/** Distance from the bottom still treated as "at the bottom", in pixels. */
const BOTTOM_THRESHOLD_PX = 80;

export function useAutoScroll<T extends HTMLElement>(
  /** Changes whenever content grows, for example the streamed text length. */
  dependency: unknown,
  active: boolean,
) {
  const containerRef = useRef<T>(null);
  const [isPinned, setIsPinned] = useState(true);

  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setIsPinned(distance <= BOTTOM_THRESHOLD_PX);
  }, []);

  useEffect(() => {
    if (!isPinned) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    // "auto" rather than "smooth": a smooth animation restarting on every token
    // never settles, which reads as jitter.
    node.scrollTo({ top: node.scrollHeight, behavior: "auto" });
  }, [dependency, isPinned, active]);

  const scrollToBottom = useCallback(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    setIsPinned(true);
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, []);

  return { containerRef, isPinned, handleScroll, scrollToBottom };
}

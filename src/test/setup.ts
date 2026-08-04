import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Browser test setup.
 *
 * Unmounts between tests so state cannot leak from one case into the next, and
 * supplies the browser APIs jsdom does not implement. Each shim is minimal and
 * behavioural: a stub that always returns a fixed value would let a real bug
 * pass, so `matchMedia` keeps working listeners.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * jsdom has no `matchMedia`.
 *
 * The theme and layout stores subscribe to it, so this implementation supports
 * listeners and lets a test drive a media change. Defaults to not matching,
 * which is the mobile and light-theme case.
 */
if (!window.matchMedia) {
  const listeners = new Map<string, Set<() => void>>();

  window.matchMedia = ((query: string) => {
    const set = listeners.get(query) ?? new Set();
    listeners.set(query, set);

    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: () => void) => set.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        set.delete(listener),
      addListener: (listener: () => void) => set.add(listener),
      removeListener: (listener: () => void) => set.delete(listener),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

// jsdom does not implement scrollTo. The transcript calls it while following a
// stream, so it needs to exist rather than throw.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {
    // Intentionally inert: tests assert on state, not on scroll position.
  } as typeof Element.prototype.scrollTo;
}

// The native <dialog> methods are absent in jsdom. Reflect the `open` attribute
// so assertions about dialog visibility remain meaningful.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
}

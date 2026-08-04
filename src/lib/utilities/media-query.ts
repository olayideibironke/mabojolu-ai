"use client";

/**
 * Media queries as subscribable external stores.
 *
 * `matchMedia` is an external system, so it is read with `useSyncExternalStore`
 * rather than copied into state inside an effect. Besides avoiding a cascading
 * render, this makes the server snapshot explicit, so hydration is correct
 * rather than merely warning-free.
 */

interface MediaQueryStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
  getServerSnapshot: () => boolean;
}

const cache = new Map<string, MediaQueryStore>();

/**
 * Create a store for a media query.
 *
 * @param query The media query string, for example `(min-width: 1024px)`.
 * @param serverValue What to assume on the server, where no viewport exists.
 *   Choose the value that renders the safer markup: for a responsive drawer that
 *   means assuming mobile, so the drawer starts closed.
 */
export function createMediaQueryStore(
  query: string,
  serverValue: boolean,
): MediaQueryStore {
  const cached = cache.get(query);
  if (cached) {
    return cached;
  }

  let mediaQuery: MediaQueryList | null = null;

  function get(): MediaQueryList {
    mediaQuery ??= window.matchMedia(query);
    return mediaQuery;
  }

  const store: MediaQueryStore = {
    subscribe(listener) {
      const media = get();
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    getSnapshot() {
      return get().matches;
    },
    getServerSnapshot() {
      return serverValue;
    },
  };

  cache.set(query, store);
  return store;
}

/**
 * Matches the Tailwind `lg` breakpoint, where the sidebar becomes a permanent
 * column instead of an overlay drawer.
 *
 * Defaults to false on the server so the first render treats the sidebar as
 * off-canvas, which is the correct starting state on mobile.
 */
export const desktopLayoutStore = createMediaQueryStore(
  "(min-width: 1024px)",
  false,
);

/**
 * True on devices with a precise pointer and real hover, which is the signal for
 * "focusing an input will not open an on-screen keyboard".
 *
 * Defaults to false so a touch device is never given autofocus by mistake.
 */
export const finePointerStore = createMediaQueryStore(
  "(hover: hover) and (pointer: fine)",
  false,
);

"use client";

import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

/**
 * External store for theme preference and OS colour scheme.
 *
 * `localStorage` and `matchMedia` are external systems, so they are exposed as
 * subscribable stores and read with `useSyncExternalStore` rather than copied
 * into state inside an effect. That is what this hook is for, and it avoids the
 * cascading render that reading-then-setting in an effect causes.
 *
 * It also gives React a distinct server snapshot, so hydration is correct by
 * construction instead of relying on a suppressed warning.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Cached snapshot.
 *
 * `useSyncExternalStore` requires `getSnapshot` to return a referentially stable
 * value while nothing has changed; re-reading storage on every call would return
 * equal-but-unstable values and loop.
 */
let cachedPreference: ThemePreference | null = null;

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Storage is unavailable in some privacy modes; following the OS is the
    // reasonable default.
    return "system";
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const themePreferenceStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);

    // Keep other tabs in sync: a `storage` event fires in every other document
    // sharing the origin.
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        cachedPreference = null;
        listener();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },

  getSnapshot(): ThemePreference {
    cachedPreference ??= readPreference();
    return cachedPreference;
  },

  /** Server and hydration snapshot. No storage exists on the server. */
  getServerSnapshot(): ThemePreference {
    return "system";
  },

  set(preference: ThemePreference): void {
    try {
      // `system` is stored as an absent key, so a future default change applies
      // to users who never chose a fixed theme.
      if (preference === "system") {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
      }
    } catch {
      // A failed write costs persistence only; the preference still applies for
      // this session.
    }

    cachedPreference = preference;
    emit();
  },
};

let mediaQuery: MediaQueryList | null = null;

function getMediaQuery(): MediaQueryList {
  mediaQuery ??= window.matchMedia("(prefers-color-scheme: dark)");
  return mediaQuery;
}

export const systemDarkStore = {
  subscribe(listener: Listener): () => void {
    const query = getMediaQuery();
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  },

  getSnapshot(): boolean {
    return getMediaQuery().matches;
  },

  /**
   * Server snapshot.
   *
   * The OS preference is unknowable on the server. Light is assumed, and the
   * pre-paint inline script has already applied the correct theme to the DOM, so
   * this only affects the first React render rather than what the user sees.
   */
  getServerSnapshot(): boolean {
    return false;
  },
};

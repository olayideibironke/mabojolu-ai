"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  systemDarkStore,
  themePreferenceStore,
} from "@/lib/utilities/theme-store";
import type { ResolvedTheme, ThemePreference } from "@/lib/utilities/theme";

/**
 * Theme state.
 *
 * The stored preference and the OS colour scheme are external systems, so they
 * are read through `useSyncExternalStore` rather than mirrored into state inside
 * an effect. The only effect here writes to the DOM, which is the direction
 * effects are actually for.
 */

interface ThemeContextValue {
  /** What the user chose, including `system`. */
  preference: ThemePreference;
  /** What is applied right now. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    themePreferenceStore.subscribe,
    themePreferenceStore.getSnapshot,
    themePreferenceStore.getServerSnapshot,
  );

  const systemPrefersDark = useSyncExternalStore(
    systemDarkStore.subscribe,
    systemDarkStore.getSnapshot,
    systemDarkStore.getServerSnapshot,
  );

  // Derived, not stored. A second copy in state could disagree with the store.
  const resolved: ResolvedTheme =
    preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;

  // Push the resolved theme to the DOM. The inline script sets it before paint;
  // this keeps it correct as the preference or the OS setting changes.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    themePreferenceStore.set(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }

  return context;
}

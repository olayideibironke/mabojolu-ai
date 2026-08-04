/**
 * Theme preference handling.
 *
 * Shared by the pre-paint inline script and the React provider, so both agree
 * on the storage key and on how `system` resolves. Duplicating that logic is
 * how theme flashes and mismatches happen.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mabojolu.theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Inline script that applies the theme before first paint.
 *
 * Runs before React hydrates, which is the only way to avoid a flash of the
 * wrong theme. Kept small and dependency-free, and wrapped in try/catch because
 * `localStorage` throws in some privacy modes and a theme read must never break
 * the page.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var t=(s==="light"||s==="dark")?s:(m?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

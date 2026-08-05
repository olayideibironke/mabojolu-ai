"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One browser-side Supabase client shared by authentication and guest-session
 * components.
 *
 * Reusing one instance prevents competing auth listeners and keeps the browser
 * session cookie synchronized consistently.
 */
let browserClient: SupabaseClient | null =
  null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Mabojolu authentication is not configured.",
    );
  }

  browserClient = createBrowserClient(
    url,
    key,
  );

  return browserClient;
}
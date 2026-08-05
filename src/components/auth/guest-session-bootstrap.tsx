"use client";

import {
  useEffect,
} from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

interface GuestSessionBootstrapProps {
  enabled: boolean;
}

/**
 * Prevent duplicate anonymous-account creation if React initializes the
 * component more than once.
 */
let guestSessionPromise:
  | Promise<void>
  | null = null;

async function startGuestSession(): Promise<void> {
  const client =
    getSupabaseBrowserClient();

  const {
    data,
    error: sessionError,
  } =
    await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (data.session) {
    return;
  }

  const {
    error,
  } =
    await client.auth.signInAnonymously();

  if (error) {
    throw error;
  }
}

/**
 * Silently creates a guest identity in the background.
 *
 * Nothing is rendered, no CAPTCHA is shown, and the visitor is never blocked
 * from seeing the Mabojolu interface.
 */
export function GuestSessionBootstrap({
  enabled,
}: GuestSessionBootstrapProps) {
  const router =
    useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!guestSessionPromise) {
      guestSessionPromise =
        startGuestSession();
    }

    void guestSessionPromise
      .then(() => {
        router.refresh();
      })
      .catch(
        (
          error: unknown,
        ) => {
          guestSessionPromise =
            null;

          console.error(
            "[mabojolu] silent guest session initialization failed",
            error,
          );
        },
      );
  }, [
    enabled,
    router,
  ]);

  return null;
}
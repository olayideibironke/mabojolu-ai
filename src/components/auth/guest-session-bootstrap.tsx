"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
} from "react";

import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

import { TurnstileWidget } from "./turnstile-widget";

interface GuestSessionBootstrapProps {
  enabled: boolean;
}

type BootstrapStatus =
  | "waiting"
  | "starting"
  | "failed";

/**
 * Prevent duplicate anonymous-account creation when React renders the component
 * more than once or the Turnstile callback fires repeatedly.
 */
let guestSessionPromise:
  | Promise<void>
  | null = null;

async function startGuestSession(
  captchaToken: string,
): Promise<void> {
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

  /**
   * A browser session may already exist while the server-rendered page is still
   * showing an older signed-out state.
   */
  if (data.session) {
    window.location.replace("/");
    return;
  }

  const {
    error,
  } =
    await client.auth.signInAnonymously({
      options: {
        captchaToken,
      },
    });

  if (error) {
    throw error;
  }

  /**
   * The anonymous session is now stored in the browser cookies. Reloading lets
   * the server resolve the new guest identity and profile before chat becomes
   * interactive.
   */
  window.location.replace("/");
}

export function GuestSessionBootstrap({
  enabled,
}: GuestSessionBootstrapProps) {
  const [
    status,
    setStatus,
  ] =
    useState<BootstrapStatus>(
      "waiting",
    );

  const startedRef =
    useRef(false);

  const handleTokenChange =
    useCallback(
      (
        token: string | null,
      ) => {
        if (
          !enabled ||
          !token ||
          startedRef.current
        ) {
          return;
        }

        startedRef.current = true;
        setStatus("starting");

        if (!guestSessionPromise) {
          guestSessionPromise =
            startGuestSession(
              token,
            );
        }

        void guestSessionPromise.catch(
          (
            error: unknown,
          ) => {
            guestSessionPromise =
              null;

            startedRef.current =
              false;

            console.error(
              "[mabojolu] guest session initialization failed",
              error,
            );

            setStatus("failed");
          },
        );
      },
      [enabled],
    );

  if (!enabled) {
    return null;
  }

  if (status === "failed") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-base px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-raised p-6 text-center shadow-lg">
          <h2 className="text-base font-semibold text-text-primary">
            Guest access could not start
          </h2>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Refresh the page to complete the security check again, or sign in
            to an existing Mabojolu account.
          </p>

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-muted"
            >
              Try again
            </button>

            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-base px-4"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm text-center">
        {status === "starting" ? (
          <>
            <div
              className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border-default border-t-text-primary"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-medium text-text-secondary">
              Preparing Mabojolu...
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-text-primary">
              Welcome to Mabojolu
            </h2>

            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Complete this quick security check to begin as a guest.
            </p>

            <TurnstileWidget
              onTokenChange={
                handleTokenChange
              }
              className="mt-5"
            />
          </>
        )}
      </div>
    </div>
  );
}
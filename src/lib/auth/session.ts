import "server-only";

import { cookies } from "next/headers";

import { getDatabase } from "@/lib/database";
import type { Profile } from "@/lib/database/types";
import { inspectServerEnv } from "@/lib/env";

/**
 * Server-side session resolution.
 *
 * Every protected route and page resolves identity here.
 *
 * supabase:
 * Real registered accounts and anonymous guest sessions issued by Supabase.
 *
 * dev:
 * Fixed local identities used to test ownership and role boundaries without an
 * external authentication provider.
 */

export type SessionKind =
  | "guest"
  | "user"
  | "admin";

export interface Session {
  userId: string;

  /**
   * Real deliverable email for a registered account.
   *
   * Anonymous visitors use an empty string here so Mabojolu never exposes the
   * internal placeholder address stored in the profiles table.
   */
  email: string;

  profile: Profile;

  /**
   * Product-level identity state used by the UI and authorization layer.
   */
  kind: SessionKind;

  /**
   * True only for a temporary Supabase anonymous account.
   */
  isAnonymous: boolean;
}

/** Cookie holding the local development identity. */
const DEV_SESSION_COOKIE =
  "mabojolu-dev-session";

/**
 * A stable synthetic identity for development.
 *
 * A fixed UUID means restarting the development server does not orphan local
 * conversations.
 */
const DEV_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "developer@mabojolu.local",
  displayName: "Local Developer",
} as const;

/**
 * A second development identity.
 *
 * Switching identities proves that one user cannot access another user's
 * conversations.
 */
const DEV_USER_ALT = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "second@mabojolu.local",
  displayName: "Second Local User",
} as const;

export function devUsers() {
  return [
    DEV_USER,
    DEV_USER_ALT,
  ];
}

/**
 * Resolve the current session.
 *
 * Returns null rather than throwing so each caller can decide whether to render
 * guest access, redirect to sign-in, or return an unauthorized API response.
 */
export async function getSession(): Promise<Session | null> {
  const envResult =
    inspectServerEnv();

  if (!envResult.ok) {
    return null;
  }

  const env =
    envResult.env;

  if (env.AUTH_MODE === "dev") {
    /*
     * Defence in depth. Environment validation already rejects dev
     * authentication in production, but this second check prevents accidental
     * exposure even if that validation is bypassed.
     */
    if (
      env.NODE_ENV ===
      "production"
    ) {
      console.error(
        "[mabojolu] refusing dev auth in production. Set AUTH_MODE=supabase.",
      );

      return null;
    }

    return getDevSession();
  }

  return getSupabaseSession();
}

async function getDevSession(): Promise<Session | null> {
  const store =
    await cookies();

  const value =
    store.get(
      DEV_SESSION_COOKIE,
    )?.value;

  if (!value) {
    return null;
  }

  const user =
    devUsers().find(
      (candidate) =>
        candidate.id === value,
    );

  if (!user) {
    return null;
  }

  const database =
    getDatabase();

  const profile =
    await database.upsertProfile({
      id: user.id,
      email: user.email,
      displayName:
        user.displayName,
    });

  const kind: SessionKind =
    profile.role === "admin"
      ? "admin"
      : "user";

  return {
    userId: user.id,
    email: user.email,
    profile,
    kind,
    isAnonymous: false,
  };
}

async function getSupabaseSession(): Promise<Session | null> {
  /*
   * Imported lazily so Supabase is not pulled into the local development
   * authentication bundle.
   */
  const {
    createServerSupabaseClient,
  } = await import(
    "./supabase-server"
  );

  const client =
    await createServerSupabaseClient();

  if (!client) {
    return null;
  }

  /*
   * getUser(), not getSession().
   *
   * getUser() verifies the token against Supabase Auth rather than trusting an
   * attacker-controlled cookie value.
   */
  const {
    data,
    error,
  } =
    await client.auth.getUser();

  const user =
    data.user;

  if (
    error ||
    !user
  ) {
    return null;
  }

  const isAnonymous =
    user.is_anonymous === true;

  const realEmail =
    user.email?.trim() ?? "";

  /*
   * Anonymous visitors normally have no email. The database requires one for
   * profile consistency, so the guest receives a stable internal address that
   * is never returned to the browser or displayed in the interface.
   */
  const profileEmail =
    realEmail.length > 0
      ? realEmail
      : `guest-${user.id}@anonymous.mabojolu.invalid`;

  const rawDisplayName =
    user.user_metadata
      ?.display_name;

  const displayName =
    typeof rawDisplayName ===
      "string" &&
    rawDisplayName.trim().length >
      0
      ? rawDisplayName.trim()
      : undefined;

  const database =
    getDatabase();

  /*
   * The signup trigger normally creates this profile. Upserting keeps the
   * application resilient for users created before the trigger existed and
   * replaces the internal guest email when the account is later upgraded.
   */
  const profile =
    await database.upsertProfile({
      id: user.id,
      email: profileEmail,

      ...(displayName === undefined
        ? {}
        : {
            displayName,
          }),
    });

  const kind: SessionKind =
    profile.role === "admin"
      ? "admin"
      : isAnonymous
        ? "guest"
        : "user";

  return {
    userId: user.id,

    /*
     * Never expose the internal guest placeholder through the session object.
     */
    email:
      isAnonymous
        ? ""
        : realEmail,

    profile,
    kind,
    isAnonymous,
  };
}

/**
 * Require any authenticated identity, including an anonymous guest.
 */
export async function requireSession(): Promise<Session> {
  const session =
    await getSession();

  if (!session) {
    const {
      chatError,
    } = await import(
      "@/lib/ai/errors"
    );

    throw chatError(
      "unauthorized",
    );
  }

  return session;
}

/**
 * Require a permanent registered account.
 *
 * Anonymous visitors can use guest features, but account-only operations such
 * as billing management and permanent account settings must use this guard.
 */
export async function requireRegisteredSession(): Promise<Session> {
  const session =
    await requireSession();

  if (session.isAnonymous) {
    const {
      chatError,
    } = await import(
      "@/lib/ai/errors"
    );

    throw chatError(
      "forbidden",
      {
        message:
          "Create an account to continue.",
      },
    );
  }

  return session;
}

/**
 * Require the Westforge administrator role.
 *
 * The role is read from the database rather than accepted from a request,
 * browser value, email address, or token claim.
 */
export async function requireAdminSession(): Promise<Session> {
  const session =
    await requireSession();

  if (
    session.profile.role !==
    "admin"
  ) {
    const {
      chatError,
    } = await import(
      "@/lib/ai/errors"
    );

    throw chatError(
      "forbidden",
      {
        message:
          "You do not have access to this area.",
      },
    );
  }

  return session;
}

/** Set the development session cookie. Dev mode only. */
export async function setDevSession(
  userId: string,
): Promise<boolean> {
  const envResult =
    inspectServerEnv();

  if (
    !envResult.ok ||
    envResult.env.AUTH_MODE !==
      "dev"
  ) {
    return false;
  }

  if (
    envResult.env.NODE_ENV ===
    "production"
  ) {
    return false;
  }

  if (
    !devUsers().some(
      (user) =>
        user.id === userId,
    )
  ) {
    return false;
  }

  const store =
    await cookies();

  store.set(
    DEV_SESSION_COOKIE,
    userId,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge:
        60 *
        60 *
        24 *
        7,
    },
  );

  return true;
}

export async function clearDevSession(): Promise<void> {
  const store =
    await cookies();

  store.delete(
    DEV_SESSION_COOKIE,
  );
}
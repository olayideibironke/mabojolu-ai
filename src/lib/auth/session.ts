import "server-only";

import { cookies } from "next/headers";

import { getDatabase } from "@/lib/database";
import { inspectServerEnv } from "@/lib/env";
import type { Profile } from "@/lib/database/types";

/**
 * Server-side session resolution.
 *
 * Every protected route and page resolves identity here. Two modes:
 *
 *   supabase  The real path. The session comes from a Supabase-issued cookie and
 *             is verified against the auth server.
 *   dev       A local stand-in so ownership boundaries and per-user behaviour are
 *             genuinely exercisable without an auth provider.
 *
 * Dev mode trusts a cookie with no cryptographic verification. That is a real
 * hole, so it is closed by construction rather than by convention: env
 * validation refuses to start in production with `AUTH_MODE=dev`, and this module
 * checks again at the point of use. Two independent guards, because a single one
 * can be misconfigured.
 */

export interface Session {
  userId: string;
  email: string;
  profile: Profile;
}

/** Cookie holding the local development identity. */
const DEV_SESSION_COOKIE = "mabojolu-dev-session";

/**
 * A stable synthetic identity for development.
 *
 * A fixed UUID, so a restart does not orphan the conversations created before it.
 */
const DEV_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "developer@mabojolu.local",
  displayName: "Local Developer",
} as const;

/**
 * A second development identity.
 *
 * Its purpose is testing: switching to it proves that user A cannot read user
 * B's conversations. Without a second account, ownership enforcement can only be
 * asserted, not demonstrated.
 */
const DEV_USER_ALT = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "second@mabojolu.local",
  displayName: "Second Local User",
} as const;

export function devUsers() {
  return [DEV_USER, DEV_USER_ALT];
}

/**
 * The current session, or null when not signed in.
 *
 * Returns null rather than throwing, so a caller decides between redirecting a
 * page and returning 401 from an API route.
 */
export async function getSession(): Promise<Session | null> {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
    // A misconfigured environment must not resolve to a signed-in user.
    return null;
  }

  const env = envResult.env;

  if (env.AUTH_MODE === "dev") {
    // Defence in depth: env validation already rejects this combination, and
    // this check means a bypass of that layer still fails closed.
    if (env.NODE_ENV === "production") {
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
  const store = await cookies();
  const value = store.get(DEV_SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  // Only the two known identities are accepted. An arbitrary cookie value cannot
  // conjure a user, which keeps even the development path from inventing
  // identities.
  const user = devUsers().find((candidate) => candidate.id === value);

  if (!user) {
    return null;
  }

  const database = getDatabase();
  const profile = await database.upsertProfile({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  });

  return { userId: user.id, email: user.email, profile };
}

async function getSupabaseSession(): Promise<Session | null> {
  // Imported lazily so the Supabase client is not pulled into the bundle when
  // running in dev auth mode.
  const { createServerSupabaseClient } = await import("./supabase-server");

  const client = await createServerSupabaseClient();

  if (!client) {
    return null;
  }

  /*
   * `getUser()`, not `getSession()`.
   *
   * `getSession()` reads the cookie and decodes the JWT without contacting the
   * auth server, so a forged or expired token can appear valid. `getUser()`
   * verifies it. On a server, where the cookie is attacker-supplied input, only
   * the verifying call is safe.
   */
  const { data, error } = await client.auth.getUser();

  if (error || !data.user?.email) {
    return null;
  }

  const database = getDatabase();

  // The signup trigger creates the profile, but upserting keeps this resilient
  // if a user existed before the trigger was installed.
  const profile = await database.upsertProfile({
    id: data.user.id,
    email: data.user.email,
  });

  return { userId: data.user.id, email: data.user.email, profile };
}

/** The session, or a thrown 401-shaped error. For API routes. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    const { chatError } = await import("@/lib/ai/errors");
    throw chatError("unauthorized");
  }

  return session;
}

/**
 * The session, requiring an admin role.
 *
 * The role is read from the database rather than from a token claim or header, so
 * a client cannot assert its own privilege.
 */
export async function requireAdminSession(): Promise<Session> {
  const session = await requireSession();

  if (session.profile.role !== "admin") {
    const { chatError } = await import("@/lib/ai/errors");
    // Deliberately 404-shaped copy would be better still, but `forbidden` is
    // honest and the admin route is not secret.
    throw chatError("forbidden", {
      message: "You do not have access to this area.",
    });
  }

  return session;
}

/** Set the development session cookie. Dev mode only. */
export async function setDevSession(userId: string): Promise<boolean> {
  const envResult = inspectServerEnv();

  if (!envResult.ok || envResult.env.AUTH_MODE !== "dev") {
    return false;
  }
  if (envResult.env.NODE_ENV === "production") {
    return false;
  }
  if (!devUsers().some((user) => user.id === userId)) {
    return false;
  }

  const store = await cookies();
  store.set(DEV_SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    // Not `secure`, because local development is served over http.
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return true;
}

export async function clearDevSession(): Promise<void> {
  const store = await cookies();
  store.delete(DEV_SESSION_COOKIE);
}

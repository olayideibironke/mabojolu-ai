import "server-only";

import { createServerClient } from "@supabase/ssr";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { inspectServerEnv } from "@/lib/env";

/**
 * Server-side Supabase clients.
 *
 * Two distinct clients are used, and the difference matters:
 *
 * createServerSupabaseClient
 * Acts as the signed-in user. Every query is filtered through row-level
 * security. This is the default for anything touching user-owned data.
 *
 * createServiceRoleClient
 * Uses Mabojolu's privileged server key and bypasses row-level security. It is
 * used only where an operation genuinely cannot run as the user, including
 * usage accounting, safety telemetry, administration, account deletion, and
 * attachment processing status changes.
 *
 * The privileged key must never reach the browser. The `server-only` import
 * above turns an accidental client import into a build error.
 */

/**
 * Select the browser-safe Supabase key.
 *
 * New projects use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The legacy anon key
 * remains an accepted fallback while older environments are migrated.
 */
function getPublicSupabaseKey(
  env: Extract<
    ReturnType<typeof inspectServerEnv>,
    { ok: true }
  >["env"],
): string | null {
  return (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null
  );
}

/**
 * Select the privileged server-only Supabase key.
 *
 * New projects use `SUPABASE_SECRET_KEY`. The legacy service-role key remains
 * an accepted fallback for existing deployments.
 */
function getPrivilegedSupabaseKey(
  env: Extract<
    ReturnType<typeof inspectServerEnv>,
    { ok: true }
  >["env"],
): string | null {
  return (
    env.SUPABASE_SECRET_KEY ??
    env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}

/**
 * Create a client scoped to the current user's session.
 *
 * Returns null when Supabase is not configured, allowing local-development
 * callers to use their existing fallback instead of crashing.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
    return null;
  }

  const url =
    envResult.env.NEXT_PUBLIC_SUPABASE_URL;

  const key = getPublicSupabaseKey(
    envResult.env,
  );

  if (!url || !key) {
    return null;
  }

  const cookieStore =
    await cookies();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            for (const {
              name,
              value,
              options,
            } of cookiesToSet) {
              cookieStore.set(
                name,
                value,
                options,
              );
            }
          } catch {
            /*
             * Cookies cannot be written during a Server Component render.
             * Session refresh remains handled by proxy.ts, where cookies are
             * writable. Throwing here would break otherwise valid page renders.
             */
          }
        },
      },
    },
  );
}

/**
 * Create a privileged server client that bypasses row-level security.
 *
 * Every call site must be justifiable. When an operation can run as the signed-
 * in user, use `createServerSupabaseClient` so RLS remains active.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
    return null;
  }

  const url =
    envResult.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    getPrivilegedSupabaseKey(
      envResult.env,
    );

  if (!url || !key) {
    return null;
  }

  return createClient(
    url,
    key,
    {
      auth: {
        /*
         * This client represents the trusted Mabojolu server, not an end user.
         * It must never inherit, refresh, or persist a browser session.
         */
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
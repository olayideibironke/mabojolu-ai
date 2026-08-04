import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { inspectServerEnv } from "@/lib/env";

/**
 * Server-side Supabase clients.
 *
 * Two distinct clients, and the difference matters:
 *
 *   createServerSupabaseClient  Acts as the signed-in user. Every query is
 *                               filtered by row-level security. This is the
 *                               default for anything touching user data.
 *
 *   createServiceRoleClient     Bypasses row-level security completely. Used only
 *                               where an operation genuinely cannot run as the
 *                               user: writing usage and safety rows, and advancing
 *                               an attachment's processing status.
 *
 * The service-role key must never reach the browser. `server-only` above turns an
 * accidental client import into a build error rather than a silent leak.
 */

/**
 * A client scoped to the current user's session.
 *
 * Returns null when Supabase is not configured, so callers can fall back rather
 * than crash.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
    return null;
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } =
    envResult.env;

  if (!url || !key) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /*
           * Cookies cannot be written from a Server Component render. That is
           * expected and harmless here: token refresh is handled in proxy.ts,
           * which runs where cookies are writable. Throwing would break every
           * page render.
           */
        }
      },
    },
  });
}

/**
 * A client that bypasses row-level security.
 *
 * Every call site must be justifiable. If an operation can be performed as the
 * user, use `createServerSupabaseClient` instead, so RLS remains in force.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const envResult = inspectServerEnv();

  if (!envResult.ok) {
    return null;
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } =
    envResult.env;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      // No session handling: this client is not a user and must never pick up or
      // persist one.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

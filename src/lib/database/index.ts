import "server-only";

import { inspectServerEnv } from "@/lib/env";

import { LocalDatabaseAdapter } from "./local-adapter";
import { SupabaseDatabaseAdapter } from "./supabase-adapter";
import type { DatabaseAdapter } from "./types";

/**
 * Adapter selection.
 *
 * The one place that decides which backend is in use. Every caller depends on the
 * `DatabaseAdapter` interface, so switching backends is an environment change
 * rather than a code change.
 */

let cached: DatabaseAdapter | null = null;

export function getDatabase(): DatabaseAdapter {
  if (cached) {
    return cached;
  }

  const envResult = inspectServerEnv();

  // An invalid environment falls back to local rather than throwing, so a
  // misconfiguration surfaces as a clear error from the route that needs
  // Supabase instead of breaking unrelated pages. Production cannot reach this
  // path: env validation rejects `PERSISTENCE=local` there.
  const persistence = envResult.ok ? envResult.env.PERSISTENCE : "local";

  cached =
    persistence === "supabase"
      ? new SupabaseDatabaseAdapter()
      : new LocalDatabaseAdapter();

  return cached;
}

/** Test-only: clear the memoized adapter so a suite can vary the environment. */
export function resetDatabaseCache(): void {
  cached = null;
}

export type { DatabaseAdapter } from "./types";

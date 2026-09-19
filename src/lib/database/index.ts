import "server-only";

/*
 * Adds the secure billing methods to SupabaseDatabaseAdapter before the
 * database factory creates an adapter instance.
 */
import "./supabase-billing";
import "./supabase-plugins";

import { persistenceRuntimeMode } from "@/lib/runtime-mode";

import { LocalDatabaseAdapter } from "./local-adapter";
import { SupabaseDatabaseAdapter } from "./supabase-adapter";
import type { DatabaseAdapter } from "./types";

/**
 * Adapter selection.
 *
 * This is the single place that decides which persistence backend Mabojolu
 * uses. Every caller depends on DatabaseAdapter, so changing backends remains
 * an environment configuration decision rather than an application rewrite.
 */

let cached: DatabaseAdapter | null =
  null;

export function getDatabase(): DatabaseAdapter {
  if (cached) {
    return cached;
  }

  const persistence =
    persistenceRuntimeMode();

  const database: DatabaseAdapter =
    persistence === "supabase"
      ? new SupabaseDatabaseAdapter()
      : new LocalDatabaseAdapter();

  cached = database;

  return database;
}

/**
 * Test-only helper that permits a test suite to change environment settings
 * between cases.
 */
export function resetDatabaseCache(): void {
  cached = null;
}

export type {
  DatabaseAdapter,
} from "./types";
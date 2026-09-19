import "server-only";

export type AuthRuntimeMode =
  | "dev"
  | "supabase";

export type PersistenceRuntimeMode =
  | "local"
  | "supabase";

/**
 * Authentication mode is security-sensitive and must not be coupled to
 * unrelated AI/provider configuration validation.
 *
 * Production always uses Supabase auth. Development may opt into Supabase
 * explicitly; otherwise it uses the local development identities.
 */
export function authRuntimeMode():
  AuthRuntimeMode {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return "supabase";
  }

  return process.env.AUTH_MODE ===
    "supabase"
    ? "supabase"
    : "dev";
}

/**
 * Production persistence is always Supabase. Local JSON persistence is only
 * appropriate for development/test environments.
 */
export function persistenceRuntimeMode():
  PersistenceRuntimeMode {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return "supabase";
  }

  return process.env.PERSISTENCE ===
    "supabase"
    ? "supabase"
    : "local";
}

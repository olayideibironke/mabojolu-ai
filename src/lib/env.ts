import "server-only";

import { z } from "zod";

/**
 * Server environment contract.
 *
 * Every value here is server-only. Nothing in this module may be imported from
 * a Client Component: the `server-only` import above turns that mistake into a
 * build error instead of a leaked credential.
 *
 * Validation is lazy (see `serverEnv()`), so the application still builds and
 * runs in mock mode before any provider credential exists. A missing credential
 * must fail safely at request time with a useful message, not crash the build.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /**
   * Which provider the gateway talks to. `mock` needs no credential and is the
   * default so development and automated tests work with zero setup.
   */
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  /** Overrides the registry default model. Must be an id the registry knows. */
  MABOJOLU_DEFAULT_MODEL: z.string().min(1).optional(),

  /** Upper bound on generated tokens per response. */
  MABOJOLU_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8192),

  /** Provider request timeout in milliseconds. */
  MABOJOLU_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(120_000),

  /** Maximum characters accepted in a single user message. */
  MABOJOLU_MAX_MESSAGE_CHARS: z.coerce
    .number()
    .int()
    .positive()
    .default(32_000),

  /** Maximum messages accepted in one conversation request. */
  MABOJOLU_MAX_CONVERSATION_MESSAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(400),

  /** Token budget for reconstructed conversation context. */
  MABOJOLU_CONTEXT_TOKEN_BUDGET: z.coerce
    .number()
    .int()
    .positive()
    .default(120_000),

  /** Requests allowed per rate-limit window, per identity. */
  MABOJOLU_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),

  /** Rate-limit window length in milliseconds. */
  MABOJOLU_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),

  /**
   * Where conversations are stored.
   *
   *   local     JSON file under .mabojolu-data. No credentials. Development only.
   *   supabase  Postgres with row-level security. Requires the keys below.
   */
  PERSISTENCE: z.enum(["local", "supabase"]).default("local"),

  /**
   * How users authenticate.
   *
   *   dev       A fixed local identity, so ownership boundaries and per-user
   *             behaviour are exercisable without an auth provider. Refuses to
   *             run in production.
   *   supabase  Real email magic-link authentication.
   */
  AUTH_MODE: z.enum(["dev", "supabase"]).default("dev"),

  // Safe to expose to the browser. The anon key is protected by row-level
  // security, which is why RLS being correct is load-bearing.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  /**
   * Bypasses row-level security entirely.
   *
   * Server-only, and used only where an operation genuinely cannot be performed
   * as the user: writing usage and safety rows, and moving an attachment through
   * its processing lifecycle.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  /** Messages one user may send per day. */
  MABOJOLU_DAILY_MESSAGE_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(200),

  /** Generations one user may have running at once. */
  MABOJOLU_MAX_CONCURRENT_GENERATIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(2),

  /** Attachments one user may hold. */
  MABOJOLU_MAX_ATTACHMENTS_PER_USER: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(20),

  /** Largest accepted attachment, in bytes. Defaults to 10 MB. */
  MABOJOLU_MAX_ATTACHMENT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10_485_760),

  /**
   * Are attachment uploads enabled?
   *
   * Off by default. The architecture is complete and tested, but broad upload
   * access should be a deliberate decision made after the storage controls have
   * been verified against a real Supabase project.
   */
  MABOJOLU_ATTACHMENTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  /** Daily spend ceiling in USD. Zero disables the check. */
  MABOJOLU_DAILY_COST_LIMIT_USD: z.coerce.number().nonnegative().default(0),

  /** Serves a maintenance notice instead of chat. */
  MABOJOLU_MAINTENANCE_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationResult =
  | { ok: true; env: ServerEnv }
  | { ok: false; issues: string[] };

let cached: EnvValidationResult | null = null;

function validate(): EnvValidationResult {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }

  const env = parsed.data;
  const issues: string[] = [];

  // Cross-field rules the schema cannot express on its own.
  if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
    issues.push(
      "ANTHROPIC_API_KEY: required when AI_PROVIDER is \"anthropic\". " +
        "Create a key at https://platform.claude.com and add it to .env.local.",
    );
  }

  if (env.PERSISTENCE === "supabase") {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_URL: required when PERSISTENCE is "supabase". ' +
          "Find it in your Supabase project under Settings, then API.",
      );
    }
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY: required when PERSISTENCE is "supabase". ' +
          "Find it in your Supabase project under Settings, then API.",
      );
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      issues.push(
        'SUPABASE_SERVICE_ROLE_KEY: required when PERSISTENCE is "supabase", ' +
          "for server-side usage and safety writes. Keep it server-only.",
      );
    }
  }

  if (env.AUTH_MODE === "supabase" && !env.NEXT_PUBLIC_SUPABASE_URL) {
    issues.push(
      'NEXT_PUBLIC_SUPABASE_URL: required when AUTH_MODE is "supabase".',
    );
  }

  /*
   * Refuse to start in production with development stand-ins.
   *
   * This is the single most important cross-field rule here. Dev auth trusts a
   * cookie with no verification, and local persistence has no row-level
   * security. Shipping either to production would expose every user's
   * conversations, so a misconfigured deploy must fail loudly at boot rather
   * than serve traffic insecurely.
   */
  if (env.NODE_ENV === "production") {
    if (env.AUTH_MODE === "dev") {
      issues.push(
        'AUTH_MODE: "dev" cannot be used in production. It trusts an ' +
          'unverified cookie as identity. Set AUTH_MODE="supabase".',
      );
    }
    if (env.PERSISTENCE === "local") {
      issues.push(
        'PERSISTENCE: "local" cannot be used in production. It is a single ' +
          "JSON file with no row-level security and does not survive an " +
          'ephemeral filesystem. Set PERSISTENCE="supabase".',
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, env };
}

/**
 * Validated server environment, or a structured failure.
 *
 * Callers decide how to react. The chat route turns a failure into a
 * configuration error the user can act on; it never surfaces raw values.
 */
export function inspectServerEnv(): EnvValidationResult {
  cached ??= validate();
  return cached;
}

/**
 * Validated server environment, throwing when invalid.
 *
 * Use only where a failure genuinely cannot be handled locally.
 */
export function serverEnv(): ServerEnv {
  const result = inspectServerEnv();

  if (!result.ok) {
    throw new Error(
      `Invalid server environment:\n${result.issues.map((i) => `  - ${i}`).join("\n")}`,
    );
  }

  return result.env;
}

/** Test-only escape hatch so suites can vary the environment. */
export function resetServerEnvCache(): void {
  cached = null;
}

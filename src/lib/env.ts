import "server-only";

import { z } from "zod";

/**
 * Server environment contract.
 *
 * Every value here is server-only. Nothing in this module may be imported from
 * a Client Component. The `server-only` import above turns that mistake into a
 * build error instead of leaking private configuration.
 *
 * Validation is lazy through `serverEnv()`, so Mabojolu can still build and run
 * in mock mode before any cloud-provider credential exists.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /**
   * Which provider the gateway uses.
   *
   * mock:
   * Deterministic local responder for development and automated tests.
   *
   * ollama:
   * Real local AI running through the Ollama desktop service.
   *
   * anthropic:
   * Cloud AI requiring an Anthropic API key.
   */
  AI_PROVIDER: z
    .enum(["mock", "ollama", "anthropic"])
    .default("mock"),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  /**
   * Local Ollama HTTP endpoint.
   *
   * 127.0.0.1 is preferred over localhost because it avoids unnecessary
   * hostname-resolution differences between Windows environments.
   */
  OLLAMA_BASE_URL: z
    .string()
    .url()
    .default("http://127.0.0.1:11434"),

  /**
   * How long Ollama should keep the selected model loaded in memory after a
   * response. Ollama accepts values such as 5m, 30m, or 0.
   */
  OLLAMA_KEEP_ALIVE: z.string().min(1).default("5m"),

  /** Overrides the registry default model. Must be a known model id. */
  MABOJOLU_DEFAULT_MODEL: z.string().min(1).optional(),

  /** Upper bound on generated tokens per response. */
  MABOJOLU_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .positive()
    .default(8192),

  /** Provider request timeout in milliseconds. */
  MABOJOLU_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(120_000),

  /** Maximum characters accepted in one user message. */
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
  MABOJOLU_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .positive()
    .default(30),

  /** Rate-limit window length in milliseconds. */
  MABOJOLU_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),

  /**
   * Where conversations are stored.
   *
   * local:
   * JSON file under .mabojolu-data. Development only.
   *
   * supabase:
   * PostgreSQL with row-level security.
   */
  PERSISTENCE: z
    .enum(["local", "supabase"])
    .default("local"),

  /**
   * How users authenticate.
   *
   * dev:
   * Fixed local identities for development. Refuses to run in production.
   *
   * supabase:
   * Real Supabase authentication.
   */
  AUTH_MODE: z.enum(["dev", "supabase"]).default("dev"),

  // Safe to expose to the browser. The anon key is protected through RLS.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

  /**
   * Bypasses row-level security.
   *
   * This key must remain server-side and should be used only where an operation
   * genuinely cannot be performed as the authenticated user.
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
   * Whether attachment uploads are enabled.
   *
   * Disabled by default until production storage controls are verified.
   */
  MABOJOLU_ATTACHMENTS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  /** Daily cloud-provider spending ceiling. Zero disables the check. */
  MABOJOLU_DAILY_COST_LIMIT_USD: z.coerce
    .number()
    .nonnegative()
    .default(0),

  /** Serves a maintenance notice instead of starting chat generations. */
  MABOJOLU_MAINTENANCE_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvValidationResult =
  | {
      ok: true;
      env: ServerEnv;
    }
  | {
      ok: false;
      issues: string[];
    };

let cached: EnvValidationResult | null = null;

function validate(): EnvValidationResult {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) =>
          `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }

  const env = parsed.data;
  const issues: string[] = [];

  /*
   * Anthropic requires a credential. Ollama and mock mode do not require any
   * API key.
   */
  if (
    env.AI_PROVIDER === "anthropic" &&
    !env.ANTHROPIC_API_KEY
  ) {
    issues.push(
      'ANTHROPIC_API_KEY: required when AI_PROVIDER is "anthropic". ' +
        "Create an Anthropic API key and add it to .env.local.",
    );
  }

  if (env.PERSISTENCE === "supabase") {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_URL: required when PERSISTENCE is "supabase".',
      );
    }

    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY: required when PERSISTENCE is "supabase".',
      );
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      issues.push(
        'SUPABASE_SERVICE_ROLE_KEY: required when PERSISTENCE is "supabase". ' +
          "Keep this value server-only.",
      );
    }
  }

  if (
    env.AUTH_MODE === "supabase" &&
    !env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    issues.push(
      'NEXT_PUBLIC_SUPABASE_URL: required when AUTH_MODE is "supabase".',
    );
  }

  if (
    env.AUTH_MODE === "supabase" &&
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    issues.push(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY: required when AUTH_MODE is "supabase".',
    );
  }

  /*
   * Refuse to serve production traffic with development-only authentication or
   * local JSON persistence.
   */
  if (env.NODE_ENV === "production") {
    if (env.AUTH_MODE === "dev") {
      issues.push(
        'AUTH_MODE: "dev" cannot be used in production. Set AUTH_MODE="supabase".',
      );
    }

    if (env.PERSISTENCE === "local") {
      issues.push(
        'PERSISTENCE: "local" cannot be used in production. ' +
          'Set PERSISTENCE="supabase".',
      );
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  return {
    ok: true,
    env,
  };
}

/**
 * Return the validated server environment or a structured failure.
 *
 * Callers decide how to respond. Raw environment values are never exposed to
 * the browser.
 */
export function inspectServerEnv(): EnvValidationResult {
  cached ??= validate();

  return cached;
}

/**
 * Return the validated server environment and throw when it is invalid.
 *
 * Use only where a configuration failure cannot be handled locally.
 */
export function serverEnv(): ServerEnv {
  const result = inspectServerEnv();

  if (!result.ok) {
    throw new Error(
      `Invalid server environment:\n${result.issues
        .map((issue) => `  - ${issue}`)
        .join("\n")}`,
    );
  }

  return result.env;
}

/** Test-only escape hatch so suites can vary the environment. */
export function resetServerEnvCache(): void {
  cached = null;
}
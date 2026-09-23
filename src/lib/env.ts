import "server-only";

import { z } from "zod";

/**
 * Server environment contract.
 *
 * Every value here is server-only. Nothing in this module may be imported from
 * a Client Component. The `server-only` import above turns that mistake into a
 * build error instead of leaking private configuration.
 *
 * Validation is lazy through `serverEnv()`. Mabojolu is local-first: the
 * default real provider is Ollama and no cloud-provider credential is required.
 * Paid cloud providers must be enabled explicitly.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "test",
      "production",
    ])
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
    .enum([
      "mock",
      "ollama",
      "anthropic",
    ])
    .default("ollama"),

  /**
   * Paid external inference is disabled by default.
   *
   * This prevents an accidental configuration change from creating API usage.
   * Set true only when the operator intentionally wants an external paid
   * provider.
   */
  MABOJOLU_ALLOW_PAID_PROVIDERS:
    z.enum([
      "true",
      "false",
    ])
      .default("false")
      .transform(
        (value) =>
          value === "true",
      ),

  ANTHROPIC_API_KEY:
    z.string().min(1).optional(),

  /** Public Mabojolu origin used to construct OAuth callback URLs. */
  MABOJOLU_APP_URL:
    z.string().url().optional(),

  /**
   * Server-only secret used to encrypt connected-plugin access and refresh
   * tokens before persistence.
   */
  MABOJOLU_PLUGIN_ENCRYPTION_KEY:
    z.string().min(32).optional(),

  GOOGLE_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  GOOGLE_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  MICROSOFT_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  MICROSOFT_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  GITHUB_OAUTH_CLIENT_ID:
    z.string().min(1).optional(),

  GITHUB_OAUTH_CLIENT_SECRET:
    z.string().min(1).optional(),

  /**
   * Local Ollama HTTP endpoint.
   *
   * 127.0.0.1 is preferred over localhost because it avoids unnecessary
   * hostname-resolution differences between Windows environments.
   */
  OLLAMA_BASE_URL: z
    .string()
    .url()
    .default(
      "http://127.0.0.1:11434",
    ),

  /**
   * How long Ollama should keep the selected model loaded in memory after a
   * response. Ollama accepts values such as 5m, 30m, or 0.
   */
  OLLAMA_KEEP_ALIVE: z
    .string()
    .min(1)
    .default("5m"),

  /** Overrides the registry default model. Must be a known model id. */
  MABOJOLU_DEFAULT_MODEL:
    z.string().min(1).optional(),

  /** Upper bound on generated tokens per response. */
  MABOJOLU_MAX_OUTPUT_TOKENS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(8192),

  /** Provider request timeout in milliseconds. */
  MABOJOLU_REQUEST_TIMEOUT_MS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(120_000),

  /** Maximum characters accepted in one user message. */
  MABOJOLU_MAX_MESSAGE_CHARS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(32_000),

  /** Maximum messages accepted in one conversation request. */
  MABOJOLU_MAX_CONVERSATION_MESSAGES:
    z.coerce
      .number()
      .int()
      .positive()
      .default(400),

  /** Token budget for reconstructed conversation context. */
  MABOJOLU_CONTEXT_TOKEN_BUDGET:
    z.coerce
      .number()
      .int()
      .positive()
      .default(120_000),

  /** Requests allowed per rate-limit window, per identity. */
  MABOJOLU_RATE_LIMIT_MAX:
    z.coerce
      .number()
      .int()
      .positive()
      .default(30),

  /** Rate-limit window length in milliseconds. */
  MABOJOLU_RATE_LIMIT_WINDOW_MS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),

  /**
   * Local multimodal processing runtime.
   *
   * These are optional and never enable paid services. They locate free local
   * tools when the operator has installed them.
   */
  MABOJOLU_PYTHON_PATH:
    z.string()
      .min(1)
      .default("python"),

  MABOJOLU_FFMPEG_PATH:
    z.string()
      .min(1)
      .default("ffmpeg"),

  MABOJOLU_FFPROBE_PATH:
    z.string()
      .min(1)
      .default("ffprobe"),

  MABOJOLU_WHISPER_CLI_PATH:
    z.string()
      .min(1)
      .optional(),

  MABOJOLU_WHISPER_MODEL_PATH:
    z.string()
      .min(1)
      .optional(),

  MABOJOLU_COMFYUI_BASE_URL:
    z.string()
      .url()
      .default(
        "http://127.0.0.1:8188",
      ),

  MABOJOLU_COMFYUI_WORKFLOW_PATH:
    z.string()
      .min(1)
      .optional(),

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
    .enum([
      "local",
      "supabase",
    ])
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
  AUTH_MODE: z
    .enum([
      "dev",
      "supabase",
    ])
    .default("dev"),

  /**
   * Supabase project endpoint.
   *
   * Safe to expose to the browser because it identifies the project but does
   * not grant privileged access by itself.
   */
  NEXT_PUBLIC_SUPABASE_URL:
    z.string().url().optional(),

  /**
   * Current browser-safe Supabase API key.
   *
   * New Supabase projects use keys beginning with `sb_publishable_`. Access is
   * still restricted by the signed-in user's JWT and row-level security.
   */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    z.string().min(1).optional(),

  /**
   * Legacy browser-safe Supabase key.
   *
   * Retained temporarily so an older project can be migrated without breaking
   * its existing environment configuration.
   */
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    z.string().min(1).optional(),

  /**
   * Current privileged server-only Supabase API key.
   *
   * New Supabase projects use keys beginning with `sb_secret_`. This bypasses
   * row-level security and must never be exposed through a public variable,
   * browser bundle, screenshot, repository, or client component.
   */
  SUPABASE_SECRET_KEY:
    z.string().min(1).optional(),

  /**
   * Legacy privileged Supabase key.
   *
   * Retained temporarily for compatibility with projects that still use the
   * legacy `service_role` JWT.
   */
  SUPABASE_SERVICE_ROLE_KEY:
    z.string().min(1).optional(),

  /** Messages one user may send per day. */
  MABOJOLU_DAILY_MESSAGE_LIMIT:
    z.coerce
      .number()
      .int()
      .positive()
      .default(200),

  /** Generations one user may have running at once. */
  MABOJOLU_MAX_CONCURRENT_GENERATIONS:
    z.coerce
      .number()
      .int()
      .positive()
      .default(2),

  /** Attachments one user may hold. */
  MABOJOLU_MAX_ATTACHMENTS_PER_USER:
    z.coerce
      .number()
      .int()
      .nonnegative()
      .default(20),

  /** Largest accepted attachment, in bytes. Defaults to 10 MB. */
  MABOJOLU_MAX_ATTACHMENT_BYTES:
    z.coerce
      .number()
      .int()
      .positive()
      .default(10_485_760),

  /**
   * Larger bounded ceiling for uploaded audio and video.
   *
   * Media is processed from private storage and is never embedded directly into
   * the ordinary chat request body.
   */
  MABOJOLU_MAX_MEDIA_ATTACHMENT_BYTES:
    z.coerce
      .number()
      .int()
      .positive()
      .default(104_857_600),

  /**
   * Whether attachment uploads are enabled.
   *
   * Disabled by default until production storage controls are verified.
   */
  MABOJOLU_ATTACHMENTS_ENABLED:
    z.enum([
      "true",
      "false",
    ])
      .default("false")
      .transform(
        (value) =>
          value === "true",
      ),

  /** Daily cloud-provider spending ceiling. Zero disables the check. */
  MABOJOLU_DAILY_COST_LIMIT_USD:
    z.coerce
      .number()
      .nonnegative()
      .default(0),

  /** Serves a maintenance notice instead of starting chat generations. */
  MABOJOLU_MAINTENANCE_MODE:
    z.enum([
      "true",
      "false",
    ])
      .default("false")
      .transform(
        (value) =>
          value === "true",
      ),
});

export type ServerEnv =
  z.infer<
    typeof serverEnvSchema
  >;

export type EnvValidationResult =
  | {
      ok: true;
      env: ServerEnv;
    }
  | {
      ok: false;
      issues: string[];
    };

let cached:
  | EnvValidationResult
  | null = null;

function validate(): EnvValidationResult {
  const parsed =
    serverEnvSchema.safeParse(
      process.env,
    );

  if (!parsed.success) {
    return {
      ok: false,

      issues:
        parsed.error.issues.map(
          (issue) =>
            `${
              issue.path.join(".") ||
              "(root)"
            }: ${issue.message}`,
        ),
    };
  }

  const env = parsed.data;

  const issues: string[] = [];

  /*
   * Prefer the current Supabase keys. Legacy keys remain valid fallbacks while
   * existing projects are migrated.
   */
  const publicSupabaseKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const privilegedSupabaseKey =
    env.SUPABASE_SECRET_KEY ??
    env.SUPABASE_SERVICE_ROLE_KEY;

  /*
   * Local inference is the default. Paid external inference must be opted into
   * explicitly and then configured with its provider credential.
   */
  if (
    env.AI_PROVIDER ===
      "anthropic" &&
    !env.MABOJOLU_ALLOW_PAID_PROVIDERS
  ) {
    issues.push(
      'MABOJOLU_ALLOW_PAID_PROVIDERS: must be "true" before AI_PROVIDER can be set to "anthropic".',
    );
  }

  if (
    env.AI_PROVIDER ===
      "anthropic" &&
    !env.ANTHROPIC_API_KEY
  ) {
    issues.push(
      'ANTHROPIC_API_KEY: required when AI_PROVIDER is "anthropic". ' +
        "Create an Anthropic API key and add it to .env.local.",
    );
  }

  if (
    env.PERSISTENCE ===
    "supabase"
  ) {
    if (
      !env.NEXT_PUBLIC_SUPABASE_URL
    ) {
      issues.push(
        'NEXT_PUBLIC_SUPABASE_URL: required when PERSISTENCE is "supabase".',
      );
    }

    if (!publicSupabaseKey) {
      issues.push(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required when " +
          'PERSISTENCE is "supabase". A legacy ' +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted temporarily.",
      );
    }

    if (
      !privilegedSupabaseKey
    ) {
      issues.push(
        "SUPABASE_SECRET_KEY: required when PERSISTENCE is " +
          '"supabase". A legacy SUPABASE_SERVICE_ROLE_KEY is also ' +
          "accepted temporarily. Keep either value server-only.",
      );
    }
  }

  if (
    env.AUTH_MODE ===
      "supabase" &&
    !env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    issues.push(
      'NEXT_PUBLIC_SUPABASE_URL: required when AUTH_MODE is "supabase".',
    );
  }

  if (
    env.AUTH_MODE ===
      "supabase" &&
    !publicSupabaseKey
  ) {
    issues.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required when " +
        'AUTH_MODE is "supabase". A legacy ' +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted temporarily.",
    );
  }

  /*
   * Refuse to serve production traffic with development-only authentication or
   * local JSON persistence.
   */
  if (
    env.NODE_ENV ===
    "production"
  ) {
    if (
      env.AUTH_MODE === "dev"
    ) {
      issues.push(
        'AUTH_MODE: "dev" cannot be used in production. ' +
          'Set AUTH_MODE="supabase".',
      );
    }

    if (
      env.PERSISTENCE ===
      "local"
    ) {
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
  const result =
    inspectServerEnv();

  if (!result.ok) {
    throw new Error(
      `Invalid server environment:\n${result.issues
        .map(
          (issue) =>
            `  - ${issue}`,
        )
        .join("\n")}`,
    );
  }

  return result.env;
}

/** Test-only escape hatch so suites can vary the environment. */
export function resetServerEnvCache(): void {
  cached = null;
}
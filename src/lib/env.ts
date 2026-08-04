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

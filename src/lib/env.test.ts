import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { inspectServerEnv, resetServerEnvCache } from "./env";

/**
 * Environment validation must fail safely and specifically: a missing credential
 * should name the variable, not crash the process or silently start in the wrong
 * provider mode.
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  resetServerEnvCache();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetServerEnvCache();
});

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetServerEnvCache();
}

describe("inspectServerEnv", () => {
  it("defaults to local Ollama so Mabojolu needs no paid provider credential", () => {
    setEnv({
      AI_PROVIDER: undefined,
      ANTHROPIC_API_KEY: undefined,
      MABOJOLU_ALLOW_PAID_PROVIDERS: undefined,
    });

    const result = inspectServerEnv();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.AI_PROVIDER).toBe("ollama");
      expect(result.env.MABOJOLU_ALLOW_PAID_PROVIDERS).toBe(false);
    }
  });

  it("refuses a paid provider unless paid inference is explicitly enabled", () => {
    setEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      MABOJOLU_ALLOW_PAID_PROVIDERS: undefined,
    });

    const result = inspectServerEnv();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(" ")).toMatch(/MABOJOLU_ALLOW_PAID_PROVIDERS/);
    }
  });

  it("reports a missing credential after paid inference is explicitly enabled", () => {
    setEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: undefined,
      MABOJOLU_ALLOW_PAID_PROVIDERS: "true",
    });

    const result = inspectServerEnv();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(" ")).toMatch(/ANTHROPIC_API_KEY/);
      expect(result.issues.join(" ")).toMatch(/\.env\.local/);
    }
  });

  it("accepts Anthropic only when both paid inference and its credential are explicit", () => {
    setEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
      MABOJOLU_ALLOW_PAID_PROVIDERS: "true",
    });

    expect(inspectServerEnv().ok).toBe(true);
  });

  it("accepts Ollama without any external API credential", () => {
    setEnv({
      AI_PROVIDER: "ollama",
      ANTHROPIC_API_KEY: undefined,
      MABOJOLU_ALLOW_PAID_PROVIDERS: "false",
    });

    expect(inspectServerEnv().ok).toBe(true);
  });

  it("rejects an unknown provider rather than falling back silently", () => {
    // A typo must not quietly route traffic somewhere unintended.
    setEnv({ AI_PROVIDER: "openai" });

    expect(inspectServerEnv().ok).toBe(false);
  });

  it("coerces numeric limits from strings", () => {
    setEnv({ AI_PROVIDER: "mock", MABOJOLU_RATE_LIMIT_MAX: "5" });

    const result = inspectServerEnv();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.MABOJOLU_RATE_LIMIT_MAX).toBe(5);
    }
  });

  it("rejects a non-positive limit", () => {
    setEnv({ AI_PROVIDER: "mock", MABOJOLU_RATE_LIMIT_MAX: "0" });

    expect(inspectServerEnv().ok).toBe(false);
  });

  it("rejects a non-numeric limit", () => {
    setEnv({ AI_PROVIDER: "mock", MABOJOLU_MAX_OUTPUT_TOKENS: "lots" });

    expect(inspectServerEnv().ok).toBe(false);
  });

  it("returns a result rather than throwing on invalid configuration", () => {
    // The chat route relies on this to answer with a clear error instead of
    // returning a 500 with a stack trace.
    setEnv({
      AI_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: undefined,
      MABOJOLU_ALLOW_PAID_PROVIDERS: "true",
    });

    expect(() => inspectServerEnv()).not.toThrow();
  });
});

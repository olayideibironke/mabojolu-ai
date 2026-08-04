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
  it("defaults to the mock provider so development needs no credential", () => {
    setEnv({ AI_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined });

    const result = inspectServerEnv();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.AI_PROVIDER).toBe("mock");
    }
  });

  it("reports a missing credential when the Anthropic provider is selected", () => {
    setEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: undefined });

    const result = inspectServerEnv();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The message has to name the variable and where to get it, or the
      // operator cannot act on it.
      expect(result.issues.join(" ")).toMatch(/ANTHROPIC_API_KEY/);
      expect(result.issues.join(" ")).toMatch(/\.env\.local/);
    }
  });

  it("accepts the Anthropic provider once a credential is present", () => {
    setEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test" });

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
    setEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: undefined });

    expect(() => inspectServerEnv()).not.toThrow();
  });
});

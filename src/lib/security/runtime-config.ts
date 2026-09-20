import "server-only";

export interface UsageRuntimeConfig {
  maintenanceMode:
    boolean;

  maxConcurrentGenerations:
    number;

  dailyMessageLimit:
    number;

  dailyCostLimitUsd:
    number;

  rateLimitMax:
    number;

  rateLimitWindowMs:
    number;
}

function positiveInteger(
  value:
    string |
    undefined,

  fallback:
    number,
):
  number {
  const parsed =
    Number(value);

  return (
    Number.isSafeInteger(
      parsed,
    ) &&
    parsed > 0
  )
    ? parsed
    : fallback;
}

function nonnegativeNumber(
  value:
    string |
    undefined,

  fallback:
    number,
):
  number {
  const parsed =
    Number(value);

  return (
    Number.isFinite(
      parsed,
    ) &&
    parsed >= 0
  )
    ? parsed
    : fallback;
}

function booleanValue(
  value:
    string |
    undefined,

  fallback:
    boolean,
):
  boolean {
  if (
    value === "true"
  ) {
    return true;
  }

  if (
    value === "false"
  ) {
    return false;
  }

  return fallback;
}

/**
 * Security and usage controls that must stay available even when an unrelated
 * AI provider is intentionally disabled or misconfigured.
 *
 * Browser-owned inference does not require Anthropic, Ollama, or any other
 * generation provider, so its persistence/control plane must never depend on
 * global provider validation.
 */
export function usageRuntimeConfig():
  UsageRuntimeConfig {
  return {
    maintenanceMode:
      booleanValue(
        process.env
          .MABOJOLU_MAINTENANCE_MODE,
        false,
      ),

    maxConcurrentGenerations:
      positiveInteger(
        process.env
          .MABOJOLU_MAX_CONCURRENT_GENERATIONS,
        2,
      ),

    dailyMessageLimit:
      positiveInteger(
        process.env
          .MABOJOLU_DAILY_MESSAGE_LIMIT,
        200,
      ),

    dailyCostLimitUsd:
      nonnegativeNumber(
        process.env
          .MABOJOLU_DAILY_COST_LIMIT_USD,
        0,
      ),

    rateLimitMax:
      positiveInteger(
        process.env
          .MABOJOLU_RATE_LIMIT_MAX,
        30,
      ),

    rateLimitWindowMs:
      positiveInteger(
        process.env
          .MABOJOLU_RATE_LIMIT_WINDOW_MS,
        60_000,
      ),
  };
}

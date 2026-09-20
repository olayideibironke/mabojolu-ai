import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  usageRuntimeConfig,
} from "./runtime-config";

describe(
  "usage runtime configuration",
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it(
      "uses safe defaults without any AI provider configuration",
      () => {
        vi.stubEnv(
          "AI_PROVIDER",
          "anthropic",
        );

        vi.stubEnv(
          "MABOJOLU_ALLOW_PAID_PROVIDERS",
          "false",
        );

        expect(
          usageRuntimeConfig(),
        ).toEqual({
          maintenanceMode:
            false,
          maxConcurrentGenerations:
            2,
          dailyMessageLimit:
            200,
          dailyCostLimitUsd:
            0,
          rateLimitMax:
            30,
          rateLimitWindowMs:
            60_000,
        });
      },
    );

    it(
      "honors explicit security and quota controls",
      () => {
        vi.stubEnv(
          "MABOJOLU_MAINTENANCE_MODE",
          "true",
        );
        vi.stubEnv(
          "MABOJOLU_MAX_CONCURRENT_GENERATIONS",
          "3",
        );
        vi.stubEnv(
          "MABOJOLU_DAILY_MESSAGE_LIMIT",
          "75",
        );
        vi.stubEnv(
          "MABOJOLU_DAILY_COST_LIMIT_USD",
          "4.5",
        );
        vi.stubEnv(
          "MABOJOLU_RATE_LIMIT_MAX",
          "12",
        );
        vi.stubEnv(
          "MABOJOLU_RATE_LIMIT_WINDOW_MS",
          "45000",
        );

        expect(
          usageRuntimeConfig(),
        ).toEqual({
          maintenanceMode:
            true,
          maxConcurrentGenerations:
            3,
          dailyMessageLimit:
            75,
          dailyCostLimitUsd:
            4.5,
          rateLimitMax:
            12,
          rateLimitWindowMs:
            45_000,
        });
      },
    );

    it(
      "falls back safely when numeric controls are invalid",
      () => {
        vi.stubEnv(
          "MABOJOLU_MAX_CONCURRENT_GENERATIONS",
          "0",
        );
        vi.stubEnv(
          "MABOJOLU_DAILY_MESSAGE_LIMIT",
          "-1",
        );
        vi.stubEnv(
          "MABOJOLU_DAILY_COST_LIMIT_USD",
          "-10",
        );
        vi.stubEnv(
          "MABOJOLU_RATE_LIMIT_MAX",
          "not-a-number",
        );

        const config =
          usageRuntimeConfig();

        expect(
          config
            .maxConcurrentGenerations,
        ).toBe(2);

        expect(
          config
            .dailyMessageLimit,
        ).toBe(200);

        expect(
          config
            .dailyCostLimitUsd,
        ).toBe(0);

        expect(
          config
            .rateLimitMax,
        ).toBe(30);
      },
    );
  },
);

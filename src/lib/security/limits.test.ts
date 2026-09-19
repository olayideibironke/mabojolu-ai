import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  Session,
} from "@/lib/auth/session";

const mocks =
  vi.hoisted(
    () => {
      const database = {
        countRecentMessages:
          vi.fn(),

        recordSafetyEvent:
          vi.fn(),

        getBillingAccount:
          vi.fn(),

        getAdminMetrics:
          vi.fn(),
      };

      const env = {
        MABOJOLU_MAINTENANCE_MODE:
          false,

        MABOJOLU_MAX_CONCURRENT_GENERATIONS:
          2,

        MABOJOLU_DAILY_MESSAGE_LIMIT:
          200,

        MABOJOLU_DAILY_COST_LIMIT_USD:
          0,
      };

      return {
        database,
        env,
      };
    },
  );

vi.mock(
  "@/lib/database",
  () => ({
    getDatabase:
      () =>
        mocks.database,
  }),
);

vi.mock(
  "@/lib/env",
  () => ({
    serverEnv:
      () =>
        mocks.env,
  }),
);

import {
  checkUsageLimits,
  resetGenerationTracking,
} from "./limits";

function session(input: {
  anonymous?:
    boolean;

  admin?:
    boolean;
} = {}):
  Session {
  const admin =
    input.admin ??
    false;

  const anonymous =
    input.anonymous ??
    false;

  return {
    userId:
      "user-1",

    email:
      anonymous
        ? ""
        : "user@example.com",

    profile: {
      id:
        "user-1",

      email:
        anonymous
          ? "guest@example.invalid"
          : "user@example.com",

      displayName:
        null,

      role:
        admin
          ? "admin"
          : "user",

      createdAt:
        "2026-09-19T12:00:00.000Z",
    },

    kind:
      admin
        ? "admin"
        : anonymous
          ? "guest"
          : "user",

    isAnonymous:
      anonymous,
  };
}

function proAccount(
  overrides:
    Record<
      string,
      unknown
    > = {},
) {
  return {
    userId:
      "user-1",

    planId:
      "pro",

    subscriptionStatus:
      "active",

    stripeCustomerId:
      "cus_test",

    stripeSubscriptionId:
      "sub_test",

    currentPeriodStart:
      "2026-09-01T00:00:00.000Z",

    currentPeriodEnd:
      "2026-10-01T00:00:00.000Z",

    includedUsageMicros:
      0,

    usedUsageMicros:
      0,

    prepaidBalanceMicros:
      0,

    createdAt:
      "2026-09-01T00:00:00.000Z",

    updatedAt:
      "2026-09-19T00:00:00.000Z",

    ...overrides,
  };
}

beforeEach(
  () => {
    resetGenerationTracking();

    vi.useFakeTimers();

    vi.setSystemTime(
      new Date(
        "2026-09-19T16:00:00.000Z",
      ),
    );

    mocks
      .database
      .countRecentMessages
      .mockReset();

    mocks
      .database
      .recordSafetyEvent
      .mockReset()
      .mockResolvedValue(
        undefined,
      );

    mocks
      .database
      .getBillingAccount
      .mockReset()
      .mockResolvedValue(
        null,
      );

    mocks
      .database
      .getAdminMetrics
      .mockReset()
      .mockResolvedValue({
        usageByModel: [],
      });

    mocks.env
      .MABOJOLU_MAINTENANCE_MODE =
      false;

    mocks.env
      .MABOJOLU_MAX_CONCURRENT_GENERATIONS =
      2;

    mocks.env
      .MABOJOLU_DAILY_MESSAGE_LIMIT =
      200;

    mocks.env
      .MABOJOLU_DAILY_COST_LIMIT_USD =
      0;
  },
);

afterEach(
  () => {
    resetGenerationTracking();

    vi.useRealTimers();
  },
);

describe(
  "Mabojolu backend usage limits",
  () => {
    it(
      "allows a guest through response nine and blocks response eleven after ten completions",
      async () => {
        mocks
          .database
          .countRecentMessages
          .mockResolvedValueOnce(
            9,
          );

        expect(
          (
            await checkUsageLimits(
              session({
                anonymous:
                  true,
              }),
            )
          ).allowed,
        ).toBe(true);

        mocks
          .database
          .countRecentMessages
          .mockResolvedValueOnce(
            10,
          );

        const blocked =
          await checkUsageLimits(
            session({
              anonymous:
                true,
            }),
          );

        expect(
          blocked.allowed,
        ).toBe(false);

        expect(
          blocked.error
            ?.code,
        ).toBe(
          "forbidden",
        );

        expect(
          blocked.error
            ?.message,
        ).toContain(
          "10 free Mabojolu responses",
        );
      },
    );

    it(
      "allows nineteen signed-in free responses and blocks after twenty inside four hours",
      async () => {
        mocks
          .database
          .countRecentMessages
          .mockResolvedValueOnce(
            19,
          )
          .mockResolvedValueOnce(
            19,
          );

        const allowed =
          await checkUsageLimits(
            session(),
          );

        expect(
          allowed.allowed,
        ).toBe(true);

        expect(
          mocks
            .database
            .countRecentMessages
            .mock
            .calls[0]?.[1],
        ).toBe(
          "2026-09-19T12:00:00.000Z",
        );

        mocks
          .database
          .countRecentMessages
          .mockReset()
          .mockResolvedValueOnce(
            20,
          );

        const blocked =
          await checkUsageLimits(
            session(),
          );

        expect(
          blocked.allowed,
        ).toBe(false);

        expect(
          blocked.error
            ?.code,
        ).toBe(
          "rate_limited",
        );

        expect(
          blocked.error
            ?.retryAfterSeconds,
        ).toBe(
          4 * 60 * 60,
        );

        expect(
          blocked.error
            ?.message,
        ).toContain(
          "20 free Mabojolu responses",
        );

        expect(
          blocked.error
            ?.message,
        ).toContain(
          "upgrade to Pro",
        );
      },
    );

    it(
      "lets an active Pro account bypass free and daily personal quotas",
      async () => {
        mocks
          .database
          .getBillingAccount
          .mockResolvedValue(
            proAccount(),
          );

        mocks
          .database
          .countRecentMessages
          .mockResolvedValue(
            999,
          );

        const decision =
          await checkUsageLimits(
            session(),
          );

        expect(
          decision.allowed,
        ).toBe(true);

        expect(
          mocks
            .database
            .countRecentMessages,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "does not treat an expired Pro period as active access",
      async () => {
        mocks
          .database
          .getBillingAccount
          .mockResolvedValue(
            proAccount({
              currentPeriodEnd:
                "2026-09-19T15:59:59.000Z",
            }),
          );

        mocks
          .database
          .countRecentMessages
          .mockResolvedValueOnce(
            20,
          );

        const decision =
          await checkUsageLimits(
            session(),
          );

        expect(
          decision.allowed,
        ).toBe(false);

        expect(
          decision.error
            ?.code,
        ).toBe(
          "rate_limited",
        );
      },
    );

    it(
      "can skip only the global provider-spend ceiling for browser-owned inference",
      async () => {
        mocks.env
          .MABOJOLU_DAILY_COST_LIMIT_USD =
          5;

        mocks
          .database
          .countRecentMessages
          .mockResolvedValueOnce(
            0,
          )
          .mockResolvedValueOnce(
            0,
          );

        mocks
          .database
          .getAdminMetrics
          .mockResolvedValue({
            usageByModel: [
              {
                estimatedCostUsd:
                  10,
              },
            ],
          });

        const browserDecision =
          await checkUsageLimits(
            session(),
            {
              enforceProviderCostCeiling:
                false,
            },
          );

        expect(
          browserDecision.allowed,
        ).toBe(true);

        expect(
          mocks
            .database
            .getAdminMetrics,
        ).not.toHaveBeenCalled();

        mocks
          .database
          .countRecentMessages
          .mockReset()
          .mockResolvedValueOnce(
            0,
          )
          .mockResolvedValueOnce(
            0,
          );

        const serverDecision =
          await checkUsageLimits(
            session(),
          );

        expect(
          serverDecision.allowed,
        ).toBe(false);

        expect(
          serverDecision.error
            ?.code,
        ).toBe(
          "provider_unavailable",
        );
      },
    );
  },
);

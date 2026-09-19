import {
  describe,
  expect,
  it,
} from "vitest";

import {
  FREE_WINDOW_HOURS,
  FREE_WINDOW_MESSAGE_LIMIT,
  GUEST_TOTAL_MESSAGE_LIMIT,
  freeLimitMessage,
  freeWindowStartIso,
  guestLimitMessage,
  hasActiveProAccess,
  registeredFreeWindowStartIso,
} from "./usage-policy";

import type {
  BillingAccount,
} from "@/lib/database/types";

function account(
  overrides:
    Partial<
      BillingAccount
    > = {},
): BillingAccount {
  return {
    userId:
      "user-1",

    planId:
      "none",

    subscriptionStatus:
      "none",

    stripeCustomerId:
      null,

    stripeSubscriptionId:
      null,

    currentPeriodStart:
      null,

    currentPeriodEnd:
      null,

    includedUsageMicros:
      0,

    usedUsageMicros:
      0,

    prepaidBalanceMicros:
      0,

    createdAt:
      "2026-09-19T12:00:00.000Z",

    updatedAt:
      "2026-09-19T12:00:00.000Z",

    ...overrides,
  };
}

describe(
  "Mabojolu 10-20-4 usage policy",
  () => {
    it(
      "uses ten guest responses and twenty registered responses per four-hour window",
      () => {
        expect(
          GUEST_TOTAL_MESSAGE_LIMIT,
        ).toBe(10);

        expect(
          FREE_WINDOW_MESSAGE_LIMIT,
        ).toBe(20);

        expect(
          FREE_WINDOW_HOURS,
        ).toBe(4);
      },
    );

    it(
      "computes the rolling free window from four hours earlier",
      () => {
        const now =
          Date.parse(
            "2026-09-19T16:00:00.000Z",
          );

        expect(
          freeWindowStartIso(
            now,
          ),
        ).toBe(
          "2026-09-19T12:00:00.000Z",
        );
      },
    );

    it(
      "starts a newly registered user's free window at trusted account confirmation",
      () => {
        const now =
          Date.parse(
            "2026-09-19T16:00:00.000Z",
          );

        expect(
          registeredFreeWindowStartIso(
            "2026-09-19T15:55:00.000Z",
            now,
          ),
        ).toBe(
          "2026-09-19T15:55:00.000Z",
        );

        expect(
          registeredFreeWindowStartIso(
            "2026-09-19T08:00:00.000Z",
            now,
          ),
        ).toBe(
          "2026-09-19T12:00:00.000Z",
        );
      },
    );

    it(
      "recognizes only active or trialing Pro access",
      () => {
        const now =
          Date.parse(
            "2026-09-19T16:00:00.000Z",
          );

        expect(
          hasActiveProAccess(
            account({
              planId:
                "pro",

              subscriptionStatus:
                "active",

              currentPeriodEnd:
                "2026-10-19T16:00:00.000Z",
            }),

            now,
          ),
        ).toBe(true);

        expect(
          hasActiveProAccess(
            account({
              planId:
                "pro",

              subscriptionStatus:
                "trialing",

              currentPeriodEnd:
                null,
            }),

            now,
          ),
        ).toBe(true);

        expect(
          hasActiveProAccess(
            account({
              planId:
                "pro",

              subscriptionStatus:
                "canceled",
            }),

            now,
          ),
        ).toBe(false);

        expect(
          hasActiveProAccess(
            account({
              planId:
                "plus",

              subscriptionStatus:
                "active",
            }),

            now,
          ),
        ).toBe(false);

        expect(
          hasActiveProAccess(
            account({
              planId:
                "pro",

              subscriptionStatus:
                "active",

              currentPeriodEnd:
                "2026-09-19T15:59:59.000Z",
            }),

            now,
          ),
        ).toBe(false);
      },
    );

    it(
      "keeps the guest and free-limit copy aligned with the product behavior",
      () => {
        expect(
          guestLimitMessage(),
        ).toContain(
          "10 free Mabojolu responses",
        );

        expect(
          freeLimitMessage(),
        ).toContain(
          "20 free Mabojolu responses",
        );

        expect(
          freeLimitMessage(),
        ).toContain(
          "4 hours",
        );

        expect(
          freeLimitMessage(),
        ).toContain(
          "upgrade to Pro",
        );
      },
    );
  },
);

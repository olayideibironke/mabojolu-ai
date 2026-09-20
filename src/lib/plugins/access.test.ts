import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Session,
} from "@/lib/auth/session";
import type {
  BillingAccount,
} from "@/lib/database/types";

import {
  hasPluginAccess,
} from "./access";

function session(
  role:
    "user" |
    "admin" =
      "user",
):
  Session {
  return {
    userId:
      "00000000-0000-4000-8000-000000000001",

    email:
      "user@example.com",

    profile: {
      id:
        "00000000-0000-4000-8000-000000000001",
      email:
        "user@example.com",
      displayName:
        "User",
      role,
      createdAt:
        "2026-09-20T00:00:00.000Z",
    },

    kind:
      role ===
        "admin"
        ? "admin"
        : "user",

    isAnonymous:
      false,

    registeredAt:
      "2026-09-20T00:00:00.000Z",
  };
}

function activeAccount():
  BillingAccount {
  return {
    userId:
      "00000000-0000-4000-8000-000000000001",

    planId:
      "plus",

    subscriptionStatus:
      "active",

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
      "2026-09-20T00:00:00.000Z",

    updatedAt:
      "2026-09-20T00:00:00.000Z",
  };
}

describe(
  "plugin access tiers",
  () => {
    it(
      "allows free developer plugins without billing",
      () => {
        expect(
          hasPluginAccess(
            session(),
            null,
            "github",
          ),
        ).toBe(true);

        expect(
          hasPluginAccess(
            session(),
            null,
            "vercel",
          ),
        ).toBe(true);
      },
    );

    it(
      "keeps premium workspace plugins behind paid access",
      () => {
        expect(
          hasPluginAccess(
            session(),
            null,
            "google-calendar",
          ),
        ).toBe(false);

        expect(
          hasPluginAccess(
            session(),
            activeAccount(),
            "google-calendar",
          ),
        ).toBe(true);
      },
    );

    it(
      "keeps admin access to premium plugins",
      () => {
        expect(
          hasPluginAccess(
            session(
              "admin",
            ),
            null,
            "microsoft",
          ),
        ).toBe(true);
      },
    );
  },
);

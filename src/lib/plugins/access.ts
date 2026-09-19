import "server-only";

import type {
  Session,
} from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import type {
  BillingAccount,
} from "@/lib/database/types";

export function hasPaidPluginAccess(
  session:
    Session,

  account:
    BillingAccount |
    null,
):
  boolean {
  if (
    session.profile.role ===
      "admin"
  ) {
    return true;
  }

  return Boolean(
    account &&
    account.planId !==
      "none" &&
    (
      account.subscriptionStatus ===
        "active" ||
      account.subscriptionStatus ===
        "trialing"
    ),
  );
}

export async function resolvePluginAccess(
  session:
    Session,
): Promise<{
  account:
    BillingAccount |
    null;

  allowed:
    boolean;
}> {
  const account =
    await getDatabase()
      .getBillingAccount(
        session.userId,
      );

  return {
    account,

    allowed:
      hasPaidPluginAccess(
        session,
        account,
      ),
  };
}

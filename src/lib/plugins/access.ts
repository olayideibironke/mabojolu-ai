import "server-only";

import type {
  Session,
} from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import type {
  BillingAccount,
} from "@/lib/database/types";

import {
  getPluginProvider,
  type PluginProviderId,
} from "./registry";

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

export function hasPluginAccess(
  session:
    Session,

  account:
    BillingAccount |
    null,

  providerId:
    PluginProviderId,
):
  boolean {
  const provider =
    getPluginProvider(
      providerId,
    );

  if (
    provider.accessTier ===
      "free"
  ) {
    return true;
  }

  return hasPaidPluginAccess(
    session,
    account,
  );
}

export async function resolvePluginAccess(
  session:
    Session,

  providerId?:
    PluginProviderId,
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
      providerId
        ? hasPluginAccess(
            session,
            account,
            providerId,
          )
        : hasPaidPluginAccess(
            session,
            account,
          ),
  };
}

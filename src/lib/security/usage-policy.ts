import type {
  BillingAccount,
} from "@/lib/database/types";

export const GUEST_TOTAL_MESSAGE_LIMIT =
  10;

export const FREE_WINDOW_MESSAGE_LIMIT =
  20;

export const FREE_WINDOW_HOURS =
  4;

export const HOUR_MS =
  60 * 60 * 1_000;

export function freeWindowStartIso(
  nowMs:
    number = Date.now(),
): string {
  return new Date(
    nowMs -
      FREE_WINDOW_HOURS *
        HOUR_MS,
  ).toISOString();
}

export function hasActiveProAccess(
  account:
    BillingAccount |
    null,

  nowMs:
    number = Date.now(),
): boolean {
  if (
    !account ||
    account.planId !==
      "pro"
  ) {
    return false;
  }

  if (
    account.subscriptionStatus !==
      "active" &&
    account.subscriptionStatus !==
      "trialing"
  ) {
    return false;
  }

  if (
    !account.currentPeriodEnd
  ) {
    return true;
  }

  const periodEnd =
    Date.parse(
      account.currentPeriodEnd,
    );

  return (
    Number.isFinite(
      periodEnd,
    ) &&
    periodEnd >
      nowMs
  );
}

export function freeLimitMessage():
  string {
  return (
    "You've used your 20 free Mabojolu responses for now. " +
    "Your free access refreshes over the next 4 hours. " +
    "You can wait and continue for free, or upgrade to Pro for expanded access without the free waiting period."
  );
}

export function guestLimitMessage():
  string {
  return (
    "You've used your 10 free Mabojolu responses. " +
    "Create a free account to continue, save your chats, and access them on any device."
  );
}

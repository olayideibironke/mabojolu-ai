import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceRoleClient } from "@/lib/auth/supabase-server";

import { SupabaseDatabaseAdapter } from "./supabase-adapter";
import type {
  AddPrepaidCreditInput,
  BillingAccount,
  BillingUsageReservation,
  ReserveBillingUsageInput,
  SettleBillingUsageInput,
  UpdateBillingSubscriptionInput,
} from "./types";

/**
 * Supabase billing persistence.
 *
 * Billing tables and RPCs are accessed only through the service role. A browser
 * or ordinary authenticated account must never be able to grant credit, alter
 * a subscription, or forge billable usage.
 *
 * This module adds billing behavior to the existing Supabase adapter without
 * disturbing its working conversation, attachment, administration, and account
 * deletion behavior.
 */
declare module "./supabase-adapter" {
  interface SupabaseDatabaseAdapter {
    getBillingAccount(
      userId: string,
    ): Promise<BillingAccount | null>;

    ensureBillingAccount(
      userId: string,
    ): Promise<BillingAccount>;

    reserveBillingUsage(
      input: ReserveBillingUsageInput,
    ): Promise<BillingUsageReservation | null>;

    settleBillingUsage(
      input: SettleBillingUsageInput,
    ): Promise<boolean>;

    releaseBillingUsage(
      reservationId: string,
      userId: string,
    ): Promise<boolean>;

    updateBillingSubscription(
      input: UpdateBillingSubscriptionInput,
    ): Promise<BillingAccount>;

    addPrepaidCredit(
      input: AddPrepaidCreditInput,
    ): Promise<BillingAccount>;
  }
}

const BILLING_ACCOUNT_COLUMNS =
  "user_id, plan_id, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, included_usage_micros, used_usage_micros, prepaid_balance_micros, created_at, updated_at";

interface BillingAccountRow {
  user_id: string;
  plan_id: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  included_usage_micros: number | string;
  used_usage_micros: number | string;
  prepaid_balance_micros: number | string;
  created_at: string;
  updated_at: string;
}

interface BillingReservationRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  model_id: string;
  funding_source: string;
  reserved_micros: number | string;
  actual_micros:
    | number
    | string
    | null;
  status: string;
  created_at: string;
  settled_at: string | null;
}

function serviceClient(): SupabaseClient {
  const client =
    createServiceRoleClient();

  if (!client) {
    throw new Error(
      "Supabase service role is not configured.",
    );
  }

  return client;
}

SupabaseDatabaseAdapter.prototype.getBillingAccount =
  async function getBillingAccount(
    userId: string,
  ): Promise<BillingAccount | null> {
    const {
      data,
      error,
    } = await serviceClient()
      .from("billing_accounts")
      .select(
        BILLING_ACCOUNT_COLUMNS,
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `Could not read billing account: ${error.message}`,
      );
    }

    return data
      ? toBillingAccount(
          data as BillingAccountRow,
        )
      : null;
  };

SupabaseDatabaseAdapter.prototype.ensureBillingAccount =
  async function ensureBillingAccount(
    userId: string,
  ): Promise<BillingAccount> {
    const client =
      serviceClient();

    const {
      error,
    } = await client
      .from("billing_accounts")
      .upsert(
        {
          user_id: userId,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      throw new Error(
        `Could not ensure billing account: ${error.message}`,
      );
    }

    const {
      data,
      error: readError,
    } = await client
      .from("billing_accounts")
      .select(
        BILLING_ACCOUNT_COLUMNS,
      )
      .eq(
        "user_id",
        userId,
      )
      .single();

    if (
      readError ||
      !data
    ) {
      throw new Error(
        `Billing account was not created: ${
          readError?.message ??
          "unknown"
        }`,
      );
    }

    return toBillingAccount(
      data as BillingAccountRow,
    );
  };

SupabaseDatabaseAdapter.prototype.reserveBillingUsage =
  async function reserveBillingUsage(
    input: ReserveBillingUsageInput,
  ): Promise<BillingUsageReservation | null> {
    assertPositiveMicros(
      input.amountMicros,
      "Reservation amount",
    );

    const {
      data,
      error,
    } = await serviceClient().rpc(
      "reserve_billing_usage",
      {
        p_reservation_id:
          input.id,

        p_user_id:
          input.userId,

        p_conversation_id:
          input.conversationId,

        p_model_id:
          input.modelId,

        p_amount_micros:
          input.amountMicros,
      },
    );

    if (error) {
      throw new Error(
        `Could not reserve billing usage: ${error.message}`,
      );
    }

    const row =
      firstRpcRow<BillingReservationRow>(
        data,
      );

    return row
      ? toBillingReservation(
          row,
        )
      : null;
  };

SupabaseDatabaseAdapter.prototype.settleBillingUsage =
  async function settleBillingUsage(
    input: SettleBillingUsageInput,
  ): Promise<boolean> {
    assertNonnegativeMicros(
      input.actualMicros,
      "Actual usage",
    );

    const {
      data,
      error,
    } = await serviceClient().rpc(
      "settle_billing_usage",
      {
        p_reservation_id:
          input.reservationId,

        p_user_id:
          input.userId,

        p_actual_micros:
          input.actualMicros,
      },
    );

    if (error) {
      throw new Error(
        `Could not settle billing usage: ${error.message}`,
      );
    }

    return readRpcBoolean(
      data,
      "settle_billing_usage",
    );
  };

SupabaseDatabaseAdapter.prototype.releaseBillingUsage =
  async function releaseBillingUsage(
    reservationId: string,
    userId: string,
  ): Promise<boolean> {
    const {
      data,
      error,
    } = await serviceClient().rpc(
      "release_billing_usage",
      {
        p_reservation_id:
          reservationId,

        p_user_id:
          userId,
      },
    );

    if (error) {
      throw new Error(
        `Could not release billing usage: ${error.message}`,
      );
    }

    return readRpcBoolean(
      data,
      "release_billing_usage",
    );
  };

SupabaseDatabaseAdapter.prototype.updateBillingSubscription =
  async function updateBillingSubscription(
    input: UpdateBillingSubscriptionInput,
  ): Promise<BillingAccount> {
    assertNonnegativeMicros(
      input.includedUsageMicros,
      "Included usage",
    );

    const {
      data,
      error,
    } = await serviceClient().rpc(
      "update_billing_subscription",
      {
        p_user_id:
          input.userId,

        p_plan_id:
          input.planId,

        p_subscription_status:
          input.subscriptionStatus,

        p_stripe_customer_id:
          input.stripeCustomerId ??
          null,

        p_stripe_subscription_id:
          input.stripeSubscriptionId ??
          null,

        p_current_period_start:
          input.currentPeriodStart ??
          null,

        p_current_period_end:
          input.currentPeriodEnd ??
          null,

        p_included_usage_micros:
          input.includedUsageMicros,

        p_reset_period_usage:
          input.resetPeriodUsage,
      },
    );

    if (error) {
      throw new Error(
        `Could not update billing subscription: ${error.message}`,
      );
    }

    const row =
      firstRpcRow<BillingAccountRow>(
        data,
      );

    if (!row) {
      throw new Error(
        "Billing subscription update returned no account.",
      );
    }

    return toBillingAccount(
      row,
    );
  };

SupabaseDatabaseAdapter.prototype.addPrepaidCredit =
  async function addPrepaidCredit(
    input: AddPrepaidCreditInput,
  ): Promise<BillingAccount> {
    assertPositiveMicros(
      input.amountMicros,
      "Prepaid credit",
    );

    const externalReference =
      input.externalReference.trim();

    if (!externalReference) {
      throw new Error(
        "A payment reference is required.",
      );
    }

    const {
      data,
      error,
    } = await serviceClient().rpc(
      "add_prepaid_billing_credit",
      {
        p_user_id:
          input.userId,

        p_amount_micros:
          input.amountMicros,

        p_external_reference:
          externalReference,
      },
    );

    if (error) {
      throw new Error(
        `Could not add prepaid credit: ${error.message}`,
      );
    }

    const row =
      firstRpcRow<BillingAccountRow>(
        data,
      );

    if (!row) {
      throw new Error(
        "Prepaid credit returned no billing account.",
      );
    }

    return toBillingAccount(
      row,
    );
  };

function toBillingAccount(
  row: BillingAccountRow,
): BillingAccount {
  const planId =
    row.plan_id === "starter" ||
    row.plan_id === "plus" ||
    row.plan_id === "pro"
      ? row.plan_id
      : "none";

  const subscriptionStatus =
    row.subscription_status ===
      "trialing" ||
    row.subscription_status ===
      "active" ||
    row.subscription_status ===
      "past_due" ||
    row.subscription_status ===
      "canceled" ||
    row.subscription_status ===
      "unpaid"
      ? row.subscription_status
      : "none";

  return {
    userId:
      row.user_id,

    planId,

    subscriptionStatus,

    stripeCustomerId:
      row.stripe_customer_id,

    stripeSubscriptionId:
      row.stripe_subscription_id,

    currentPeriodStart:
      row.current_period_start,

    currentPeriodEnd:
      row.current_period_end,

    includedUsageMicros:
      toSafeMicros(
        row.included_usage_micros,
        "Included usage",
      ),

    usedUsageMicros:
      toSafeMicros(
        row.used_usage_micros,
        "Used usage",
      ),

    prepaidBalanceMicros:
      toSafeMicros(
        row.prepaid_balance_micros,
        "Prepaid balance",
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function toBillingReservation(
  row: BillingReservationRow,
): BillingUsageReservation {
  const fundingSource =
    row.funding_source ===
    "prepaid"
      ? "prepaid"
      : "subscription";

  const status =
    row.status ===
      "settled" ||
    row.status ===
      "released"
      ? row.status
      : "reserved";

  return {
    id:
      row.id,

    userId:
      row.user_id,

    conversationId:
      row.conversation_id,

    modelId:
      row.model_id,

    fundingSource,

    reservedMicros:
      toSafeMicros(
        row.reserved_micros,
        "Reserved usage",
      ),

    actualMicros:
      row.actual_micros ===
      null
        ? null
        : toSafeMicros(
            row.actual_micros,
            "Actual usage",
          ),

    status,

    createdAt:
      row.created_at,

    settledAt:
      row.settled_at,
  };
}

function firstRpcRow<T>(
  data: unknown,
): T | null {
  if (
    Array.isArray(
      data,
    )
  ) {
    return data.length > 0
      ? (data[0] as T)
      : null;
  }

  if (
    data !== null &&
    typeof data === "object"
  ) {
    return data as T;
  }

  return null;
}

function readRpcBoolean(
  data: unknown,
  key: string,
): boolean {
  if (
    typeof data ===
    "boolean"
  ) {
    return data;
  }

  if (
    Array.isArray(
      data,
    )
  ) {
    return data.length > 0
      ? readRpcBoolean(
          data[0],
          key,
        )
      : false;
  }

  if (
    data !== null &&
    typeof data === "object"
  ) {
    const value = (
      data as Record<
        string,
        unknown
      >
    )[key];

    if (
      typeof value ===
      "boolean"
    ) {
      return value;
    }
  }

  return false;
}

function assertPositiveMicros(
  value: number,
  label: string,
): void {
  assertNonnegativeMicros(
    value,
    label,
  );

  if (value === 0) {
    throw new Error(
      `${label} must be greater than zero.`,
    );
  }
}

function assertNonnegativeMicros(
  value: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value < 0
  ) {
    throw new Error(
      `${label} must be a nonnegative integer number of microdollars.`,
    );
  }
}

function toSafeMicros(
  value:
    | number
    | string,
  label: string,
): number {
  const parsed =
    Number(value);

  assertNonnegativeMicros(
    parsed,
    label,
  );

  return parsed;
}
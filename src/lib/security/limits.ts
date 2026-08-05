import "server-only";

import { chatError } from "@/lib/ai/errors";
import type { Session } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import { serverEnv } from "@/lib/env";

/**
 * Initial Mabojolu access rules.
 *
 * Guest users may explore Mabojolu before creating an account. Once the guest
 * allowance is exhausted, the same anonymous identity must be upgraded so its
 * conversations remain attached to the user.
 *
 * Registered free users receive a renewable allowance. Paid-plan detection will
 * be connected after the billing migration and Stripe flow are complete.
 */
const GUEST_TOTAL_MESSAGE_LIMIT =
  5;

const FREE_WINDOW_MESSAGE_LIMIT =
  20;

const FREE_WINDOW_HOURS =
  8;

const HOUR_MS =
  60 * 60 * 1_000;

/**
 * Generations currently running per user.
 *
 * This is intentionally an in-process protection. On multiple server instances,
 * each instance maintains its own count, while the database-backed quotas remain
 * shared across the deployment.
 */
const activeGenerations =
  new Map<string, number>();

export interface LimitDecision {
  allowed: boolean;

  /**
   * Present when the request is blocked. The message is already safe to display
   * to the user.
   */
  error?: ReturnType<
    typeof chatError
  >;
}

/**
 * Enforce access, quota, concurrency, maintenance, and global spending rules
 * before any provider request begins.
 */
export async function checkUsageLimits(
  session: Session,
): Promise<LimitDecision> {
  const env =
    serverEnv();

  const userId =
    session.userId;

  /**
   * Maintenance mode blocks every identity because it may indicate deployment,
   * database, or provider work that makes generation unsafe.
   */
  if (
    env.MABOJOLU_MAINTENANCE_MODE
  ) {
    return {
      allowed: false,

      error: chatError(
        "provider_unavailable",
        {
          message:
            "Mabojolu is temporarily unavailable for maintenance. Please try again shortly.",
        },
      ),
    };
  }

  /**
   * Concurrency applies to guests, registered users, paid users, and the
   * administrator. It prevents duplicate provider requests and accidental
   * repeated spending from rapid clicks.
   */
  const running =
    activeGenerations.get(
      userId,
    ) ?? 0;

  if (
    running >=
    env.MABOJOLU_MAX_CONCURRENT_GENERATIONS
  ) {
    return {
      allowed: false,

      error: chatError(
        "rate_limited",
        {
          message:
            "You already have a response in progress. Wait for it to finish, or stop it first.",

          retryAfterSeconds:
            5,
        },
      ),
    };
  }

  const database =
    getDatabase();

  const isAdmin =
    session.profile.role ===
    "admin";

  /**
   * The administrator is exempt from personal message allowances, but not from
   * maintenance mode, concurrency protection, or the global provider-spending
   * ceiling below.
   */
  if (!isAdmin) {
    if (session.isAnonymous) {
      /**
       * Count successful assistant responses across the guest's complete history rather than using a rolling window.
       *
       * A guest receives five successful exploratory responses total. Waiting or refreshing
       * must not create another allowance. Upgrading the anonymous account keeps
       * the same user ID and therefore preserves the conversation history.
       */
      const guestCompletedResponses =
        await database.countRecentMessages(
          userId,
          new Date(0).toISOString(),
        );

      if (
        guestCompletedResponses >=
        GUEST_TOTAL_MESSAGE_LIMIT
      ) {
        await database.recordSafetyEvent(
          {
            userId,

            conversationId:
              null,

            kind:
              "guest_message_limit_reached",

            severity:
              "info",

            detail:
              `Guest received ${guestCompletedResponses} successful responses, limit ${GUEST_TOTAL_MESSAGE_LIMIT}.`,
          },
        );

        return {
          allowed: false,

          error: chatError(
            "forbidden",
            {
              message:
                "You've used your 5 free questions. Create a free Mabojolu account to continue this conversation, save your chats, and access them on any device.",
            },
          ),
        };
      }
    } else {
      /**
       * Registered free allowance.
       *
       * This rolling window allows the user to resume naturally without the
       * allowance resetting at midnight in an arbitrary timezone.
       */
      const freeWindowStart =
        new Date(
          Date.now() -
            FREE_WINDOW_HOURS *
              HOUR_MS,
        ).toISOString();

      const freeWindowCompletedResponses =
        await database.countRecentMessages(
          userId,
          freeWindowStart,
        );

      if (
        freeWindowCompletedResponses >=
        FREE_WINDOW_MESSAGE_LIMIT
      ) {
        await database.recordSafetyEvent(
          {
            userId,

            conversationId:
              null,

            kind:
              "free_message_limit_reached",

            severity:
              "info",

            detail:
              `Registered free user received ${freeWindowCompletedResponses} successful responses in ${FREE_WINDOW_HOURS} hours, limit ${FREE_WINDOW_MESSAGE_LIMIT}.`,
          },
        );

        return {
          allowed: false,

          error: chatError(
            "rate_limited",
            {
              message:
                "You have used your current free Mabojolu allowance. Please return in a few hours to continue.",

              retryAfterSeconds:
                FREE_WINDOW_HOURS *
                60 *
                60,
            },
          ),
        };
      }

      /**
       * Preserve the existing configurable 24-hour ceiling as an additional
       * financial safeguard. This can be higher than the free-window allowance
       * and remains independently configurable through the environment.
       */
      const dailyWindowStart =
        new Date(
          Date.now() -
            24 *
              HOUR_MS,
        ).toISOString();

      const dailyCompletedResponses =
        await database.countRecentMessages(
          userId,
          dailyWindowStart,
        );

      if (
        dailyCompletedResponses >=
        env.MABOJOLU_DAILY_MESSAGE_LIMIT
      ) {
        await database.recordSafetyEvent(
          {
            userId,

            conversationId:
              null,

            kind:
              "daily_message_limit_reached",

            severity:
              "info",

            detail:
              `Received ${dailyCompletedResponses} successful responses in 24 hours, limit ${env.MABOJOLU_DAILY_MESSAGE_LIMIT}.`,
          },
        );

        return {
          allowed: false,

          error: chatError(
            "rate_limited",
            {
              message:
                "You have reached your daily Mabojolu message limit. Please try again later.",
            },
          ),
        };
      }
    }
  }

  /**
   * Global provider spending ceiling.
   *
   * This remains active even for the administrator because it protects the
   * Anthropic account from accidental runaway spending. Zero disables it.
   */
  if (
    env.MABOJOLU_DAILY_COST_LIMIT_USD >
    0
  ) {
    const metrics =
      await database.getAdminMetrics();

    const spentToday =
      metrics.usageByModel.reduce(
        (
          total,
          row,
        ) =>
          total +
          row.estimatedCostUsd,
        0,
      );

    if (
      spentToday >=
      env.MABOJOLU_DAILY_COST_LIMIT_USD
    ) {
      await database.recordSafetyEvent(
        {
          userId,

          conversationId:
            null,

          kind:
            "daily_cost_limit_reached",

          severity:
            "critical",

          detail:
            `Estimated spend ${spentToday.toFixed(2)} USD reached the configured ceiling.`,
        },
      );

      return {
        allowed: false,

        error: chatError(
          "provider_unavailable",
          {
            message:
              "Mabojolu has reached its configured usage ceiling for today. Please try again later.",
          },
        ),
      };
    }
  }

  return {
    allowed: true,
  };
}

/**
 * Mark a generation as running.
 *
 * The returned release function must be called after streaming finishes or when
 * generation fails before streaming begins.
 */
export function beginGeneration(
  userId: string,
): () => void {
  activeGenerations.set(
    userId,
    (
      activeGenerations.get(
        userId,
      ) ?? 0
    ) + 1,
  );

  let released =
    false;

  return () => {
    if (released) {
      return;
    }

    released = true;

    const next =
      (
        activeGenerations.get(
          userId,
        ) ?? 1
      ) - 1;

    if (next <= 0) {
      activeGenerations.delete(
        userId,
      );
    } else {
      activeGenerations.set(
        userId,
        next,
      );
    }
  };
}

/**
 * Test-only helper for clearing concurrency state between cases.
 */
export function resetGenerationTracking(): void {
  activeGenerations.clear();
}

/**
 * Current in-process concurrency snapshot for the administrator dashboard.
 */
export function currentConcurrency(): Array<{
  userId: string;
  running: number;
}> {
  return [
    ...activeGenerations.entries(),
  ].map(
    ([
      userId,
      running,
    ]) => ({
      userId,
      running,
    }),
  );
}
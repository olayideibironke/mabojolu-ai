import "server-only";

import { chatError } from "@/lib/ai/errors";
import { getDatabase } from "@/lib/database";
import { serverEnv } from "@/lib/env";

/**
 * Usage limits and cost controls.
 *
 * Layered deliberately, because each layer catches something the others cannot:
 *
 *   1. Rate limit          Bursts, per short window. Cheap, in memory.
 *   2. Daily message quota Sustained heavy use. Requires a database count.
 *   3. Concurrency         Parallel generations from one account.
 *   4. Daily spend ceiling A hard financial stop, independent of message counts,
 *                          because a few very large requests can cost more than
 *                          many small ones.
 *
 * All checks run before any provider work is scheduled, so an over-quota request
 * costs nothing.
 */

/**
 * Generations currently running, per user.
 *
 * In-process, with the same caveat as the rate limiter: on several instances each
 * tracks its own count, so the effective cap is per instance. Documented rather
 * than overstated.
 */
const activeGenerations = new Map<string, number>();

export interface LimitDecision {
  allowed: boolean;
  /** Present when blocked. Already user-facing. */
  error?: ReturnType<typeof chatError>;
}

/** Enforce every quota for a user about to send a message. */
export async function checkUsageLimits(userId: string): Promise<LimitDecision> {
  const env = serverEnv();

  if (env.MABOJOLU_MAINTENANCE_MODE) {
    return {
      allowed: false,
      error: chatError("provider_unavailable", {
        message:
          "Mabojolu is temporarily unavailable for maintenance. Please try again shortly.",
      }),
    };
  }

  const database = getDatabase();

  // Concurrency, checked first because it needs no database round trip.
  const running = activeGenerations.get(userId) ?? 0;
  if (running >= env.MABOJOLU_MAX_CONCURRENT_GENERATIONS) {
    return {
      allowed: false,
      error: chatError("rate_limited", {
        message:
          "You already have a response in progress. Wait for it to finish, or stop it first.",
        retryAfterSeconds: 5,
      }),
    };
  }

  // Daily message quota.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const sent = await database.countRecentMessages(userId, since);

  if (sent >= env.MABOJOLU_DAILY_MESSAGE_LIMIT) {
    await database.recordSafetyEvent({
      userId,
      conversationId: null,
      kind: "daily_message_limit_reached",
      severity: "info",
      // Counts only. No message content, since administrators read this table.
      detail: `Sent ${sent} messages in 24 hours, limit ${env.MABOJOLU_DAILY_MESSAGE_LIMIT}.`,
    });

    return {
      allowed: false,
      error: chatError("rate_limited", {
        message:
          "You have reached your daily message limit. It resets 24 hours after your first message.",
      }),
    };
  }

  // Daily spend ceiling. Zero disables it.
  if (env.MABOJOLU_DAILY_COST_LIMIT_USD > 0) {
    const metrics = await database.getAdminMetrics();
    const spentToday = metrics.usageByModel.reduce(
      (total, row) => total + row.estimatedCostUsd,
      0,
    );

    if (spentToday >= env.MABOJOLU_DAILY_COST_LIMIT_USD) {
      await database.recordSafetyEvent({
        userId,
        conversationId: null,
        kind: "daily_cost_limit_reached",
        severity: "critical",
        detail: `Estimated spend ${spentToday.toFixed(2)} USD reached the configured ceiling.`,
      });

      return {
        allowed: false,
        error: chatError("provider_unavailable", {
          message:
            "Mabojolu has reached its configured usage ceiling for today. Please try again later.",
        }),
      };
    }
  }

  return { allowed: true };
}

/**
 * Mark a generation as running.
 *
 * Returns a release function. Callers must invoke it in a `finally`, or an
 * abandoned request would permanently consume a concurrency slot and lock the
 * user out of their own account.
 */
export function beginGeneration(userId: string): () => void {
  activeGenerations.set(userId, (activeGenerations.get(userId) ?? 0) + 1);

  let released = false;

  return () => {
    // Guard against a double release, which would let the count drift negative
    // and effectively disable the limit.
    if (released) {
      return;
    }
    released = true;

    const next = (activeGenerations.get(userId) ?? 1) - 1;

    if (next <= 0) {
      activeGenerations.delete(userId);
    } else {
      activeGenerations.set(userId, next);
    }
  };
}

/** Test-only: clear concurrency state between cases. */
export function resetGenerationTracking(): void {
  activeGenerations.clear();
}

/** Snapshot for the admin view. */
export function currentConcurrency(): Array<{ userId: string; running: number }> {
  return [...activeGenerations.entries()].map(([userId, running]) => ({
    userId,
    running,
  }));
}

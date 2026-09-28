import type { LongHorizonLearningState } from "./autonomous-long-horizon-learning";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";
import { retrievePersistentMemory } from "./persistent-memory-lifecycle";

export interface LongHorizonStrategyCandidate {
  id: string;
  terms: string[];
  baseUtility: number;
  risk: number;
}

export interface LongHorizonStrategySelection {
  selectedStrategyId?: string;
  score: number;
  supportingMemoryIds: string[];
  rejectedStrategyIds: string[];
  reason: "memory-informed-strategy" | "no-safe-novel-strategy";
}

export function selectMemoryInformedLongHorizonStrategy(input: {
  state: LongHorizonLearningState;
  memory: PersistentMemoryStore;
  candidates: readonly LongHorizonStrategyCandidate[];
  maximumRisk?: number;
  memoryWeight?: number;
}): LongHorizonStrategySelection {
  if (input.state.status !== "active") {
    throw new Error("Strategy selection requires an active long-horizon objective.");
  }

  const maximumRisk = input.maximumRisk ?? 0.2;
  const memoryWeight = input.memoryWeight ?? 0.5;
  if (!Number.isFinite(maximumRisk) || maximumRisk < 0 || maximumRisk > 1) {
    throw new Error("maximumRisk must be in [0, 1].");
  }
  if (!Number.isFinite(memoryWeight) || memoryWeight < 0) {
    throw new Error("memoryWeight must be non-negative.");
  }

  const failed = new Set(input.state.failedStrategyIds);
  const rejectedStrategyIds: string[] = [];
  let best:
    | { id: string; score: number; supportingMemoryIds: string[] }
    | undefined;

  for (const candidate of input.candidates) {
    const id = candidate.id.trim();
    if (
      !id ||
      failed.has(id) ||
      !Number.isFinite(candidate.risk) ||
      candidate.risk < 0 ||
      candidate.risk > maximumRisk ||
      !Number.isFinite(candidate.baseUtility)
    ) {
      if (id) rejectedStrategyIds.push(id);
      continue;
    }

    const terms = [...new Set(candidate.terms.map((term) => term.trim()).filter(Boolean))];
    const retrieved = terms.length === 0
      ? []
      : retrievePersistentMemory({
          store: input.memory,
          query: {
            terms,
            domains: [],
            limit: 5,
          },
        });

    const trustedRetrieved = retrieved.filter(
      (entry) => entry.memory.confidence > 0,
    );
    const supportingMemoryIds = trustedRetrieved.map((entry) => entry.memory.id).sort();
    const memorySupport = trustedRetrieved.reduce(
      (total, entry) => total + entry.score * entry.memory.confidence,
      0,
    );
    const score = candidate.baseUtility + memorySupport * memoryWeight;

    if (
      !best ||
      score > best.score + Number.EPSILON ||
      (Math.abs(score - best.score) <= Number.EPSILON && id.localeCompare(best.id) < 0)
    ) {
      best = { id, score, supportingMemoryIds };
    }
  }

  if (!best) {
    return {
      score: 0,
      supportingMemoryIds: [],
      rejectedStrategyIds: [...new Set(rejectedStrategyIds)].sort(),
      reason: "no-safe-novel-strategy",
    };
  }

  return {
    selectedStrategyId: best.id,
    score: best.score,
    supportingMemoryIds: best.supportingMemoryIds,
    rejectedStrategyIds: [...new Set(rejectedStrategyIds)].sort(),
    reason: "memory-informed-strategy",
  };
}

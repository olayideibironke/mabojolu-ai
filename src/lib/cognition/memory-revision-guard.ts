import type { SemanticMemory } from "./memory-consolidation";

export interface MemoryRevisionEvidence {
  id: string;
  sourceId: string;
  observedAt: string;
  protected?: boolean;
  stale?: boolean;
}

export interface MemoryRevisionGuardResult {
  acceptedEvidenceIds: string[];
  independentSourceCount: number;
}

export function guardSemanticMemoryRevision(input: {
  memory: SemanticMemory;
  evidence: readonly MemoryRevisionEvidence[];
  minimumIndependentSources?: number;
}): MemoryRevisionGuardResult {
  const minimumIndependentSources =
    input.minimumIndependentSources ?? 2;

  if (
    !Number.isInteger(minimumIndependentSources) ||
    minimumIndependentSources < 1
  ) {
    throw new Error(
      "Memory revision requires a positive independent-source threshold.",
    );
  }

  const evidenceIds = new Set<string>();
  for (const item of input.evidence) {
    if (!item.id.trim() || !item.sourceId.trim()) {
      throw new Error(
        "Memory revision evidence requires id and source identity.",
      );
    }
    if (evidenceIds.has(item.id)) {
      throw new Error(
        `Duplicate memory revision evidence ${item.id} is not independent evidence.`,
      );
    }
    evidenceIds.add(item.id);
    if (item.protected) {
      throw new Error(
        `Protected evidence ${item.id} cannot participate in live memory revision.`,
      );
    }
    if (item.stale) {
      throw new Error(
        `Stale evidence ${item.id} cannot revise current semantic memory.`,
      );
    }
    if (Number.isNaN(Date.parse(item.observedAt))) {
      throw new Error(
        `Memory revision evidence ${item.id} has an invalid timestamp.`,
      );
    }
  }

  const independentSources = new Set(
    input.evidence.map((item) => item.sourceId),
  );

  if (
    input.evidence.length > 0 &&
    independentSources.size < minimumIndependentSources
  ) {
    throw new Error(
      `Semantic memory revision requires at least ${minimumIndependentSources} independent evidence sources.`,
    );
  }

  return {
    acceptedEvidenceIds: input.evidence.map((item) => item.id),
    independentSourceCount: independentSources.size,
  };
}

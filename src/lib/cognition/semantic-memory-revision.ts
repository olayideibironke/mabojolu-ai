import type { SemanticMemory } from "./memory-consolidation";

export type SemanticMemoryRevisionStatus =
  | "retained"
  | "weakened"
  | "revised"
  | "retracted";

export interface SemanticMemoryRevision {
  previous: SemanticMemory;
  current: SemanticMemory;
  status: SemanticMemoryRevisionStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  revisionReason: string;
  revisedAt: string;
}

export function reviseSemanticMemory(input: {
  memory: SemanticMemory;
  supportingEvidenceIds?: readonly string[];
  contradictingEvidenceIds?: readonly string[];
  revisedStatement?: string;
  revisedConfidence: number;
  revisionReason: string;
  revisedAt: string;
}): SemanticMemoryRevision {
  if (
    !Number.isFinite(input.revisedConfidence) ||
    input.revisedConfidence < 0 ||
    input.revisedConfidence > 1
  ) {
    throw new Error("Revised semantic confidence must be between 0 and 1.");
  }
  if (!input.revisionReason.trim()) {
    throw new Error("Semantic memory revision requires a reason.");
  }

  const support = [...new Set(input.supportingEvidenceIds ?? [])];
  const against = [...new Set(input.contradictingEvidenceIds ?? [])];
  const overlap = support.find((id) => against.includes(id));
  if (overlap) {
    throw new Error(
      `Evidence ${overlap} cannot both support and contradict semantic memory.`,
    );
  }

  const statement =
    input.revisedStatement?.trim() || input.memory.statement;
  const statementChanged = statement !== input.memory.statement;
  const confidenceDelta =
    input.revisedConfidence - input.memory.confidence;

  if (
    support.length === 0 &&
    against.length === 0 &&
    (statementChanged || confidenceDelta !== 0)
  ) {
    throw new Error(
      "Semantic memory cannot change without revision evidence.",
    );
  }

  let status: SemanticMemoryRevisionStatus = "retained";
  if (input.revisedConfidence === 0 && against.length > 0) {
    status = "retracted";
  } else if (statementChanged) {
    status = "revised";
  } else if (confidenceDelta < 0) {
    status = "weakened";
  } else if (confidenceDelta > 0) {
    status = "revised";
  }

  return {
    previous: input.memory,
    current: {
      ...input.memory,
      statement,
      confidence: input.revisedConfidence,
      derivedFromIds: [
        ...new Set([
          ...input.memory.derivedFromIds,
          ...support,
          ...against,
        ]),
      ],
      consolidatedAt: input.revisedAt,
    },
    status,
    supportingEvidenceIds: support,
    contradictingEvidenceIds: against,
    revisionReason: input.revisionReason.trim(),
    revisedAt: input.revisedAt,
  };
}

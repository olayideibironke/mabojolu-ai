import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { multimodalEvidenceSourceKey } from "./multimodal-evidence-independence";
import {
  assessMultimodalReasoningCandidate,
  evidenceWeight,
  type MultimodalReasoningCandidate,
} from "./multimodal-evidence-reasoning";

export type MultimodalConflictDecision =
  | "supported"
  | "contested"
  | "contradicted"
  | "insufficient";

export interface MultimodalConflictAssessment {
  candidateId: string;
  decision: MultimodalConflictDecision;
  confidence: number;
  independentSupportSourceCount: number;
  independentContradictionSourceCount: number;
  supportModalities: string[];
  contradictionModalities: string[];
  conflictingSourceKeys: string[];
  incompleteEvidenceIds: string[];
}

function admissibleSources(
  ids: readonly string[],
  byId: ReadonlyMap<string, CognitiveMultimodalObservation>,
): Map<string, CognitiveMultimodalObservation[]> {
  const result = new Map<string, CognitiveMultimodalObservation[]>();

  for (const id of new Set(ids)) {
    const observation = byId.get(id);
    if (!observation) {
      throw new Error(`Unknown multimodal observation ${id}.`);
    }
    if (evidenceWeight(observation) <= 0) {
      continue;
    }

    const key = multimodalEvidenceSourceKey(observation);
    const group = result.get(key) ?? [];
    group.push(observation);
    result.set(key, group);
  }

  return result;
}

export function assessMultimodalConflict(
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
): MultimodalConflictAssessment {
  const reasoning = assessMultimodalReasoningCandidate(
    candidate,
    observations,
  );
  const byId = new Map(
    observations.map((entry) => [entry.observation.id, entry]),
  );
  const supportSources = admissibleSources(
    reasoning.evidenceForIds,
    byId,
  );
  const contradictionSources = admissibleSources(
    reasoning.evidenceAgainstIds,
    byId,
  );

  const conflictingSourceKeys = [...supportSources.keys()]
    .filter((key) => contradictionSources.has(key))
    .sort();

  if (conflictingSourceKeys.length > 0) {
    throw new Error(
      `Underlying source ${conflictingSourceKeys[0]} supplies both supporting and contradicting evidence.`,
    );
  }

  const supportModalities = [
    ...new Set(
      [...supportSources.values()]
        .flat()
        .map((entry) => entry.modality),
    ),
  ].sort();
  const contradictionModalities = [
    ...new Set(
      [...contradictionSources.values()]
        .flat()
        .map((entry) => entry.modality),
    ),
  ].sort();

  let decision: MultimodalConflictDecision = "insufficient";
  if (supportSources.size > 0 && contradictionSources.size > 0) {
    decision = "contested";
  } else if (supportSources.size > 0) {
    decision = "supported";
  } else if (contradictionSources.size > 0) {
    decision = "contradicted";
  }

  return {
    candidateId: candidate.id,
    decision,
    confidence: reasoning.confidence,
    independentSupportSourceCount: supportSources.size,
    independentContradictionSourceCount: contradictionSources.size,
    supportModalities,
    contradictionModalities,
    conflictingSourceKeys,
    incompleteEvidenceIds: [...reasoning.incompleteEvidenceIds],
  };
}

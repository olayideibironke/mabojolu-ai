import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import {
  reviseCognitionFromMultimodalEvidence,
  type MultimodalBeliefRevisionResult,
} from "./multimodal-belief-revision";
import { assessMultimodalConflict } from "./multimodal-conflict-resolution";
import { filterMultimodalCandidateToCurrentEvidence } from "./multimodal-current-evidence";
import type { MultimodalReasoningCandidate } from "./multimodal-evidence-reasoning";
import type { CognitiveState } from "./types";

export interface GovernedMultimodalReasoningOptions {
  protectedEvidenceIds?: readonly string[];
}

export interface GovernedMultimodalReasoningResult
  extends MultimodalBeliefRevisionResult {
  conflictDecision:
    | "supported"
    | "contested"
    | "contradicted"
    | "insufficient";
  supersededObservationIds: string[];
}

function assertProtectedEvidenceSeparation(
  candidate: MultimodalReasoningCandidate,
  protectedEvidenceIds: readonly string[],
): void {
  const protectedIds = new Set(protectedEvidenceIds);
  if (protectedIds.size !== protectedEvidenceIds.length) {
    throw new Error("Protected multimodal evidence ids must be unique.");
  }

  const contaminated = [
    ...candidate.supportingObservationIds,
    ...(candidate.contradictingObservationIds ?? []),
  ].find((id) => protectedIds.has(id));

  if (contaminated) {
    throw new Error(
      `Protected multimodal evidence ${contaminated} cannot participate in live belief revision.`,
    );
  }
}

export function runGovernedMultimodalReasoning(
  state: CognitiveState,
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
  updatedAt: string,
  options: GovernedMultimodalReasoningOptions = {},
): GovernedMultimodalReasoningResult {
  assertProtectedEvidenceSeparation(
    candidate,
    options.protectedEvidenceIds ?? [],
  );

  const current = filterMultimodalCandidateToCurrentEvidence(
    candidate,
    observations,
  );
  const conflict = assessMultimodalConflict(
    current.candidate,
    current.observations,
  );
  const revision = reviseCognitionFromMultimodalEvidence(
    state,
    current.candidate,
    current.observations,
    updatedAt,
  );

  return {
    ...revision,
    conflictDecision: conflict.decision,
    supersededObservationIds: current.supersededObservationIds,
  };
}

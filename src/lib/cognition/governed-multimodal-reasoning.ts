import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import {
  reviseCognitionFromMultimodalEvidence,
  type MultimodalBeliefRevisionResult,
} from "./multimodal-belief-revision";
import { assessMultimodalConflict } from "./multimodal-conflict-resolution";
import { filterMultimodalCandidateToCurrentEvidence } from "./multimodal-current-evidence";
import type { MultimodalReasoningCandidate } from "./multimodal-evidence-reasoning";
import type { CognitiveState } from "./types";

export interface GovernedMultimodalReasoningResult
  extends MultimodalBeliefRevisionResult {
  conflictDecision:
    | "supported"
    | "contested"
    | "contradicted"
    | "insufficient";
  supersededObservationIds: string[];
}

export function runGovernedMultimodalReasoning(
  state: CognitiveState,
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
  updatedAt: string,
): GovernedMultimodalReasoningResult {
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

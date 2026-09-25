import {
  assessMultimodalReasoningCandidate,
  multimodalCandidateToBelief,
  multimodalCandidateToHypothesis,
  type MultimodalReasoningAssessment,
  type MultimodalReasoningCandidate,
} from "./multimodal-evidence-reasoning";
import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { reduceCognitiveState } from "./state";
import type {
  Belief,
  CognitiveEvent,
  CognitiveState,
  Hypothesis,
} from "./types";

export interface MultimodalBeliefRevisionResult {
  state: CognitiveState;
  assessment: MultimodalReasoningAssessment;
  belief: Belief;
  hypothesis: Hypothesis;
  events: CognitiveEvent[];
  previousConfidence?: number;
  confidenceDelta?: number;
}

export function reviseCognitionFromMultimodalEvidence(
  state: CognitiveState,
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
  updatedAt: string,
): MultimodalBeliefRevisionResult {
  const assessment =
    assessMultimodalReasoningCandidate(candidate, observations);
  const belief =
    multimodalCandidateToBelief(candidate, assessment, updatedAt);
  const hypothesis =
    multimodalCandidateToHypothesis(candidate, assessment, updatedAt);

  const previousBelief = state.beliefs.find(
    (entry) => entry.id === belief.id,
  );
  const previousHypothesis = state.hypotheses.find(
    (entry) => entry.id === hypothesis.id,
  );

  if (
    previousBelief &&
    previousBelief.proposition !== belief.proposition
  ) {
    throw new Error(
      `Cannot revise belief ${belief.id} with a different proposition.`,
    );
  }
  if (
    previousHypothesis &&
    previousHypothesis.statement !== hypothesis.statement
  ) {
    throw new Error(
      `Cannot revise hypothesis ${hypothesis.id} with a different statement.`,
    );
  }

  const revisedHypothesis: Hypothesis = {
    ...hypothesis,
    createdAt: previousHypothesis?.createdAt ?? hypothesis.createdAt,
  };

  const events: CognitiveEvent[] = [
    {
      type: "belief.updated",
      belief,
    },
    {
      type: "hypothesis.updated",
      hypothesis: revisedHypothesis,
    },
  ];

  let nextState = state;
  for (const event of events) {
    nextState = reduceCognitiveState(nextState, event);
  }

  return {
    state: nextState,
    assessment,
    belief,
    hypothesis: revisedHypothesis,
    events,
    ...(previousBelief
      ? {
          previousConfidence: previousBelief.confidence,
          confidenceDelta:
            belief.confidence - previousBelief.confidence,
        }
      : {}),
  };
}

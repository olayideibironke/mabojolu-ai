import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import type { MultimodalReasoningCandidate } from "./multimodal-evidence-reasoning";
import { currentMultimodalObservationIds } from "./multimodal-temporal-evidence";

export interface TemporallyFilteredMultimodalCandidate {
  candidate: MultimodalReasoningCandidate;
  observations: CognitiveMultimodalObservation[];
  supersededObservationIds: string[];
}

export function filterMultimodalCandidateToCurrentEvidence(
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
): TemporallyFilteredMultimodalCandidate {
  const currentIds = new Set(
    currentMultimodalObservationIds(observations),
  );
  const referencedIds = new Set([
    ...candidate.supportingObservationIds,
    ...(candidate.contradictingObservationIds ?? []),
  ]);
  const knownIds = new Set(
    observations.map((entry) => entry.observation.id),
  );

  for (const id of referencedIds) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown multimodal observation ${id}.`);
    }
  }

  const supersededObservationIds = [...referencedIds]
    .filter((id) => !currentIds.has(id))
    .sort();

  return {
    candidate: {
      ...candidate,
      supportingObservationIds:
        candidate.supportingObservationIds.filter((id) =>
          currentIds.has(id),
        ),
      contradictingObservationIds:
        candidate.contradictingObservationIds?.filter((id) =>
          currentIds.has(id),
        ),
    },
    observations: observations.filter((entry) =>
      currentIds.has(entry.observation.id),
    ),
    supersededObservationIds,
  };
}

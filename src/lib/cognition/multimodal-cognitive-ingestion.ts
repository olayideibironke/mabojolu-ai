import type { MultimodalEvidencePackage } from "@/lib/attachments/analysis";
import {
  multimodalEvidenceBatchToCognitiveObservations,
  type CognitiveMultimodalObservation,
} from "./multimodal-evidence-bridge";
import {
  reduceCognitiveState,
} from "./state";
import type {
  CognitiveEvent,
  CognitiveState,
} from "./types";

export interface MultimodalCognitiveIngestionResult {
  state: CognitiveState;
  events: CognitiveEvent[];
  ingested: CognitiveMultimodalObservation[];
}

export function ingestMultimodalEvidenceIntoCognitiveState(
  state: CognitiveState,
  packages: readonly MultimodalEvidencePackage[],
): MultimodalCognitiveIngestionResult {
  const ingested =
    multimodalEvidenceBatchToCognitiveObservations(packages);

  const events: CognitiveEvent[] =
    ingested.map((entry) => ({
      type: "observation.recorded" as const,
      observation: entry.observation,
    }));

  let nextState = state;

  for (const event of events) {
    nextState = reduceCognitiveState(nextState, event);
  }

  return {
    state: nextState,
    events,
    ingested,
  };
}

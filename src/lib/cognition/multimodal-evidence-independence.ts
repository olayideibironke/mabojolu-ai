import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";

export interface MultimodalEvidenceIndependenceGroup {
  sourceKey: string;
  observationIds: string[];
  modalities: string[];
  processorIds: string[];
}

export interface MultimodalEvidenceIndependenceSummary {
  independentSourceCount: number;
  modalityCount: number;
  groups: MultimodalEvidenceIndependenceGroup[];
}

function metadataString(
  observation: CognitiveMultimodalObservation,
  key: string,
): string | undefined {
  const value = observation.observation.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function multimodalEvidenceSourceKey(
  observation: CognitiveMultimodalObservation,
): string {
  const explicit =
    metadataString(observation, "sourceArtifactId") ??
    metadataString(observation, "sourceAttachmentId") ??
    metadataString(observation, "parentAttachmentId");

  return explicit ?? observation.attachmentId;
}

export function summarizeMultimodalEvidenceIndependence(
  observations: readonly CognitiveMultimodalObservation[],
): MultimodalEvidenceIndependenceSummary {
  const bySource = new Map<string, CognitiveMultimodalObservation[]>();

  for (const observation of observations) {
    const sourceKey = multimodalEvidenceSourceKey(observation);
    const group = bySource.get(sourceKey) ?? [];
    group.push(observation);
    bySource.set(sourceKey, group);
  }

  const groups = [...bySource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourceKey, group]) => ({
      sourceKey,
      observationIds: group.map((entry) => entry.observation.id),
      modalities: [...new Set(group.map((entry) => entry.modality))].sort(),
      processorIds: [...new Set(group.map((entry) => entry.processorId))].sort(),
    }));

  return {
    independentSourceCount: groups.length,
    modalityCount: new Set(observations.map((entry) => entry.modality)).size,
    groups,
  };
}

export function independentMultimodalEvidenceWeight(
  observationIds: readonly string[],
  observations: readonly CognitiveMultimodalObservation[],
  roleWeight: (
    observation: CognitiveMultimodalObservation,
  ) => number,
): number {
  const byId = new Map(
    observations.map((entry) => [entry.observation.id, entry]),
  );
  const bestBySource = new Map<string, number>();

  for (const id of new Set(observationIds)) {
    const observation = byId.get(id);
    if (!observation) {
      throw new Error(`Unknown multimodal observation ${id}.`);
    }

    const sourceKey = multimodalEvidenceSourceKey(observation);
    const weight = roleWeight(observation);
    bestBySource.set(
      sourceKey,
      Math.max(bestBySource.get(sourceKey) ?? 0, weight),
    );
  }

  return [...bestBySource.values()].reduce(
    (sum, weight) => sum + weight,
    0,
  );
}

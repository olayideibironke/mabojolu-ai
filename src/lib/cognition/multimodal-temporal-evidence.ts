import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";

export type MultimodalTemporalRole =
  | "current"
  | "superseded"
  | "concurrent";

export interface MultimodalTemporalEvidence {
  observationId: string;
  sourceKey: string;
  observedAt: string;
  temporalRole: MultimodalTemporalRole;
  supersededByObservationId?: string;
}

function temporalSubjectKey(
  observation: CognitiveMultimodalObservation,
): string {
  const metadata = observation.observation.metadata ?? {};
  const explicit = metadata.temporalSubjectId;
  return typeof explicit === "string" && explicit.trim()
    ? explicit
    : observation.attachmentId;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid multimodal observation timestamp ${value}.`);
  }
  return parsed;
}

export function classifyMultimodalTemporalEvidence(
  observations: readonly CognitiveMultimodalObservation[],
): MultimodalTemporalEvidence[] {
  const ids = new Set<string>();
  const groups = new Map<string, CognitiveMultimodalObservation[]>();

  for (const observation of observations) {
    if (ids.has(observation.observation.id)) {
      throw new Error(
        `Duplicate multimodal temporal observation ${observation.observation.id}.`,
      );
    }
    ids.add(observation.observation.id);
    timestamp(observation.observation.observedAt);

    const key = temporalSubjectKey(observation);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const result: MultimodalTemporalEvidence[] = [];

  for (const [sourceKey, group] of groups) {
    const ordered = [...group].sort(
      (left, right) =>
        timestamp(left.observation.observedAt) -
          timestamp(right.observation.observedAt) ||
        left.observation.id.localeCompare(right.observation.id),
    );
    const latestTime = Math.max(
      ...ordered.map((entry) => timestamp(entry.observation.observedAt)),
    );
    const latest = ordered.filter(
      (entry) => timestamp(entry.observation.observedAt) === latestTime,
    );
    const latestIds = latest.map((entry) => entry.observation.id).sort();

    for (const entry of ordered) {
      const entryTime = timestamp(entry.observation.observedAt);
      if (entryTime < latestTime) {
        result.push({
          observationId: entry.observation.id,
          sourceKey,
          observedAt: entry.observation.observedAt,
          temporalRole: "superseded",
          supersededByObservationId: latestIds[0],
        });
      } else {
        result.push({
          observationId: entry.observation.id,
          sourceKey,
          observedAt: entry.observation.observedAt,
          temporalRole: latest.length > 1 ? "concurrent" : "current",
        });
      }
    }
  }

  return result.sort((left, right) =>
    left.observationId.localeCompare(right.observationId),
  );
}

export function currentMultimodalObservationIds(
  observations: readonly CognitiveMultimodalObservation[],
): string[] {
  return classifyMultimodalTemporalEvidence(observations)
    .filter((entry) => entry.temporalRole !== "superseded")
    .map((entry) => entry.observationId);
}

import type { Observation } from "./types";

export interface EnvironmentFeature {
  name: string;
  values: string[];
}

export interface InducedEnvironmentModel {
  id: string;
  domains: string[];
  features: EnvironmentFeature[];
  candidateActionKinds: string[];
  candidateOutcomeKinds: string[];
  evidenceIds: string[];
  confidence: number;
  unresolvedQuestions: string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function metadataString(
  observation: Observation,
  key: string,
): string | undefined {
  const value = observation.metadata?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

export function induceEnvironmentModel(input: {
  id: string;
  observations: readonly Observation[];
  minimumObservations?: number;
}): InducedEnvironmentModel {
  if (!input.id.trim()) {
    throw new Error("Environment model id must be non-empty.");
  }

  const minimumObservations = input.minimumObservations ?? 3;
  if (!Number.isInteger(minimumObservations) || minimumObservations < 2) {
    throw new Error("Environment induction requires a minimum of at least two observations.");
  }
  if (input.observations.length < minimumObservations) {
    throw new Error(
      `Environment induction requires at least ${minimumObservations} observations.`,
    );
  }

  const evidenceIds = unique(input.observations.map((observation) => observation.id));
  if (evidenceIds.length !== input.observations.length) {
    throw new Error("Environment induction requires unique observation evidence.");
  }

  const domains = unique(
    input.observations.flatMap((observation) => {
      const domain = metadataString(observation, "domain");
      return domain ? [domain] : [];
    }),
  );
  const candidateActionKinds = unique(
    input.observations.flatMap((observation) => {
      const action = metadataString(observation, "actionKind");
      return action ? [action] : [];
    }),
  );
  const candidateOutcomeKinds = unique(
    input.observations.flatMap((observation) => {
      const outcome = metadataString(observation, "outcomeKind");
      return outcome ? [outcome] : [];
    }),
  );

  const featureValues = new Map<string, Set<string>>();
  for (const observation of input.observations) {
    for (const [key, rawValue] of Object.entries(observation.metadata ?? {})) {
      if (!key.startsWith("feature:") || rawValue === null) {
        continue;
      }
      const name = key.slice("feature:".length).trim();
      if (!name) {
        continue;
      }
      const values = featureValues.get(name) ?? new Set<string>();
      values.add(String(rawValue));
      featureValues.set(name, values);
    }
  }

  const features = [...featureValues.entries()]
    .map(([name, values]) => ({
      name,
      values: [...values].sort(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const unresolvedQuestions: string[] = [];
  if (domains.length === 0) unresolvedQuestions.push("domain");
  if (features.length === 0) unresolvedQuestions.push("state-features");
  if (candidateActionKinds.length === 0) unresolvedQuestions.push("available-actions");
  if (candidateOutcomeKinds.length === 0) unresolvedQuestions.push("outcome-structure");

  const resolvedDimensions = 4 - unresolvedQuestions.length;
  const evidenceFactor = Math.min(1, input.observations.length / (minimumObservations * 2));
  const confidence = Number(
    Math.min(1, resolvedDimensions / 4 * 0.8 + evidenceFactor * 0.2).toFixed(6),
  );

  return {
    id: input.id,
    domains,
    features,
    candidateActionKinds,
    candidateOutcomeKinds,
    evidenceIds,
    confidence,
    unresolvedQuestions,
  };
}

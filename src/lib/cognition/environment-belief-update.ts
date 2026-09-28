import type { CompetingEnvironmentModel } from "./active-environment-discovery";

export interface EnvironmentExperimentObservation {
  actionKind: string;
  outcome: string;
  observedAt: string;
}

export interface EnvironmentBeliefUpdate {
  models: CompetingEnvironmentModel[];
  contradictedModelIds: string[];
  confidence: number;
  decision: "act" | "experiment-again";
}

export function updateEnvironmentModelBeliefs(input: {
  models: readonly CompetingEnvironmentModel[];
  observation: EnvironmentExperimentObservation;
  observationReliability?: number;
  actionConfidenceThreshold?: number;
}): EnvironmentBeliefUpdate {
  if (input.models.length < 2) {
    throw new Error("Environment belief update requires at least two competing models.");
  }
  if (!input.observation.actionKind.trim() || !input.observation.outcome.trim()) {
    throw new Error("Experiment observation requires action and outcome.");
  }
  if (Number.isNaN(Date.parse(input.observation.observedAt))) {
    throw new Error("Experiment observation timestamp is invalid.");
  }

  const reliability = input.observationReliability ?? 0.95;
  const threshold = input.actionConfidenceThreshold ?? 0.9;
  if (!Number.isFinite(reliability) || reliability <= 0.5 || reliability > 1) {
    throw new Error("Observation reliability must be in (0.5, 1].");
  }
  if (!Number.isFinite(threshold) || threshold <= 0.5 || threshold > 1) {
    throw new Error("Action confidence threshold must be in (0.5, 1].");
  }

  const seen = new Set<string>();
  let priorTotal = 0;
  for (const model of input.models) {
    if (!model.id.trim() || seen.has(model.id)) {
      throw new Error("Competing model ids must be non-empty and unique.");
    }
    if (!Number.isFinite(model.probability) || model.probability <= 0) {
      throw new Error("Competing model probabilities must be positive.");
    }
    if (!model.predictedOutcomes[input.observation.actionKind]?.trim()) {
      throw new Error("Every competing model must predict the observed experiment.");
    }
    seen.add(model.id);
    priorTotal += model.probability;
  }
  if (Math.abs(priorTotal - 1) > 1e-9) {
    throw new Error("Competing model probabilities must sum to one.");
  }

  const distinctOutcomes = new Set(
    input.models.map((model) => model.predictedOutcomes[input.observation.actionKind]),
  );
  const mismatchLikelihood =
    distinctOutcomes.size > 1
      ? (1 - reliability) / (distinctOutcomes.size - 1)
      : 1 - reliability;

  const weighted = input.models.map((model) => {
    const predicted = model.predictedOutcomes[input.observation.actionKind];
    const likelihood = predicted === input.observation.outcome
      ? reliability
      : mismatchLikelihood;
    return { model, weight: model.probability * likelihood, predicted };
  });

  const normalization = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(normalization) || normalization <= 0) {
    throw new Error("Observed outcome cannot produce a valid posterior.");
  }

  const models = weighted
    .map(({ model, weight }) => ({
      ...model,
      predictedOutcomes: { ...model.predictedOutcomes },
      probability: weight / normalization,
    }))
    .sort(
      (left, right) =>
        right.probability - left.probability || left.id.localeCompare(right.id),
    );

  const confidence = models[0]?.probability ?? 0;
  const contradictedModelIds = weighted
    .filter(({ predicted }) => predicted !== input.observation.outcome)
    .map(({ model }) => model.id)
    .sort();

  return {
    models,
    contradictedModelIds,
    confidence,
    decision: confidence >= threshold ? "act" : "experiment-again",
  };
}

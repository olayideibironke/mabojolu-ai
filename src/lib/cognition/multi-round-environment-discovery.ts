import {
  selectUncertaintyReducingExperiment,
  type CompetingEnvironmentModel,
  type DiscoveryExperiment,
} from "./active-environment-discovery";
import {
  updateEnvironmentModelBeliefs,
  type EnvironmentExperimentObservation,
} from "./environment-belief-update";

export interface DiscoveryRound {
  round: number;
  experimentId: string;
  actionKind: string;
  outcome: string;
  confidence: number;
  leadingModelId: string;
}

export interface MultiRoundDiscoveryResult {
  models: CompetingEnvironmentModel[];
  rounds: DiscoveryRound[];
  decision: "act" | "observe";
  rejectedUnsafeExperimentIds: string[];
}

export function runMultiRoundEnvironmentDiscovery(input: {
  models: readonly CompetingEnvironmentModel[];
  experiments: readonly DiscoveryExperiment[];
  observe: (experiment: DiscoveryExperiment, round: number) => EnvironmentExperimentObservation;
  maximumRounds?: number;
  maximumRisk?: number;
  actionConfidenceThreshold?: number;
  observationReliability?: number;
}): MultiRoundDiscoveryResult {
  const maximumRounds = input.maximumRounds ?? 4;
  if (!Number.isInteger(maximumRounds) || maximumRounds < 1) {
    throw new Error("Multi-round discovery requires a positive round limit.");
  }

  const maximumRisk = input.maximumRisk ?? 0.2;
  const actionConfidenceThreshold = input.actionConfidenceThreshold ?? 0.9;
  const rejectedUnsafeExperimentIds = input.experiments
    .filter(
      (experiment) =>
        !experiment.reversible ||
        !Number.isFinite(experiment.risk) ||
        experiment.risk < 0 ||
        experiment.risk > maximumRisk,
    )
    .map((experiment) => experiment.id)
    .sort();

  let models = input.models.map((model) => ({
    ...model,
    predictedOutcomes: { ...model.predictedOutcomes },
  }));
  const rounds: DiscoveryRound[] = [];

  for (let round = 1; round <= maximumRounds; round += 1) {
    const discovery = selectUncertaintyReducingExperiment({
      models,
      experiments: input.experiments,
      maximumRisk,
    });
    if (!discovery.experiment) {
      return { models, rounds, decision: "observe", rejectedUnsafeExperimentIds };
    }

    const observation = input.observe(discovery.experiment, round);
    if (observation.actionKind !== discovery.experiment.actionKind) {
      throw new Error("Discovery environment returned an outcome for the wrong action.");
    }

    const update = updateEnvironmentModelBeliefs({
      models,
      observation,
      observationReliability: input.observationReliability,
      actionConfidenceThreshold,
    });
    models = update.models;

    rounds.push({
      round,
      experimentId: discovery.experiment.id,
      actionKind: discovery.experiment.actionKind,
      outcome: observation.outcome,
      confidence: update.confidence,
      leadingModelId: update.models[0]?.id ?? "",
    });

    if (update.decision === "act") {
      return { models, rounds, decision: "act", rejectedUnsafeExperimentIds };
    }
  }

  return { models, rounds, decision: "observe", rejectedUnsafeExperimentIds };
}

import type { Observation } from "./types";
import {
  induceEnvironmentModel,
  type InducedEnvironmentModel,
} from "./open-ended-environment-induction";
import {
  induceTaskStructure,
  transitionFromObservation,
  type InducedTaskStructure,
} from "./open-ended-task-induction";
import {
  selectUncertaintyReducingExperiment,
  type CompetingEnvironmentModel,
  type DiscoveryExperiment,
  type DiscoveryExperimentDecision,
} from "./active-environment-discovery";
import {
  updateEnvironmentModelBeliefs,
  type EnvironmentBeliefUpdate,
  type EnvironmentExperimentObservation,
} from "./environment-belief-update";

export interface GovernedInductionCycle {
  environment: InducedEnvironmentModel;
  task: InducedTaskStructure;
  discovery: DiscoveryExperimentDecision;
  beliefUpdate?: EnvironmentBeliefUpdate;
  next: "observe" | "experiment" | "act";
}

export function runGovernedInductionCycle(input: {
  environmentId: string;
  observations: readonly Observation[];
  models: readonly CompetingEnvironmentModel[];
  experiments: readonly DiscoveryExperiment[];
  experimentObservation?: EnvironmentExperimentObservation;
  maximumRisk?: number;
  actionConfidenceThreshold?: number;
}): GovernedInductionCycle {
  const environment = induceEnvironmentModel({
    id: input.environmentId,
    observations: input.observations,
  });

  const transitions = input.observations.flatMap((observation) => {
    const metadata = observation.metadata ?? {};
    const hasBefore = Object.keys(metadata).some((key) => key.startsWith("before:"));
    const hasAfter = Object.keys(metadata).some((key) => key.startsWith("after:"));
    if (!hasBefore && !hasAfter) return [];
    return [transitionFromObservation(observation)];
  });

  const task = transitions.length >= 2
    ? induceTaskStructure({ transitions })
    : {
        relevantFeatures: [],
        transitionRules: [],
        unresolvedActions: [...new Set(input.experiments.map((item) => item.actionKind))].sort(),
      };

  const discovery = selectUncertaintyReducingExperiment({
    models: input.models,
    experiments: input.experiments,
    maximumRisk: input.maximumRisk,
  });

  if (!input.experimentObservation) {
    return {
      environment,
      task,
      discovery,
      next: discovery.experiment ? "experiment" : "observe",
    };
  }

  if (
    !discovery.experiment ||
    input.experimentObservation.actionKind !== discovery.experiment.actionKind
  ) {
    throw new Error("Belief updates require the outcome of the selected discovery experiment.");
  }

  const beliefUpdate = updateEnvironmentModelBeliefs({
    models: input.models,
    observation: input.experimentObservation,
    actionConfidenceThreshold: input.actionConfidenceThreshold,
  });

  return {
    environment,
    task,
    discovery,
    beliefUpdate,
    next:
      beliefUpdate.decision === "act"
        ? "act"
        : beliefUpdate.decision === "model-set-failure"
          ? "observe"
          : "experiment",
  };
}

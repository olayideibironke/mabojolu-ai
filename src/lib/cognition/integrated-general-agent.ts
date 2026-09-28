import type { Observation } from "./types";
import {
  runGovernedInductionCycle,
  type GovernedInductionCycle,
} from "./governed-environment-induction-cycle";
import {
  runAdaptiveLongHorizonLearning,
  type AdaptiveLongHorizonResult,
} from "./adaptive-long-horizon-learning";
import type { LongHorizonLearningState } from "./autonomous-long-horizon-learning";
import type { LongHorizonStrategyCandidate } from "./memory-informed-long-horizon-strategy";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";
import type {
  CompetingEnvironmentModel,
  DiscoveryExperiment,
} from "./active-environment-discovery";
import type { EnvironmentExperimentObservation } from "./environment-belief-update";

export interface IntegratedGeneralAgentResult {
  induction: GovernedInductionCycle;
  learning?: AdaptiveLongHorizonResult;
  decision: "observe" | "experiment" | "act" | "completed";
  reason:
    | "environment-unresolved"
    | "experiment-required"
    | "objective-executed"
    | "objective-completed";
}

export function runIntegratedGeneralAgentCycle(input: {
  environmentId: string;
  observations: readonly Observation[];
  models: readonly CompetingEnvironmentModel[];
  experiments: readonly DiscoveryExperiment[];
  experimentObservation?: EnvironmentExperimentObservation;
  state: LongHorizonLearningState;
  memory: PersistentMemoryStore;
  candidates: readonly LongHorizonStrategyCandidate[];
  experience: Parameters<typeof runAdaptiveLongHorizonLearning>[0]["experience"];
  maximumRisk?: number;
  actionConfidenceThreshold?: number;
  memoryWeight?: number;
}): IntegratedGeneralAgentResult {
  const induction = runGovernedInductionCycle({
    environmentId: input.environmentId,
    observations: input.observations,
    models: input.models,
    experiments: input.experiments,
    experimentObservation: input.experimentObservation,
    maximumRisk: input.maximumRisk,
    actionConfidenceThreshold: input.actionConfidenceThreshold,
  });

  if (induction.next === "observe") {
    return { induction, decision: "observe", reason: "environment-unresolved" };
  }
  if (induction.next === "experiment") {
    return { induction, decision: "experiment", reason: "experiment-required" };
  }

  const learning = runAdaptiveLongHorizonLearning({
    initialState: input.state,
    memory: input.memory,
    candidates: input.candidates,
    experience: input.experience,
    maximumRisk: input.maximumRisk,
    memoryWeight: input.memoryWeight,
  });

  return {
    induction,
    learning,
    decision: learning.state.status === "succeeded" ? "completed" : "act",
    reason:
      learning.state.status === "succeeded"
        ? "objective-completed"
        : "objective-executed",
  };
}

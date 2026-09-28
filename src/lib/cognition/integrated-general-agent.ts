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
import {
  planLongHorizonDualControl,
  type LongHorizonDualControlPlan,
} from "./hierarchical-causal-program";
import type {
  ProbabilisticCausalMechanism,
  WorldModelAction,
  WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface IntegratedGeneralAgentPlanningInput {
  mechanisms: readonly ProbabilisticCausalMechanism[];
  prior: ReadonlyMap<string, number>;
  initialState: number;
  goalState: number;
  experiments: readonly WorldModelExperiment[];
  actions: readonly WorldModelAction[];
  horizon?: number;
  costPenalty?: number;
  partialProgressWeight?: number;
}

export interface IntegratedGeneralAgentResult {
  induction: GovernedInductionCycle;
  plan?: LongHorizonDualControlPlan;
  learning?: AdaptiveLongHorizonResult;
  decision: "observe" | "experiment" | "abstain" | "act" | "completed";
  reason:
    | "environment-unresolved"
    | "experiment-required"
    | "no-safe-long-horizon-policy"
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
  planning?: IntegratedGeneralAgentPlanningInput;
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

  let plan: LongHorizonDualControlPlan | undefined;
  if (input.planning) {
    plan = planLongHorizonDualControl(
      input.planning.mechanisms,
      input.planning.prior,
      input.planning.initialState,
      input.planning.goalState,
      input.planning.experiments,
      input.planning.actions,
      {
        horizon: input.planning.horizon,
        maximumRisk: input.maximumRisk,
        costPenalty: input.planning.costPenalty,
        partialProgressWeight: input.planning.partialProgressWeight,
      },
    );

    if (plan.decision === "abstained") {
      return {
        induction,
        plan,
        decision: "abstain",
        reason: "no-safe-long-horizon-policy",
      };
    }
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
    plan,
    learning,
    decision: learning.state.status === "succeeded" ? "completed" : "act",
    reason:
      learning.state.status === "succeeded"
        ? "objective-completed"
        : "objective-executed",
  };
}

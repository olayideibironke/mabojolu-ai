import type { Observation } from "../cognition/types";
import { beginLongHorizonLearning } from "../cognition/autonomous-long-horizon-learning";
import { runIntegratedGeneralAgentCycle } from "../cognition/integrated-general-agent";
import type { CompetingEnvironmentModel, DiscoveryExperiment } from "../cognition/active-environment-discovery";
import type { PersistentMemoryStore } from "../cognition/persistent-memory-lifecycle";
import type { LongHorizonStrategyCandidate } from "../cognition/memory-informed-long-horizon-strategy";
import type { GeneralizationAgent } from "./generalization-harness";

export interface IntegratedKernelExternalObservation {
  kind: "initial" | "experiment-outcome";
  outcome?: string;
}

export interface IntegratedKernelEvaluationScenario {
  environmentId: string;
  observations: readonly Observation[];
  models: readonly CompetingEnvironmentModel[];
  experiments: readonly DiscoveryExperiment[];
  candidates: readonly LongHorizonStrategyCandidate[];
  memory: PersistentMemoryStore;
  objective: {
    id: string;
    description: string;
    successSignals: string[];
    maximumSteps: number;
  };
  initialStrategyId: string;
  actionConfidenceThreshold?: number;
  maximumRisk?: number;
}

export interface IntegratedKernelBaselineAgent
  extends GeneralizationAgent<string, IntegratedKernelExternalObservation> {
  lastKernelDecision(): ReturnType<typeof runIntegratedGeneralAgentCycle> | undefined;
}

/**
 * Evaluation-only bridge into the frozen v1.42 integrated cognitive kernel.
 *
 * The bridge does not alter cognition or encode the environment's correct
 * answer. It exposes the kernel's own discovery/act/abstain decisions as
 * evaluator actions. The external environment remains responsible for deciding
 * whether those actions succeed.
 */
export function createIntegratedKernelBaselineAgent(
  scenario: IntegratedKernelEvaluationScenario,
): IntegratedKernelBaselineAgent {
  let pendingExperimentAction: string | undefined;
  let lastKernelDecision:
    | ReturnType<typeof runIntegratedGeneralAgentCycle>
    | undefined;

  return {
    reset() {
      lastKernelDecision = undefined;
      pendingExperimentAction = undefined;
    },

    act({ observation, availableActions }) {
      const discovery = scenario.experiments.find((item) => item.actionKind === pendingExperimentAction) ?? (observation.kind === "experiment-outcome" ? scenario.experiments.find((item) => item.actionKind === "inspect") : undefined);
      const experimentObservation =
        observation.kind === "experiment-outcome" && discovery && observation.outcome
          ? {
              actionKind: discovery.actionKind,
              outcome: observation.outcome,
              observedAt: "2026-10-04T00:00:00.000Z",
            }
          : undefined;

      // The frozen kernel remains unchanged. This adapter must not claim that
      // an action succeeded before the external evaluator has scored it.
      const result = runIntegratedGeneralAgentCycle({
        environmentId: scenario.environmentId,
        observations: scenario.observations,
        models: scenario.models,
        experiments: scenario.experiments,
        experimentObservation,
        state: beginLongHorizonLearning({
          objective: scenario.objective,
          strategyId: scenario.initialStrategyId,
        }),
        memory: structuredClone(scenario.memory),
        candidates: scenario.candidates,
        maximumRisk: scenario.maximumRisk,
        actionConfidenceThreshold: scenario.actionConfidenceThreshold,
        experience: (state) => ({
          strategyId: state.strategyId,
          observedSignals: [],
        }),
      });
      lastKernelDecision = result;

      if (result.decision === "experiment") {
        const action = result.induction.discovery.experiment?.actionKind;
        pendingExperimentAction = action;
        return action && availableActions.includes(action) ? action : undefined;
      }

      if (result.decision === "observe" || result.decision === "abstain") {
        return undefined;
      }

      const strategyId = result.learning?.state.strategyId ?? scenario.initialStrategyId;
      return availableActions.includes(strategyId) ? strategyId : undefined;
    },

    lastKernelDecision() {
      return lastKernelDecision;
    },
  };
}

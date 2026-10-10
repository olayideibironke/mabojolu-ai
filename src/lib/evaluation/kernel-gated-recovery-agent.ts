import { ConsequenceGroundedLearningSession } from "./consequence-grounded-learning";
import { createIntegratedKernelBaselineAgent, type IntegratedKernelEvaluationScenario, type IntegratedKernelExternalObservation } from "./integrated-kernel-baseline-agent";
import type { GeneralizationAgent } from "./generalization-harness";

/**
 * Evaluation-only integration: the frozen kernel handles initial discovery and
 * uncertainty gating; externally scored strategy failures drive persistent
 * recovery. Recovery is performed by the Phase 2B session, not the v1.42 kernel.
 */
export function createKernelGatedRecoveryAgent(scenario: IntegratedKernelEvaluationScenario):
  GeneralizationAgent<string, IntegratedKernelExternalObservation> & {
    learningState(): ReturnType<ConsequenceGroundedLearningSession["currentState"]> | undefined;
    lastKernelDecision(): ReturnType<ReturnType<typeof createIntegratedKernelBaselineAgent>["lastKernelDecision"]>;
  } {
  const kernel = createIntegratedKernelBaselineAgent(scenario);
  let session: ConsequenceGroundedLearningSession | undefined;
  let issued: string | undefined;
  let inspected = false;
  return {
    reset(input) {
      kernel.reset(input);
      session = new ConsequenceGroundedLearningSession(
        scenario.objective,
        scenario.initialStrategyId,
        scenario.candidates,
        structuredClone(scenario.memory),
        scenario.maximumRisk,
      );
      issued = undefined;
      inspected = false;
    },
    act(input) {
      if (!session) throw new Error("Agent must be reset.");
      if (issued) throw new Error("Missing outcome for previous action.");
      const state = session.currentState();
      if (state.status !== "active") return undefined;
      if (!inspected) {
        const decision = kernel.act(input);
        if (decision === undefined) return undefined;
        if (scenario.experiments.some((experiment) => experiment.actionKind === decision)) {
          issued = decision;
          return decision;
        }
        if (!input.availableActions.includes(state.strategyId)) return undefined;
        issued = state.strategyId;
        return issued;
      }
      if (!input.availableActions.includes(state.strategyId)) return undefined;
      issued = state.strategyId;
      return issued;
    },
    onOutcome(outcome) {
      if (!session || issued !== outcome.action) throw new Error("Outcome does not match issued action.");
      issued = undefined;
      if (scenario.experiments.some((experiment) => experiment.actionKind === outcome.action)) {
        inspected = true;
        if (outcome.terminal || outcome.success) {
          // An inspection alone does not establish the strategy objective.
          // The external evaluator may terminate independently.
        }
        return;
      }
      session.record(outcome);
    },
    learningState() { return session?.currentState(); },
    lastKernelDecision() { return kernel.lastKernelDecision(); },
  };
}

import type { GeneralizationAgent } from "./generalization-harness";
import { ConsequenceGroundedLearningSession } from "./consequence-grounded-learning";
import type { LongHorizonObjective } from "../cognition/autonomous-long-horizon-learning";
import type { LongHorizonStrategyCandidate } from "../cognition/memory-informed-long-horizon-strategy";
import type { PersistentMemoryStore } from "../cognition/persistent-memory-lifecycle";

/**
 * Phase 2B adapter. Strategy recovery uses only externally returned outcomes.
 * This is a controlled recovery evaluation, not a replacement for the frozen
 * integrated-kernel baseline or evidence of open-world general intelligence.
 */
export function createConsequenceGroundedEvaluatorAgent(input: {
  objective: LongHorizonObjective;
  initialStrategyId: string;
  candidates: readonly LongHorizonStrategyCandidate[];
  memory: PersistentMemoryStore;
  maximumRisk?: number;
}): GeneralizationAgent<string, unknown> & {
  learningState(): ReturnType<ConsequenceGroundedLearningSession["currentState"]> | undefined;
  recordedConsequences(): ReturnType<ConsequenceGroundedLearningSession["consequences"]>;
} {
  let session: ConsequenceGroundedLearningSession | undefined;
  let awaitingAction: string | undefined;

  return {
    reset() {
      session = new ConsequenceGroundedLearningSession(
        input.objective,
        input.initialStrategyId,
        input.candidates,
        structuredClone(input.memory),
        input.maximumRisk,
      );
      awaitingAction = undefined;
    },
    act({ availableActions }) {
      if (!session) throw new Error("Evaluation agent must be reset before acting.");
      if (awaitingAction) throw new Error("Previous action has no environment consequence.");
      const state = session.currentState();
      if (state.status !== "active") return undefined;
      if (!availableActions.includes(state.strategyId)) return undefined;
      awaitingAction = state.strategyId;
      return state.strategyId;
    },
    onOutcome({ action, reward, success, terminal }) {
      if (!session || awaitingAction !== action) {
        throw new Error("Consequence does not match an issued action.");
      }
      session.record({ action, reward, success, terminal });
      awaitingAction = undefined;
    },
    learningState() {
      return session?.currentState();
    },
    recordedConsequences() {
      return session?.consequences() ?? [];
    },
  };
}

import {
  advanceLongHorizonLearning,
  beginLongHorizonLearning,
  type LongHorizonExperience,
  type LongHorizonLearningState,
  type LongHorizonObjective,
} from "../cognition/autonomous-long-horizon-learning";
import {
  selectMemoryInformedLongHorizonStrategy,
  type LongHorizonStrategyCandidate,
} from "../cognition/memory-informed-long-horizon-strategy";
import type { PersistentMemoryStore } from "../cognition/persistent-memory-lifecycle";

export interface ExternalActionConsequence {
  action: string;
  reward: number;
  success: boolean;
  terminal?: boolean;
  observedSignals?: readonly string[];
}

export class ConsequenceGroundedLearningSession {
  private state: LongHorizonLearningState;
  private readonly history: ExternalActionConsequence[] = [];

  constructor(
    objective: LongHorizonObjective,
    initialStrategyId: string,
    private readonly candidates: readonly LongHorizonStrategyCandidate[],
    private readonly memory: PersistentMemoryStore,
    private readonly maximumRisk?: number,
  ) {
    this.state = beginLongHorizonLearning({ objective, strategyId: initialStrategyId });
  }

  currentState(): LongHorizonLearningState {
    return structuredClone(this.state);
  }

  consequences(): readonly ExternalActionConsequence[] {
    return structuredClone(this.history);
  }

  record(consequence: ExternalActionConsequence): LongHorizonLearningState {
    if (this.state.status !== "active") {
      throw new Error("Cannot record consequences after learning terminates.");
    }
    if (consequence.action !== this.state.strategyId) {
      throw new Error("External consequence must match the active strategy.");
    }
    if (!Number.isFinite(consequence.reward)) {
      throw new Error("External reward must be finite.");
    }
    const failed = !consequence.success && (consequence.reward < 0 || Boolean(consequence.terminal));
    const observedSignals = consequence.success
      ? [...(consequence.observedSignals ?? this.state.objective.successSignals)]
      : [];
    const experience: LongHorizonExperience = {
      strategyId: consequence.action,
      observedSignals,
      failed,
      lesson: failed ? `External action ${consequence.action} failed` : undefined,
    };
    let nextStrategyId: string | undefined;
    if (failed && this.state.step + 1 < this.state.objective.maximumSteps && !consequence.terminal) {
      const failedState: LongHorizonLearningState = {
        ...this.state,
        failedStrategyIds: [...new Set([...this.state.failedStrategyIds, consequence.action])],
      };
      nextStrategyId = selectMemoryInformedLongHorizonStrategy({
        state: failedState,
        candidates: this.candidates,
        memory: this.memory,
        maximumRisk: this.maximumRisk,
      }).selectedStrategyId;
      if (!nextStrategyId) {
        throw new Error("No safe replacement strategy exists.");
      }
    }
    // Terminal failures end the external session; never invent a replacement action.
    if (failed && consequence.terminal) {
      this.state = {
        ...this.state,
        step: this.state.step + 1,
        failedStrategyIds: [...new Set([...this.state.failedStrategyIds, consequence.action])].sort(),
        lessons: [...new Set([...this.state.lessons, experience.lesson!])].sort(),
        status: "budget-exhausted",
      };
    } else {
      this.state = advanceLongHorizonLearning({
        state: this.state,
        experience,
        nextStrategyId,
      });
    }
    this.history.push(structuredClone(consequence));
    return this.currentState();
  }
}

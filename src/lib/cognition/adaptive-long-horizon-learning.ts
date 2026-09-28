import {
  advanceLongHorizonLearning,
  type LongHorizonExperience,
  type LongHorizonLearningState,
} from "./autonomous-long-horizon-learning";
import {
  selectMemoryInformedLongHorizonStrategy,
  type LongHorizonStrategyCandidate,
  type LongHorizonStrategySelection,
} from "./memory-informed-long-horizon-strategy";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";

export interface AdaptiveLongHorizonStep {
  beforeStrategyId: string;
  afterStrategyId: string;
  failed: boolean;
  completedSignals: string[];
  selection?: LongHorizonStrategySelection;
}

export interface AdaptiveLongHorizonResult {
  state: LongHorizonLearningState;
  steps: AdaptiveLongHorizonStep[];
}

export function runAdaptiveLongHorizonLearning(input: {
  initialState: LongHorizonLearningState;
  memory: PersistentMemoryStore;
  candidates: readonly LongHorizonStrategyCandidate[];
  experience: (
    state: LongHorizonLearningState,
    step: number,
  ) => LongHorizonExperience;
  maximumRisk?: number;
  memoryWeight?: number;
}): AdaptiveLongHorizonResult {
  if (input.initialState.status !== "active") {
    throw new Error("Adaptive long-horizon learning requires an active initial state.");
  }

  let state = input.initialState;
  const steps: AdaptiveLongHorizonStep[] = [];

  while (state.status === "active") {
    const beforeStrategyId = state.strategyId;
    const experience = input.experience(state, state.step + 1);
    let selection: LongHorizonStrategySelection | undefined;
    let nextStrategyId: string | undefined;

    if (experience.failed) {
      const failedState: LongHorizonLearningState = {
        ...state,
        failedStrategyIds: [
          ...new Set([...state.failedStrategyIds, state.strategyId]),
        ].sort(),
      };
      selection = selectMemoryInformedLongHorizonStrategy({
        state: failedState,
        memory: input.memory,
        candidates: input.candidates,
        maximumRisk: input.maximumRisk,
        memoryWeight: input.memoryWeight,
      });
      nextStrategyId = selection.selectedStrategyId;
      if (!nextStrategyId) {
        throw new Error("No safe memory-informed replacement strategy is available.");
      }
    }

    state = advanceLongHorizonLearning({
      state,
      experience,
      nextStrategyId,
    });

    steps.push({
      beforeStrategyId,
      afterStrategyId: state.strategyId,
      failed: Boolean(experience.failed),
      completedSignals: [...state.completedSignals],
      selection,
    });
  }

  return { state, steps };
}

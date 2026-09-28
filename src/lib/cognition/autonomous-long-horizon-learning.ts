export interface LongHorizonObjective {
  id: string;
  description: string;
  successSignals: string[];
  maximumSteps: number;
}

export interface LongHorizonLearningState {
  objective: LongHorizonObjective;
  step: number;
  strategyId: string;
  completedSignals: string[];
  failedStrategyIds: string[];
  lessons: string[];
  status: "active" | "succeeded" | "budget-exhausted";
}

export interface LongHorizonExperience {
  strategyId: string;
  observedSignals: string[];
  lesson?: string;
  failed?: boolean;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function beginLongHorizonLearning(input: {
  objective: LongHorizonObjective;
  strategyId: string;
}): LongHorizonLearningState {
  const objective = {
    ...input.objective,
    id: input.objective.id.trim(),
    description: input.objective.description.trim(),
    successSignals: uniqueSorted(input.objective.successSignals),
  };
  const strategyId = input.strategyId.trim();

  if (!objective.id || !objective.description || !strategyId) {
    throw new Error("Long-horizon learning requires objective and strategy identity.");
  }
  if (objective.successSignals.length === 0) {
    throw new Error("Long-horizon objective requires at least one success signal.");
  }
  if (!Number.isInteger(objective.maximumSteps) || objective.maximumSteps < 1) {
    throw new Error("Long-horizon objective requires a positive step budget.");
  }

  return {
    objective,
    step: 0,
    strategyId,
    completedSignals: [],
    failedStrategyIds: [],
    lessons: [],
    status: "active",
  };
}

export function advanceLongHorizonLearning(input: {
  state: LongHorizonLearningState;
  experience: LongHorizonExperience;
  nextStrategyId?: string;
}): LongHorizonLearningState {
  if (input.state.status !== "active") {
    throw new Error("Completed long-horizon learning state cannot be advanced.");
  }
  if (input.experience.strategyId.trim() !== input.state.strategyId) {
    throw new Error("Experience must belong to the active strategy.");
  }

  const observed = uniqueSorted(input.experience.observedSignals);
  const validSignals = new Set(input.state.objective.successSignals);
  const completedSignals = uniqueSorted([
    ...input.state.completedSignals,
    ...observed.filter((signal) => validSignals.has(signal)),
  ]);
  const failedStrategyIds = uniqueSorted([
    ...input.state.failedStrategyIds,
    ...(input.experience.failed ? [input.state.strategyId] : []),
  ]);
  const lesson = input.experience.lesson?.trim();
  const lessons = uniqueSorted([
    ...input.state.lessons,
    ...(lesson ? [lesson] : []),
  ]);

  const step = input.state.step + 1;
  const succeeded = input.state.objective.successSignals.every((signal) =>
    completedSignals.includes(signal),
  );

  if (succeeded) {
    return {
      ...input.state,
      step,
      completedSignals,
      failedStrategyIds,
      lessons,
      status: "succeeded",
    };
  }

  if (step >= input.state.objective.maximumSteps) {
    return {
      ...input.state,
      step,
      completedSignals,
      failedStrategyIds,
      lessons,
      status: "budget-exhausted",
    };
  }

  let strategyId = input.state.strategyId;
  if (input.experience.failed) {
    const replacement = input.nextStrategyId?.trim();
    if (!replacement) {
      throw new Error("Failed strategy requires an explicit replacement strategy.");
    }
    if (failedStrategyIds.includes(replacement)) {
      throw new Error("Long-horizon learning cannot immediately reuse a failed strategy.");
    }
    strategyId = replacement;
  }

  return {
    ...input.state,
    step,
    strategyId,
    completedSignals,
    failedStrategyIds,
    lessons,
    status: "active",
  };
}

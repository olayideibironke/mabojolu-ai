export interface GeneralizationTask<Action = string, Observation = unknown> {
  id: string;
  domain: string;
  maximumSteps: number;
  initialObservation: Observation;
  availableActions: readonly Action[];
  transition(input: {
    action: Action;
    step: number;
  }): {
    observation: Observation;
    reward: number;
    success: boolean;
    terminal?: boolean;
  };
}

export interface GeneralizationAgent<Action = string, Observation = unknown> {
  reset(input: {
    taskId: string;
    domain: string;
    maximumSteps: number;
    availableActions: readonly Action[];
  }): void;
  act(input: {
    observation: Observation;
    step: number;
    availableActions: readonly Action[];
  }): Action | undefined;
  onOutcome?(input: {
    action: Action;
    step: number;
    observation: Observation;
    reward: number;
    success: boolean;
    terminal: boolean;
  }): void;
}

export interface GeneralizationEvaluationResult<Action = string> {
  taskId: string;
  domain: string;
  success: boolean;
  terminated: boolean;
  stepsUsed: number;
  totalReward: number;
  actions: Action[];
  abstained: boolean;
  reason:
    | "success"
    | "agent-abstained"
    | "environment-terminal"
    | "step-budget-exhausted";
}

export function evaluateGeneralizationTask<Action, Observation>(input: {
  task: GeneralizationTask<Action, Observation>;
  agent: GeneralizationAgent<Action, Observation>;
}): GeneralizationEvaluationResult<Action> {
  const { task, agent } = input;

  if (!task.id.trim() || !task.domain.trim()) {
    throw new Error("Generalization tasks require non-empty id and domain.");
  }
  if (!Number.isInteger(task.maximumSteps) || task.maximumSteps < 1) {
    throw new Error("Generalization task maximumSteps must be a positive integer.");
  }
  if (task.availableActions.length === 0) {
    throw new Error("Generalization tasks require at least one available action.");
  }

  agent.reset({
    taskId: task.id,
    domain: task.domain,
    maximumSteps: task.maximumSteps,
    availableActions: task.availableActions,
  });

  let observation = task.initialObservation;
  let totalReward = 0;
  const actions: Action[] = [];

  for (let step = 0; step < task.maximumSteps; step += 1) {
    const action = agent.act({
      observation,
      step,
      availableActions: task.availableActions,
    });

    if (action === undefined) {
      return {
        taskId: task.id,
        domain: task.domain,
        success: false,
        terminated: true,
        stepsUsed: actions.length,
        totalReward,
        actions,
        abstained: true,
        reason: "agent-abstained",
      };
    }

    if (!task.availableActions.includes(action)) {
      throw new Error("Generalization agent selected an unavailable action.");
    }

    actions.push(action);
    const outcome = task.transition({ action, step });
    totalReward += outcome.reward;
    agent.onOutcome?.({
      action,
      step,
      observation: outcome.observation,
      reward: outcome.reward,
      success: outcome.success,
      terminal: Boolean(outcome.terminal),
    });
    observation = outcome.observation;

    if (outcome.success) {
      return {
        taskId: task.id,
        domain: task.domain,
        success: true,
        terminated: true,
        stepsUsed: actions.length,
        totalReward,
        actions,
        abstained: false,
        reason: "success",
      };
    }

    if (outcome.terminal) {
      return {
        taskId: task.id,
        domain: task.domain,
        success: false,
        terminated: true,
        stepsUsed: actions.length,
        totalReward,
        actions,
        abstained: false,
        reason: "environment-terminal",
      };
    }
  }

  return {
    taskId: task.id,
    domain: task.domain,
    success: false,
    terminated: true,
    stepsUsed: actions.length,
    totalReward,
    actions,
    abstained: false,
    reason: "step-budget-exhausted",
  };
}

export interface GeneralizationEvaluationSummary {
  tasks: number;
  successes: number;
  abstentions: number;
  successRate: number;
  meanSteps: number;
  meanReward: number;
}

export function summarizeGeneralizationEvaluation<Action>(
  results: readonly GeneralizationEvaluationResult<Action>[],
): GeneralizationEvaluationSummary {
  if (results.length === 0) {
    return {
      tasks: 0,
      successes: 0,
      abstentions: 0,
      successRate: 0,
      meanSteps: 0,
      meanReward: 0,
    };
  }

  const successes = results.filter((result) => result.success).length;
  const abstentions = results.filter((result) => result.abstained).length;

  return {
    tasks: results.length,
    successes,
    abstentions,
    successRate: successes / results.length,
    meanSteps:
      results.reduce((total, result) => total + result.stepsUsed, 0) /
      results.length,
    meanReward:
      results.reduce((total, result) => total + result.totalReward, 0) /
      results.length,
  };
}

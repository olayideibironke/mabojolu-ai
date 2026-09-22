export interface RecedingVectorHypothesis {
  id: string;
  repairCandidateId: string;
  prerequisiteHypothesisId: string;
  dimensionEffects: Record<string, Record<string, number>>;
  observationStdDev: number;
  actionPrerequisites: Record<string, Record<string, number>>;
}

export interface RecedingVectorAction {
  id: string;
  risk: number;
  cost: number;
  delay: number;
  reversible: boolean;
  observationDimension: string;
}

export interface RecedingVectorExperiment {
  id: string;
  risk: number;
  cost: number;
  delay: number;
  reversible: boolean;
  observationDimension: string;
}

export interface RecedingVectorGoal {
  minimums: Record<string, number>;
  maximums: Record<string, number>;
}

export interface RecedingVectorBelief {
  probabilities: Record<string, number>;
  topHypothesisId: string;
  confidence: number;
  normalizedEntropy: number;
}

export interface RecedingVectorDecision {
  decision: "act" | "experiment" | "stop" | "abstained";
  selectedId?: string;
  expectedTerminalUtility: number;
  expectedCost: number;
  expectedDelay: number;
  maximumRisk: number;
  valueOverOpenLoop: number;
  openLoopActionIds: string[];
  reason:
    | "informative-action-best"
    | "pure-experiment-best"
    | "direct-action-best"
    | "goal-satisfied"
    | "no-safe-control";
}

export interface RecedingVectorExecution {
  controlId: string;
  controlKind: "action" | "experiment";
  observedEffect: number;
  observedDimension: string;
  previousState: Record<string, number>;
  nextState: Record<string, number>;
  previousBelief: RecedingVectorBelief;
  nextBelief: RecedingVectorBelief;
}

export interface RecedingVectorControllerState {
  state: Record<string, number>;
  belief: RecedingVectorBelief;
  history: RecedingVectorExecution[];
}

function validateUnitInterval(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number in [0, 1].`);
  }
}

function validateNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number.`);
  }
}

function normalize(probabilities: Readonly<Record<string, number>>): Record<string, number> {
  const entries = Object.entries(probabilities);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Receding vector belief cannot be normalized.");
  }

  return Object.fromEntries(
    entries.map(([id, value]) => [id, value / total]),
  );
}

function entropy(probabilities: readonly number[]): number {
  let result = 0;

  for (const probability of probabilities) {
    if (probability > 0) {
      result -= probability * Math.log(probability);
    }
  }

  return result;
}

function summarizeBelief(probabilities: Readonly<Record<string, number>>): RecedingVectorBelief {
  const normalized = normalize(probabilities);
  const ranked = Object.entries(normalized).sort(
    (left, right) =>
      right[1] - left[1] ||
      left[0].localeCompare(right[0]),
  );

  const top = ranked[0];

  if (!top) {
    throw new Error("Receding vector belief has no hypotheses.");
  }

  return {
    probabilities: normalized,
    topHypothesisId: top[0],
    confidence: top[1],
    normalizedEntropy:
      ranked.length <= 1
        ? 0
        : entropy(ranked.map(([, probability]) => probability)) /
          Math.log(ranked.length),
  };
}

function gaussianLikelihood(
  observation: number,
  mean: number,
  stdDev: number,
): number {
  if (!Number.isFinite(stdDev) || stdDev <= 0) {
    throw new Error("observationStdDev must be positive and finite.");
  }

  const variance = stdDev * stdDev;

  return Math.max(
    Number.MIN_VALUE,
    Math.exp(
      -((observation - mean) * (observation - mean)) /
        (2 * variance),
    ) /
      (stdDev * Math.sqrt(2 * Math.PI)),
  );
}

function prerequisitesSatisfied(
  hypothesis: RecedingVectorHypothesis,
  actionId: string,
  state: Readonly<Record<string, number>>,
): boolean {
  const prerequisites = hypothesis.actionPrerequisites[actionId] ?? {};

  return Object.entries(prerequisites).every(
    ([dimension, threshold]) =>
      (state[dimension] ?? 0) >= threshold - Number.EPSILON,
  );
}

function effectForControl(
  hypothesis: RecedingVectorHypothesis,
  controlId: string,
  dimension: string,
  state: Readonly<Record<string, number>>,
  isAction: boolean,
): number {
  if (
    isAction &&
    !prerequisitesSatisfied(
      hypothesis,
      controlId,
      state,
    )
  ) {
    return 0;
  }

  return hypothesis.dimensionEffects[dimension]?.[controlId] ?? 0;
}

function applyAction(
  hypothesis: RecedingVectorHypothesis,
  state: Readonly<Record<string, number>>,
  action: RecedingVectorAction,
): Record<string, number> {
  const next = { ...state };
  const dimensions = new Set([
    ...Object.keys(state),
    ...Object.keys(hypothesis.dimensionEffects),
  ]);

  for (const dimension of dimensions) {
    next[dimension] =
      (next[dimension] ?? 0) +
      effectForControl(
        hypothesis,
        action.id,
        dimension,
        state,
        true,
      );
  }

  return next;
}

function vectorUtility(
  state: Readonly<Record<string, number>>,
  goal: RecedingVectorGoal,
): number {
  for (const [dimension, maximum] of Object.entries(goal.maximums)) {
    if ((state[dimension] ?? 0) > maximum + Number.EPSILON) {
      return 0;
    }
  }

  const minimumEntries = Object.entries(goal.minimums);

  if (minimumEntries.length === 0) {
    return 1;
  }

  return Math.max(
    0,
    Math.min(
      1,
      ...minimumEntries.map(([dimension, minimum]) => {
        if (minimum <= 0) {
          return 1;
        }

        return (state[dimension] ?? 0) / minimum;
      }),
    ),
  );
}

function goalSatisfied(
  state: Readonly<Record<string, number>>,
  goal: RecedingVectorGoal,
): boolean {
  return (
    Object.entries(goal.minimums).every(
      ([dimension, minimum]) =>
        (state[dimension] ?? 0) >= minimum - Number.EPSILON,
    ) &&
    Object.entries(goal.maximums).every(
      ([dimension, maximum]) =>
        (state[dimension] ?? 0) <= maximum + Number.EPSILON,
    )
  );
}

function posteriorAfterObservation(
  hypotheses: readonly RecedingVectorHypothesis[],
  prior: RecedingVectorBelief,
  controlId: string,
  observationDimension: string,
  state: Readonly<Record<string, number>>,
  observation: number,
  isAction: boolean,
): RecedingVectorBelief {
  const weighted: Record<string, number> = {};

  for (const hypothesis of hypotheses) {
    const predicted =
      effectForControl(
        hypothesis,
        controlId,
        observationDimension,
        state,
        isAction,
      );

    weighted[hypothesis.id] =
      (prior.probabilities[hypothesis.id] ?? 0) *
      gaussianLikelihood(
        observation,
        predicted,
        hypothesis.observationStdDev,
      );
  }

  return summarizeBelief(weighted);
}

function safeActions(
  actions: readonly RecedingVectorAction[],
  maximumRisk: number,
): RecedingVectorAction[] {
  return actions.filter((action) => {
    validateUnitInterval("receding action risk", action.risk);
    validateNonNegative("receding action cost", action.cost);
    validateNonNegative("receding action delay", action.delay);

    return action.reversible && action.risk <= maximumRisk;
  });
}

function safeExperiments(
  experiments: readonly RecedingVectorExperiment[],
  maximumRisk: number,
): RecedingVectorExperiment[] {
  return experiments.filter((experiment) => {
    validateUnitInterval("receding experiment risk", experiment.risk);
    validateNonNegative("receding experiment cost", experiment.cost);
    validateNonNegative("receding experiment delay", experiment.delay);

    return experiment.reversible && experiment.risk <= maximumRisk;
  });
}

function bestFollowUpAction(
  hypotheses: readonly RecedingVectorHypothesis[],
  belief: RecedingVectorBelief,
  state: Readonly<Record<string, number>>,
  goal: RecedingVectorGoal,
  actions: readonly RecedingVectorAction[],
  costWeight: number,
  delayWeight: number,
): {
  action?: RecedingVectorAction;
  expectedUtility: number;
  score: number;
} {
  const stopUtility = vectorUtility(state, goal);

  let best: {
    action?: RecedingVectorAction;
    expectedUtility: number;
    score: number;
  } = {
    expectedUtility: stopUtility,
    score: stopUtility,
  };

  for (const action of actions) {
    let expectedUtility = 0;

    for (const hypothesis of hypotheses) {
      const probability = belief.probabilities[hypothesis.id] ?? 0;
      const next = applyAction(hypothesis, state, action);

      expectedUtility +=
        probability *
        vectorUtility(
          next,
          goal,
        );
    }

    const score =
      expectedUtility -
      costWeight * action.cost -
      delayWeight * action.delay;

    if (
      score > best.score + Number.EPSILON ||
      (
        Math.abs(score - best.score) <= Number.EPSILON &&
        best.action &&
        action.id < best.action.id
      )
    ) {
      best = {
        action,
        expectedUtility,
        score,
      };
    }
  }

  return best;
}

function actionPairs(
  actions: readonly RecedingVectorAction[],
): RecedingVectorAction[][] {
  const pairs: RecedingVectorAction[][] = [];

  for (const first of actions) {
    pairs.push([first]);

    for (const second of actions) {
      if (second.id !== first.id) {
        pairs.push([first, second]);
      }
    }
  }

  return pairs;
}

function openLoopBaseline(
  hypotheses: readonly RecedingVectorHypothesis[],
  belief: RecedingVectorBelief,
  state: Readonly<Record<string, number>>,
  goal: RecedingVectorGoal,
  actions: readonly RecedingVectorAction[],
  costWeight: number,
  delayWeight: number,
): {
  actionIds: string[];
  expectedUtility: number;
  cost: number;
  delay: number;
  maximumRisk: number;
  score: number;
} | undefined {
  let best:
    | {
        actionIds: string[];
        expectedUtility: number;
        cost: number;
        delay: number;
        maximumRisk: number;
        score: number;
      }
    | undefined;

  for (const sequence of actionPairs(actions)) {
    let expectedUtility = 0;

    for (const hypothesis of hypotheses) {
      const probability = belief.probabilities[hypothesis.id] ?? 0;
      let projected = { ...state };

      for (const action of sequence) {
        projected = applyAction(
          hypothesis,
          projected,
          action,
        );
      }

      expectedUtility +=
        probability *
        vectorUtility(
          projected,
          goal,
        );
    }

    const cost = sequence.reduce(
      (sum, action) => sum + action.cost,
      0,
    );

    const delay = sequence.reduce(
      (sum, action) => sum + action.delay,
      0,
    );

    const maximumRisk = sequence.reduce(
      (risk, action) => Math.max(risk, action.risk),
      0,
    );

    const score =
      expectedUtility -
      costWeight * cost -
      delayWeight * delay;

    const candidate = {
      actionIds: sequence.map((action) => action.id),
      expectedUtility,
      cost,
      delay,
      maximumRisk,
      score,
    };

    if (
      !best ||
      candidate.score > best.score + Number.EPSILON ||
      (
        Math.abs(candidate.score - best.score) <= Number.EPSILON &&
        candidate.cost < best.cost - Number.EPSILON
      ) ||
      (
        Math.abs(candidate.score - best.score) <= Number.EPSILON &&
        Math.abs(candidate.cost - best.cost) <= Number.EPSILON &&
        candidate.actionIds.join("|") < best.actionIds.join("|")
      )
    ) {
      best = candidate;
    }
  }

  return best;
}

function evaluateAdaptiveFirstControl(
  hypotheses: readonly RecedingVectorHypothesis[],
  belief: RecedingVectorBelief,
  state: Readonly<Record<string, number>>,
  goal: RecedingVectorGoal,
  first:
    | RecedingVectorAction
    | RecedingVectorExperiment,
  firstKind: "action" | "experiment",
  followUpActions: readonly RecedingVectorAction[],
  costWeight: number,
  delayWeight: number,
): {
  expectedUtility: number;
  cost: number;
  delay: number;
  maximumRisk: number;
  score: number;
  usesInformation: boolean;
} {
  let expectedUtility = 0;
  let expectedFollowUpCost = 0;
  let expectedFollowUpDelay = 0;
  let maximumRisk = first.risk;

  const followUpIds =
    new Set<string>();

  for (const truth of hypotheses) {
    const truthProbability =
      belief.probabilities[truth.id] ?? 0;

    if (truthProbability <= 0) {
      continue;
    }

    const observedEffect =
      effectForControl(
        truth,
        first.id,
        first.observationDimension,
        state,
        firstKind === "action",
      );

    const posterior =
      posteriorAfterObservation(
        hypotheses,
        belief,
        first.id,
        first.observationDimension,
        state,
        observedEffect,
        firstKind === "action",
      );

    const stateAfterFirst =
      firstKind === "action"
        ? applyAction(
            truth,
            state,
            first as RecedingVectorAction,
          )
        : { ...state };

    const availableFollowUps =
      firstKind === "action"
        ? followUpActions.filter(
            (action) => action.id !== first.id,
          )
        : followUpActions;

    const followUp =
      bestFollowUpAction(
        hypotheses,
        posterior,
        stateAfterFirst,
        goal,
        availableFollowUps,
        costWeight,
        delayWeight,
      );

    if (followUp.action) {
      followUpIds.add(
        followUp.action.id,
      );

      expectedFollowUpCost +=
        truthProbability *
        followUp.action.cost;

      expectedFollowUpDelay +=
        truthProbability *
        followUp.action.delay;

      maximumRisk =
        Math.max(
          maximumRisk,
          followUp.action.risk,
        );

      const finalState =
        applyAction(
          truth,
          stateAfterFirst,
          followUp.action,
        );

      expectedUtility +=
        truthProbability *
        vectorUtility(
          finalState,
          goal,
        );
    } else {
      followUpIds.add("stop");

      expectedUtility +=
        truthProbability *
        vectorUtility(
          stateAfterFirst,
          goal,
        );
    }
  }

  const cost =
    first.cost +
    expectedFollowUpCost;

  const delay =
    first.delay +
    expectedFollowUpDelay;

  return {
    expectedUtility,
    cost,
    delay,
    maximumRisk,
    score:
      expectedUtility -
      costWeight * cost -
      delayWeight * delay,
    usesInformation:
      followUpIds.size > 1,
  };
}

export function chooseRecedingHorizonVectorControl(
  hypotheses: readonly RecedingVectorHypothesis[],
  controller: RecedingVectorControllerState,
  goal: RecedingVectorGoal,
  actions: readonly RecedingVectorAction[],
  experiments: readonly RecedingVectorExperiment[],
  options?: {
    maximumRisk?: number;
    costWeight?: number;
    delayWeight?: number;
    minimumValueOverOpenLoop?: number;
  },
): RecedingVectorDecision {
  if (goalSatisfied(controller.state, goal)) {
    return {
      decision: "stop",
      expectedTerminalUtility: 1,
      expectedCost: 0,
      expectedDelay: 0,
      maximumRisk: 0,
      valueOverOpenLoop: 0,
      openLoopActionIds: [],
      reason: "goal-satisfied",
    };
  }

  const maximumRisk = options?.maximumRisk ?? 0.3;
  const costWeight = options?.costWeight ?? 1;
  const delayWeight = options?.delayWeight ?? 0.2;
  const minimumValueOverOpenLoop =
    options?.minimumValueOverOpenLoop ?? 0.01;

  validateUnitInterval("maximumRisk", maximumRisk);
  validateNonNegative("costWeight", costWeight);
  validateNonNegative("delayWeight", delayWeight);
  validateNonNegative(
    "minimumValueOverOpenLoop",
    minimumValueOverOpenLoop,
  );

  const actionsSafe = safeActions(actions, maximumRisk);
  const experimentsSafe = safeExperiments(
    experiments,
    maximumRisk,
  );

  const baseline =
    openLoopBaseline(
      hypotheses,
      controller.belief,
      controller.state,
      goal,
      actionsSafe,
      costWeight,
      delayWeight,
    );

  if (!baseline) {
    return {
      decision: "abstained",
      expectedTerminalUtility:
        vectorUtility(
          controller.state,
          goal,
        ),
      expectedCost: 0,
      expectedDelay: 0,
      maximumRisk: 0,
      valueOverOpenLoop: 0,
      openLoopActionIds: [],
      reason: "no-safe-control",
    };
  }

  let bestAdaptive:
    | {
        kind: "action" | "experiment";
        id: string;
        expectedUtility: number;
        cost: number;
        delay: number;
        maximumRisk: number;
        score: number;
      }
    | undefined;

  for (const action of actionsSafe) {
    const result =
      evaluateAdaptiveFirstControl(
        hypotheses,
        controller.belief,
        controller.state,
        goal,
        action,
        "action",
        actionsSafe,
        costWeight,
        delayWeight,
      );

    if (
      result.usesInformation &&
      (
        !bestAdaptive ||
        result.score > bestAdaptive.score + Number.EPSILON ||
        (
          Math.abs(result.score - bestAdaptive.score) <= Number.EPSILON &&
          action.id < bestAdaptive.id
        )
      )
    ) {
      bestAdaptive = {
        kind: "action",
        id: action.id,
        expectedUtility:
          result.expectedUtility,
        cost: result.cost,
        delay: result.delay,
        maximumRisk:
          result.maximumRisk,
        score: result.score,
      };
    }
  }

  for (const experiment of experimentsSafe) {
    const result =
      evaluateAdaptiveFirstControl(
        hypotheses,
        controller.belief,
        controller.state,
        goal,
        experiment,
        "experiment",
        actionsSafe,
        costWeight,
        delayWeight,
      );

    if (
      result.usesInformation &&
      (
        !bestAdaptive ||
        result.score > bestAdaptive.score + Number.EPSILON ||
        (
          Math.abs(result.score - bestAdaptive.score) <= Number.EPSILON &&
          experiment.id < bestAdaptive.id
        )
      )
    ) {
      bestAdaptive = {
        kind: "experiment",
        id: experiment.id,
        expectedUtility:
          result.expectedUtility,
        cost: result.cost,
        delay: result.delay,
        maximumRisk:
          result.maximumRisk,
        score: result.score,
      };
    }
  }

  const valueOverOpenLoop =
    bestAdaptive
      ? bestAdaptive.score -
        baseline.score
      : 0;

  if (
    !bestAdaptive ||
    valueOverOpenLoop <
      minimumValueOverOpenLoop
  ) {
    return {
      decision: "act",
      selectedId:
        baseline.actionIds[0],
      expectedTerminalUtility:
        baseline.expectedUtility,
      expectedCost:
        baseline.cost,
      expectedDelay:
        baseline.delay,
      maximumRisk:
        baseline.maximumRisk,
      valueOverOpenLoop,
      openLoopActionIds: [
        ...baseline.actionIds,
      ],
      reason: "direct-action-best",
    };
  }

  return {
    decision:
      bestAdaptive.kind ===
        "action"
        ? "act"
        : "experiment",
    selectedId:
      bestAdaptive.id,
    expectedTerminalUtility:
      bestAdaptive.expectedUtility,
    expectedCost:
      bestAdaptive.cost,
    expectedDelay:
      bestAdaptive.delay,
    maximumRisk:
      bestAdaptive.maximumRisk,
    valueOverOpenLoop,
    openLoopActionIds: [
      ...baseline.actionIds,
    ],
    reason:
      bestAdaptive.kind ===
        "action"
        ? "informative-action-best"
        : "pure-experiment-best",
  };
}

export function createRecedingVectorController(
  initialState: Readonly<Record<string, number>>,
  initialBelief: Readonly<Record<string, number>>,
): RecedingVectorControllerState {
  return {
    state: { ...initialState },
    belief:
      summarizeBelief(
        initialBelief,
      ),
    history: [],
  };
}

export function executeRecedingVectorControl(
  hypotheses: readonly RecedingVectorHypothesis[],
  controller: RecedingVectorControllerState,
  actualHypothesisId: string,
  control:
    | RecedingVectorAction
    | RecedingVectorExperiment,
  kind: "action" | "experiment",
): RecedingVectorControllerState {
  const actual =
    hypotheses.find(
      (hypothesis) =>
        hypothesis.id ===
        actualHypothesisId,
    );

  if (!actual) {
    throw new Error(
      `Unknown actual hypothesis ${actualHypothesisId}.`,
    );
  }

  const previousState = {
    ...controller.state,
  };

  const previousBelief = {
    ...controller.belief,
    probabilities: {
      ...controller
        .belief
        .probabilities,
    },
  };

  const observedEffect =
    effectForControl(
      actual,
      control.id,
      control.observationDimension,
      previousState,
      kind === "action",
    );

  const nextBelief =
    posteriorAfterObservation(
      hypotheses,
      controller.belief,
      control.id,
      control.observationDimension,
      previousState,
      observedEffect,
      kind === "action",
    );

  const nextState =
    kind === "action"
      ? applyAction(
          actual,
          previousState,
          control as RecedingVectorAction,
        )
      : previousState;

  const execution:
    RecedingVectorExecution = {
    controlId:
      control.id,
    controlKind:
      kind,
    observedEffect,
    observedDimension:
      control.observationDimension,
    previousState,
    nextState: {
      ...nextState,
    },
    previousBelief,
    nextBelief: {
      ...nextBelief,
      probabilities: {
        ...nextBelief
          .probabilities,
      },
    },
  };

  return {
    state: {
      ...nextState,
    },
    belief: nextBelief,
    history: [
      ...controller.history,
      execution,
    ],
  };
}

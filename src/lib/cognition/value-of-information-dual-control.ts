import {
  predictMechanismEffect,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface DualControlAction
  extends WorldModelAction {
  delay: number;
}

export interface DualControlExperiment
  extends WorldModelExperiment {
  delay: number;
}

export interface MixedControlBranch {
  truthMechanismId: string;
  representativeObservation: number;
  posteriorTopMechanismId: string;
  posteriorConfidence: number;
  followUpActionId?: string;
  finalState: number;
  taskUtility: number;
}

export interface MixedDualControlPolicy {
  firstKind:
    | "experiment"
    | "action";
  firstId: string;
  branches: MixedControlBranch[];
  expectedTaskUtility: number;
  expectedCost: number;
  expectedDelay: number;
  maximumRisk: number;
  score: number;
  usesInformation: boolean;
}

export interface OpenLoopTaskPlan {
  decision:
    | "plan"
    | "abstained";
  actionIds: string[];
  expectedTaskUtility: number;
  totalCost: number;
  totalDelay: number;
  maximumRisk: number;
  score: number;
  reason:
    | "safe-open-loop-task-plan"
    | "no-safe-open-loop-plan";
}

export interface ValueOfInformationDecision {
  decision:
    | "experiment"
    | "act"
    | "stop"
    | "abstained";
  selectedId?: string;
  selectedPolicy?: MixedDualControlPolicy;
  openLoopBaseline: OpenLoopTaskPlan;
  valueOfInformation: number;
  expectedTaskUtility: number;
  expectedCost: number;
  expectedDelay: number;
  maximumRisk: number;
  reason:
    | "pure-experiment-worth-value"
    | "informative-action-worth-value"
    | "information-not-worth-cost"
    | "goal-already-reached"
    | "no-safe-task-plan";
}

function validateUnitInterval(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validateNonNegativeFinite(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function normalizeBelief(
  belief:
    ReadonlyMap<string, number>,
): Map<string, number> {
  const total =
    Array.from(
      belief.values(),
    ).reduce(
      (sum, probability) =>
        sum + probability,
      0,
    );

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    throw new Error(
      "Dual-control belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      belief.entries(),
    ).map(
      ([id, probability]) => [
        id,
        probability / total,
      ],
    ),
  );
}

function gaussianLikelihood(
  observation: number,
  mean: number,
  stdDev: number,
): number {
  if (
    !Number.isFinite(stdDev) ||
    stdDev <= 0
  ) {
    throw new Error(
      "Mechanism observationStdDev must be positive and finite.",
    );
  }

  const variance =
    stdDev * stdDev;

  return Math.max(
    Number.MIN_VALUE,
    Math.exp(
      -(
        (observation - mean) *
        (observation - mean)
      ) /
        (2 * variance),
    ) /
      (
        stdDev *
        Math.sqrt(
          2 * Math.PI,
        )
      ),
  );
}

function posteriorAfterObservation(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  prior:
    ReadonlyMap<string, number>,
  interventions:
    Readonly<Record<string, number>>,
  observation: number,
): Map<string, number> {
  const weighted =
    new Map<string, number>();

  for (
    const mechanism of
      mechanisms
  ) {
    weighted.set(
      mechanism.id,
      (
        prior.get(
          mechanism.id,
        ) ??
        0
      ) *
        gaussianLikelihood(
          observation,
          predictMechanismEffect(
            mechanism,
            interventions,
          ),
          mechanism.observationStdDev,
        ),
    );
  }

  return normalizeBelief(
    weighted,
  );
}

function posteriorSummary(
  belief:
    ReadonlyMap<string, number>,
): {
  topMechanismId: string;
  confidence: number;
} {
  const ranked =
    Array.from(
      belief.entries(),
    ).sort(
      (left, right) =>
        right[1] -
          left[1] ||
        left[0].localeCompare(
          right[0],
        ),
    );

  const top =
    ranked[0];

  if (!top) {
    throw new Error(
      "Dual-control posterior is empty.",
    );
  }

  return {
    topMechanismId:
      top[0],
    confidence:
      top[1],
  };
}

function taskUtility(
  state: number,
  goalState: number,
): number {
  if (
    goalState <= 0 ||
    !Number.isFinite(goalState)
  ) {
    throw new Error(
      "goalState must be positive and finite.",
    );
  }

  return Math.max(
    0,
    Math.min(
      1,
      state / goalState,
    ),
  );
}

function safeActions(
  actions:
    readonly DualControlAction[],
  maximumRisk: number,
): DualControlAction[] {
  return actions.filter(
    (action) => {
      validateUnitInterval(
        "dual-control action risk",
        action.risk,
      );

      validateNonNegativeFinite(
        "dual-control action cost",
        action.cost,
      );

      validateNonNegativeFinite(
        "dual-control action delay",
        action.delay,
      );

      return action.reversible &&
        action.risk <=
          maximumRisk;
    },
  );
}

function safeExperiments(
  experiments:
    readonly DualControlExperiment[],
  maximumRisk: number,
): DualControlExperiment[] {
  return experiments.filter(
    (experiment) => {
      validateUnitInterval(
        "dual-control experiment risk",
        experiment.risk,
      );

      validateNonNegativeFinite(
        "dual-control experiment cost",
        experiment.cost,
      );

      validateNonNegativeFinite(
        "dual-control experiment delay",
        experiment.delay,
      );

      return experiment.reversible &&
        experiment.risk <=
          maximumRisk;
    },
  );
}

function actionSequences(
  actions:
    readonly DualControlAction[],
  maximumLength: number,
): DualControlAction[][] {
  const output:
    DualControlAction[][] =
      [];

  function visit(
    remaining:
      DualControlAction[],
    chosen:
      DualControlAction[],
  ): void {
    if (
      chosen.length >
        0
    ) {
      output.push([
        ...chosen,
      ]);
    }

    if (
      chosen.length >=
        maximumLength
    ) {
      return;
    }

    for (
      let index = 0;
      index <
        remaining.length;
      index += 1
    ) {
      const action =
        remaining[index];

      if (!action) {
        continue;
      }

      chosen.push(action);

      visit(
        [
          ...remaining.slice(
            0,
            index,
          ),
          ...remaining.slice(
            index + 1,
          ),
        ],
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    [
      ...actions,
    ],
    [],
  );

  return output;
}

function expectedSequenceUtility(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  belief:
    ReadonlyMap<string, number>,
  currentState: number,
  goalState: number,
  sequence:
    readonly DualControlAction[],
): number {
  let expected =
    0;

  for (
    const mechanism of
      mechanisms
  ) {
    const probability =
      belief.get(
        mechanism.id,
      ) ??
      0;

    let state =
      currentState;

    for (
      const action of
        sequence
    ) {
      state +=
        predictMechanismEffect(
          mechanism,
          action.interventions,
        );
    }

    expected +=
      probability *
      taskUtility(
        state,
        goalState,
      );
  }

  return expected;
}

export function chooseOpenLoopTaskPlan(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  belief:
    ReadonlyMap<string, number>,
  currentState: number,
  goalState: number,
  actions:
    readonly DualControlAction[],
  options?: {
    horizon?: number;
    maximumRisk?: number;
    costWeight?: number;
    delayWeight?: number;
  },
): OpenLoopTaskPlan {
  validateNonNegativeFinite(
    "currentState",
    currentState,
  );

  const horizon =
    options?.horizon ??
    2;

  if (
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 2
  ) {
    throw new Error(
      "v1.21 open-loop planning supports horizon 1 or 2.",
    );
  }

  const maximumRisk =
    options?.maximumRisk ??
    0.3;

  const costWeight =
    options?.costWeight ??
    1;

  const delayWeight =
    options?.delayWeight ??
    0.2;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costWeight",
    costWeight,
  );

  validateNonNegativeFinite(
    "delayWeight",
    delayWeight,
  );

  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const actionsSafe =
    safeActions(
      actions,
      maximumRisk,
    );

  let best:
    OpenLoopTaskPlan |
    undefined;

  for (
    const sequence of
      actionSequences(
        actionsSafe,
        Math.min(
          horizon,
          actionsSafe.length,
        ),
      )
  ) {
    const expectedTaskUtility =
      expectedSequenceUtility(
        mechanisms,
        normalizedBelief,
        currentState,
        goalState,
        sequence,
      );

    const totalCost =
      sequence.reduce(
        (sum, action) =>
          sum + action.cost,
        0,
      );

    const totalDelay =
      sequence.reduce(
        (sum, action) =>
          sum + action.delay,
        0,
      );

    const maximumSequenceRisk =
      sequence.reduce(
        (risk, action) =>
          Math.max(
            risk,
            action.risk,
          ),
        0,
      );

    const score =
      expectedTaskUtility -
      costWeight *
        totalCost -
      delayWeight *
        totalDelay;

    const candidate:
      OpenLoopTaskPlan = {
      decision:
        "plan",

      actionIds:
        sequence.map(
          (action) =>
            action.id,
        ),

      expectedTaskUtility,

      totalCost,

      totalDelay,

      maximumRisk:
        maximumSequenceRisk,

      score,

      reason:
        "safe-open-loop-task-plan",
    };

    if (
      !best ||
      candidate.score >
        best.score +
          Number.EPSILON ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        candidate.totalCost <
          best.totalCost -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.totalCost -
            best.totalCost,
        ) <=
          Number.EPSILON &&
        candidate.actionIds.join(
          "|",
        ) <
          best.actionIds.join(
            "|",
          )
      )
    ) {
      best =
        candidate;
    }
  }

  return best ?? {
    decision:
      "abstained",

    actionIds:
      [],

    expectedTaskUtility:
      taskUtility(
        currentState,
        goalState,
      ),

    totalCost:
      0,

    totalDelay:
      0,

    maximumRisk:
      0,

    score:
      taskUtility(
        currentState,
        goalState,
      ),

    reason:
      "no-safe-open-loop-plan",
  };
}

function chooseFollowUpAction(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  posterior:
    ReadonlyMap<string, number>,
  observedState: number,
  goalState: number,
  actions:
    readonly DualControlAction[],
  costWeight: number,
  delayWeight: number,
): DualControlAction |
  undefined {
  const stopScore =
    taskUtility(
      observedState,
      goalState,
    );

  let bestAction:
    DualControlAction |
    undefined;

  let bestScore =
    stopScore;

  for (
    const action of
      actions
  ) {
    let expectedUtility =
      0;

    for (
      const mechanism of
        mechanisms
    ) {
      const probability =
        posterior.get(
          mechanism.id,
        ) ??
        0;

      const finalState =
        observedState +
        predictMechanismEffect(
          mechanism,
          action.interventions,
        );

      expectedUtility +=
        probability *
        taskUtility(
          finalState,
          goalState,
        );
    }

    const score =
      expectedUtility -
      costWeight *
        action.cost -
      delayWeight *
        action.delay;

    if (
      score >
        bestScore +
          Number.EPSILON ||
      (
        Math.abs(
          score -
            bestScore,
        ) <=
          Number.EPSILON &&
        bestAction &&
        action.id <
          bestAction.id
      )
    ) {
      bestAction =
        action;

      bestScore =
        score;
    }
  }

  return bestAction;
}

function evaluateFirstStep(
  kind:
    "experiment" |
    "action",
  first:
    DualControlExperiment |
    DualControlAction,
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  prior:
    ReadonlyMap<string, number>,
  currentState: number,
  goalState: number,
  followUpActions:
    readonly DualControlAction[],
  costWeight: number,
  delayWeight: number,
): MixedDualControlPolicy {
  const branches:
    MixedControlBranch[] =
      [];

  let expectedTaskUtility =
    0;

  let expectedFollowUpCost =
    0;

  let expectedFollowUpDelay =
    0;

  let maximumRisk =
    first.risk;

  for (
    const truth of
      mechanisms
  ) {
    const truthProbability =
      prior.get(
        truth.id,
      ) ??
      0;

    if (
      truthProbability <=
        0
    ) {
      continue;
    }

    const observation =
      predictMechanismEffect(
        truth,
        first.interventions,
      );

    const posterior =
      posteriorAfterObservation(
        mechanisms,
        prior,
        first.interventions,
        observation,
      );

    const summary =
      posteriorSummary(
        posterior,
      );

    const observedState =
      kind ===
        "action"
        ? currentState +
          observation
        : currentState;

    const availableFollowUps =
      kind ===
        "action"
        ? followUpActions.filter(
            (action) =>
              action.id !==
              first.id,
          )
        : followUpActions;

    const followUp =
      chooseFollowUpAction(
        mechanisms,
        posterior,
        observedState,
        goalState,
        availableFollowUps,
        costWeight,
        delayWeight,
      );

    const finalState =
      followUp
        ? observedState +
          predictMechanismEffect(
            truth,
            followUp.interventions,
          )
        : observedState;

    const utility =
      taskUtility(
        finalState,
        goalState,
      );

    expectedTaskUtility +=
      truthProbability *
      utility;

    if (followUp) {
      expectedFollowUpCost +=
        truthProbability *
        followUp.cost;

      expectedFollowUpDelay +=
        truthProbability *
        followUp.delay;

      maximumRisk =
        Math.max(
          maximumRisk,
          followUp.risk,
        );
    }

    branches.push({
      truthMechanismId:
        truth.id,

      representativeObservation:
        observation,

      posteriorTopMechanismId:
        summary.topMechanismId,

      posteriorConfidence:
        summary.confidence,

      followUpActionId:
        followUp?.id,

      finalState,

      taskUtility:
        utility,
    });
  }

  const expectedCost =
    first.cost +
    expectedFollowUpCost;

  const expectedDelay =
    first.delay +
    expectedFollowUpDelay;

  const score =
    expectedTaskUtility -
    costWeight *
      expectedCost -
    delayWeight *
      expectedDelay;

  const followUpSignatures =
    new Set(
      branches.map(
        (branch) =>
          branch.followUpActionId ??
          "stop",
      ),
    );

  return {
    firstKind:
      kind,

    firstId:
      first.id,

    branches:
      branches.sort(
        (left, right) =>
          left.truthMechanismId.localeCompare(
            right.truthMechanismId,
          ),
      ),

    expectedTaskUtility,

    expectedCost,

    expectedDelay,

    maximumRisk,

    score,

    usesInformation:
      followUpSignatures.size >
      1,
  };
}

export function chooseValueOfInformationDualControl(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
  belief:
    ReadonlyMap<string, number>,
  currentState: number,
  goalState: number,
  experiments:
    readonly DualControlExperiment[],
  actions:
    readonly DualControlAction[],
  options?: {
    maximumRisk?: number;
    costWeight?: number;
    delayWeight?: number;
    minimumValueOfInformation?: number;
  },
): ValueOfInformationDecision {
  validateNonNegativeFinite(
    "currentState",
    currentState,
  );

  const maximumRisk =
    options?.maximumRisk ??
    0.3;

  const costWeight =
    options?.costWeight ??
    1;

  const delayWeight =
    options?.delayWeight ??
    0.2;

  const minimumValueOfInformation =
    options
      ?.minimumValueOfInformation ??
    0.01;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costWeight",
    costWeight,
  );

  validateNonNegativeFinite(
    "delayWeight",
    delayWeight,
  );

  validateNonNegativeFinite(
    "minimumValueOfInformation",
    minimumValueOfInformation,
  );

  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const baseline =
    chooseOpenLoopTaskPlan(
      mechanisms,
      normalizedBelief,
      currentState,
      goalState,
      actions,
      {
        horizon:
          2,

        maximumRisk,

        costWeight,

        delayWeight,
      },
    );

  if (
    currentState >=
      goalState
  ) {
    return {
      decision:
        "stop",

      openLoopBaseline:
        baseline,

      valueOfInformation:
        0,

      expectedTaskUtility:
        1,

      expectedCost:
        0,

      expectedDelay:
        0,

      maximumRisk:
        0,

      reason:
        "goal-already-reached",
    };
  }

  if (
    baseline.decision !==
      "plan"
  ) {
    return {
      decision:
        "abstained",

      openLoopBaseline:
        baseline,

      valueOfInformation:
        0,

      expectedTaskUtility:
        baseline.expectedTaskUtility,

      expectedCost:
        0,

      expectedDelay:
        0,

      maximumRisk:
        0,

      reason:
        "no-safe-task-plan",
    };
  }

  const actionsSafe =
    safeActions(
      actions,
      maximumRisk,
    );

  const experimentsSafe =
    safeExperiments(
      experiments,
      maximumRisk,
    );

  const informationPolicies:
    MixedDualControlPolicy[] =
      [];

  for (
    const experiment of
      experimentsSafe
  ) {
    const policy =
      evaluateFirstStep(
        "experiment",
        experiment,
        mechanisms,
        normalizedBelief,
        currentState,
        goalState,
        actionsSafe,
        costWeight,
        delayWeight,
      );

    if (
      policy.usesInformation
    ) {
      informationPolicies.push(
        policy,
      );
    }
  }

  for (
    const action of
      actionsSafe
  ) {
    const policy =
      evaluateFirstStep(
        "action",
        action,
        mechanisms,
        normalizedBelief,
        currentState,
        goalState,
        actionsSafe,
        costWeight,
        delayWeight,
      );

    if (
      policy.usesInformation
    ) {
      informationPolicies.push(
        policy,
      );
    }
  }

  informationPolicies.sort(
    (left, right) =>
      right.score -
        left.score ||
      left.expectedCost -
        right.expectedCost ||
      left.expectedDelay -
        right.expectedDelay ||
      left.firstId.localeCompare(
        right.firstId,
      ),
  );

  const bestInformationPolicy =
    informationPolicies[0];

  const valueOfInformation =
    bestInformationPolicy
      ? bestInformationPolicy.score -
        baseline.score
      : 0;

  if (
    !bestInformationPolicy ||
    valueOfInformation <
      minimumValueOfInformation
  ) {
    return {
      decision:
        "act",

      selectedId:
        baseline.actionIds[0],

      openLoopBaseline:
        baseline,

      valueOfInformation,

      expectedTaskUtility:
        baseline.expectedTaskUtility,

      expectedCost:
        baseline.totalCost,

      expectedDelay:
        baseline.totalDelay,

      maximumRisk:
        baseline.maximumRisk,

      reason:
        "information-not-worth-cost",
    };
  }

  return {
    decision:
      bestInformationPolicy
        .firstKind ===
        "experiment"
        ? "experiment"
        : "act",

    selectedId:
      bestInformationPolicy
        .firstId,

    selectedPolicy:
      bestInformationPolicy,

    openLoopBaseline:
      baseline,

    valueOfInformation,

    expectedTaskUtility:
      bestInformationPolicy
        .expectedTaskUtility,

    expectedCost:
      bestInformationPolicy
        .expectedCost,

    expectedDelay:
      bestInformationPolicy
        .expectedDelay,

    maximumRisk:
      bestInformationPolicy
        .maximumRisk,

    reason:
      bestInformationPolicy
        .firstKind ===
        "experiment"
        ? "pure-experiment-worth-value"
        : "informative-action-worth-value",
  };
}

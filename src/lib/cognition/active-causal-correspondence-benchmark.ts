import {
  ActiveCausalCorrespondenceLearner,
  chooseTransferredPlanningAction,
  generateCausalCorrespondenceHypotheses,
  simulateCausalExperimentObservation,
  type CausalCorrespondenceExperiment,
  type CausalCorrespondenceResolution,
  type TransferredPlanningAction,
  type TransferredPlanningDecision,
} from "./active-causal-correspondence";

import {
  evaluateRepresentationPrimitive,
  type RepresentationDomainBinding,
  type RepresentationPrimitive,
} from "./representation-synthesis";

export interface ActiveCausalCorrespondenceBenchmarkReport {
  activeResolution: CausalCorrespondenceResolution;
  activeExperimentIds: string[];
  activeExperimentCost: number;
  activeMaximumRisk: number;
  passiveResolution: CausalCorrespondenceResolution;
  passiveExperimentIds: string[];
  passiveExperimentCost: number;
  plannerDecision: TransferredPlanningDecision;
  plannerGoalReached: boolean;
  cheapestBaselineActionId: string;
  cheapestBaselineGoalReached: boolean;
  blockedUnsafeExperimentIds: string[];
}

const VARIABLES = [
  "demandShock",
  "forecastUncertainty",
  "holidayIndex",
  "queuePressure",
  "sensorNoise",
] as const;

const TRUE_VARIABLE_SET = [
  "demandShock",
  "forecastUncertainty",
  "queuePressure",
] as const;

const ROLE_COUNT =
  3;

const PRIMITIVE:
  RepresentationPrimitive = {
  id:
    "mean(signal-a,signal-b,signal-c)",

  operator:
    "mean",

  roles: [
    "signal-a",
    "signal-b",
    "signal-c",
  ],

  complexity:
    3,
};

const THRESHOLD =
  0.5;

const EXPERIMENTS:
  readonly CausalCorrespondenceExperiment[] = [
    {
      id:
        "unsafe-triple",

      variables: [
        "demandShock",
        "forecastUncertainty",
        "queuePressure",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
    {
      id:
        "pair-core",

      variables: [
        "demandShock",
        "forecastUncertainty",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "pair-holiday",

      variables: [
        "demandShock",
        "holidayIndex",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.06,

      reversible:
        true,
    },
    {
      id:
        "pair-queue",

      variables: [
        "demandShock",
        "queuePressure",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.07,

      reversible:
        true,
    },
    {
      id:
        "pair-sensor",

      variables: [
        "demandShock",
        "sensorNoise",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.08,

      reversible:
        true,
    },
    ...VARIABLES.map(
      (
        variable,
        index,
      ) => ({
        id:
          `single-${variable}`,

        variables: [
          variable,
        ],

        interventionMagnitude:
          0.3,

        risk:
          0.1,

        cost:
          0.2 +
          index *
            0.01,

        reversible:
          true,
      }),
    ),
  ];

const PASSIVE_EXPERIMENT_IDS = [
  "single-demandShock",
  "single-forecastUncertainty",
  "single-holidayIndex",
  "single-queuePressure",
  "single-sensorNoise",
] as const;

const CURRENT_STATE:
  Readonly<
    Record<
      string,
      number
    >
  > = {
    demandShock:
      0.4,

    forecastUncertainty:
      0.4,

    queuePressure:
      0.4,

    holidayIndex:
      0.1,

    sensorNoise:
      0.1,
  };

const ACTIONS:
  readonly TransferredPlanningAction[] = [
    {
      id:
        "cheap-nuisance",

      variable:
        "holidayIndex",

      delta:
        0.6,

      cost:
        0.01,

      risk:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "raise-demand",

      variable:
        "demandShock",

      delta:
        0.4,

      cost:
        0.2,

      risk:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "raise-forecast",

      variable:
        "forecastUncertainty",

      delta:
        0.4,

      cost:
        0.3,

      risk:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "unsafe-queue",

      variable:
        "queuePressure",

      delta:
        0.4,

      cost:
        0.05,

      risk:
        0.8,

      reversible:
        false,
    },
  ];

function newLearner():
  ActiveCausalCorrespondenceLearner {
  return new ActiveCausalCorrespondenceLearner(
    generateCausalCorrespondenceHypotheses(
      VARIABLES,
      ROLE_COUNT,
    ),
    ROLE_COUNT,
  );
}

function runActiveLearner(): {
  resolution:
    CausalCorrespondenceResolution;
  experimentIds:
    string[];
  experimentCost:
    number;
  maximumRisk:
    number;
  blockedUnsafeExperimentIds:
    string[];
} {
  const learner =
    newLearner();

  const experimentIds:
    string[] =
      [];

  let experimentCost =
    0;

  let maximumRisk =
    0;

  for (
    let step =
      0;
    step <
      10;
    step +=
      1
  ) {
    const resolution =
      learner.resolve();

    if (
      resolution.decision ===
        "resolved"
    ) {
      return {
        resolution,
        experimentIds,
        experimentCost,
        maximumRisk,

        blockedUnsafeExperimentIds:
          learner
            .getAuditSummary()
            .blockedExperimentIds,
      };
    }

    const choice =
      learner.chooseExperiment(
        EXPERIMENTS,
      );

    if (
      choice.decision !==
        "experiment" ||
      !choice.experiment
    ) {
      break;
    }

    experimentIds.push(
      choice.experiment.id,
    );

    experimentCost +=
      choice.experiment.cost;

    maximumRisk =
      Math.max(
        maximumRisk,
        choice
          .experiment
          .risk,
      );

    learner.recordObservation(
      choice.experiment,
      simulateCausalExperimentObservation(
        TRUE_VARIABLE_SET,
        choice.experiment,
        ROLE_COUNT,
      ),
    );
  }

  return {
    resolution:
      learner.resolve(),

    experimentIds,
    experimentCost,
    maximumRisk,

    blockedUnsafeExperimentIds:
      learner
        .getAuditSummary()
        .blockedExperimentIds,
  };
}

function runPassiveLearner(): {
  resolution:
    CausalCorrespondenceResolution;
  experimentIds:
    string[];
  experimentCost:
    number;
} {
  const learner =
    newLearner();

  const experimentIds:
    string[] =
      [];

  let experimentCost =
    0;

  for (
    const experimentId of
      PASSIVE_EXPERIMENT_IDS
  ) {
    if (
      learner.resolve()
        .decision ===
        "resolved"
    ) {
      break;
    }

    const experiment =
      EXPERIMENTS.find(
        (candidate) =>
          candidate.id ===
          experimentId,
      );

    if (
      !experiment
    ) {
      throw new Error(
        `Passive benchmark experiment ${experimentId} is missing.`,
      );
    }

    experimentIds.push(
      experiment.id,
    );

    experimentCost +=
      experiment.cost;

    learner.recordObservation(
      experiment,
      simulateCausalExperimentObservation(
        TRUE_VARIABLE_SET,
        experiment,
        ROLE_COUNT,
      ),
    );
  }

  return {
    resolution:
      learner.resolve(),

    experimentIds,

    experimentCost,
  };
}

function trueBinding():
  RepresentationDomainBinding {
  const variables = [
    ...TRUE_VARIABLE_SET,
  ].sort();

  return {
    domainId:
      "hidden-target-ground-truth",

    roleToVariable: {
      "signal-a":
        variables[
          0
        ]!,

      "signal-b":
        variables[
          1
        ]!,

      "signal-c":
        variables[
          2
        ]!,
    },
  };
}

function applyAction(
  state:
    Readonly<
      Record<
        string,
        number
      >
    >,

  action:
    TransferredPlanningAction,
): Record<
  string,
  number
> {
  const current =
    state[
      action.variable
    ];

  if (
    current ===
      undefined
  ) {
    throw new Error(
      `Planning benchmark action ${action.id} targets an unknown variable.`,
    );
  }

  return {
    ...state,

    [
      action.variable
    ]:
      Math.min(
        1,
        Math.max(
          0,
          current +
            action.delta,
        ),
      ),
  };
}

function groundTruthGoalReached(
  action:
    TransferredPlanningAction,
): boolean {
  return evaluateRepresentationPrimitive(
    PRIMITIVE,
    applyAction(
      CURRENT_STATE,
      action,
    ),
    trueBinding(),
  ) >
    THRESHOLD;
}

export function runActiveCausalCorrespondenceBenchmark():
  ActiveCausalCorrespondenceBenchmarkReport {
  const active =
    runActiveLearner();

  const passive =
    runPassiveLearner();

  if (
    active.resolution
      .decision !==
      "resolved" ||
    !active.resolution
      .variableSet
  ) {
    throw new Error(
      "Active causal correspondence benchmark failed to resolve the target mapping.",
    );
  }

  const plannerDecision =
    chooseTransferredPlanningAction(
      PRIMITIVE,
      THRESHOLD,
      active.resolution
        .variableSet,
      CURRENT_STATE,
      ACTIONS,
    );

  if (
    plannerDecision.decision !==
      "act" ||
    !plannerDecision.action
  ) {
    throw new Error(
      "Transferred causal planner failed to select a safe goal-reaching action.",
    );
  }

  const cheapestBaselineAction =
    ACTIONS
      .filter(
        (action) =>
          action.reversible &&
          action.risk <=
            0.3,
      )
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          left.cost -
            right.cost ||
          left.id.localeCompare(
            right.id,
          ),
      )[
        0
      ];

  if (
    !cheapestBaselineAction
  ) {
    throw new Error(
      "Planning benchmark has no safe baseline action.",
    );
  }

  return {
    activeResolution:
      active.resolution,

    activeExperimentIds:
      active.experimentIds,

    activeExperimentCost:
      active.experimentCost,

    activeMaximumRisk:
      active.maximumRisk,

    passiveResolution:
      passive.resolution,

    passiveExperimentIds:
      passive.experimentIds,

    passiveExperimentCost:
      passive.experimentCost,

    plannerDecision,

    plannerGoalReached:
      groundTruthGoalReached(
        plannerDecision.action,
      ),

    cheapestBaselineActionId:
      cheapestBaselineAction.id,

    cheapestBaselineGoalReached:
      groundTruthGoalReached(
        cheapestBaselineAction,
      ),

    blockedUnsafeExperimentIds:
      active.blockedUnsafeExperimentIds,
  };
}

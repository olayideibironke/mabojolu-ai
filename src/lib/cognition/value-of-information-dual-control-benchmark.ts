import {
  chooseValueOfInformationDualControl,
  type DualControlAction,
  type DualControlExperiment,
  type ValueOfInformationDecision,
} from "./value-of-information-dual-control";

import type {
  ProbabilisticCausalMechanism,
} from "./probabilistic-causal-world-model";

export interface ValueOfInformationDualControlBenchmarkReport {
  informativeActionDecision:
    ValueOfInformationDecision;
  pureExperimentDecision:
    ValueOfInformationDecision;
  invariantPlanDecision:
    ValueOfInformationDecision;
  informativeActionFollowUps:
    Record<string, string | undefined>;
  informativeActionValueOfInformation:
    number;
  pureExperimentValueOfInformation:
    number;
}

const MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "slow-world",

      effects: {
        diagnostic:
          0.2,
        probe:
          0.2,
        slow:
          1,
        fast:
          0.1,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "fast-world",

      effects: {
        diagnostic:
          0.6,
        probe:
          0.8,
        slow:
          0.1,
        fast:
          1,
      },

      observationStdDev:
        0.05,
    },
  ];

const PRIOR =
  new Map([
    [
      "slow-world",
      0.5,
    ],
    [
      "fast-world",
      0.5,
    ],
  ]);

const BASE_ACTIONS:
  readonly DualControlAction[] = [
    {
      id:
        "diagnostic-progress",

      interventions: {
        diagnostic:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "finish-slow",

      interventions: {
        slow:
          1,
      },

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "finish-fast",

      interventions: {
        fast:
          1,
      },

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,
    },
  ];

const BASE_EXPERIMENT:
  DualControlExperiment = {
  id:
    "pure-probe",

  interventions: {
    probe:
      1,
  },

  risk:
    0.1,

  cost:
    0.08,

  delay:
    0.15,

  reversible:
    true,
};

function invariantDecision():
  ValueOfInformationDecision {
  const mechanisms:
    ProbabilisticCausalMechanism[] = [
    {
      id:
        "left",

      effects: {
        probe:
          0.2,
        universal:
          1,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "right",

      effects: {
        probe:
          0.8,
        universal:
          1,
      },

      observationStdDev:
        0.05,
    },
  ];

  const actions:
    DualControlAction[] = [
    {
      id:
        "universal-finish",

      interventions: {
        universal:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,
    },
  ];

  return chooseValueOfInformationDualControl(
    mechanisms,
    new Map([
      [
        "left",
        0.5,
      ],
      [
        "right",
        0.5,
      ],
    ]),
    0,
    1,
    [
      BASE_EXPERIMENT,
    ],
    actions,
  );
}

export function runValueOfInformationDualControlBenchmark():
  ValueOfInformationDualControlBenchmarkReport {
  const informativeActionDecision =
    chooseValueOfInformationDualControl(
      MECHANISMS,
      PRIOR,
      0,
      1,
      [
        BASE_EXPERIMENT,
      ],
      BASE_ACTIONS,
    );

  const expensiveActions:
    DualControlAction[] = [
    {
      ...BASE_ACTIONS[
        0
      ]!,

      cost:
        0.25,

      delay:
        0.2,
    },
    {
      ...BASE_ACTIONS[
        1
      ]!,

      cost:
        0.3,
    },
    {
      ...BASE_ACTIONS[
        2
      ]!,

      cost:
        0.3,
    },
  ];

  const cheapExperiment:
    DualControlExperiment = {
    ...BASE_EXPERIMENT,

    cost:
      0.03,

    delay:
      0.05,
  };

  const pureExperimentDecision =
    chooseValueOfInformationDualControl(
      MECHANISMS,
      PRIOR,
      0,
      1,
      [
        cheapExperiment,
      ],
      expensiveActions,
    );

  const informativeActionFollowUps:
    Record<
      string,
      string |
      undefined
    > = {};

  for (
    const branch of
      informativeActionDecision
        .selectedPolicy
        ?.branches ??
      []
  ) {
    informativeActionFollowUps[
      branch
        .truthMechanismId
    ] =
      branch
        .followUpActionId;
  }

  return {
    informativeActionDecision,

    pureExperimentDecision,

    invariantPlanDecision:
      invariantDecision(),

    informativeActionFollowUps,

    informativeActionValueOfInformation:
      informativeActionDecision
        .valueOfInformation,

    pureExperimentValueOfInformation:
      pureExperimentDecision
        .valueOfInformation,
  };
}

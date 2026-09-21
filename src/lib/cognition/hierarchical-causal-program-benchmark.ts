import {
  planLongHorizonDualControl,
  selectValidatedHierarchicalProgram,
  synthesizeHierarchicalCausalPrograms,
  type HierarchicalCausalProgram,
  type HierarchicalProgramDecision,
  type LongHorizonDualControlPlan,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  ProbabilisticCausalMechanism,
  WorldModelAction,
  WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface HierarchicalCausalProgramBenchmarkReport {
  hierarchicalDecision:
    HierarchicalProgramDecision;
  bestSingleFragmentProtectedError: number;
  hierarchicalProtectedError: number;
  discoveryObservationIds: string[];
  protectedObservationIds: string[];
  longHorizonPlan:
    LongHorizonDualControlPlan;
  actionOnlyPlan:
    LongHorizonDualControlPlan;
  longHorizonExpectedCost: number;
  longHorizonGoalSuccessProbability: number;
  actionOnlyGoalSuccessProbability: number;
}

const INCUMBENT:
  HierarchicalCausalProgram = {
  id:
    "base-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments:
    [],

  observationStdDev:
    0.05,

  depth:
    1,

  complexity:
    0,
};

const FRAGMENTS:
  readonly ValidatedCausalFragment[] = [
    {
      id:
        "xy-fragment",

      terms: [
        {
          id:
            "interaction(x,y)",

          kind:
            "interaction",

          variables: [
            "x",
            "y",
          ],

          coefficient:
            0.4,
        },
      ],

      validationMeanSquaredError:
        0,

      sourceEvidenceCount:
        4,
    },
    {
      id:
        "yz-fragment",

      terms: [
        {
          id:
            "interaction(y,z)",

          kind:
            "interaction",

          variables: [
            "y",
            "z",
          ],

          coefficient:
            0.3,
        },
      ],

      validationMeanSquaredError:
        0,

      sourceEvidenceCount:
        4,
    },
  ];

function observation(
  id:
    string,

  x:
    number,

  y:
    number,

  z:
    number,

  measuredEffect:
    number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        x,
        y,
        z,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },

    measuredEffect,
  };
}

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "discover-xy",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "discover-yz",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "discover-all",
      1,
      1,
      1,
      1,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-x",
      1,
      0,
      0,
      0.1,
    ),
    observation(
      "protected-y",
      0,
      1,
      0,
      0.1,
    ),
    observation(
      "protected-z",
      0,
      0,
      1,
      0.1,
    ),
    observation(
      "protected-half",
      0.5,
      0.5,
      0.5,
      0.325,
    ),
    observation(
      "protected-all",
      1,
      1,
      1,
      1,
    ),
  ];

function protectedMse(
  program:
    HierarchicalCausalProgram,
): number {
  return PROTECTED.reduce(
    (
      total,
      item,
    ) => {
      const base =
        Object.entries(
          item
            .experiment
            .interventions,
        ).reduce(
          (
            sum,
            [
              variable,
              magnitude,
            ],
          ) =>
            sum +
            (
              program
                .baseEffects[
                  variable
                ] ??
              0
            ) *
            magnitude,
          0,
        );

      const fragmentEffect =
        program.fragments.reduce(
          (
            sum,
            fragment,
          ) =>
            sum +
            fragment.terms.reduce(
              (
                termTotal,
                term,
              ) => {
                if (
                  term.kind ===
                    "interaction"
                ) {
                  return termTotal +
                    term.coefficient *
                    term.variables.reduce(
                      (
                        product,
                        variable,
                      ) =>
                        product *
                        (
                          item
                            .experiment
                            .interventions[
                              variable
                            ] ??
                          0
                        ),
                      1,
                    );
                }

                if (
                  term.kind ===
                    "linear"
                ) {
                  return termTotal +
                    term.coefficient *
                    (
                      item
                        .experiment
                        .interventions[
                          term
                            .variables[
                              0
                            ]!
                        ] ??
                      0
                    );
                }

                return termTotal +
                  term.coefficient;
              },
              0,
            ),
          0,
        );

      const error =
        item.measuredEffect -
        (
          base +
          fragmentEffect
        );

      return total +
        error *
          error;
    },
    0,
  ) /
    PROTECTED.length;
}

const MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "slow",

      effects: {
        x:
          0.05,
        w:
          0.05,
        y:
          0.4,
        v:
          0.4,
        z:
          0.2,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "fast",

      effects: {
        x:
          0.4,
        w:
          0.4,
        y:
          0.05,
        v:
          0.05,
        z:
          0.8,
      },

      observationStdDev:
        0.05,
    },
  ];

const EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "probe-z",

      interventions: {
        z:
          1,
      },

      risk:
        0.1,

      cost:
        0.03,

      reversible:
        true,
    },
    {
      id:
        "unsafe-probe",

      interventions: {
        z:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "fast-a",

      interventions: {
        x:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "fast-b",

      interventions: {
        w:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "slow-a",

      interventions: {
        y:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "slow-b",

      interventions: {
        v:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "unsafe-action",

      interventions: {
        x:
          1,
        y:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

const PRIOR =
  new Map([
    [
      "slow",
      0.5,
    ],
    [
      "fast",
      0.5,
    ],
  ]);

export function runHierarchicalCausalProgramBenchmark():
  HierarchicalCausalProgramBenchmarkReport {
  const candidates =
    synthesizeHierarchicalCausalPrograms(
      INCUMBENT,
      FRAGMENTS,
      DISCOVERY,
    );

  const hierarchicalDecision =
    selectValidatedHierarchicalProgram(
      INCUMBENT,
      candidates,
      PROTECTED,
    );

  const singleFragmentErrors =
    candidates
      .filter(
        (candidate) =>
          candidate
            .program
            .fragments
            .length ===
          1,
      )
      .map(
        (candidate) =>
          protectedMse(
            candidate.program,
          ),
      );

  if (
    singleFragmentErrors.length ===
      0
  ) {
    throw new Error(
      "Hierarchical benchmark produced no single-fragment baseline.",
    );
  }

  const bestSingleFragmentProtectedError =
    Math.min(
      ...singleFragmentErrors,
    );

  const hierarchicalProtectedError =
    protectedMse(
      hierarchicalDecision
        .champion,
    );

  const longHorizonPlan =
    planLongHorizonDualControl(
      MECHANISMS,
      PRIOR,
      0.1,
      0.85,
      EXPERIMENTS,
      ACTIONS,
      {
        horizon:
          3,
      },
    );

  const actionOnlyPlan =
    planLongHorizonDualControl(
      MECHANISMS,
      PRIOR,
      0.1,
      0.85,
      [],
      ACTIONS,
      {
        horizon:
          3,
      },
    );

  return {
    hierarchicalDecision,

    bestSingleFragmentProtectedError,

    hierarchicalProtectedError,

    discoveryObservationIds:
      DISCOVERY.map(
        (item) =>
          item.experiment.id,
      ),

    protectedObservationIds:
      PROTECTED.map(
        (item) =>
          item.experiment.id,
      ),

    longHorizonPlan,

    actionOnlyPlan,

    longHorizonExpectedCost:
      longHorizonPlan
        .expectedCost,

    longHorizonGoalSuccessProbability:
      longHorizonPlan
        .expectedGoalSuccessProbability,

    actionOnlyGoalSuccessProbability:
      actionOnlyPlan
        .expectedGoalSuccessProbability,
  };
}

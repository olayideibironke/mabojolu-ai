import {
  describe,
  expect,
  it,
} from "vitest";

import {
  HierarchicalProgramPosterior,
  diagnoseHierarchicalFragmentFailure,
  generateAutonomousSubgoalPlan,
  materializeAutonomousSubgoals,
  reconcileAutonomousSubgoals,
} from "./uncertain-hierarchical-program";

import {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

const XY_FRAGMENT:
  ValidatedCausalFragment = {
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
};

const YZ_FRAGMENT:
  ValidatedCausalFragment = {
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
};

const FULL_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "full-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    XY_FRAGMENT,
    YZ_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
};

const PARTIAL_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "partial-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    XY_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
};

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

describe(
  "HierarchicalProgramPosterior",
  () => {
    it(
      "maintains probability over competing hierarchical programs under noisy evidence",
      () => {
        const posterior =
          new HierarchicalProgramPosterior([
            FULL_PROGRAM,
            PARTIAL_PROGRAM,
          ]);

        posterior.recordObservation(
          observation(
            "noisy-yz",
            0,
            1,
            1,
            0.48,
          ),
        );

        const belief =
          posterior.getBelief();

        expect(
          belief.topProgramId,
        ).toBe(
          "full-program",
        );

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          belief
            .probabilities[
              "partial-program"
            ],
        ).toBeGreaterThan(
          0,
        );

        expect(
          Object.values(
            belief.probabilities,
          ).reduce(
            (
              total,
              probability,
            ) =>
              total +
              probability,
            0,
          ),
        ).toBeCloseTo(
          1,
        );
      },
    );

    it(
      "does not collapse uncertainty before any evidence arrives",
      () => {
        const posterior =
          new HierarchicalProgramPosterior([
            FULL_PROGRAM,
            PARTIAL_PROGRAM,
          ]);

        const belief =
          posterior.getBelief();

        expect(
          belief.confidence,
        ).toBeCloseTo(
          0.5,
        );

        expect(
          belief.margin,
        ).toBeCloseTo(
          0,
        );

        expect(
          belief.normalizedEntropy,
        ).toBeCloseTo(
          1,
        );
      },
    );
  },
);

describe(
  "hierarchical fragment failure attribution",
  () => {
    it(
      "blames the fragment whose removal repairs the failed prediction",
      () => {
        const flawed:
          HierarchicalCausalProgram = {
          ...FULL_PROGRAM,

          id:
            "flawed-program",

          fragments: [
            XY_FRAGMENT,
            {
              ...YZ_FRAGMENT,

              id:
                "bad-yz-fragment",

              terms: [
                {
                  ...YZ_FRAGMENT
                    .terms[
                      0
                    ]!,

                  coefficient:
                    0.7,
                },
              ],
            },
          ],
        };

        const diagnosis =
          diagnoseHierarchicalFragmentFailure(
            flawed,
            observation(
              "failure-yz",
              0,
              1,
              1,
              0.2,
            ),
          );

        expect(
          diagnosis
            .blamedFragmentIds,
        ).toEqual([
          "bad-yz-fragment",
        ]);

        expect(
          diagnosis
            .attributions[
              0
            ],
        ).toMatchObject({
          fragmentId:
            "bad-yz-fragment",

          blamed:
            true,

          withoutFragmentSquaredError:
            0,
        });

        expect(
          diagnosis
            .attributions
            .find(
              (item) =>
                item
                  .fragmentId ===
                "xy-fragment",
            )
            ?.blamed,
        ).toBe(
          false,
        );
      },
    );

    it(
      "does not blame a fragment when removing it makes the prediction worse",
      () => {
        const diagnosis =
          diagnoseHierarchicalFragmentFailure(
            FULL_PROGRAM,
            observation(
              "correct-yz",
              0,
              1,
              1,
              0.5,
            ),
          );

        expect(
          diagnosis
            .blamedFragmentIds,
        ).toEqual(
          [],
        );
      },
    );
  },
);

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "01-prepare-xy",

      interventions: {
        x:
          1,
        y:
          1,
      },

      risk:
        0.1,

      cost:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "02-bridge-yz",

      interventions: {
        y:
          1,
        z:
          1,
      },

      risk:
        0.1,

      cost:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "cheap-nuisance",

      interventions: {
        nuisance:
          1,
      },

      risk:
        0.05,

      cost:
        0.01,

      reversible:
        true,
    },
    {
      id:
        "unsafe-shortcut",

      interventions: {
        x:
          1,
        y:
          1,
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

function concentratedPosterior():
  HierarchicalProgramPosterior {
  const posterior =
    new HierarchicalProgramPosterior([
      FULL_PROGRAM,
      PARTIAL_PROGRAM,
    ]);

  posterior.recordObservation(
    observation(
      "calibrate-yz",
      0,
      1,
      1,
      0.5,
    ),
  );

  return posterior;
}

describe(
  "autonomous subgoal formation",
  () => {
    it(
      "creates intermediate state goals from the cheapest safe posterior-supported action sequence",
      () => {
        const posterior =
          concentratedPosterior();

        const plan =
          generateAutonomousSubgoalPlan(
            posterior.getPrograms(),
            posterior.getProbabilityMap(),
            0.1,
            1,
            ACTIONS,
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "planned",

          actionIds: [
            "01-prepare-xy",
            "02-bridge-yz",
          ],

          totalCost:
            0.2,

          maximumRisk:
            0.1,

          reason:
            "posterior-supported-subgoals",
        });

        expect(
          plan
            .goalSuccessProbability,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          plan.subgoals,
        ).toHaveLength(
          2,
        );

        expect(
          plan
            .subgoals[
              0
            ],
        ).toMatchObject({
          id:
            "autonomous-subgoal-1",

          actionId:
            "01-prepare-xy",

          targetState:
            0.7,

          dependsOnGoalIds:
            [],
        });

        expect(
          plan
            .subgoals[
              1
            ],
        ).toMatchObject({
          id:
            "autonomous-subgoal-2",

          actionId:
            "02-bridge-yz",

          targetState:
            1,

          dependsOnGoalIds: [
            "autonomous-subgoal-1",
          ],
        });
      },
    );

    it(
      "ignores a cheaper irrelevant action and an unsafe shortcut",
      () => {
        const posterior =
          concentratedPosterior();

        const plan =
          generateAutonomousSubgoalPlan(
            posterior.getPrograms(),
            posterior.getProbabilityMap(),
            0.1,
            1,
            ACTIONS,
          );

        expect(
          plan.actionIds,
        ).not.toContain(
          "cheap-nuisance",
        );

        expect(
          plan.actionIds,
        ).not.toContain(
          "unsafe-shortcut",
        );
      },
    );

    it(
      "materializes generated subgoals into the existing dependency-aware goal hierarchy",
      () => {
        const posterior =
          concentratedPosterior();

        const plan =
          generateAutonomousSubgoalPlan(
            posterior.getPrograms(),
            posterior.getProbabilityMap(),
            0.1,
            1,
            ACTIONS,
          );

        let tick =
          0;

        const reasoner =
          new HierarchicalGoalReasoner(
            () =>
              `2026-09-21T19:00:${String(
                tick++,
              ).padStart(
                2,
                "0",
              )}Z`,
          );

        reasoner.registerRoot({
          id:
            "terminal-goal",

          description:
            "Reach state 1.000.",

          priority:
            100,

          status:
            "active",

          successCriteria: [
            "Observed state is at least 1.000.",
          ],

          constraints: [
            "Use only safe reversible actions.",
          ],

          createdAt:
            "2026-09-21T19:00:00Z",

          updatedAt:
            "2026-09-21T19:00:00Z",
        });

        const goals =
          materializeAutonomousSubgoals(
            reasoner,
            "terminal-goal",
            plan,
          );

        expect(
          goals,
        ).toHaveLength(
          2,
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "autonomous-subgoal-1",
        );

        const completed =
          reconcileAutonomousSubgoals(
            reasoner,
            plan,
            0.75,
          );

        expect(
          completed,
        ).toEqual([
          "autonomous-subgoal-1",
        ]);

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "autonomous-subgoal-2",
        );
      },
    );

    it(
      "abstains when the posterior does not support any safe sequence reaching the terminal goal",
      () => {
        const posterior =
          new HierarchicalProgramPosterior([
            FULL_PROGRAM,
            PARTIAL_PROGRAM,
          ]);

        const plan =
          generateAutonomousSubgoalPlan(
            posterior.getPrograms(),
            posterior.getProbabilityMap(),
            0.1,
            1,
            ACTIONS,
            {
              minimumGoalSuccessProbability:
                0.9,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "abstained",

          actionIds:
            [],

          subgoals:
            [],

          reason:
            "no-safe-subgoal-plan",
        });
      },
    );
  },
);

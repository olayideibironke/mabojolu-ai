import {
  describe,
  expect,
  it,
} from "vitest";

import {
  chooseEpistemicSubgoal,
  generateMultidimensionalPlan,
  materializeEpistemicSubgoal,
  materializeMultidimensionalSubgoals,
  synthesizeFragmentRepairCandidates,
  updateMultidimensionalBeliefFromExperiment,
  validateAutonomousFragmentRepairs,
  type MultidimensionalCausalModel,
} from "./multidimensional-self-revision";

import {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  WorldModelAction,
  WorldModelExperiment,
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

const BAD_YZ_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "bad-yz-fragment",

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
        0.7,
    },
  ],

  validationMeanSquaredError:
    0,

  sourceEvidenceCount:
    4,
};

const FLAWED_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "flawed-program",

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
    BAD_YZ_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
};

const QUARANTINED:
  FragmentReliabilitySummary = {
  fragments: [
    {
      fragmentId:
        "xy-fragment",

      episodes:
        2,

      supportEpisodes:
        2,

      blameEpisodes:
        0,

      neutralEpisodes:
        0,

      posteriorReliability:
        0.75,

      quarantined:
        false,
    },
    {
      fragmentId:
        "bad-yz-fragment",

      episodes:
        3,

      supportEpisodes:
        0,

      blameEpisodes:
        3,

      neutralEpisodes:
        0,

      posteriorReliability:
        0.2,

      quarantined:
        true,
    },
  ],

  quarantinedFragmentIds: [
    "bad-yz-fragment",
  ],
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

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "repair-yz-1",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "repair-yz-2",
      0,
      0.5,
      0.5,
      0.175,
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
      "protected-yz",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "protected-all",
      1,
      1,
      1,
      1,
    ),
  ];

describe(
  "autonomous fragment repair synthesis",
  () => {
    it(
      "fits a replacement coefficient directly from residual repair evidence",
      () => {
        const candidates =
          synthesizeFragmentRepairCandidates(
            FLAWED_PROGRAM,
            QUARANTINED,
            REPAIR_EVIDENCE,
          );

        expect(
          candidates,
        ).toHaveLength(
          1,
        );

        expect(
          candidates[
            0
          ],
        ).toMatchObject({
          damagedFragmentId:
            "bad-yz-fragment",

          evidenceCount:
            2,
        });

        expect(
          candidates[
            0
          ]!
            .fittedCoefficient,
        ).toBeCloseTo(
          0.3,
        );

        expect(
          candidates[
            0
          ]!
            .discoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "installs the synthesized repair only after it wins on protected evidence",
      () => {
        const candidates =
          synthesizeFragmentRepairCandidates(
            FLAWED_PROGRAM,
            QUARANTINED,
            REPAIR_EVIDENCE,
          );

        const decision =
          validateAutonomousFragmentRepairs(
            FLAWED_PROGRAM,
            QUARANTINED,
            candidates,
            PROTECTED,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "repaired",

          damagedFragmentId:
            "bad-yz-fragment",

          synthesizedFragmentId:
            "bad-yz-fragment+synthesized-repair",

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-synthesized-repair",
        });

        expect(
          decision
            .program
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "bad-yz-fragment+synthesized-repair",
        ]);

        expect(
          decision
            .program
            .fragments[
              1
            ]!
            .terms[
              0
            ]!
            .coefficient,
        ).toBeCloseTo(
          0.3,
        );
      },
    );

    it(
      "does not synthesize repairs when reliability evidence has not quarantined a fragment",
      () => {
        const candidates =
          synthesizeFragmentRepairCandidates(
            FLAWED_PROGRAM,
            {
              ...QUARANTINED,

              quarantinedFragmentIds:
                [],
            },
            REPAIR_EVIDENCE,
          );

        expect(
          candidates,
        ).toEqual(
          [],
        );
      },
    );
  },
);

function program(
  id:
    string,

  effects:
    Record<
      string,
      number
    >,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      ...effects,
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
}

const MODEL_A:
  MultidimensionalCausalModel = {
  id:
    "model-a",

  dimensionPrograms: {
    progress:
      program(
        "a-progress",
        {
          a:
            0.5,
          b:
            0.5,
          shortcut:
            1,
          probe:
            0.2,
        },
      ),

    exposure:
      program(
        "a-exposure",
        {
          a:
            0.1,
          b:
            0.1,
          shortcut:
            0.8,
          probe:
            0,
        },
      ),
  },
};

const MODEL_B:
  MultidimensionalCausalModel = {
  id:
    "model-b",

  dimensionPrograms: {
    progress:
      program(
        "b-progress",
        {
          a:
            0.45,
          b:
            0.55,
          shortcut:
            1,
          probe:
            0.8,
        },
      ),

    exposure:
      program(
        "b-exposure",
        {
          a:
            0.12,
          b:
            0.08,
          shortcut:
            0.8,
          probe:
            0,
        },
      ),
  },
};

const MODELS = [
  MODEL_A,
  MODEL_B,
] as const;

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "01-a",

      interventions: {
        a:
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
        "02-b",

      interventions: {
        b:
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
        "shortcut",

      interventions: {
        shortcut:
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
        "unsafe",

      interventions: {
        a:
          1,
        b:
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

const EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "probe-route",

      interventions: {
        probe:
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
        "unsafe-probe",

      interventions: {
        probe:
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
      "model-a",
      0.5,
    ],
    [
      "model-b",
      0.5,
    ],
  ]);

describe(
  "multidimensional constraint-aware planning",
  () => {
    it(
      "chooses the cheapest safe sequence satisfying progress and exposure constraints across the model belief",
      () => {
        const plan =
          generateMultidimensionalPlan(
            MODELS,
            PRIOR,
            {
              progress:
                0,
              exposure:
                0,
            },
            {
              minimums: {
                progress:
                  1,
              },

              maximums: {
                exposure:
                  0.3,
              },
            },
            ACTIONS,
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "planned",

          actionIds: [
            "01-a",
            "02-b",
          ],

          goalSuccessProbability:
            1,

          totalCost:
            0.2,

          maximumRisk:
            0.1,

          reason:
            "posterior-supported-vector-plan",
        });

        expect(
          plan
            .expectedFinalState
            .progress,
        ).toBeCloseTo(
          1,
        );

        expect(
          plan
            .expectedFinalState
            .exposure,
        ).toBeCloseTo(
          0.2,
        );
      },
    );

    it(
      "rejects a cheaper shortcut that reaches progress but violates the exposure constraint",
      () => {
        const plan =
          generateMultidimensionalPlan(
            MODELS,
            PRIOR,
            {
              progress:
                0,
              exposure:
                0,
            },
            {
              minimums: {
                progress:
                  1,
              },

              maximums: {
                exposure:
                  0.3,
              },
            },
            ACTIONS,
          );

        expect(
          plan.actionIds,
        ).not.toContain(
          "shortcut",
        );

        expect(
          plan.actionIds,
        ).not.toContain(
          "cheap-nuisance",
        );

        expect(
          plan.actionIds,
        ).not.toContain(
          "unsafe",
        );
      },
    );

    it(
      "creates intermediate vector subgoals rather than scalar checkpoints",
      () => {
        const plan =
          generateMultidimensionalPlan(
            MODELS,
            PRIOR,
            {
              progress:
                0,
              exposure:
                0,
            },
            {
              minimums: {
                progress:
                  1,
              },

              maximums: {
                exposure:
                  0.3,
              },
            },
            ACTIONS,
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
            ]!
            .targetState
            .progress,
        ).toBeCloseTo(
          0.475,
        );

        expect(
          plan
            .subgoals[
              0
            ]!
            .targetState
            .exposure,
        ).toBeCloseTo(
          0.11,
        );

        expect(
          plan
            .subgoals[
              1
            ]!
            .dependsOnGoalIds,
        ).toEqual([
          "vector-subgoal-1",
        ]);
      },
    );
  },
);

describe(
  "mixed epistemic and progress subgoals",
  () => {
    it(
      "chooses a safe information-seeking prerequisite while model uncertainty is high",
      () => {
        const selection =
          chooseEpistemicSubgoal(
            MODELS,
            PRIOR,
            EXPERIMENTS,
            "progress",
          );

        expect(
          selection,
        ).toMatchObject({
          decision:
            "selected",

          subgoal: {
            id:
              "epistemic-subgoal-1",

            experimentId:
              "probe-route",

            diagnosticDimension:
              "progress",
          },

          reason:
            "model-uncertainty-requires-information",
        });

        expect(
          selection
            .subgoal!
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.68,
        );
      },
    );

    it(
      "updates the multidimensional model posterior from the epistemic experiment",
      () => {
        const posterior =
          updateMultidimensionalBeliefFromExperiment(
            MODELS,
            PRIOR,
            EXPERIMENTS[
              0
            ]!,
            "progress",
            0.79,
          );

        expect(
          posterior.get(
            "model-b",
          ),
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          posterior.get(
            "model-a",
          ),
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "places the epistemic goal and vector progress goals in one dependency hierarchy",
      () => {
        const selection =
          chooseEpistemicSubgoal(
            MODELS,
            PRIOR,
            EXPERIMENTS,
            "progress",
          );

        const posterior =
          updateMultidimensionalBeliefFromExperiment(
            MODELS,
            PRIOR,
            EXPERIMENTS[
              0
            ]!,
            "progress",
            0.79,
          );

        const plan =
          generateMultidimensionalPlan(
            MODELS,
            posterior,
            {
              progress:
                0,
              exposure:
                0,
            },
            {
              minimums: {
                progress:
                  1,
              },

              maximums: {
                exposure:
                  0.3,
              },
            },
            ACTIONS,
          );

        let tick =
          0;

        const reasoner =
          new HierarchicalGoalReasoner(
            () =>
              `2026-09-21T20:10:${String(
                tick++,
              ).padStart(
                2,
                "0",
              )}Z`,
          );

        reasoner.registerRoot({
          id:
            "vector-terminal-goal",

          description:
            "Reach progress at least 1.000 while exposure stays at or below 0.300.",

          priority:
            100,

          status:
            "active",

          successCriteria: [
            "progress >= 1.000",
            "exposure <= 0.300",
          ],

          constraints: [
            "Use only safe reversible actions and experiments.",
          ],

          createdAt:
            "2026-09-21T20:10:00Z",

          updatedAt:
            "2026-09-21T20:10:00Z",
        });

        const epistemic =
          materializeEpistemicSubgoal(
            reasoner,
            "vector-terminal-goal",
            selection,
          );

        materializeMultidimensionalSubgoals(
          reasoner,
          "vector-terminal-goal",
          plan,
          epistemic.id,
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "epistemic-subgoal-1",
        );

        reasoner.complete(
          "epistemic-subgoal-1",
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "vector-subgoal-1",
        );

        const vectorOne =
          reasoner
            .getSnapshot()
            .goals
            .find(
              (goal) =>
                goal.id ===
                "vector-subgoal-1",
            );

        expect(
          vectorOne
            ?.constraints,
        ).toEqual(
          expect.arrayContaining([
            "Use only safe reversible actions and experiments.",
            "Preserve all multidimensional terminal constraints and hard safety limits.",
          ]),
        );
      },
    );
  },
);

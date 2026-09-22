import {
  describe,
  expect,
  it,
} from "vitest";

import {
  generatePrerequisiteAwarePlan,
  learnActionPrerequisite,
  materializePrerequisiteAwareSubgoals,
  revisePrerequisiteAwareGoalChain,
  synthesizeStructuralRepairCandidates,
  validateStructuralRepairCandidates,
  type ActionPrerequisiteObservation,
  type LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

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
  MultidimensionalCausalModel,
} from "./multidimensional-self-revision";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

const BAD_LINEAR_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "bad-linear-y",

  terms: [
    {
      id:
        "linear(y)",

      kind:
        "linear",

      variables: [
        "y",
      ],

      coefficient:
        0.6,
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
    "wrong-topology-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    BAD_LINEAR_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
};

const QUARANTINED:
  FragmentReliabilitySummary = {
  fragments: [
    {
      fragmentId:
        "bad-linear-y",

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
    "bad-linear-y",
  ],
};

function structuralObservation(
  id:
    string,

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
        x:
          0,
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
    structuralObservation(
      "repair-joint-full",
      1,
      1,
      0.7,
    ),
    structuralObservation(
      "repair-y-only",
      1,
      0,
      0.1,
    ),
    structuralObservation(
      "repair-half-y-full-z",
      0.5,
      1,
      0.4,
    ),
    structuralObservation(
      "repair-half-joint",
      0.5,
      0.5,
      0.225,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    structuralObservation(
      "protected-y-only",
      1,
      0,
      0.1,
    ),
    structuralObservation(
      "protected-z-only",
      0,
      1,
      0.1,
    ),
    structuralObservation(
      "protected-quarter-joint",
      0.25,
      0.5,
      0.1375,
    ),
    structuralObservation(
      "protected-full-joint",
      1,
      1,
      0.7,
    ),
  ];

describe(
  "structural repair topology synthesis",
  () => {
    it(
      "discovers an interaction repair when the quarantined linear topology cannot explain repair evidence",
      () => {
        const candidates =
          synthesizeStructuralRepairCandidates(
            FLAWED_PROGRAM,
            QUARANTINED,
            REPAIR_EVIDENCE,
            [
              "y",
              "z",
            ],
          );

        expect(
          candidates[
            0
          ]!
            .fragment
            .terms[
              0
            ],
        ).toMatchObject({
          id:
            "interaction(y,z)",

          kind:
            "interaction",

          coefficient:
            0.5,
        });

        expect(
          candidates[
            0
          ]!
            .topologyChanged,
        ).toBe(
          true,
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
      "promotes the topology-changing repair only after disjoint protected validation",
      () => {
        const candidates =
          synthesizeStructuralRepairCandidates(
            FLAWED_PROGRAM,
            QUARANTINED,
            REPAIR_EVIDENCE,
            [
              "y",
              "z",
            ],
          );

        const decision =
          validateStructuralRepairCandidates(
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
            "bad-linear-y",

          synthesizedFragmentId:
            "bad-linear-y+structure:interaction(y,z)",

          topologyChanged:
            true,

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-structural-repair",
        });

        expect(
          decision
            .program
            .fragments[
              0
            ]!
            .terms[
              0
            ]!
            .kind,
        ).toBe(
          "interaction",
        );
      },
    );

    it(
      "fails closed if repair-fitting and protected evidence overlap",
      () => {
        const candidates =
          synthesizeStructuralRepairCandidates(
            FLAWED_PROGRAM,
            QUARANTINED,
            REPAIR_EVIDENCE,
            [
              "y",
              "z",
            ],
          );

        expect(
          () =>
            validateStructuralRepairCandidates(
              FLAWED_PROGRAM,
              QUARANTINED,
              candidates,
              [
                REPAIR_EVIDENCE[
                  0
                ]!,
              ],
            ),
        ).toThrow(
          /must remain disjoint/,
        );
      },
    );
  },
);

const INITIAL_PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.1,
        nuisance:
          0.1,
      },

      observedEffects: {
        progress:
          0.02,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.2,
        nuisance:
          0.9,
      },

      observedEffects: {
        progress:
          0.03,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.5,
        nuisance:
          0.1,
      },

      observedEffects: {
        progress:
          0.8,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.6,
        nuisance:
          0.9,
      },

      observedEffects: {
        progress:
          0.78,
      },
    },
  ];

const STRICTER_PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.4,
      },

      observedEffects: {
        progress:
          0.02,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.6,
      },

      observedEffects: {
        progress:
          0.03,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.8,
      },

      observedEffects: {
        progress:
          0.8,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.9,
      },

      observedEffects: {
        progress:
          0.82,
      },
    },
  ];

function simpleProgram(
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

const MODEL:
  MultidimensionalCausalModel = {
  id:
    "vector-model",

  dimensionPrograms: {
    readiness:
      simpleProgram(
        "readiness-program",
        {
          "prep-light":
            0.5,
          "prep-strong":
            0.8,
        },
      ),

    progress:
      simpleProgram(
        "progress-program",
        {
          finish:
            0.8,
          shortcut:
            1,
        },
      ),

    exposure:
      simpleProgram(
        "exposure-program",
        {
          "prep-light":
            0.05,
          "prep-strong":
            0.1,
          finish:
            0.1,
          shortcut:
            0.8,
        },
      ),
  },
};

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "prep-light",

      interventions: {
        "prep-light":
          1,
      },

      risk:
        0.05,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "prep-strong",

      interventions: {
        "prep-strong":
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
        "finish",

      interventions: {
        finish:
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
        "shortcut",

      interventions: {
        shortcut:
          1,
      },

      risk:
        0.1,

      cost:
        0.02,

      reversible:
        true,
    },
  ];

const GOAL = {
  minimums: {
    progress:
      0.8,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function rootReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T20:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "terminal-vector-goal",

    description:
      "Reach progress >= 0.800 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.800",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions.",
      "Honor learned prerequisites.",
    ],

    createdAt:
      "2026-09-21T20:30:00Z",

    updatedAt:
      "2026-09-21T20:30:00Z",
  });

  return reasoner;
}

describe(
  "learned action prerequisites and vector replanning",
  () => {
    it(
      "learns readiness rather than nuisance as the action prerequisite",
      () => {
        const prerequisite =
          learnActionPrerequisite(
            INITIAL_PREREQUISITE_EVIDENCE,
            "finish",
            "progress",
            [
              "readiness",
              "nuisance",
            ],
          );

        expect(
          prerequisite,
        ).toMatchObject({
          actionId:
            "finish",

          targetDimension:
            "progress",

          stateDimension:
            "readiness",

          evidenceCount:
            4,
        });

        expect(
          prerequisite!
            .threshold,
        ).toBeCloseTo(
          0.35,
        );

        expect(
          prerequisite!
            .effectGap,
        ).toBeGreaterThan(
          0.75,
        );
      },
    );

    it(
      "plans preparation before finish and rejects a constraint-violating shortcut",
      () => {
        const prerequisite =
          learnActionPrerequisite(
            INITIAL_PREREQUISITE_EVIDENCE,
            "finish",
            "progress",
            [
              "readiness",
              "nuisance",
            ],
          )!;

        const plan =
          generatePrerequisiteAwarePlan(
            [
              MODEL,
            ],
            new Map([
              [
                "vector-model",
                1,
              ],
            ]),
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            GOAL,
            ACTIONS,
            [
              prerequisite,
            ],
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "planned",

          actionIds: [
            "prep-light",
            "finish",
          ],

          goalSuccessProbability:
            1,
          reason:
            "prerequisite-aware-vector-plan",
        });

        expect(
          plan.totalCost,
        ).toBeCloseTo(
          0.15,
        );

        expect(
          plan.actionIds,
        ).not.toContain(
          "shortcut",
        );

        expect(
          plan
            .subgoals[
              1
            ]!
            .prerequisiteDescriptions,
        ).toEqual([
          "readiness >= 0.350 before finish",
        ]);
      },
    );

    it(
      "replans to stronger preparation when new evidence raises the learned prerequisite threshold",
      () => {
        const initial =
          learnActionPrerequisite(
            INITIAL_PREREQUISITE_EVIDENCE,
            "finish",
            "progress",
            [
              "readiness",
            ],
          )!;

        const stricter =
          learnActionPrerequisite(
            STRICTER_PREREQUISITE_EVIDENCE,
            "finish",
            "progress",
            [
              "readiness",
            ],
          )!;

        expect(
          stricter.threshold,
        ).toBeCloseTo(
          0.7,
        );

        const initialPlan =
          generatePrerequisiteAwarePlan(
            [
              MODEL,
            ],
            new Map([
              [
                "vector-model",
                1,
              ],
            ]),
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            GOAL,
            ACTIONS,
            [
              initial,
            ],
          );

        const revisedPlan =
          generatePrerequisiteAwarePlan(
            [
              MODEL,
            ],
            new Map([
              [
                "vector-model",
                1,
              ],
            ]),
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            GOAL,
            ACTIONS,
            [
              stricter,
            ],
          );

        expect(
          initialPlan.actionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        expect(
          revisedPlan.actionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);

        const reasoner =
          rootReasoner();

        materializePrerequisiteAwareSubgoals(
          reasoner,
          "terminal-vector-goal",
          initialPlan,
        );

        const revision =
          revisePrerequisiteAwareGoalChain(
            reasoner,
            "terminal-vector-goal",
            initialPlan,
            revisedPlan,
            1,
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "revised",

          oldActionIds: [
            "prep-light",
            "finish",
          ],

          newActionIds: [
            "prep-strong",
            "finish",
          ],

          replacementGoalIds: [
            "prerequisite-revised-1-1",
            "prerequisite-revised-1-2",
          ],

          terminalGoalPreserved:
            true,

          reason:
            "prerequisites-changed-plan",
        });

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "prerequisite-revised-1-1",
        );

        const snapshot =
          reasoner.getSnapshot();

        expect(
          snapshot
            .goals
            .find(
              (goal) =>
                goal.id ===
                "prerequisite-vector-subgoal-1",
            )
            ?.status,
        ).toBe(
          "abandoned",
        );

        expect(
          snapshot
            .goals
            .find(
              (goal) =>
                goal.id ===
                "terminal-vector-goal",
            )
            ?.constraints,
        ).toEqual([
          "Use only safe reversible actions.",
          "Honor learned prerequisites.",
        ]);
      },
    );
  },
);

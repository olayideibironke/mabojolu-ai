import {
  describe,
  expect,
  it,
} from "vitest";

import {
  FragmentReliabilityTracker,
  accumulateFragmentReliability,
  reviseAutonomousSubgoalsAfterDivergence,
  reviseHierarchicalProgramFromReliability,
} from "./self-revising-hierarchical-program";

import {
  generateAutonomousSubgoalPlan,
  materializeAutonomousSubgoals,
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

const REPAIRED_YZ_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "repaired-yz-fragment",

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
    5,
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

const REPAIRED_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "repaired-program",

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
    REPAIRED_YZ_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
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

const RELIABILITY_EPISODES:
  readonly StructuralMechanismObservation[] = [
    observation(
      "failure-yz-1",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "support-xy-1",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "failure-yz-2",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "support-xy-2",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "failure-yz-3",
      0,
      1,
      1,
      0.5,
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
  "cross-episode fragment reliability",
  () => {
    it(
      "requires repeated blame before a fragment is quarantined",
      () => {
        const tracker =
          new FragmentReliabilityTracker([
            "xy-fragment",
            "bad-yz-fragment",
          ]);

        const first =
          accumulateFragmentReliability(
            FLAWED_PROGRAM,
            [
              RELIABILITY_EPISODES[
                0
              ]!,
            ],
          );

        tracker.recordDiagnosis(
          first.diagnoses[
            0
          ]!,
        );

        expect(
          tracker
            .getEvidence(
              "bad-yz-fragment",
            )
            .quarantined,
        ).toBe(
          false,
        );

        const second =
          accumulateFragmentReliability(
            FLAWED_PROGRAM,
            [
              RELIABILITY_EPISODES[
                2
              ]!,
            ],
          );

        tracker.recordDiagnosis(
          second.diagnoses[
            0
          ]!,
        );

        expect(
          tracker
            .getEvidence(
              "bad-yz-fragment",
            )
            .quarantined,
        ).toBe(
          true,
        );
      },
    );

    it(
      "accumulates support for a healthy fragment while repeated failures quarantine the bad fragment",
      () => {
        const result =
          accumulateFragmentReliability(
            FLAWED_PROGRAM,
            RELIABILITY_EPISODES,
          );

        const xy =
          result.summary.fragments.find(
            (fragment) =>
              fragment.fragmentId ===
              "xy-fragment",
          );

        const yz =
          result.summary.fragments.find(
            (fragment) =>
              fragment.fragmentId ===
              "bad-yz-fragment",
          );

        expect(
          xy,
        ).toMatchObject({
          supportEpisodes:
            2,

          blameEpisodes:
            0,

          quarantined:
            false,
        });

        expect(
          xy!
            .posteriorReliability,
        ).toBeCloseTo(
          0.75,
        );

        expect(
          yz,
        ).toMatchObject({
          blameEpisodes:
            3,

          quarantined:
            true,
        });

        expect(
          yz!
            .posteriorReliability,
        ).toBeCloseTo(
          0.2,
        );
      },
    );
  },
);

describe(
  "protected fragment repair and rollback",
  () => {
    it(
      "repairs a repeatedly blamed fragment only when the replacement wins protected validation",
      () => {
        const reliability =
          accumulateFragmentReliability(
            FLAWED_PROGRAM,
            RELIABILITY_EPISODES,
          ).summary;

        const revision =
          reviseHierarchicalProgramFromReliability(
            FLAWED_PROGRAM,
            reliability,
            [
              REPAIRED_YZ_FRAGMENT,
            ],
            PROTECTED,
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "repaired",

          retiredFragmentIds: [
            "bad-yz-fragment",
          ],

          replacementFragmentIds: {
            "bad-yz-fragment":
              "repaired-yz-fragment",
          },

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-repair",
        });

        expect(
          revision
            .program
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "repaired-yz-fragment",
        ]);

        expect(
          revision.improvement,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "rolls back a bad fragment when no validated repair is available but removal improves protected evidence",
      () => {
        const reliability =
          accumulateFragmentReliability(
            FLAWED_PROGRAM,
            RELIABILITY_EPISODES,
          ).summary;

        const revision =
          reviseHierarchicalProgramFromReliability(
            FLAWED_PROGRAM,
            reliability,
            [],
            PROTECTED,
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "rolled-back",

          retiredFragmentIds: [
            "bad-yz-fragment",
          ],

          replacementFragmentIds:
            {},

          reason:
            "protected-rollback",
        });

        expect(
          revision
            .program
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
        ]);

        expect(
          revision
            .revisedProtectedMeanSquaredError,
        ).toBeLessThan(
          revision
            .incumbentProtectedMeanSquaredError,
        );
      },
    );

    it(
      "keeps the incumbent when no fragment has earned quarantine",
      () => {
        const tracker =
          new FragmentReliabilityTracker([
            "xy-fragment",
            "bad-yz-fragment",
          ]);

        const revision =
          reviseHierarchicalProgramFromReliability(
            FLAWED_PROGRAM,
            tracker.getSummary(),
            [
              REPAIRED_YZ_FRAGMENT,
            ],
            PROTECTED,
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "retained",

          improvement:
            0,

          reason:
            "incumbent-protected",
        });
      },
    );
  },
);

const ORIGINAL_ACTIONS:
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
  ];

const REVISION_ACTIONS:
  readonly WorldModelAction[] = [
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
        "03-finish-x",

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
  ];

function reasonerWithPlan(
  plan:
    ReturnType<
      typeof generateAutonomousSubgoalPlan
    >,
): HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T20:00:${String(
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
      "Preserve terminal objective.",
    ],

    createdAt:
      "2026-09-21T20:00:00Z",

    updatedAt:
      "2026-09-21T20:00:00Z",
  });

  materializeAutonomousSubgoals(
    reasoner,
    "terminal-goal",
    plan,
  );

  return reasoner;
}

describe(
  "dynamic autonomous subgoal revision",
  () => {
    it(
      "replaces the stale subgoal chain when observed progress falls outside tolerance",
      () => {
        const original =
          generateAutonomousSubgoalPlan(
            [
              REPAIRED_PROGRAM,
            ],
            new Map([
              [
                "repaired-program",
                1,
              ],
            ]),
            0.1,
            1,
            ORIGINAL_ACTIONS,
          );

        expect(
          original.decision,
        ).toBe(
          "planned",
        );

        expect(
          original
            .subgoals[
              0
            ]!
            .targetState,
        ).toBeCloseTo(
          0.7,
        );

        const reasoner =
          reasonerWithPlan(
            original,
          );

        const beforeRoot =
          reasoner
            .getSnapshot()
            .goals
            .find(
              (goal) =>
                goal.id ===
                "terminal-goal",
            )!;

        const revision =
          reviseAutonomousSubgoalsAfterDivergence(
            reasoner,
            "terminal-goal",
            original,
            1,
            0.45,
            [
              REPAIRED_PROGRAM,
            ],
            new Map([
              [
                "repaired-program",
                1,
              ],
            ]),
            REVISION_ACTIONS,
            {
              divergenceTolerance:
                0.1,

              revisionNumber:
                1,
            },
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "revised",

          staleGoalIds: [
            "autonomous-subgoal-1",
            "autonomous-subgoal-2",
          ],

          replacementGoalIds: [
            "revised-subgoal-1-1",
            "revised-subgoal-1-2",
          ],

          terminalGoalPreserved:
            true,

          reason:
            "posterior-supported-revision",
        });

        expect(
          revision.divergence,
        ).toBeCloseTo(
          0.25,
        );

        expect(
          revision
            .revisedPlan
            ?.actionIds,
        ).toEqual([
          "02-bridge-yz",
          "03-finish-x",
        ]);

        expect(
          revision
            .revisedPlan
            ?.subgoals[
              0
            ]!
            .targetState,
        ).toBeCloseTo(
          0.95,
        );

        expect(
          revision
            .revisedPlan
            ?.subgoals[
              1
            ]!
            .targetState,
        ).toBeCloseTo(
          1,
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "revised-subgoal-1-1",
        );

        const afterRoot =
          reasoner
            .getSnapshot()
            .goals
            .find(
              (goal) =>
                goal.id ===
                "terminal-goal",
            )!;

        expect(
          afterRoot.description,
        ).toBe(
          beforeRoot.description,
        );

        expect(
          afterRoot.successCriteria,
        ).toEqual(
          beforeRoot.successCriteria,
        );

        expect(
          afterRoot.constraints,
        ).toEqual(
          beforeRoot.constraints,
        );
      },
    );

    it(
      "does not rewrite the goal hierarchy when progress remains within tolerance",
      () => {
        const original =
          generateAutonomousSubgoalPlan(
            [
              REPAIRED_PROGRAM,
            ],
            new Map([
              [
                "repaired-program",
                1,
              ],
            ]),
            0.1,
            1,
            ORIGINAL_ACTIONS,
          );

        const reasoner =
          reasonerWithPlan(
            original,
          );

        const before =
          reasoner.getSnapshot();

        const revision =
          reviseAutonomousSubgoalsAfterDivergence(
            reasoner,
            "terminal-goal",
            original,
            1,
            0.66,
            [
              REPAIRED_PROGRAM,
            ],
            new Map([
              [
                "repaired-program",
                1,
              ],
            ]),
            REVISION_ACTIONS,
            {
              divergenceTolerance:
                0.1,
            },
          );

        expect(
          revision,
        ).toMatchObject({
          decision:
            "unchanged",

          reason:
            "progress-within-tolerance",
        });

        expect(
          reasoner.getSnapshot(),
        ).toEqual(
          before,
        );
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  CompositeFragmentMonitor,
  maintainCompositeRevisionSelectively,
} from "./selective-composite-fragment-maintenance";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  buildPlanForLiveHypothesis,
} from "./online-belief-model-coevolution";

import {
  materializePrerequisiteAwareSubgoals,
  type LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

import {
  chooseRecedingHorizonVectorControl,
  createRecedingVectorController,
  type RecedingVectorAction,
  type RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

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

function linearFragment(
  id: string,
  variable: string,
  coefficient: number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        id:
          `linear(${variable})`,

        kind:
          "linear",

        variables: [
          variable,
        ],

        coefficient,
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

const Y_FRAGMENT =
  linearFragment(
    "rev-y:program-y-fragment",
    "y",
    0.6,
  );

const Z_FRAGMENT =
  linearFragment(
    "rev-z:program-z-fragment",
    "z",
    0.5,
  );

const REPAIR_Z =
  linearFragment(
    "repair-z-0.2",
    "z",
    0.2,
  );

const COMPOSITE_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "rev-composite-program",

  baseEffects: {
    y:
      0,
    z:
      0,
  },

  fragments: [
    Y_FRAGMENT,
    Z_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
};

const PREREQUISITE:
  LearnedActionPrerequisite = {
  actionId:
    "finish",

  targetDimension:
    "progress",

  stateDimension:
    "readiness",

  threshold:
    0.7,

  inactiveMeanEffect:
    0.02,

  activeMeanEffect:
    1.1,

  effectGap:
    1.08,

  evidenceCount:
    8,
};

const ACTIVE_HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:rev-composite",

  repairCandidateId:
    "composition:rev-y+rev-z",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        1.1,
      "boost-finish":
        1.6,
    },

    exposure: {
      finish:
        0.1,
      "boost-finish":
        0.15,
    },
  },

  observationStdDev:
    0.05,

  actionPrerequisites: {
    finish: {
      readiness:
        0.7,
    },
  },
};

const ACTIONS:
  readonly RecedingVectorAction[] = [
    {
      id:
        "finish",

      risk:
        0.1,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "progress",
    },
    {
      id:
        "boost-finish",

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "progress",
    },
  ];

const STATE = {
  readiness:
    0.8,
  progress:
    0,
  exposure:
    0,
};

const GOAL = {
  minimums: {
    progress:
      1,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function observation(
  id: string,
  y: number,
  z: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
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

const PROTECTED_REPAIR:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-y",
      1,
      0,
      0.6,
    ),
    observation(
      "protected-z",
      0,
      1,
      0.2,
    ),
    observation(
      "protected-joint",
      1,
      1,
      0.8,
    ),
    observation(
      "protected-half-joint",
      0.5,
      1,
      0.5,
    ),
  ];

function lineage() {
  return createRevisionLineage(
    "rev-composite",
    COMPOSITE_PROGRAM,
    ACTIVE_HYPOTHESIS,
    PREREQUISITE,
    [
      "install-composite-a",
      "install-composite-b",
      "install-composite-c",
      "install-composite-d",
    ],
    0.2,
    4,
  );
}

function monitorWithLocalZFailure() {
  const monitor =
    new CompositeFragmentMonitor(
      COMPOSITE_PROGRAM,
    );

  monitor.record(
    observation(
      "monitor-z-1",
      0,
      1,
      0.2,
    ),
  );

  monitor.record(
    observation(
      "monitor-y-1",
      1,
      0,
      0.6,
    ),
  );

  monitor.record(
    observation(
      "monitor-z-2",
      0,
      0.5,
      0.1,
    ),
  );

  monitor.record(
    observation(
      "monitor-y-2",
      0.5,
      0,
      0.3,
    ),
  );

  return monitor;
}

function currentPlan() {
  const plan =
    buildPlanForLiveHypothesis(
      ACTIVE_HYPOTHESIS,
      STATE,
      GOAL,
      ACTIONS,
      PREREQUISITE,
    );

  if (
    plan.decision !==
      "planned"
  ) {
    throw new Error(
      "Expected the composite incumbent plan to be available.",
    );
  }

  return plan;
}

function reasonerWithCurrentPlan() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T11:10:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "selective-terminal-goal",

    description:
      "Reach progress >= 1.000 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 1.000",
      "exposure <= 0.300",
    ],

    constraints: [
      "Preserve healthy validated composite fragments.",
      "Use fresh protected evidence for local maintenance.",
    ],

    createdAt:
      "2026-09-22T11:10:00Z",

    updatedAt:
      "2026-09-22T11:10:00Z",
  });

  const plan =
    currentPlan();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "selective-terminal-goal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

describe(
  "composite fragment reliability monitoring",
  () => {
    it(
      "quarantines only the degraded z fragment while preserving support for y",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const summary =
          monitor
            .getReliability();

        expect(
          summary
            .quarantinedFragmentIds,
        ).toEqual([
          "rev-z:program-z-fragment",
        ]);

        const y =
          summary.fragments.find(
            (fragment) =>
              fragment.fragmentId ===
              "rev-y:program-y-fragment",
          );

        const z =
          summary.fragments.find(
            (fragment) =>
              fragment.fragmentId ===
              "rev-z:program-z-fragment",
          );

        expect(
          y,
        ).toMatchObject({
          supportEpisodes:
            2,

          blameEpisodes:
            0,

          quarantined:
            false,
        });

        expect(
          z,
        ).toMatchObject({
          blameEpisodes:
            2,

          posteriorReliability:
            0.25,

          quarantined:
            true,
        });
      },
    );

    it(
      "rejects duplicate monitoring observations",
      () => {
        const monitor =
          new CompositeFragmentMonitor(
            COMPOSITE_PROGRAM,
          );

        const sample =
          observation(
            "duplicate-monitor",
            0,
            1,
            0.2,
          );

        monitor.record(
          sample,
        );

        expect(
          () =>
            monitor.record(
              sample,
            ),
        ).toThrow(
          "Duplicate composite monitoring observation duplicate-monitor.",
        );
      },
    );

    it(
      "abstains from local maintenance when multiple fragments are repeatedly blamed",
      () => {
        const monitor =
          new CompositeFragmentMonitor(
            COMPOSITE_PROGRAM,
          );

        monitor.record(
          observation(
            "multi-1",
            1,
            1,
            0,
          ),
        );

        monitor.record(
          observation(
            "multi-2",
            1,
            1,
            0,
          ),
        );

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [
              REPAIR_Z,
            ],
            PROTECTED_REPAIR,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  2,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "selective-terminal-goal",
            "rev-composite-maintained",
            1,
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "multiple-fragment-failure-requires-broader-search",
        });

        expect(
          result
            .retiredFragmentIds,
        ).toEqual([
          "rev-y:program-y-fragment",
          "rev-z:program-z-fragment",
        ]);
      },
    );

    it(
      "keeps monitoring and protected maintenance evidence disjoint",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        expect(
          () =>
            maintainCompositeRevisionSelectively(
              lineage(),
              monitor,
              [
                REPAIR_Z,
              ],
              [
                observation(
                  "monitor-z-1",
                  0,
                  1,
                  0.2,
                ),
              ],
              "progress",
              {
                finish: {
                  y:
                    1,
                  z:
                    1,
                },
              },
              STATE,
              GOAL,
              ACTIONS,
              plan,
              reasoner,
              "selective-terminal-goal",
              "rev-overlap",
              1,
            ),
        ).toThrow(
          "Composite monitoring evidence must remain disjoint from protected maintenance evidence.",
        );
      },
    );
  },
);

describe(
  "selective composite maintenance",
  () => {
    it(
      "repairs only the degraded z fragment and leaves the healthy y fragment structurally unchanged",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [
              REPAIR_Z,
            ],
            PROTECTED_REPAIR,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  2,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "selective-terminal-goal",
            "rev-composite-maintained",
            1,
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "repaired",

          preservedFragmentIds: [
            "rev-y:program-y-fragment",
          ],

          retiredFragmentIds: [
            "rev-z:program-z-fragment",
          ],

          replacementFragmentIds: {
            "rev-z:program-z-fragment":
              "repair-z-0.2",
          },

          reason:
            "selective-fragment-repair-installed",
        });

        expect(
          result
            .programRevision
            ?.revisedProtectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );

        expect(
          result
            .programRevision
            ?.program
            .fragments
            .find(
              (fragment) =>
                fragment.id ===
                "rev-y:program-y-fragment",
            ),
        ).toEqual(
          Y_FRAGMENT,
        );
      },
    );

    it(
      "refuses installation when the local repair wins but the adaptive protected reserve is undersized",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [
              REPAIR_Z,
            ],
            PROTECTED_REPAIR.slice(
              0,
              3,
            ),
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "selective-terminal-goal",
            "rev-short-reserve",
            1,
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          requirement: {
            minimumProtectedEvidence:
              4,
          },

          reason:
            "adaptive-protected-maintenance-reserve-insufficient",
        });
      },
    );

    it(
      "updates the live task effects and changes the plan from finish to boost-finish",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        expect(
          plan.actionIds,
        ).toEqual([
          "finish",
        ]);

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [
              REPAIR_Z,
            ],
            PROTECTED_REPAIR,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  2,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "selective-terminal-goal",
            "rev-composite-maintained",
            1,
          );

        expect(
          result
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.8,

          "boost-finish":
            1,
        });

        expect(
          result
            .revisedPlan
            ?.actionIds,
        ).toEqual([
          "boost-finish",
        ]);

        expect(
          result
            .goalRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          replacementGoalIds: [
            "prerequisite-revised-1-1",
          ],
        });

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "prerequisite-revised-1-1",
        );
      },
    );

    it(
      "feeds the selectively repaired composite directly into receding-horizon control",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const {
          reasoner,
          plan,
        } =
          reasonerWithCurrentPlan();

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [
              REPAIR_Z,
            ],
            PROTECTED_REPAIR,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  2,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "selective-terminal-goal",
            "rev-composite-maintained",
            1,
          );

        const controller =
          createRecedingVectorController(
            STATE,
            result
              .catalogRevision!
              .belief
              .probabilities,
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            result
              .catalogRevision!
              .hypotheses,
            controller,
            GOAL,
            ACTIONS,
            [],
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "boost-finish",

          reason:
            "direct-action-best",
        });

        expect(
          decision.maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );

    it(
      "can remove only the failed fragment when protected evidence favors a local rollback over replacement",
      () => {
        const monitor =
          monitorWithLocalZFailure();

        const rollbackProtected = [
          observation(
            "rollback-y",
            1,
            0,
            0.6,
          ),
          observation(
            "rollback-z",
            0,
            1,
            0,
          ),
          observation(
            "rollback-joint",
            1,
            1,
            0.6,
          ),
          observation(
            "rollback-half",
            0.5,
            1,
            0.3,
          ),
        ];

        const rollbackGoal = {
          minimums: {
            progress:
              0.6,
          },

          maximums: {
            exposure:
              0.3,
          },
        };

        const rollbackPlan =
          buildPlanForLiveHypothesis(
            ACTIVE_HYPOTHESIS,
            STATE,
            rollbackGoal,
            ACTIONS,
            PREREQUISITE,
          );

        if (
          rollbackPlan.decision !==
            "planned"
        ) {
          throw new Error(
            "Expected rollback incumbent plan.",
          );
        }

        const reasoner =
          reasonerWithCurrentPlan()
            .reasoner;

        const result =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [],
            rollbackProtected,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  2,
              },
            },
            STATE,
            rollbackGoal,
            ACTIONS,
            rollbackPlan,
            reasoner,
            "selective-terminal-goal",
            "rev-composite-local-rollback",
            2,
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "rolled-back-fragment",

          preservedFragmentIds: [
            "rev-y:program-y-fragment",
          ],

          retiredFragmentIds: [
            "rev-z:program-z-fragment",
          ],

          replacementFragmentIds:
            {},

          reason:
            "selective-fragment-rollback-installed",
        });

        expect(
          result
            .programRevision
            ?.program
            .fragments,
        ).toHaveLength(
          1,
        );
      },
    );
  },
);

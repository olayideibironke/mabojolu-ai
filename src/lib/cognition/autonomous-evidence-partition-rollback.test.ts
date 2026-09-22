import {
  describe,
  expect,
  it,
} from "vitest";

import {
  coevolveFromAutonomousEvidencePartition,
  evaluateOnlineRevisionRollback,
  partitionLiveStructuralEvidence,
  rollbackInstalledRevisionAndGoals,
  type LiveStructuralEvidence,
} from "./autonomous-evidence-partition-rollback";

import {
  OnlinePredictionMismatchTracker,
  buildPlanForLiveHypothesis,
} from "./online-belief-model-coevolution";

import {
  materializePrerequisiteAwareSubgoals,
  type ActionPrerequisiteObservation,
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

const BAD_FRAGMENT:
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

const INCUMBENT_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "partition-incumbent",

  baseEffects: {
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    BAD_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
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

const LIVE_EVIDENCE:
  readonly LiveStructuralEvidence[] = [
    {
      sequence:
        0,

      observation:
        structuralObservation(
          "fit-full",
          1,
          1,
          0.7,
        ),
    },
    {
      sequence:
        1,

      observation:
        structuralObservation(
          "reserve-y",
          1,
          0,
          0.1,
        ),
    },
    {
      sequence:
        2,

      observation:
        structuralObservation(
          "fit-y",
          1,
          0,
          0.1,
        ),
    },
    {
      sequence:
        3,

      observation:
        structuralObservation(
          "reserve-z",
          0,
          1,
          0.1,
        ),
    },
    {
      sequence:
        4,

      observation:
        structuralObservation(
          "fit-half-full",
          0.5,
          1,
          0.4,
        ),
    },
    {
      sequence:
        5,

      observation:
        structuralObservation(
          "reserve-quarter",
          0.25,
          0.5,
          0.1375,
        ),
    },
    {
      sequence:
        6,

      observation:
        structuralObservation(
          "fit-half",
          0.5,
          0.5,
          0.225,
        ),
    },
    {
      sequence:
        7,

      observation:
        structuralObservation(
          "reserve-full",
          1,
          1,
          0.7,
        ),
    },
  ];

const PREREQUISITE_EVIDENCE:
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
          0.7,
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
          0.72,
      },
    },
  ];

const CURRENT_PREREQUISITE:
  LearnedActionPrerequisite = {
  actionId:
    "finish",

  targetDimension:
    "progress",

  stateDimension:
    "readiness",

  threshold:
    0.35,

  inactiveMeanEffect:
    0.02,

  activeMeanEffect:
    0.9,

  effectGap:
    0.88,

  evidenceCount:
    4,
};

const LIVE_HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "legacy-live",

  repairCandidateId:
    "bad-linear-y",

  prerequisiteHypothesisId:
    "finish:readiness>=0.350",

  dimensionEffects: {
    readiness: {
      "prep-light":
        0.5,
      "prep-strong":
        0.8,
    },

    progress: {
      finish:
        0.9,
    },

    exposure: {
      "prep-light":
        0.05,
      "prep-strong":
        0.1,
      finish:
        0.1,
    },
  },

  observationStdDev:
    0.05,

  actionPrerequisites: {
    finish: {
      readiness:
        0.35,
    },
  },
};

const ACTIONS:
  readonly RecedingVectorAction[] = [
    {
      id:
        "prep-light",

      risk:
        0.05,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "readiness",
    },
    {
      id:
        "prep-strong",

      risk:
        0.1,

      cost:
        0.1,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "readiness",
    },
    {
      id:
        "finish",

      risk:
        0.1,

      cost:
        0.1,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "progress",
    },
  ];

const GOAL = {
  minimums: {
    progress:
      0.7,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function mismatchStatus() {
  const tracker =
    new OnlinePredictionMismatchTracker(
      3,
      0.1,
    );

  tracker.record(
    "mismatch-1",
    0.9,
    0.7,
  );

  tracker.record(
    "mismatch-2",
    0.9,
    0.69,
  );

  return tracker.record(
    "mismatch-3",
    0.9,
    0.71,
  );
}

function createReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T23:20:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "partition-terminal-goal",

    description:
      "Reach progress >= 0.700 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.700",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions.",
      "Keep fitting and protected evidence disjoint.",
    ],

    createdAt:
      "2026-09-21T23:20:00Z",

    updatedAt:
      "2026-09-21T23:20:00Z",
  });

  return reasoner;
}

function installRevision() {
  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const currentPlan =
    buildPlanForLiveHypothesis(
      LIVE_HYPOTHESIS,
      state,
      GOAL,
      ACTIONS,
      CURRENT_PREREQUISITE,
    );

  if (
    currentPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "Expected the pre-revision plan to be available.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "partition-terminal-goal",
    currentPlan,
  );

  const result =
    coevolveFromAutonomousEvidencePartition(
      LIVE_EVIDENCE,
      mismatchStatus(),
      INCUMBENT_PROGRAM,
      "bad-linear-y",
      [
        "y",
        "z",
      ],
      [
        LIVE_HYPOTHESIS,
      ],
      {
        probabilities: {
          "legacy-live":
            1,
        },

        topHypothesisId:
          "legacy-live",

        confidence:
          1,

        normalizedEntropy:
          0,
      },
      "legacy-live",
      "progress",
      {
        finish: {
          y:
            1,
          z:
            1,
        },
      },
      PREREQUISITE_EVIDENCE,
      "finish",
      "progress",
      [
        "readiness",
      ],
      CURRENT_PREREQUISITE,
      state,
      GOAL,
      ACTIONS,
      currentPlan,
      reasoner,
      "partition-terminal-goal",
      1,
    );

  if (
    !result.archive ||
    result.coevolution
      ?.decision !==
      "revised" ||
    !result.coevolution
      .catalogRevision ||
    !result.coevolution
      .revisedPlan
  ) {
    throw new Error(
      "Expected autonomous evidence partitioning to install a revision.",
    );
  }

  return {
    state,
    currentPlan,
    reasoner,
    result,
  };
}

function rollbackEvidence():
  StructuralMechanismObservation[] {
  return [
    structuralObservation(
      "fresh-old-y",
      1,
      0,
      0.7,
    ),
    structuralObservation(
      "fresh-old-z",
      0,
      1,
      0.1,
    ),
    structuralObservation(
      "fresh-old-full",
      1,
      1,
      0.8,
    ),
    structuralObservation(
      "fresh-old-half",
      0.5,
      1,
      0.45,
    ),
  ];
}

describe(
  "autonomous evidence partitioning",
  () => {
    it(
      "assigns fitting and protected roles without looking at measured outcomes",
      () => {
        const original =
          partitionLiveStructuralEvidence(
            LIVE_EVIDENCE,
          );

        const changedOutcomes =
          partitionLiveStructuralEvidence(
            LIVE_EVIDENCE.map(
              (entry) => ({
                sequence:
                  entry.sequence,

                observation: {
                  ...entry.observation,

                  measuredEffect:
                    1 -
                    entry.observation
                      .measuredEffect,
                },
              }),
            ),
          );

        expect(
          changedOutcomes
            .assignments,
        ).toEqual(
          original.assignments,
        );

        expect(
          original.reason,
        ).toBe(
          "outcome-blind-deterministic-partition",
        );
      },
    );

    it(
      "keeps repair fitting and protected validation ids strictly disjoint",
      () => {
        const partition =
          partitionLiveStructuralEvidence(
            LIVE_EVIDENCE,
          );

        expect(
          partition.decision,
        ).toBe(
          "ready",
        );

        expect(
          partition
            .repairFitEvidenceIds,
        ).toEqual([
          "fit-full",
          "fit-y",
          "fit-half-full",
          "fit-half",
        ]);

        expect(
          partition
            .protectedEvidenceIds,
        ).toEqual([
          "reserve-y",
          "reserve-z",
          "reserve-quarter",
          "reserve-full",
        ]);

        expect(
          partition
            .repairFitEvidenceIds
            .some(
              (id) =>
                partition
                  .protectedEvidenceIds
                  .includes(id),
            ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "abstains when the deterministic split cannot supply both evidence roles",
      () => {
        const partition =
          partitionLiveStructuralEvidence(
            LIVE_EVIDENCE.slice(
              0,
              2,
            ),
          );

        expect(
          partition,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "insufficient-partitioned-evidence",
        });
      },
    );

    it(
      "uses one live evidence stream to fit and independently validate an online repair",
      () => {
        const {
          result,
        } =
          installRevision();

        expect(
          result
            .coevolution
            ?.repairDecision,
        ).toMatchObject({
          decision:
            "repaired",

          topologyChanged:
            true,

          synthesizedFragmentId:
            "bad-linear-y+structure:interaction(y,z)",
        });

        expect(
          result
            .archive
            ?.installationProtectedEvidenceIds,
        ).toEqual([
          "reserve-full",
          "reserve-quarter",
          "reserve-y",
          "reserve-z",
        ]);
      },
    );
  },
);

describe(
  "fresh protected online rollback",
  () => {
    it(
      "rolls back when the archived pre-revision model materially wins on a fresh protected reserve",
      () => {
        const {
          result,
        } =
          installRevision();

        const assessment =
          evaluateOnlineRevisionRollback(
            result.archive!,
            rollbackEvidence(),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "rolled-back",

          archivedMeanSquaredError:
            0,

          reason:
            "archived-model-wins-fresh-protected",
        });

        expect(
          assessment
            .installedMeanSquaredError,
        ).toBeGreaterThan(
          0.05,
        );

        expect(
          assessment
            .improvementFromRollback,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "rejects reuse of installation protected observations as rollback evidence",
      () => {
        const {
          result,
        } =
          installRevision();

        expect(
          () =>
            evaluateOnlineRevisionRollback(
              result.archive!,
              [
                structuralObservation(
                  "reserve-y",
                  1,
                  0,
                  0.7,
                ),
              ],
            ),
        ).toThrow(
          "Fresh rollback evidence must remain disjoint from installation protected evidence.",
        );
      },
    );

    it(
      "reopens model search when the installed revision is bad but the archived model is not a material improvement",
      () => {
        const {
          result,
        } =
          installRevision();

        const assessment =
          evaluateOnlineRevisionRollback(
            result.archive!,
            [
              structuralObservation(
                "fresh-neither-1",
                1,
                1,
                0,
              ),
              structuralObservation(
                "fresh-neither-2",
                0.5,
                1,
                0,
              ),
            ],
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "reopen-search",

          reason:
            "installed-regressed-reopen-search",
        });

        expect(
          assessment
            .installedMeanSquaredError,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "restores the archived hypothesis, old prerequisite plan, and stale goal branch after rollback",
      () => {
        const {
          state,
          reasoner,
          result,
        } =
          installRevision();

        const assessment =
          evaluateOnlineRevisionRollback(
            result.archive!,
            rollbackEvidence(),
          );

        const rollback =
          rollbackInstalledRevisionAndGoals(
            result.archive!,
            assessment,
            result
              .coevolution!
              .catalogRevision!
              .hypotheses,
            result
              .coevolution!
              .catalogRevision!
              .belief,
            state,
            GOAL,
            ACTIONS,
            result
              .coevolution!
              .revisedPlan!,
            1,
            reasoner,
            "partition-terminal-goal",
            2,
          );

        expect(
          rollback,
        ).toMatchObject({
          decision:
            "rolled-back",

          reason:
            "archived-model-restored",

          rollbackPlan: {
            actionIds: [
              "prep-light",
              "finish",
            ],
          },

          goalRevision: {
            decision:
              "revised",

            terminalGoalPreserved:
              true,

            replacementGoalIds: [
              "prerequisite-revised-2-1",
              "prerequisite-revised-2-2",
            ],
          },
        });

        expect(
          rollback
            .catalogRevision
            ?.belief
            .topHypothesisId,
        ).toBe(
          "legacy-live",
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "prerequisite-revised-2-1",
        );

        const controller =
          createRecedingVectorController(
            state,
            rollback
              .catalogRevision!
              .belief
              .probabilities,
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            rollback
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
            "prep-light",

          reason:
            "direct-action-best",
        });
      },
    );
  },
);

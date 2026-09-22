import {
  describe,
  expect,
  it,
} from "vitest";

import {
  OnlinePredictionMismatchTracker,
  applyValidatedOnlineRevision,
  buildOnlineReliabilitySummary,
  buildPlanForLiveHypothesis,
  coevolveOnlineBeliefModelAndGoals,
  replaceLiveHypothesisCatalog,
} from "./online-belief-model-coevolution";

import {
  learnActionPrerequisite,
  materializePrerequisiteAwareSubgoals,
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
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  RecedingVectorAction,
  RecedingVectorBelief,
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

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
    "online-incumbent",

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

function repairObservation(
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

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "online-fit-full",
      1,
      1,
      0.7,
    ),
    repairObservation(
      "online-fit-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "online-fit-half-full",
      0.5,
      1,
      0.4,
    ),
    repairObservation(
      "online-fit-half",
      0.5,
      0.5,
      0.225,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "protected-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "protected-z-only",
      0,
      1,
      0.1,
    ),
    repairObservation(
      "protected-quarter",
      0.25,
      0.5,
      0.1375,
    ),
    repairObservation(
      "protected-full",
      1,
      1,
      0.7,
    ),
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

const LIVE_BELIEF:
  RecedingVectorBelief = {
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

function triggeredMismatchStatus() {
  const tracker =
    new OnlinePredictionMismatchTracker(
      3,
      0.1,
    );

  tracker.record(
    "miss-1",
    0.9,
    0.7,
  );

  tracker.record(
    "miss-2",
    0.9,
    0.69,
  );

  return tracker.record(
    "miss-3",
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
        `2026-09-21T23:00:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "online-terminal-goal",

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
      "Preserve protected model installation.",
    ],

    createdAt:
      "2026-09-21T23:00:00Z",

    updatedAt:
      "2026-09-21T23:00:00Z",
  });

  return reasoner;
}

describe(
  "online prediction mismatch accumulation",
  () => {
    it(
      "does not trigger repair after one surprising observation",
      () => {
        const tracker =
          new OnlinePredictionMismatchTracker(
            3,
            0.1,
          );

        const status =
          tracker.record(
            "isolated",
            0.9,
            0.7,
          );

        expect(
          status,
        ).toMatchObject({
          mismatchCount:
            1,

          consecutiveMismatchCount:
            1,

          triggered:
            false,
        });
      },
    );

    it(
      "triggers only after repeated consecutive mismatch",
      () => {
        const status =
          triggeredMismatchStatus();

        expect(
          status,
        ).toMatchObject({
          mismatchCount:
            3,

          consecutiveMismatchCount:
            3,

          triggered:
            true,
        });

        expect(
          status
            .meanAbsoluteResidual,
        ).toBeGreaterThan(
          0.19,
        );
      },
    );

    it(
      "resets the consecutive mismatch count after a recovery observation",
      () => {
        const tracker =
          new OnlinePredictionMismatchTracker(
            3,
            0.1,
          );

        tracker.record(
          "miss-1",
          0.9,
          0.7,
        );

        tracker.record(
          "miss-2",
          0.9,
          0.7,
        );

        const recovered =
          tracker.record(
            "recovered",
            0.9,
            0.86,
          );

        expect(
          recovered
            .consecutiveMismatchCount,
        ).toBe(
          0,
        );

        expect(
          recovered.triggered,
        ).toBe(
          false,
        );
      },
    );

    it(
      "converts persistent mismatch into bounded fragment quarantine evidence",
      () => {
        const reliability =
          buildOnlineReliabilitySummary(
            "bad-linear-y",
            triggeredMismatchStatus(),
          );

        expect(
          reliability
            .quarantinedFragmentIds,
        ).toEqual([
          "bad-linear-y",
        ]);

        expect(
          reliability
            .fragments[
              0
            ]!
            .posteriorReliability,
        ).toBeCloseTo(
          0.2,
        );
      },
    );
  },
);

describe(
  "online model and goal coevolution",
  () => {
    it(
      "projects a protected structural repair and learned prerequisite into the live hypothesis",
      () => {
        const reliability =
          buildOnlineReliabilitySummary(
            "bad-linear-y",
            triggeredMismatchStatus(),
          );

        const candidates =
          synthesizeStructuralRepairCandidates(
            INCUMBENT_PROGRAM,
            reliability,
            REPAIR_EVIDENCE,
            [
              "y",
              "z",
            ],
          );

        const repair =
          validateStructuralRepairCandidates(
            INCUMBENT_PROGRAM,
            reliability,
            candidates,
            PROTECTED_EVIDENCE,
          );

        const prerequisite =
          learnActionPrerequisite(
            PREREQUISITE_EVIDENCE,
            "finish",
            "progress",
            [
              "readiness",
            ],
          )!;

        const revised =
          applyValidatedOnlineRevision(
            LIVE_HYPOTHESIS,
            repair,
            "progress",
            {
              finish: {
                y:
                  1,
                z:
                  1,
              },
            },
            prerequisite,
            1,
          );

        expect(
          revised,
        ).toMatchObject({
          id:
            "legacy-live+online-revision-1",

          repairCandidateId:
            "bad-linear-y+structure:interaction(y,z)",

          prerequisiteHypothesisId:
            "finish:readiness>=0.700",
        });

        expect(
          revised
            .dimensionEffects
            .progress
            ?.finish,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          revised
            .actionPrerequisites
            .finish
            ?.readiness,
        ).toBeCloseTo(
          0.7,
        );
      },
    );

    it(
      "transfers live belief mass from the stale hypothesis to the protected revised hypothesis",
      () => {
        const revised = {
          ...LIVE_HYPOTHESIS,

          id:
            "legacy-live+online-revision-1",
        };

        const catalog =
          replaceLiveHypothesisCatalog(
            [
              LIVE_HYPOTHESIS,
            ],
            LIVE_BELIEF,
            "legacy-live",
            revised,
          );

        expect(
          catalog
            .hypotheses
            .map(
              (hypothesis) =>
                hypothesis.id,
            ),
        ).toEqual([
          "legacy-live+online-revision-1",
        ]);

        expect(
          catalog
            .belief
            .topHypothesisId,
        ).toBe(
          "legacy-live+online-revision-1",
        );

        expect(
          catalog
            .belief
            .confidence,
        ).toBe(
          1,
        );
      },
    );

    it(
      "repairs the live model, relearns the prerequisite, and replaces the stale goal branch in one episode",
      () => {
        const currentPlan =
          buildPlanForLiveHypothesis(
            LIVE_HYPOTHESIS,
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
            CURRENT_PREREQUISITE,
          );

        expect(
          currentPlan.actionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        const reasoner =
          createReasoner();

        materializePrerequisiteAwareSubgoals(
          reasoner,
          "online-terminal-goal",
          currentPlan,
        );

        const decision =
          coevolveOnlineBeliefModelAndGoals(
            triggeredMismatchStatus(),
            INCUMBENT_PROGRAM,
            "bad-linear-y",
            REPAIR_EVIDENCE,
            PROTECTED_EVIDENCE,
            [
              "y",
              "z",
            ],
            [
              LIVE_HYPOTHESIS,
            ],
            LIVE_BELIEF,
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
            currentPlan,
            reasoner,
            "online-terminal-goal",
            1,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "revised",

          repairDecision: {
            decision:
              "repaired",

            topologyChanged:
              true,

            synthesizedFragmentId:
              "bad-linear-y+structure:interaction(y,z)",
          },

          learnedPrerequisite: {
            stateDimension:
              "readiness",

            threshold:
              0.7,
          },

          reason:
            "persistent-mismatch-repaired-and-replanned",
        });

        expect(
          decision
            .revisedPlan
            ?.actionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);

        expect(
          decision
            .goalRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          replacementGoalIds: [
            "prerequisite-revised-1-1",
            "prerequisite-revised-1-2",
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
      "does not alter the live model or goals before persistent mismatch is earned",
      () => {
        const tracker =
          new OnlinePredictionMismatchTracker(
            3,
            0.1,
          );

        const status =
          tracker.record(
            "one-miss",
            0.9,
            0.7,
          );

        const currentPlan =
          buildPlanForLiveHypothesis(
            LIVE_HYPOTHESIS,
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
            CURRENT_PREREQUISITE,
          );

        const reasoner =
          createReasoner();

        materializePrerequisiteAwareSubgoals(
          reasoner,
          "online-terminal-goal",
          currentPlan,
        );

        const before =
          reasoner.getSnapshot();

        const decision =
          coevolveOnlineBeliefModelAndGoals(
            status,
            INCUMBENT_PROGRAM,
            "bad-linear-y",
            REPAIR_EVIDENCE,
            PROTECTED_EVIDENCE,
            [
              "y",
              "z",
            ],
            [
              LIVE_HYPOTHESIS,
            ],
            LIVE_BELIEF,
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
            currentPlan,
            reasoner,
            "online-terminal-goal",
            1,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "retained",

          reason:
            "mismatch-evidence-insufficient",
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

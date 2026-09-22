import {
  OnlinePredictionMismatchTracker,
  buildPlanForLiveHypothesis,
  coevolveOnlineBeliefModelAndGoals,
  type OnlineBeliefModelCoevolutionDecision,
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
  type RecedingVectorDecision,
  type RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

import {
  HierarchicalGoalReasoner,
  type GoalHierarchySnapshot,
} from "./goal-hierarchy";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface OnlineBeliefModelCoevolutionBenchmarkReport {
  mismatchTriggered:
    boolean;
  mismatchCount:
    number;
  repairEvidenceIds:
    string[];
  protectedEvidenceIds:
    string[];
  coevolution:
    OnlineBeliefModelCoevolutionDecision;
  oldActionIds:
    string[];
  revisedActionIds:
    string[];
  nextRecedingDecision:
    RecedingVectorDecision;
  hierarchy:
    GoalHierarchySnapshot;
  nextActionableGoalId?:
    string;
}

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
      "episode-fit-full",
      1,
      1,
      0.7,
    ),
    repairObservation(
      "episode-fit-y",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "episode-fit-half-full",
      0.5,
      1,
      0.4,
    ),
    repairObservation(
      "episode-fit-half",
      0.5,
      0.5,
      0.225,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "reserve-y",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "reserve-z",
      0,
      1,
      0.1,
    ),
    repairObservation(
      "reserve-quarter",
      0.25,
      0.5,
      0.1375,
    ),
    repairObservation(
      "reserve-full",
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

function createReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T23:10:${String(
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
      "2026-09-21T23:10:00Z",

    updatedAt:
      "2026-09-21T23:10:00Z",
  });

  return reasoner;
}

export function runOnlineBeliefModelCoevolutionBenchmark():
  OnlineBeliefModelCoevolutionBenchmarkReport {
  const tracker =
    new OnlinePredictionMismatchTracker(
      3,
      0.1,
    );

  tracker.record(
    "live-miss-1",
    0.9,
    0.7,
  );

  tracker.record(
    "live-miss-2",
    0.9,
    0.69,
  );

  const mismatchStatus =
    tracker.record(
      "live-miss-3",
      0.9,
      0.71,
    );

  const currentState = {
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
      currentState,
      GOAL,
      ACTIONS,
      CURRENT_PREREQUISITE,
    );

  if (
    currentPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.23 benchmark failed to construct the pre-revision plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "online-terminal-goal",
    currentPlan,
  );

  const liveBelief = {
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

  const coevolution =
    coevolveOnlineBeliefModelAndGoals(
      mismatchStatus,
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
      liveBelief,
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
      currentState,
      GOAL,
      ACTIONS,
      currentPlan,
      reasoner,
      "online-terminal-goal",
      1,
    );

  if (
    coevolution.decision !==
      "revised" ||
    !coevolution
      .catalogRevision
  ) {
    throw new Error(
      "v1.23 benchmark failed to revise the live model.",
    );
  }

  const revisedController =
    createRecedingVectorController(
      currentState,
      coevolution
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      coevolution
        .catalogRevision
        .hypotheses,
      revisedController,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    mismatchTriggered:
      mismatchStatus.triggered,

    mismatchCount:
      mismatchStatus
        .mismatchCount,

    repairEvidenceIds:
      REPAIR_EVIDENCE.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    protectedEvidenceIds:
      PROTECTED_EVIDENCE.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    coevolution,

    oldActionIds: [
      ...currentPlan
        .actionIds,
    ],

    revisedActionIds: [
      ...(
        coevolution
          .revisedPlan
          ?.actionIds ??
        []
      ),
    ],

    nextRecedingDecision,

    hierarchy:
      reasoner.getSnapshot(),

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

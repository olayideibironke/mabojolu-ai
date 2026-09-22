import {
  coevolveFromAutonomousEvidencePartition,
  evaluateOnlineRevisionRollback,
  partitionLiveStructuralEvidence,
  rollbackInstalledRevisionAndGoals,
  type AutonomousEvidencePartition,
  type LiveStructuralEvidence,
  type OnlineRollbackAssessment,
  type OnlineRollbackExecution,
} from "./autonomous-evidence-partition-rollback";

import {
  OnlinePredictionMismatchTracker,
  buildPlanForLiveHypothesis,
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

export interface AutonomousEvidencePartitionRollbackBenchmarkReport {
  installationPartition:
    AutonomousEvidencePartition;
  installationCoevolution:
    OnlineBeliefModelCoevolutionDecision;
  freshPartition:
    AutonomousEvidencePartition;
  rollbackAssessment:
    OnlineRollbackAssessment;
  rollbackExecution:
    OnlineRollbackExecution;
  installedActionIds:
    string[];
  rollbackActionIds:
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

function observation(
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

const INSTALL_STREAM:
  readonly LiveStructuralEvidence[] = [
    {
      sequence:
        0,

      observation:
        observation(
          "install-fit-full",
          1,
          1,
          0.7,
        ),
    },
    {
      sequence:
        1,

      observation:
        observation(
          "install-reserve-y",
          1,
          0,
          0.1,
        ),
    },
    {
      sequence:
        2,

      observation:
        observation(
          "install-fit-y",
          1,
          0,
          0.1,
        ),
    },
    {
      sequence:
        3,

      observation:
        observation(
          "install-reserve-z",
          0,
          1,
          0.1,
        ),
    },
    {
      sequence:
        4,

      observation:
        observation(
          "install-fit-half-full",
          0.5,
          1,
          0.4,
        ),
    },
    {
      sequence:
        5,

      observation:
        observation(
          "install-reserve-quarter",
          0.25,
          0.5,
          0.1375,
        ),
    },
    {
      sequence:
        6,

      observation:
        observation(
          "install-fit-half",
          0.5,
          0.5,
          0.225,
        ),
    },
    {
      sequence:
        7,

      observation:
        observation(
          "install-reserve-full",
          1,
          1,
          0.7,
        ),
    },
  ];

const FRESH_STREAM:
  readonly LiveStructuralEvidence[] = [
    {
      sequence:
        100,

      observation:
        observation(
          "fresh-fit-a",
          0.25,
          0.25,
          0.2,
        ),
    },
    {
      sequence:
        101,

      observation:
        observation(
          "fresh-reserve-y",
          1,
          0,
          0.7,
        ),
    },
    {
      sequence:
        102,

      observation:
        observation(
          "fresh-fit-b",
          0.5,
          0.5,
          0.35,
        ),
    },
    {
      sequence:
        103,

      observation:
        observation(
          "fresh-reserve-z",
          0,
          1,
          0.1,
        ),
    },
    {
      sequence:
        104,

      observation:
        observation(
          "fresh-fit-c",
          0.75,
          0.75,
          0.55,
        ),
    },
    {
      sequence:
        105,

      observation:
        observation(
          "fresh-reserve-full",
          1,
          1,
          0.8,
        ),
    },
    {
      sequence:
        106,

      observation:
        observation(
          "fresh-fit-d",
          1,
          0.5,
          0.75,
        ),
    },
    {
      sequence:
        107,

      observation:
        observation(
          "fresh-reserve-half",
          0.5,
          1,
          0.45,
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

function reasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const result =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T23:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  result.registerRoot({
    id:
      "rollback-terminal-goal",

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
      "Keep installation and rollback reserves disjoint.",
    ],

    createdAt:
      "2026-09-21T23:30:00Z",

    updatedAt:
      "2026-09-21T23:30:00Z",
  });

  return result;
}

function mismatchStatus() {
  const tracker =
    new OnlinePredictionMismatchTracker(
      3,
      0.1,
    );

  tracker.record(
    "benchmark-miss-1",
    0.9,
    0.7,
  );

  tracker.record(
    "benchmark-miss-2",
    0.9,
    0.69,
  );

  return tracker.record(
    "benchmark-miss-3",
    0.9,
    0.71,
  );
}

export function runAutonomousEvidencePartitionRollbackBenchmark():
  AutonomousEvidencePartitionRollbackBenchmarkReport {
  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const oldPlan =
    buildPlanForLiveHypothesis(
      LIVE_HYPOTHESIS,
      state,
      GOAL,
      ACTIONS,
      CURRENT_PREREQUISITE,
    );

  if (
    oldPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.24 benchmark could not construct the old plan.",
    );
  }

  const hierarchy =
    reasoner();

  materializePrerequisiteAwareSubgoals(
    hierarchy,
    "rollback-terminal-goal",
    oldPlan,
  );

  const installation =
    coevolveFromAutonomousEvidencePartition(
      INSTALL_STREAM,
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
      oldPlan,
      hierarchy,
      "rollback-terminal-goal",
      1,
    );

  if (
    !installation.archive ||
    installation.coevolution
      ?.decision !==
      "revised" ||
    !installation.coevolution
      .catalogRevision ||
    !installation.coevolution
      .revisedPlan
  ) {
    throw new Error(
      "v1.24 benchmark failed to install the online revision.",
    );
  }

  const freshPartition =
    partitionLiveStructuralEvidence(
      FRESH_STREAM,
    );

  if (
    freshPartition.decision !==
      "ready"
  ) {
    throw new Error(
      "v1.24 benchmark failed to construct a fresh protected reserve.",
    );
  }

  const rollbackAssessment =
    evaluateOnlineRevisionRollback(
      installation.archive,
      freshPartition
        .protectedEvidence,
    );

  if (
    rollbackAssessment.decision !==
      "rolled-back"
  ) {
    throw new Error(
      "v1.24 benchmark fresh reserve did not authorize rollback.",
    );
  }

  const rollbackExecution =
    rollbackInstalledRevisionAndGoals(
      installation.archive,
      rollbackAssessment,
      installation
        .coevolution
        .catalogRevision
        .hypotheses,
      installation
        .coevolution
        .catalogRevision
        .belief,
      state,
      GOAL,
      ACTIONS,
      installation
        .coevolution
        .revisedPlan,
      1,
      hierarchy,
      "rollback-terminal-goal",
      2,
    );

  if (
    rollbackExecution.decision !==
      "rolled-back" ||
    !rollbackExecution
      .catalogRevision ||
    !rollbackExecution
      .rollbackPlan
  ) {
    throw new Error(
      "v1.24 benchmark failed to execute rollback.",
    );
  }

  const controller =
    createRecedingVectorController(
      state,
      rollbackExecution
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      rollbackExecution
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    installationPartition:
      installation.partition,

    installationCoevolution:
      installation.coevolution,

    freshPartition,

    rollbackAssessment,

    rollbackExecution,

    installedActionIds: [
      ...installation
        .coevolution
        .revisedPlan
        .actionIds,
    ],

    rollbackActionIds: [
      ...rollbackExecution
        .rollbackPlan
        .actionIds,
    ],

    nextRecedingDecision,

    hierarchy:
      hierarchy.getSnapshot(),

    nextActionableGoalId:
      hierarchy
        .nextActionableGoal()
        ?.id,
  };
}

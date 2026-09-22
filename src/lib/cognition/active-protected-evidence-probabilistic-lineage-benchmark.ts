import {
  runControlledProtectedEvidenceAcquisition,
  type ActiveProtectedAcquisitionResult,
} from "./active-protected-evidence-probabilistic-lineage";

import {
  activateRevisionLineageSelection,
  appendInstalledRevision,
  createRevisionLineage,
  type LineageActivationExecution,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  buildPlanForLiveHypothesis,
} from "./online-belief-model-coevolution";

import {
  materializePrerequisiteAwareSubgoals,
  revisePrerequisiteAwareGoalChain,
  type LearnedActionPrerequisite,
  type PrerequisiteAwarePlan,
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

export interface ActiveProtectedEvidenceProbabilisticLineageBenchmarkReport {
  acquisition:
    ActiveProtectedAcquisitionResult;
  activation:
    LineageActivationExecution;
  initialActionIds:
    string[];
  activatedActionIds:
    string[];
  nextRecedingDecision:
    RecedingVectorDecision;
  hierarchy:
    GoalHierarchySnapshot;
  nextActionableGoalId?:
    string;
}

function fragment(
  id: string,
  kind:
    | "linear"
    | "interaction",
  variables: string[],
  coefficient: number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        id:
          `${kind}(${variables.join(",")})`,

        kind,

        variables,

        coefficient,
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

function program(
  id: string,
  kind:
    "linear"
    | "interaction",
  variables: string[],
  coefficient: number,
  complexity: number,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      y:
        0.1,
      z:
        0.1,
    },

    fragments: [
      fragment(
        `${id}-fragment`,
        kind,
        variables,
        coefficient,
      ),
    ],

    observationStdDev:
      0.05,

    depth:
      2,

    complexity,
  };
}

const PROGRAM_0 =
  program(
    "program-0",
    "linear",
    [
      "y",
    ],
    0.6,
    1,
  );

const PROGRAM_1 =
  program(
    "program-1",
    "interaction",
    [
      "y",
      "z",
    ],
    0.5,
    2,
  );

const PROGRAM_2 =
  program(
    "program-2",
    "interaction",
    [
      "y",
      "z",
    ],
    0.9,
    4,
  );

const PREREQUISITE_0:
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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    4,
};

const PREREQUISITE_1:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_0,

  threshold:
    0.7,
};

const PREREQUISITE_2:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_0,

  threshold:
    0.9,
};

function hypothesis(
  id: string,
  repairCandidateId: string,
  prerequisite:
    LearnedActionPrerequisite,
  finishEffect: number,
): RecedingVectorHypothesis {
  return {
    id,

    repairCandidateId,

    prerequisiteHypothesisId:
      `finish:readiness>=${prerequisite.threshold.toFixed(
        3,
      )}`,

    dimensionEffects: {
      readiness: {
        "prep-light":
          0.5,
        "prep-strong":
          0.8,
        "prep-ultra":
          1,
      },

      progress: {
        finish:
          finishEffect,
      },

      exposure: {
        "prep-light":
          0.05,
        "prep-strong":
          0.1,
        "prep-ultra":
          0.15,
        finish:
          0.1,
      },
    },

    observationStdDev:
      0.05,

    actionPrerequisites: {
      finish: {
        readiness:
          prerequisite.threshold,
      },
    },
  };
}

const HYPOTHESIS_0 =
  hypothesis(
    "hypothesis-0",
    "revision-0-linear",
    PREREQUISITE_0,
    0.8,
  );

const HYPOTHESIS_1 =
  hypothesis(
    "hypothesis-1",
    "revision-1-interaction",
    PREREQUISITE_1,
    0.7,
  );

const HYPOTHESIS_2 =
  hypothesis(
    "hypothesis-2",
    "revision-2-interaction",
    PREREQUISITE_2,
    1.1,
  );

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
        "prep-ultra",

      risk:
        0.1,

      cost:
        0.15,

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

const INITIAL_PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "fresh-y",
      1,
      0,
      0.1,
    ),
    observation(
      "fresh-z",
      0,
      1,
      0.1,
    ),
  ];

function lineage():
  RevisionLineage {
  let result =
    createRevisionLineage(
      "rev-0",
      PROGRAM_0,
      HYPOTHESIS_0,
      PREREQUISITE_0,
      [
        "install-0-a",
        "install-0-b",
      ],
      0,
      4,
    );

  result =
    appendInstalledRevision(
      result,
      "rev-1",
      PROGRAM_1,
      HYPOTHESIS_1,
      PREREQUISITE_1,
      [
        "install-1-a",
        "install-1-b",
        "install-1-c",
      ],
      0.2,
    );

  return appendInstalledRevision(
    result,
    "rev-2",
    PROGRAM_2,
    HYPOTHESIS_2,
    PREREQUISITE_2,
    [
      "install-2-a",
      "install-2-b",
      "install-2-c",
      "install-2-d",
    ],
    0.6,
  );
}

function remapPlan(
  plan: PrerequisiteAwarePlan,
  revisionNumber: number,
): PrerequisiteAwarePlan {
  return {
    ...plan,

    actionIds: [
      ...plan.actionIds,
    ],

    subgoals:
      plan.subgoals.map(
        (subgoal, index) => ({
          ...subgoal,

          id:
            `prerequisite-revised-${revisionNumber}-${index + 1}`,

          targetState: {
            ...subgoal.targetState,
          },

          prerequisiteDescriptions: [
            ...subgoal.prerequisiteDescriptions,
          ],

          dependsOnGoalIds:
            index ===
              0
              ? []
              : [
                  `prerequisite-revised-${revisionNumber}-${index}`,
                ],
        }),
      ),

    expectedFinalState: {
      ...plan.expectedFinalState,
    },
  };
}

function hierarchyWithRev2() {
  let tick =
    0;

  const hierarchy =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T10:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  hierarchy.registerRoot({
    id:
      "active-protected-terminal",

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
      "Acquire fresh protected evidence before lineage activation.",
    ],

    createdAt:
      "2026-09-22T10:30:00Z",

    updatedAt:
      "2026-09-22T10:30:00Z",
  });

  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const plan0 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_0,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_0,
    );

  const plan1 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_1,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_1,
    );

  const plan2 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_2,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_2,
    );

  if (
    plan0.decision !==
      "planned" ||
    plan1.decision !==
      "planned" ||
    plan2.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.26 benchmark could not construct lineage plans.",
    );
  }

  materializePrerequisiteAwareSubgoals(
    hierarchy,
    "active-protected-terminal",
    plan0,
  );

  const firstRevision =
    revisePrerequisiteAwareGoalChain(
      hierarchy,
      "active-protected-terminal",
      plan0,
      plan1,
      1,
    );

  if (
    firstRevision.decision !==
      "revised"
  ) {
    throw new Error(
      "v1.26 benchmark could not materialize rev-1 goals.",
    );
  }

  const secondRevision =
    revisePrerequisiteAwareGoalChain(
      hierarchy,
      "active-protected-terminal",
      remapPlan(
        plan1,
        1,
      ),
      plan2,
      2,
    );

  if (
    secondRevision.decision !==
      "revised"
  ) {
    throw new Error(
      "v1.26 benchmark could not materialize rev-2 goals.",
    );
  }

  return {
    hierarchy,
    state,
    plan2,
  };
}

export function runActiveProtectedEvidenceProbabilisticLineageBenchmark():
  ActiveProtectedEvidenceProbabilisticLineageBenchmarkReport {
  const currentLineage =
    lineage();

  const acquisition =
    runControlledProtectedEvidenceAcquisition(
      currentLineage,
      INITIAL_PROTECTED,
      "rev-1",
    );

  if (
    acquisition.decision !==
      "ready" ||
    acquisition
      .lineageAssessment
      ?.decision !==
      "rollback-parent"
  ) {
    throw new Error(
      "v1.26 benchmark did not resolve rev-1 from protected evidence.",
    );
  }

  const {
    hierarchy,
    state,
    plan2,
  } =
    hierarchyWithRev2();

  const activation =
    activateRevisionLineageSelection(
      currentLineage,
      acquisition
        .lineageAssessment,
      [
        HYPOTHESIS_2,
      ],
      {
        probabilities: {
          "hypothesis-2":
            1,
        },

        topHypothesisId:
          "hypothesis-2",

        confidence:
          1,

        normalizedEntropy:
          0,
      },
      state,
      GOAL,
      ACTIONS,
      plan2,
      2,
      hierarchy,
      "active-protected-terminal",
      3,
    );

  if (
    activation.decision !==
      "activated" ||
    !activation
      .catalogRevision ||
    !activation
      .activatedPlan
  ) {
    throw new Error(
      "v1.26 benchmark failed to activate rev-1.",
    );
  }

  const controller =
    createRecedingVectorController(
      state,
      activation
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      activation
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    acquisition,

    activation,

    initialActionIds: [
      ...plan2
        .actionIds,
    ],

    activatedActionIds: [
      ...activation
        .activatedPlan
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

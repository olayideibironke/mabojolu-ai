import {
  activateRevisionLineageSelection,
  appendInstalledRevision,
  createRevisionLineage,
  deriveAdaptiveEvidenceRequirement,
  evaluateRevisionLineage,
  type AdaptiveEvidenceRequirement,
  type LineageActivationExecution,
  type RevisionLineage,
  type RevisionLineageAssessment,
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

export interface AdaptiveEvidenceGovernanceLineageBenchmarkReport {
  simpleRequirement:
    AdaptiveEvidenceRequirement;
  complexRequirement:
    AdaptiveEvidenceRequirement;
  lineage:
    RevisionLineage;
  retainAssessment:
    RevisionLineageAssessment;
  parentAssessment:
    RevisionLineageAssessment;
  ancestorAssessment:
    RevisionLineageAssessment;
  reopenAssessment:
    RevisionLineageAssessment;
  ancestorActivation:
    LineageActivationExecution;
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

function evidence(
  source:
    "root"
    | "parent"
    | "active"
    | "bad",
): StructuralMechanismObservation[] {
  const points = [
    [
      1,
      0,
    ],
    [
      0,
      1,
    ],
    [
      1,
      1,
    ],
    [
      0.5,
      1,
    ],
    [
      1,
      0.5,
    ],
    [
      0.5,
      0.5,
    ],
  ] as const;

  function effect(
    y: number,
    z: number,
  ): number {
    if (
      source ===
        "root"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.6 *
        y;
    }

    if (
      source ===
        "parent"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.5 *
        y *
        z;
    }

    if (
      source ===
        "active"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.9 *
        y *
        z;
    }

    return 2;
  }

  return points.map(
    (
      [
        y,
        z,
      ],
      index,
    ) =>
      observation(
        `benchmark-${source}-${index + 1}`,
        y,
        z,
        effect(
          y,
          z,
        ),
      ),
  );
}

function buildLineage():
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

function hierarchyWithActiveRevision() {
  let tick =
    0;

  const hierarchy =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T10:20:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  hierarchy.registerRoot({
    id:
      "lineage-terminal-goal",

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
      "Use fresh protected evidence for lineage selection.",
    ],

    createdAt:
      "2026-09-22T10:20:00Z",

    updatedAt:
      "2026-09-22T10:20:00Z",
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
      "v1.25 benchmark failed to construct lineage plans.",
    );
  }

  materializePrerequisiteAwareSubgoals(
    hierarchy,
    "lineage-terminal-goal",
    plan0,
  );

  const revision1 =
    revisePrerequisiteAwareGoalChain(
      hierarchy,
      "lineage-terminal-goal",
      plan0,
      plan1,
      1,
    );

  if (
    revision1.decision !==
      "revised"
  ) {
    throw new Error(
      "v1.25 benchmark failed to materialize revision 1.",
    );
  }

  const revision2 =
    revisePrerequisiteAwareGoalChain(
      hierarchy,
      "lineage-terminal-goal",
      remapPlan(
        plan1,
        1,
      ),
      plan2,
      2,
    );

  if (
    revision2.decision !==
      "revised"
  ) {
    throw new Error(
      "v1.25 benchmark failed to materialize revision 2.",
    );
  }

  return {
    hierarchy,
    state,
    plan2,
  };
}

export function runAdaptiveEvidenceGovernanceLineageBenchmark():
  AdaptiveEvidenceGovernanceLineageBenchmarkReport {
  const lineage =
    buildLineage();

  const simpleRequirement =
    deriveAdaptiveEvidenceRequirement(
      PROGRAM_0,
      0,
    );

  const complexRequirement =
    deriveAdaptiveEvidenceRequirement(
      PROGRAM_2,
      0.6,
    );

  const retainAssessment =
    evaluateRevisionLineage(
      lineage,
      evidence(
        "active",
      ),
    );

  const parentAssessment =
    evaluateRevisionLineage(
      lineage,
      evidence(
        "parent",
      ),
    );

  const ancestorAssessment =
    evaluateRevisionLineage(
      lineage,
      evidence(
        "root",
      ),
    );

  const reopenAssessment =
    evaluateRevisionLineage(
      lineage,
      evidence(
        "bad",
      ),
    );

  const {
    hierarchy,
    state,
    plan2,
  } =
    hierarchyWithActiveRevision();

  const ancestorActivation =
    activateRevisionLineageSelection(
      lineage,
      ancestorAssessment,
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
      "lineage-terminal-goal",
      3,
    );

  if (
    ancestorActivation.decision !==
      "activated" ||
    !ancestorActivation
      .catalogRevision
  ) {
    throw new Error(
      "v1.25 benchmark failed to activate the selected ancestor.",
    );
  }

  const controller =
    createRecedingVectorController(
      state,
      ancestorActivation
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      ancestorActivation
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    simpleRequirement,

    complexRequirement,

    lineage,

    retainAssessment,

    parentAssessment,

    ancestorAssessment,

    reopenAssessment,

    ancestorActivation,

    nextRecedingDecision,

    hierarchy:
      hierarchy.getSnapshot(),

    nextActionableGoalId:
      hierarchy
        .nextActionableGoal()
        ?.id,
  };
}

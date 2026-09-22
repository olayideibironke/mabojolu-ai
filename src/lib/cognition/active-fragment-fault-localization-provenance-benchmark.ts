import {
  initializeFragmentProvenance,
  runControlledLocalizedCompositeMaintenance,
  synthesizeFragmentFaultProbes,
  type LocalizedCompositeMaintenanceResult,
} from "./active-fragment-fault-localization-provenance";

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

export interface ActiveFragmentFaultLocalizationProvenanceBenchmarkReport {
  result:
    LocalizedCompositeMaintenanceResult;
  oldActionIds:
    string[];
  newActionIds:
    string[];
  nextRecedingDecision:
    RecedingVectorDecision;
  hierarchy:
    GoalHierarchySnapshot;
  nextActionableGoalId?:
    string;
}

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

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "active-fault-benchmark-composite",

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

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "active-fault-benchmark-actual",

  fragments: [
    Y_FRAGMENT,
    REPAIR_Z,
  ],
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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:active-fault-benchmark",

  repairCandidateId:
    "composition:rev-y+rev-z",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        0.8,
      "boost-finish":
        1.1,
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
      0.75,
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

const INITIAL_MONITORING:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-passive-z-half",
      0,
      0.5,
      0.1,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-fault-protected-y",
      1,
      0,
      0.6,
    ),
    observation(
      "benchmark-fault-protected-z",
      0,
      1,
      0.2,
    ),
    observation(
      "benchmark-fault-protected-joint",
      1,
      1,
      0.8,
    ),
    observation(
      "benchmark-fault-protected-half-joint",
      0.5,
      1,
      0.5,
    ),
  ];

function reasoner() {
  let tick =
    0;

  const result =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T11:50:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  result.registerRoot({
    id:
      "active-fault-terminal",

    description:
      "Reach progress >= 0.750 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.750",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve local fault uncertainty before repair.",
      "Preserve healthy fragment provenance.",
    ],

    createdAt:
      "2026-09-22T11:50:00Z",

    updatedAt:
      "2026-09-22T11:50:00Z",
  });

  return result;
}

export function runActiveFragmentFaultLocalizationProvenanceBenchmark():
  ActiveFragmentFaultLocalizationProvenanceBenchmarkReport {
  const currentLineage =
    createRevisionLineage(
      "rev-composite",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "benchmark-install-a",
        "benchmark-install-b",
        "benchmark-install-c",
        "benchmark-install-d",
      ],
      0.2,
      4,
    );

  const oldPlan =
    buildPlanForLiveHypothesis(
      HYPOTHESIS,
      STATE,
      GOAL,
      ACTIONS,
      PREREQUISITE,
    );

  if (
    oldPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.29 benchmark failed to construct the incumbent plan.",
    );
  }

  const hierarchy =
    reasoner();

  materializePrerequisiteAwareSubgoals(
    hierarchy,
    "active-fault-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "rev-composite",
      PROGRAM,
      {
        [
          Y_FRAGMENT.id
        ]: {
          sourceRevisionId:
            "rev-y",

          sourceFragmentId:
            "program-y-fragment",
        },

        [
          Z_FRAGMENT.id
        ]: {
          sourceRevisionId:
            "rev-z",

          sourceFragmentId:
            "program-z-fragment",
        },
      },
    );

  const probes =
    synthesizeFragmentFaultProbes(
      PROGRAM,
      {
        riskByVariable: {
          y:
            0.1,

          z:
            0.05,
        },

        costByVariable: {
          y:
            0.05,

          z:
            0.03,
        },

        observationStdDev:
          0.1,
      },
    );

  const result =
    runControlledLocalizedCompositeMaintenance(
      currentLineage,
      ACTUAL_PROGRAM,
      INITIAL_MONITORING,
      probes,
      [
        REPAIR_Z,
      ],
      PROTECTED,
      "progress",
      {
        finish: {
          y:
            0.5,

          z:
            1,
        },

        "boost-finish": {
          y:
            1,

          z:
            1,
        },
      },
      STATE,
      GOAL,
      ACTIONS,
      oldPlan,
      hierarchy,
      "active-fault-terminal",
      "rev-composite-localized",
      1,
      provenance,
      {
        maximumSteps:
          1,
      },
    );

  if (
    result.reason !==
      "localized-fragment-maintained" ||
    result.maintenance
      ?.decision !==
      "repaired" ||
    !result
      .maintenance
      .catalogRevision ||
    !result
      .maintenance
      .revisedPlan
  ) {
    throw new Error(
      "v1.29 benchmark failed to localize and maintain the degraded fragment.",
    );
  }

  const controller =
    createRecedingVectorController(
      STATE,
      result
        .maintenance
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      result
        .maintenance
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    result,

    oldActionIds: [
      ...oldPlan
        .actionIds,
    ],

    newActionIds: [
      ...result
        .maintenance
        .revisedPlan
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

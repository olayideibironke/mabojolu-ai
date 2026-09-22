import {
  CompositeFragmentMonitor,
  maintainCompositeRevisionSelectively,
  type SelectiveFragmentMaintenanceResult,
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

export interface SelectiveCompositeFragmentMaintenanceBenchmarkReport {
  maintenance:
    SelectiveFragmentMaintenanceResult;
  oldActionIds:
    string[];
  newActionIds:
    string[];
  healthyFragmentBefore:
    ValidatedCausalFragment;
  healthyFragmentAfter?:
    ValidatedCausalFragment;
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
    "benchmark-composite",

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

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:benchmark-composite",

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

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-protected-y",
      1,
      0,
      0.6,
    ),
    observation(
      "benchmark-protected-z",
      0,
      1,
      0.2,
    ),
    observation(
      "benchmark-protected-joint",
      1,
      1,
      0.8,
    ),
    observation(
      "benchmark-protected-half-joint",
      0.5,
      1,
      0.5,
    ),
  ];

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T11:20:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "selective-benchmark-terminal",

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
      "Preserve healthy composite fragments.",
      "Repair only protected local failures.",
    ],

    createdAt:
      "2026-09-22T11:20:00Z",

    updatedAt:
      "2026-09-22T11:20:00Z",
  });

  return reasoner;
}

export function runSelectiveCompositeFragmentMaintenanceBenchmark():
  SelectiveCompositeFragmentMaintenanceBenchmarkReport {
  const currentLineage =
    createRevisionLineage(
      "rev-composite",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "install-a",
        "install-b",
        "install-c",
        "install-d",
      ],
      0.2,
      4,
    );

  const monitor =
    new CompositeFragmentMonitor(
      PROGRAM,
    );

  monitor.record(
    observation(
      "benchmark-monitor-z-1",
      0,
      1,
      0.2,
    ),
  );

  monitor.record(
    observation(
      "benchmark-monitor-y-1",
      1,
      0,
      0.6,
    ),
  );

  monitor.record(
    observation(
      "benchmark-monitor-z-2",
      0,
      0.5,
      0.1,
    ),
  );

  monitor.record(
    observation(
      "benchmark-monitor-y-2",
      0.5,
      0,
      0.3,
    ),
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
      "v1.28 benchmark failed to construct the incumbent composite plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "selective-benchmark-terminal",
    oldPlan,
  );

  const maintenance =
    maintainCompositeRevisionSelectively(
      currentLineage,
      monitor,
      [
        REPAIR_Z,
      ],
      PROTECTED,
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
      oldPlan,
      reasoner,
      "selective-benchmark-terminal",
      "rev-composite-maintained",
      1,
    );

  if (
    maintenance.decision !==
      "repaired" ||
    !maintenance
      .programRevision ||
    !maintenance
      .catalogRevision ||
    !maintenance
      .revisedPlan
  ) {
    throw new Error(
      "v1.28 benchmark failed to install the selective local repair.",
    );
  }

  const controller =
    createRecedingVectorController(
      STATE,
      maintenance
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      maintenance
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    maintenance,

    oldActionIds: [
      ...oldPlan
        .actionIds,
    ],

    newActionIds: [
      ...maintenance
        .revisedPlan
        .actionIds,
    ],

    healthyFragmentBefore:
      Y_FRAGMENT,

    healthyFragmentAfter:
      maintenance
        .programRevision
        .program
        .fragments
        .find(
          (fragment) =>
            fragment.id ===
            Y_FRAGMENT.id,
        ),

    nextRecedingDecision,

    hierarchy:
      reasoner.getSnapshot(),

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

import {
  installProbabilisticLocalRepair,
  runControlledMultiStepFaultDiagnosis,
  searchProbabilisticLocalRepairs,
  validateProbabilisticLocalRepairSearch,
  type InstalledProbabilisticLocalRepair,
  type MultiStepFaultDiagnosisResult,
  type ProbabilisticLocalRepairSearch,
  type ProtectedLocalRepairDecision,
} from "./multi-step-fault-diagnosis-local-repair";

import {
  CompositeFragmentMonitor,
} from "./selective-composite-fragment-maintenance";

import {
  initializeFragmentProvenance,
  synthesizeFragmentFaultProbes,
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

export interface MultiStepFaultDiagnosisLocalRepairBenchmarkReport {
  diagnosis:
    MultiStepFaultDiagnosisResult;
  search:
    ProbabilisticLocalRepairSearch;
  protectedDecision:
    ProtectedLocalRepairDecision;
  installation:
    InstalledProbabilisticLocalRepair;
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

const REPAIR_Y =
  linearFragment(
    "repair-y-0.15",
    "y",
    0.15,
  );

const REPAIR_Y_ALT =
  linearFragment(
    "repair-y-0.3",
    "y",
    0.3,
  );

const REPAIR_Z =
  linearFragment(
    "repair-z-0.125",
    "z",
    0.125,
  );

const REPAIR_Z_ALT =
  linearFragment(
    "repair-z-0.25",
    "z",
    0.25,
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.30-benchmark-composite",

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
    "v1.30-benchmark-actual",

  fragments: [
    REPAIR_Y,
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
    "hypothesis:v1.30-benchmark",

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
      0.25,
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

const INITIAL_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-passive-y-half",
      0.5,
      0,
      0.075,
    ),
    observation(
      "benchmark-passive-z-half",
      0,
      0.5,
      0.0625,
    ),
  ];

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-repair-y",
      1,
      0,
      0.15,
    ),
    observation(
      "benchmark-repair-z",
      0,
      1,
      0.125,
    ),
    observation(
      "benchmark-repair-joint",
      1,
      1,
      0.275,
    ),
    observation(
      "benchmark-repair-half-joint",
      0.5,
      1,
      0.2,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-protected-y",
      1,
      0,
      0.15,
    ),
    observation(
      "benchmark-protected-z",
      0,
      1,
      0.125,
    ),
    observation(
      "benchmark-protected-joint",
      1,
      1,
      0.275,
    ),
    observation(
      "benchmark-protected-half-joint",
      0.5,
      1,
      0.2,
    ),
  ];

function buildReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T12:20:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.30-terminal",

    description:
      "Reach progress >= 0.250 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.250",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve bounded multi-fault uncertainty before repair search.",
      "Install only a protected repair-search winner.",
    ],

    createdAt:
      "2026-09-22T12:20:00Z",

    updatedAt:
      "2026-09-22T12:20:00Z",
  });

  return reasoner;
}

export function runMultiStepFaultDiagnosisLocalRepairBenchmark():
  MultiStepFaultDiagnosisLocalRepairBenchmarkReport {
  const lineage =
    createRevisionLineage(
      "rev-composite",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "v1.30-install-a",
        "v1.30-install-b",
        "v1.30-install-c",
        "v1.30-install-d",
      ],
      0.2,
      4,
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
          0.15,
      },
    );

  const diagnosis =
    runControlledMultiStepFaultDiagnosis(
      PROGRAM,
      ACTUAL_PROGRAM,
      INITIAL_EVIDENCE,
      probes,
      {
        maximumSteps:
          2,

        faultScale:
          0.25,

        observationStdDev:
          0.15,
      },
    );

  if (
    diagnosis.decision !==
      "resolved" ||
    diagnosis.finalBelief.topKind !==
      "multi-fragment"
  ) {
    throw new Error(
      "v1.30 benchmark failed to resolve the bounded multi-fragment fault.",
    );
  }

  const monitor =
    new CompositeFragmentMonitor(
      PROGRAM,
    );

  for (
    const item of
      INITIAL_EVIDENCE
  ) {
    monitor.record(
      item,
    );
  }

  for (
    const item of
      diagnosis.acquiredObservations
  ) {
    monitor.record(
      item,
    );
  }

  const search =
    searchProbabilisticLocalRepairs(
      PROGRAM,
      diagnosis.finalBelief,
      monitor.getReliability(),
      [
        REPAIR_Y,
        REPAIR_Y_ALT,
        REPAIR_Z,
        REPAIR_Z_ALT,
      ],
      REPAIR_EVIDENCE,
    );

  if (
    search.decision !==
      "search"
  ) {
    throw new Error(
      "v1.30 benchmark failed to open the protected local repair search.",
    );
  }

  const diagnosticIds = [
    ...INITIAL_EVIDENCE.map(
      (item) =>
        item.experiment.id,
    ),
    ...diagnosis
      .acquiredObservations
      .map(
        (item) =>
          item.experiment.id,
      ),
  ];

  const protectedDecision =
    validateProbabilisticLocalRepairSearch(
      lineage,
      PROGRAM,
      search,
      PROTECTED_EVIDENCE,
      diagnosticIds,
      diagnosis
        .finalBelief
        .normalizedEntropy,
    );

  if (
    protectedDecision.decision !==
      "installed"
  ) {
    throw new Error(
      "v1.30 benchmark protected reserve did not select the local repair.",
    );
  }

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
      "v1.30 benchmark failed to construct the incumbent live plan.",
    );
  }

  const reasoner =
    buildReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.30-terminal",
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

  const installation =
    installProbabilisticLocalRepair(
      lineage,
      protectedDecision,
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
      reasoner,
      "v1.30-terminal",
      "rev-multi-repaired",
      1,
      diagnosis
        .finalBelief
        .normalizedEntropy,
      provenance,
    );

  if (
    installation.decision !==
      "installed" ||
    !installation
      .catalogRevision ||
    !installation
      .revisedPlan
  ) {
    throw new Error(
      "v1.30 benchmark failed to install the probabilistic local repair.",
    );
  }

  const controller =
    createRecedingVectorController(
      STATE,
      installation
        .catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      installation
        .catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    diagnosis,

    search,

    protectedDecision,

    installation,

    oldActionIds: [
      ...oldPlan.actionIds,
    ],

    newActionIds: [
      ...installation
        .revisedPlan
        .actionIds,
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

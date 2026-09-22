import {
  AdaptiveFaultModelPosterior,
  chooseAdaptiveFaultRepairAction,
  createAdaptiveRepairPosterior,
  expectedProbeInformationGainForAdaptiveFaults,
  inferFragmentFaultMagnitudes,
  synthesizeAdaptiveFaultModels,
  validateAdaptiveRepairPosterior,
  type AdaptiveFaultModelBelief,
  type AdaptiveFaultRepairActionDecision,
  type AdaptiveRepairBelief,
  type FragmentFaultMagnitudeEstimate,
} from "./adaptive-fault-model-repair-uncertainty";

import {
  initializeFragmentProvenance,
  synthesizeFragmentFaultProbes,
} from "./active-fragment-fault-localization-provenance";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  installProbabilisticLocalRepair,
  type InstalledProbabilisticLocalRepair,
  type ProtectedLocalRepairDecision,
} from "./multi-step-fault-diagnosis-local-repair";

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

export interface AdaptiveFaultModelRepairUncertaintyBenchmarkReport {
  estimates:
    FragmentFaultMagnitudeEstimate[];
  initialFaultBelief:
    AdaptiveFaultModelBelief;
  diagnoseDecision:
    AdaptiveFaultRepairActionDecision;
  resolvedFaultBelief:
    AdaptiveFaultModelBelief;
  initialRepairBelief:
    AdaptiveRepairBelief;
  validateDecision:
    AdaptiveFaultRepairActionDecision;
  resolvedRepairBelief:
    AdaptiveRepairBelief;
  protectedDecision:
    ProtectedLocalRepairDecision;
  repairDecision:
    AdaptiveFaultRepairActionDecision;
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

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.31-adaptive-composite",

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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:v1.31-adaptive",

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
      0.55,
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

const MAGNITUDE_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-magnitude-y-half",
      0.5,
      0,
      0.12,
    ),
    observation(
      "benchmark-magnitude-z-half",
      0,
      0.5,
      0.175,
    ),
  ];

const DIAGNOSTIC_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-diagnostic-y",
      1,
      0,
      0.24,
    ),
    observation(
      "benchmark-diagnostic-z",
      0,
      1,
      0.35,
    ),
  ];

const REPAIR_SELECTION_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-repair-select-y",
      1,
      0,
      0.24,
    ),
    observation(
      "benchmark-repair-select-z",
      0,
      1,
      0.35,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "benchmark-adaptive-protected-y",
      1,
      0,
      0.24,
    ),
    observation(
      "benchmark-adaptive-protected-z",
      0,
      1,
      0.35,
    ),
    observation(
      "benchmark-adaptive-protected-joint",
      1,
      1,
      0.59,
    ),
    observation(
      "benchmark-adaptive-protected-half-joint",
      0.5,
      1,
      0.47,
    ),
  ];

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T14:25:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.31-terminal",

    description:
      "Reach progress >= 0.550 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.550",
      "exposure <= 0.300",
    ],

    constraints: [
      "Infer fault magnitudes from evidence.",
      "Maintain repair uncertainty until protected validation.",
    ],

    createdAt:
      "2026-09-22T14:25:00Z",

    updatedAt:
      "2026-09-22T14:25:00Z",
  });

  return reasoner;
}

export function runAdaptiveFaultModelRepairUncertaintyBenchmark():
  AdaptiveFaultModelRepairUncertaintyBenchmarkReport {
  const lineage =
    createRevisionLineage(
      "rev-composite",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "v1.31-install-a",
        "v1.31-install-b",
        "v1.31-install-c",
        "v1.31-install-d",
      ],
      0.2,
      4,
    );

  const estimates =
    inferFragmentFaultMagnitudes(
      PROGRAM,
      MAGNITUDE_EVIDENCE,
      {
        uncertaintyRadius:
          0.1,
      },
    );

  const candidates =
    synthesizeAdaptiveFaultModels(
      PROGRAM,
      estimates,
      {
        maximumChangedFragments:
          2,

        maximumCandidates:
          64,
      },
    );

  const faultPosterior =
    new AdaptiveFaultModelPosterior(
      candidates,
    );

  for (
    const item of
      MAGNITUDE_EVIDENCE
  ) {
    faultPosterior.recordObservation(
      item,
      0.08,
    );
  }

  const initialFaultBelief =
    faultPosterior.getBelief();

  const probes =
    synthesizeFragmentFaultProbes(
      PROGRAM,
      {
        observationStdDev:
          0.02,
      },
    );

  const bestInformationGain =
    Math.max(
      ...probes.map(
        (probe) =>
          expectedProbeInformationGainForAdaptiveFaults(
            faultPosterior,
            probe,
          ),
      ),
    );

  const diagnoseDecision =
    chooseAdaptiveFaultRepairAction(
      initialFaultBelief,
      undefined,
      false,
      {
        diagnosticExpectedInformationGain:
          bestInformationGain,

        diagnosticCost:
          0.03,

        diagnosticRisk:
          0.05,
      },
    );

  if (
    diagnoseDecision.decision !==
      "diagnose"
  ) {
    throw new Error(
      "v1.31 benchmark did not choose further diagnosis under fault uncertainty.",
    );
  }

  for (
    const item of
      DIAGNOSTIC_EVIDENCE
  ) {
    faultPosterior.recordObservation(
      item,
      0.02,
    );
  }

  const resolvedFaultBelief =
    faultPosterior.getBelief();

  if (
    !resolvedFaultBelief
      .sufficientlyResolved
  ) {
    throw new Error(
      "v1.31 benchmark did not resolve adaptive fault magnitude.",
    );
  }

  const repairPosterior =
    createAdaptiveRepairPosterior(
      PROGRAM,
      candidates,
      MAGNITUDE_EVIDENCE,
      {
        maximumRepairCandidates:
          8,
      },
    );

  const initialRepairBelief =
    repairPosterior.getBelief();

  const validateDecision =
    chooseAdaptiveFaultRepairAction(
      resolvedFaultBelief,
      initialRepairBelief,
      false,
      {
        validationExpectedInformationGain:
          0.5,

        validationCost:
          0.05,

        validationRisk:
          0.05,
      },
    );

  if (
    validateDecision.decision !==
      "validate"
  ) {
    throw new Error(
      "v1.31 benchmark did not choose validation under repair uncertainty.",
    );
  }

  for (
    const item of
      REPAIR_SELECTION_EVIDENCE
  ) {
    repairPosterior.recordObservation(
      item,
      0.018,
    );
  }

  const resolvedRepairBelief =
    repairPosterior.getBelief();

  if (
    !resolvedRepairBelief
      .sufficientlyResolved
  ) {
    throw new Error(
      "v1.31 benchmark did not resolve the repair candidate posterior.",
    );
  }

  const protectedDecision =
    validateAdaptiveRepairPosterior(
      lineage,
      PROGRAM,
      repairPosterior,
      [
        ...MAGNITUDE_EVIDENCE,
        ...REPAIR_SELECTION_EVIDENCE,
      ],
      DIAGNOSTIC_EVIDENCE,
      PROTECTED_EVIDENCE,
      resolvedRepairBelief
        .normalizedEntropy,
    );

  if (
    protectedDecision.decision !==
      "installed"
  ) {
    throw new Error(
      "v1.31 benchmark protected reserve did not authorize the adaptive repair.",
    );
  }

  const repairDecision =
    chooseAdaptiveFaultRepairAction(
      resolvedFaultBelief,
      resolvedRepairBelief,
      true,
    );

  if (
    repairDecision.decision !==
      "repair"
  ) {
    throw new Error(
      "v1.31 benchmark did not authorize repair after protected validation.",
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
      "v1.31 benchmark could not build the incumbent plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.31-terminal",
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
      "v1.31-terminal",
      "rev-adaptive-repair",
      1,
      resolvedRepairBelief
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
      "v1.31 benchmark failed to install the protected adaptive repair.",
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
    estimates,

    initialFaultBelief,

    diagnoseDecision,

    resolvedFaultBelief,

    initialRepairBelief,

    validateDecision,

    resolvedRepairBelief,

    protectedDecision,

    repairDecision,

    installation,

    oldActionIds: [
      ...oldPlan
        .actionIds,
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

import {
  JointParameterStructurePosterior,
  buildResolvedStructuralMutationSearch,
  chooseStructuralMutationProbe,
  synthesizeBoundedLocalStructuralMutations,
  synthesizeStructuralMutationProbes,
  type JointParameterStructureBelief,
  type LocalStructuralMutationCandidate,
  type StructuralMutationProbeChoice,
} from "./bounded-local-structural-mutation";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  initializeFragmentProvenance,
} from "./active-fragment-fault-localization-provenance";

import {
  installProbabilisticLocalRepair,
  validateProbabilisticLocalRepairSearch,
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

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

export interface BoundedLocalStructuralMutationBenchmarkReport {
  candidates:
    LocalStructuralMutationCandidate[];
  initialBelief:
    JointParameterStructureBelief;
  probeChoice:
    StructuralMutationProbeChoice;
  diagnosticObservation:
    StructuralMechanismObservation;
  resolvedBelief:
    JointParameterStructureBelief;
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

function fragment(
  id: string,
  term:
    StructuralMechanismTerm,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        ...term,

        variables: [
          ...term.variables,
        ],
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

const Y_FRAGMENT =
  fragment(
    "rev-y:program-y-fragment",
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
  );

const Z_FRAGMENT =
  fragment(
    "rev-z:program-z-fragment",
    {
      id:
        "linear(z)",

      kind:
        "linear",

      variables: [
        "z",
      ],

      coefficient:
        0.2,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.32-structural-composite",

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
    0.04,

  depth:
    3,

  complexity:
    2,
};

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "v1.32-actual-saturating",

  fragments: [
    fragment(
      "actual-saturating-y",
      {
        id:
          "saturating(y)",

        kind:
          "saturating",

        variables: [
          "y",
        ],

        coefficient:
          0.9,
      },
    ),
    Z_FRAGMENT,
  ],
};

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.32-discovery-y-half",
      0.5,
      0,
      0.45,
    ),
    observation(
      "v1.32-discovery-z",
      0,
      1,
      0.2,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.32-protected-y-quarter",
      0.25,
      0,
      0.3,
    ),
    observation(
      "v1.32-protected-y-half",
      0.5,
      0,
      0.45,
    ),
    observation(
      "v1.32-protected-y-full",
      1,
      0,
      0.6,
    ),
    observation(
      "v1.32-protected-joint",
      0.5,
      1,
      0.65,
    ),
  ];

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
    0.6,

  effectGap:
    0.58,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:v1.32",

  repairCandidateId:
    "composition:linear-y+linear-z",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        0.3,
      "boost-finish":
        0.6,
    },

    exposure: {
      finish:
        0.1,
      "boost-finish":
        0.15,
    },
  },

  observationStdDev:
    0.04,

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
      0.4,
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

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T15:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.32-terminal",

    description:
      "Reach progress >= 0.400 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.400",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve parameter versus structure uncertainty.",
      "Protect local topology mutation before live installation.",
    ],

    createdAt:
      "2026-09-22T15:30:00Z",

    updatedAt:
      "2026-09-22T15:30:00Z",
  });

  return reasoner;
}

export function runBoundedLocalStructuralMutationBenchmark():
  BoundedLocalStructuralMutationBenchmarkReport {
  const candidates =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Y_FRAGMENT.id,
      DISCOVERY,
      [
        "y",
        "z",
      ],
      {
        includeSaturating:
          true,

        includeInteractions:
          true,

        includeLatentBias:
          true,

        maximumCandidates:
          12,
      },
    );

  const posterior =
    new JointParameterStructurePosterior(
      candidates,
      {
        maximumDiscoveryObjectiveGap:
          0.005,

        sufficientConfidence:
          0.95,

        minimumMargin:
          0.1,
      },
    );

  const initialBelief =
    posterior.getBelief();

  const probes =
    synthesizeStructuralMutationProbes(
      [
        "y",
        "z",
      ],
      {
        levels: [
          1,
        ],

        includeJointProbe:
          false,

        observationStdDev:
          0.03,
      },
    );

  const probeChoice =
    chooseStructuralMutationProbe(
      posterior,
      probes,
    );

  if (
    probeChoice.decision !==
      "probe" ||
    !probeChoice.probe
  ) {
    throw new Error(
      "v1.32 benchmark did not choose a safe structural diagnostic.",
    );
  }

  const diagnosticObservation:
    StructuralMechanismObservation = {
    experiment: {
      id:
        `${probeChoice.probe.id}:controlled-observation`,

      interventions: {
        ...probeChoice
          .probe
          .interventions,
      },

      risk:
        probeChoice.probe.risk,

      cost:
        probeChoice.probe.cost,

      reversible:
        probeChoice
          .probe
          .reversible,
    },

    measuredEffect:
      predictHierarchicalProgramEffect(
        ACTUAL_PROGRAM,
        probeChoice
          .probe
          .interventions,
      ),
  };

  const resolvedBelief =
    posterior.recordObservation(
      diagnosticObservation,
      probeChoice
        .probe
        .observationStdDev,
    );

  if (
    !resolvedBelief
      .sufficientlyResolved ||
    resolvedBelief.topKind !==
      "saturating"
  ) {
    throw new Error(
      "v1.32 benchmark did not resolve the saturating local structure.",
    );
  }

  const search =
    buildResolvedStructuralMutationSearch(
      posterior,
      DISCOVERY,
    );

  const lineage =
    createRevisionLineage(
      "rev-structural-incumbent",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "v1.32-install-a",
        "v1.32-install-b",
        "v1.32-install-c",
        "v1.32-install-d",
      ],
      0.2,
      4,
    );

  const protectedDecision =
    validateProbabilisticLocalRepairSearch(
      lineage,
      PROGRAM,
      search,
      PROTECTED,
      [
        diagnosticObservation
          .experiment
          .id,
      ],
      resolvedBelief
        .normalizedEntropy,
    );

  if (
    protectedDecision.decision !==
      "installed"
  ) {
    throw new Error(
      "v1.32 benchmark protected reserve did not authorize the topology mutation.",
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
      "v1.32 benchmark could not build the incumbent plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.32-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "rev-structural-incumbent",
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
            0,
        },

        "boost-finish": {
          y:
            1,
          z:
            0,
        },
      },
      STATE,
      GOAL,
      ACTIONS,
      oldPlan,
      reasoner,
      "v1.32-terminal",
      "rev-saturating-y",
      1,
      resolvedBelief
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
      "v1.32 benchmark failed to install the protected structural mutation.",
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
    candidates,

    initialBelief,

    probeChoice,

    diagnosticObservation,

    resolvedBelief,

    protectedDecision,

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

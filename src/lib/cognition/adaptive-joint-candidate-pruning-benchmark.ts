import {
  restorePrunedStructuralCandidate,
  runControlledAdaptivePrunedStructuralDiagnosis,
  type AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import {
  runControlledActiveProtectedStructuralValidation,
  type ActiveProtectedStructuralValidationResult,
} from "./active-protected-structural-validation";

import {
  synthesizeBoundedLocalStructuralMutations,
  type LocalStructuralMutationCandidate,
  type StructuralMutationProbe,
} from "./bounded-local-structural-mutation";

import {
  synthesizeBoundedMultiFragmentStructuralRevisions,
  type MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  initializeFragmentProvenance,
} from "./active-fragment-fault-localization-provenance";

import {
  installProbabilisticLocalRepair,
  type InstalledProbabilisticLocalRepair,
  type LocalRepairSearchCandidate,
  type ProbabilisticLocalRepairSearch,
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
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

export interface AdaptiveJointCandidatePruningBenchmarkReport {
  candidates:
    MultiFragmentStructuralRevisionCandidate[];
  diagnosis:
    AdaptivePrunedStructuralDiagnosisResult;
  reopened:
    AdaptivePrunedStructuralDiagnosisResult;
  restoredCandidateId:
    string;
  restoredAuditLength:
    number;
  protectedValidation:
    ActiveProtectedStructuralValidationResult;
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
        0.5,
    },
  );

const Q_FRAGMENT =
  fragment(
    "rev-q:program-q-fragment",
    {
      id:
        "linear(q)",

      kind:
        "linear",

      variables: [
        "q",
      ],

      coefficient:
        0.4,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.35-incumbent",

  baseEffects: {
    y:
      0,

    z:
      0,

    w:
      0,

    q:
      0,
  },

  fragments: [
    Y_FRAGMENT,
    Z_FRAGMENT,
    Q_FRAGMENT,
  ],

  observationStdDev:
    0.03,

  depth:
    4,

  complexity:
    3,
};

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "v1.35-actual",

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
    fragment(
      "actual-interaction-z-w",
      {
        id:
          "interaction(z,w)",

        kind:
          "interaction",

        variables: [
          "z",
          "w",
        ],

        coefficient:
          0.5,
      },
    ),
    fragment(
      "actual-saturating-q",
      {
        id:
          "saturating(q)",

        kind:
          "saturating",

        variables: [
          "q",
        ],

        coefficient:
          0.6,
      },
    ),
  ],
};

const OUTSIDE_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "v1.35-outside",

  fragments: [
    fragment(
      "outside-y",
      {
        id:
          "linear(y)",

        kind:
          "linear",

        variables: [
          "y",
        ],

        coefficient:
          0.1,
      },
    ),
    fragment(
      "outside-z",
      {
        id:
          "latent-bias",

        kind:
          "latent-bias",

        variables:
          [],

        coefficient:
          0.1,
      },
    ),
    fragment(
      "outside-q",
      {
        id:
          "linear(q)",

        kind:
          "linear",

        variables: [
          "q",
        ],

        coefficient:
          0.1,
      },
    ),
  ],
};

function observation(
  id: string,
  y: number,
  z: number,
  w: number,
  q: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        y,
        z,
        w,
        q,
      },

      risk:
        0.05,

      cost:
        0.02,

      reversible:
        true,
    },

    measuredEffect,
  };
}

const Y_LOCAL:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.35-local-y-half",
      0.5,
      0,
      1,
      0,
      0.45,
    ),
  ];

const Z_LOCAL:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.35-local-z-context-full",
      0,
      1,
      1,
      0,
      0.5,
    ),
  ];

const Q_LOCAL:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.35-local-q-half",
      0,
      0,
      1,
      0.5,
      0.3,
    ),
  ];

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    ...Y_LOCAL,
    ...Z_LOCAL,
    ...Q_LOCAL,
    observation(
      "v1.35-discovery-combined",
      0.5,
      1,
      1,
      0.5,
      1.25,
    ),
  ];

const PROBES:
  readonly StructuralMutationProbe[] = [
    {
      id:
        "v1.35-probe:y=1.00",

      interventions: {
        y:
          1,

        z:
          0,

        w:
          1,

        q:
          0,
      },

      risk:
        0.02,

      cost:
        0.01,

      reversible:
        true,

      observationStdDev:
        0.03,
    },
    {
      id:
        "v1.35-probe:q=1.00",

      interventions: {
        y:
          0,

        z:
          0,

        w:
          1,

        q:
          1,
      },

      risk:
        0.02,

      cost:
        0.02,

      reversible:
        true,

      observationStdDev:
        0.03,
    },
    {
      id:
        "v1.35-probe:z=1.00+w=0.50",

      interventions: {
        y:
          0,

        z:
          1,

        w:
          0.5,

        q:
          0,
      },

      risk:
        0.03,

      cost:
        0.03,

      reversible:
        true,

      observationStdDev:
        0.03,
    },
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
    1.3,

  effectGap:
    1.28,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:v1.35",

  repairCandidateId:
    "composition:linear-y+linear-z+linear-q",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        1.3,

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
    0.03,

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
      1.2,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function localCandidateSets(): {
  y:
    LocalStructuralMutationCandidate[];
  z:
    LocalStructuralMutationCandidate[];
  q:
    LocalStructuralMutationCandidate[];
} {
  const y =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Y_FRAGMENT.id,
      Y_LOCAL,
      [
        "y",
        "z",
        "w",
        "q",
      ],
      {
        maximumCandidates:
          16,
      },
    ).filter(
      (candidate) =>
        (
          candidate.kind ===
            "linear" &&
          !candidate
            .topologyChanged &&
          Math.abs(
            candidate.coefficient -
              0.9,
          ) <
            1e-9
        ) ||
        (
          candidate.kind ===
            "saturating" &&
          Math.abs(
            candidate.coefficient -
              0.9,
          ) <
            1e-9
        ),
    );

  const z =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Z_FRAGMENT.id,
      Z_LOCAL,
      [
        "y",
        "z",
        "w",
        "q",
      ],
      {
        maximumCandidates:
          16,
      },
    ).filter(
      (candidate) =>
        candidate.kind ===
          "incumbent" ||
        (
          candidate.kind ===
            "interaction" &&
          candidate.variables
            .includes(
              "z",
            ) &&
          candidate.variables
            .includes(
              "w",
            ) &&
          Math.abs(
            candidate.coefficient -
              0.5,
          ) <
            1e-9
        ),
    );

  const q =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Q_FRAGMENT.id,
      Q_LOCAL,
      [
        "y",
        "z",
        "w",
        "q",
      ],
      {
        maximumCandidates:
          16,
      },
    ).filter(
      (candidate) =>
        (
          candidate.kind ===
            "linear" &&
          !candidate
            .topologyChanged &&
          Math.abs(
            candidate.coefficient -
              0.6,
          ) <
            1e-9
        ) ||
        (
          candidate.kind ===
            "saturating" &&
          Math.abs(
            candidate.coefficient -
              0.6,
          ) <
            1e-9
        ),
    );

  if (
    y.length !==
      2 ||
    z.length !==
      2 ||
    q.length !==
      2
  ) {
    throw new Error(
      "v1.35 benchmark local candidate calibration failed.",
    );
  }

  return {
    y,
    z,
    q,
  };
}

function createCandidates():
  MultiFragmentStructuralRevisionCandidate[] {
  const local =
    localCandidateSets();

  const candidates =
    synthesizeBoundedMultiFragmentStructuralRevisions(
      PROGRAM,
      {
        [
          Y_FRAGMENT.id
        ]:
          local.y,

        [
          Z_FRAGMENT.id
        ]:
          local.z,

        [
          Q_FRAGMENT.id
        ]:
          local.q,
      },
      DISCOVERY,
      {
        maximumChangedFragments:
          3,

        maximumCandidates:
          16,

        complexityPenaltyPerTopologyChange:
          0,
      },
    );

  if (
    candidates.length !==
      8
  ) {
    throw new Error(
      `v1.35 benchmark expected 8 joint candidates but found ${candidates.length}.`,
    );
  }

  return candidates;
}

function toRepairCandidate(
  candidate:
    MultiFragmentStructuralRevisionCandidate,
): LocalRepairSearchCandidate {
  return {
    id:
      candidate.id,

    program:
      candidate.program,

    replacementFragmentIds: {
      ...candidate
        .replacementFragmentIds,
    },

    retiredFragmentIds: [
      ...candidate
        .retiredFragmentIds,
    ],

    discoveryMeanSquaredError:
      candidate
        .discoveryMeanSquaredError,

    complexityPenalty:
      candidate
        .complexityPenalty,

    objective:
      candidate.objective,
  };
}

function buildSearch(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  selectedCandidateId:
    string,
): ProbabilisticLocalRepairSearch {
  const repairCandidates =
    candidates.map(
      toRepairCandidate,
    );

  const selectedCandidate =
    repairCandidates.find(
      (candidate) =>
        candidate.id ===
        selectedCandidateId,
    );

  if (!selectedCandidate) {
    throw new Error(
      `v1.35 benchmark selected candidate ${selectedCandidateId} is missing.`,
    );
  }

  return {
    decision:
      "search",

    faultExplanation: {
      id:
        "v1.35-adaptive-pruned-structure",

      kind:
        "multi-fragment",

      fragmentIds: [
        Y_FRAGMENT.id,
        Z_FRAGMENT.id,
        Q_FRAGMENT.id,
      ].sort(),
    },

    faultConfidence:
      1,

    faultFragmentIds: [
      Y_FRAGMENT.id,
      Z_FRAGMENT.id,
      Q_FRAGMENT.id,
    ].sort(),

    repairEvidenceIds:
      DISCOVERY.map(
        (item) =>
          item
            .experiment
            .id,
      ),

    candidates:
      repairCandidates,

    selectedCandidate,

    reason:
      "fault-posterior-authorized-local-repair-search",
  };
}

function lineage() {
  return createRevisionLineage(
    "v1.35-root",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "v1.35-historical-a",
      "v1.35-historical-b",
      "v1.35-historical-c",
      "v1.35-historical-d",
    ],
    0.2,
    4,
  );
}

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T19:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.35-terminal",

    description:
      "Reach progress >= 1.200 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 1.200",
      "exposure <= 0.300",
    ],

    constraints: [
      "Prune contradicted structural candidates reversibly.",
      "Replan after every structural observation.",
      "Require active protected validation before installation.",
    ],

    createdAt:
      "2026-09-22T19:30:00Z",

    updatedAt:
      "2026-09-22T19:30:00Z",
  });

  return reasoner;
}

export function runAdaptiveJointCandidatePruningBenchmark():
  AdaptiveJointCandidatePruningBenchmarkReport {
  const candidates =
    createCandidates();

  const diagnosis =
    runControlledAdaptivePrunedStructuralDiagnosis(
      candidates,
      PROBES,
      ACTUAL_PROGRAM,
      DISCOVERY,
      {
        maximumSteps:
          5,

        minimumEvidenceBeforePrune:
          2,

        maximumProbabilityForPrune:
          0.01,

        maximumRelativeProbabilityForPrune:
          0.02,

        minimumEvidenceBeforeReopen:
          5,

        maximumAcceptableMeanSquaredError:
          0.02,
      },
    );

  if (
    diagnosis.decision !==
      "resolved" ||
    !diagnosis
      .selectedCandidateId
  ) {
    throw new Error(
      "v1.35 benchmark did not resolve the adaptively pruned joint structure.",
    );
  }

  const reopened =
    runControlledAdaptivePrunedStructuralDiagnosis(
      candidates,
      PROBES,
      OUTSIDE_PROGRAM,
      DISCOVERY,
      {
        maximumSteps:
          5,

        minimumEvidenceBeforePrune:
          2,

        minimumEvidenceBeforeReopen:
          5,

        maximumAcceptableMeanSquaredError:
          0.005,
      },
    );

  if (
    reopened.decision !==
      "reopen-search"
  ) {
    throw new Error(
      "v1.35 benchmark did not reopen structural synthesis after retained-set inadequacy.",
    );
  }

  const firstPruned =
    diagnosis
      .finalCandidateSet
      .prunedCandidateIds[
        0
      ];

  if (!firstPruned) {
    throw new Error(
      "v1.35 benchmark did not produce a reversible pruning event.",
    );
  }

  const restored =
    restorePrunedStructuralCandidate(
      diagnosis
        .finalCandidateSet,
      firstPruned,
    );

  const search =
    buildSearch(
      candidates,
      diagnosis
        .selectedCandidateId,
    );

  const protectedValidation =
    runControlledActiveProtectedStructuralValidation(
      lineage(),
      PROGRAM,
      search,
      diagnosis
        .acquiredObservations
        .map(
          (item) =>
            item
              .experiment
              .id,
        ),
      ACTUAL_PROGRAM,
      [],
      {
        uncertaintyAtInstall:
          diagnosis
            .finalBelief
            .normalizedEntropy,

        maximumSteps:
          8,
      },
    );

  if (
    protectedValidation.decision !==
      "validated" ||
    !protectedValidation
      .protectedDecision
  ) {
    throw new Error(
      "v1.35 benchmark did not actively protect the resolved pruned structure.",
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
      "v1.35 benchmark could not build the incumbent live plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.35-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "v1.35-root",
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

        [
          Q_FRAGMENT.id
        ]: {
          sourceRevisionId:
            "rev-q",

          sourceFragmentId:
            "program-q-fragment",
        },
      },
    );

  const installation =
    installProbabilisticLocalRepair(
      lineage(),
      protectedValidation
        .protectedDecision,
      "progress",
      {
        finish: {
          y:
            0.5,

          z:
            1,

          w:
            0.5,

          q:
            0.5,
        },

        "boost-finish": {
          y:
            1,

          z:
            1,

          w:
            0.5,

          q:
            1,
        },
      },
      STATE,
      GOAL,
      ACTIONS,
      oldPlan,
      reasoner,
      "v1.35-terminal",
      "rev-v1.35-pruned-structure",
      1,
      protectedValidation
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
      "v1.35 benchmark failed to install the actively protected pruned structure.",
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

    diagnosis,

    reopened,

    restoredCandidateId:
      firstPruned,

    restoredAuditLength:
      restored
        .auditHistory
        .length,

    protectedValidation,

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

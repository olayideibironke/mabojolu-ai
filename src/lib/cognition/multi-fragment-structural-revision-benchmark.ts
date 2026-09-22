import {
  MultiFragmentStructuralPosterior,
  buildResolvedMultiFragmentStructuralSearch,
  runControlledContingentStructuralDiagnosis,
  synthesizeBoundedMultiFragmentStructuralRevisions,
  type ContingentStructuralDiagnosticPlan,
  type ControlledContingentStructuralDiagnosisResult,
  type MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import {
  synthesizeBoundedLocalStructuralMutations,
  type LocalStructuralMutationCandidate,
  type StructuralMutationProbe,
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

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

export interface MultiFragmentStructuralRevisionBenchmarkReport {
  candidates:
    MultiFragmentStructuralRevisionCandidate[];
  initialPlan:
    ContingentStructuralDiagnosticPlan;
  diagnosis:
    ControlledContingentStructuralDiagnosisResult;
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
        0.5,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.33-joint-structure",

  baseEffects: {
    y:
      0,
    z:
      0,
    w:
      0,
  },

  fragments: [
    Y_FRAGMENT,
    Z_FRAGMENT,
  ],

  observationStdDev:
    0.03,

  depth:
    3,

  complexity:
    2,
};

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "v1.33-hidden-actual",

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
  ],
};

function observation(
  id: string,
  y: number,
  z: number,
  w: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        y,
        z,
        w,
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

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.33-discovery-y-half",
      0.5,
      0,
      1,
      0.45,
    ),
    observation(
      "v1.33-discovery-z-full-context",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "v1.33-discovery-combined",
      0.5,
      1,
      1,
      0.95,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.33-protected-y-quarter",
      0.25,
      0,
      1,
      0.3,
    ),
    observation(
      "v1.33-protected-y-full",
      1,
      0,
      1,
      0.6,
    ),
    observation(
      "v1.33-protected-z-half-context",
      0,
      1,
      0.5,
      0.25,
    ),
    observation(
      "v1.33-protected-z-full-context",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "v1.33-protected-combined",
      0.5,
      1,
      0.5,
      0.7,
    ),
  ];

const PROBES:
  readonly StructuralMutationProbe[] = [
    {
      id:
        "joint-structure:y=1.00",

      interventions: {
        y:
          1,
        z:
          0,
        w:
          1,
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
        "joint-structure:z=1.00+w=0.50",

      interventions: {
        y:
          0,
        z:
          1,
        w:
          0.5,
      },

      risk:
        0.08,

      cost:
        0.25,

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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:v1.33",

  repairCandidateId:
    "composition:linear-y+linear-z",

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
      0.79,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function localCandidates() {
  const y =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Y_FRAGMENT.id,
      DISCOVERY,
      [
        "y",
        "z",
        "w",
      ],
      {
        maximumCandidates:
          12,
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
      DISCOVERY,
      [
        "y",
        "z",
        "w",
      ],
      {
        maximumCandidates:
          12,
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

  if (
    y.length !==
      2 ||
    z.length !==
      2
  ) {
    throw new Error(
      "v1.33 benchmark local structural calibration failed.",
    );
  }

  return {
    y,
    z,
  };
}

function createCandidates() {
  const local =
    localCandidates();

  return synthesizeBoundedMultiFragmentStructuralRevisions(
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
    },
    DISCOVERY,
    {
      maximumChangedFragments:
        2,

      maximumCandidates:
        8,

      complexityPenaltyPerTopologyChange:
        0,
    },
  );
}

function findJointCandidate(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  yKind:
    "linear" |
    "saturating",
  zKind:
    "incumbent" |
    "interaction",
) {
  const result =
    candidates.find(
      (candidate) => {
        const yId =
          candidate
            .componentCandidateIds[
              Y_FRAGMENT.id
            ] ??
          "";

        const zId =
          candidate
            .componentCandidateIds[
              Z_FRAGMENT.id
            ] ??
          "";

        return (
          yId.includes(
            `:mutation:${yKind}:`,
          ) &&
          (
            zKind ===
              "incumbent"
              ? zId.endsWith(
                  ":mutation:incumbent",
                )
              : zId.includes(
                  ":mutation:interaction:",
                )
          )
        );
      },
    );

  if (!result) {
    throw new Error(
      `v1.33 benchmark missing joint candidate ${yKind}+${zKind}.`,
    );
  }

  return result;
}

function createPosterior(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
) {
  const satInteraction =
    findJointCandidate(
      candidates,
      "saturating",
      "interaction",
    );

  const satIncumbent =
    findJointCandidate(
      candidates,
      "saturating",
      "incumbent",
    );

  const linearIncumbent =
    findJointCandidate(
      candidates,
      "linear",
      "incumbent",
    );

  const linearInteraction =
    findJointCandidate(
      candidates,
      "linear",
      "interaction",
    );

  return new MultiFragmentStructuralPosterior(
    candidates,
    {
      [
        satInteraction.id
      ]:
        0.35,

      [
        satIncumbent.id
      ]:
        0.35,

      [
        linearIncumbent.id
      ]:
        0.29,

      [
        linearInteraction.id
      ]:
        0.01,
    },
    0.95,
    0.1,
  );
}

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T15:40:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.33-terminal",

    description:
      "Reach progress >= 0.790 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.790",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve bounded multi-fragment topology uncertainty.",
      "Use outcome-contingent structural diagnostics.",
      "Protect the same joint structure independently.",
    ],

    createdAt:
      "2026-09-22T15:40:00Z",

    updatedAt:
      "2026-09-22T15:40:00Z",
  });

  return reasoner;
}

export function runMultiFragmentStructuralRevisionBenchmark():
  MultiFragmentStructuralRevisionBenchmarkReport {
  const candidates =
    createCandidates();

  const posterior =
    createPosterior(
      candidates,
    );

  const initialPlan =
    (
      awaitPlan(
        posterior,
      )
    );

  const diagnosis =
    runControlledContingentStructuralDiagnosis(
      posterior,
      ACTUAL_PROGRAM,
      PROBES,
      {
        maximumSteps:
          2,
      },
    );

  if (
    diagnosis.decision !==
      "resolved"
  ) {
    throw new Error(
      "v1.33 benchmark failed to resolve the joint structural revision.",
    );
  }

  const search =
    buildResolvedMultiFragmentStructuralSearch(
      posterior,
      DISCOVERY,
    );

  const lineage =
    createRevisionLineage(
      "rev-joint-structure-incumbent",
      PROGRAM,
      HYPOTHESIS,
      PREREQUISITE,
      [
        "v1.33-install-a",
        "v1.33-install-b",
        "v1.33-install-c",
        "v1.33-install-d",
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
      diagnosis
        .acquiredObservations
        .map(
          (item) =>
            item
              .experiment
              .id,
        ),
      diagnosis
        .finalBelief
        .normalizedEntropy,
    );

  if (
    protectedDecision.decision !==
      "installed"
  ) {
    throw new Error(
      "v1.33 benchmark protected reserve did not authorize the joint topology revision.",
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
      "v1.33 benchmark could not build the incumbent live plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.33-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "rev-joint-structure-incumbent",
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
          w:
            0.5,
        },

        "boost-finish": {
          y:
            1,
          z:
            1,
          w:
            0.5,
        },
      },
      STATE,
      GOAL,
      ACTIONS,
      oldPlan,
      reasoner,
      "v1.33-terminal",
      "rev-joint-structure-repaired",
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
      "v1.33 benchmark failed to install the protected joint topology revision.",
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

    initialPlan,

    diagnosis,

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

function awaitPlan(
  posterior:
    MultiFragmentStructuralPosterior,
): ContingentStructuralDiagnosticPlan {
  const {
    planContingentMultiFragmentStructuralDiagnostics,
  } =
    requirePlan();

  return planContingentMultiFragmentStructuralDiagnostics(
    posterior,
    PROBES,
    {
      horizon:
        2,
    },
  );
}

function requirePlan(): {
  planContingentMultiFragmentStructuralDiagnostics:
    (
      posterior:
        MultiFragmentStructuralPosterior,
      probes:
        readonly StructuralMutationProbe[],
      options?: {
        horizon?: 1 | 2;
      },
    ) =>
      ContingentStructuralDiagnosticPlan;
} {
  return {
    planContingentMultiFragmentStructuralDiagnostics:
      (
        posterior,
        probes,
        options,
      ) => {
        return (
          // Kept as a local wrapper so the benchmark exposes the initial plan
          // without introducing a second simulation path.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require("./multi-fragment-structural-revision")
            .planContingentMultiFragmentStructuralDiagnostics(
              posterior,
              probes,
              options,
            )
        );
      },
  };
}

import {
  buildResynthesizedStructuralRepairSearch,
  runControlledAutomaticStructuralRecovery,
  type AutomaticStructuralRecoveryResult,
} from "./automatic-bounded-structural-resynthesis";

import {
  runControlledAdaptivePrunedStructuralDiagnosis,
  type AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import {
  runControlledActiveProtectedStructuralValidation,
  type ActiveProtectedStructuralValidationResult,
} from "./active-protected-structural-validation";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  initializeFragmentProvenance,
} from "./active-fragment-fault-localization-provenance";

import {
  installProbabilisticLocalRepair,
  type InstalledProbabilisticLocalRepair,
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
  MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

import type {
  StructuralMutationProbe,
} from "./bounded-local-structural-mutation";

export interface AutomaticBoundedStructuralResynthesisBenchmarkReport {
  failedCandidates:
    MultiFragmentStructuralRevisionCandidate[];
  collapse:
    AdaptivePrunedStructuralDiagnosisResult;
  recovery:
    AutomaticStructuralRecoveryResult;
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
        0.2,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "v1.36-incumbent",

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
    "v1.36-actual",

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
    Q_FRAGMENT,
  ],
};

function observation(
  id: string,
  y: number,
  z: number,
  w: number,
  q: number,
): StructuralMechanismObservation {
  const interventions = {
    y,
    z,
    w,
    q,
  };

  return {
    experiment: {
      id,

      interventions,

      risk:
        0.05,

      cost:
        0.02,

      reversible:
        true,
    },

    measuredEffect:
      predictHierarchicalProgramEffect(
        ACTUAL_PROGRAM,
        interventions,
      ),
  };
}

const COLLAPSE_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "v1.36-collapse-y-025",
      0.25,
      0,
      1,
      0,
    ),
    observation(
      "v1.36-collapse-y-050",
      0.5,
      0,
      1,
      0,
    ),
    observation(
      "v1.36-collapse-y-075",
      0.75,
      0,
      1,
      0,
    ),
    observation(
      "v1.36-collapse-y-100",
      1,
      0,
      1,
      0,
    ),
    observation(
      "v1.36-collapse-z-w025",
      0,
      1,
      0.25,
      0,
    ),
    observation(
      "v1.36-collapse-z-w050",
      0,
      1,
      0.5,
      0,
    ),
    observation(
      "v1.36-collapse-z-w075",
      0,
      1,
      0.75,
      0,
    ),
    observation(
      "v1.36-collapse-z-w100",
      0,
      1,
      1,
      0,
    ),
    observation(
      "v1.36-collapse-q-050",
      0,
      0,
      1,
      0.5,
    ),
    observation(
      "v1.36-collapse-q-100",
      0,
      0,
      1,
      1,
    ),
  ];

function cloneProgramWithLinearCoefficients(
  id: string,
  yCoefficient: number,
  zCoefficient: number,
): HierarchicalCausalProgram {
  return {
    ...PROGRAM,

    id,

    fragments: [
      fragment(
        `${id}:y`,
        {
          id:
            "linear(y)",

          kind:
            "linear",

          variables: [
            "y",
          ],

          coefficient:
            yCoefficient,
        },
      ),
      fragment(
        `${id}:z`,
        {
          id:
            "linear(z)",

          kind:
            "linear",

          variables: [
            "z",
          ],

          coefficient:
            zCoefficient,
        },
      ),
      Q_FRAGMENT,
    ],
  };
}

function failedCandidate(
  id: string,
  yCoefficient: number,
  zCoefficient: number,
): MultiFragmentStructuralRevisionCandidate {
  const program =
    cloneProgramWithLinearCoefficients(
      id,
      yCoefficient,
      zCoefficient,
    );

  const yChanged =
    Math.abs(
      yCoefficient -
      0.6,
    ) >
    Number.EPSILON;

  const zChanged =
    Math.abs(
      zCoefficient -
      0.5,
    ) >
    Number.EPSILON;

  const replacementFragmentIds:
    Record<string, string> =
      {};

  const parameterChangedFragmentIds:
    string[] =
      [];

  if (
    yChanged
  ) {
    replacementFragmentIds[
      Y_FRAGMENT.id
    ] =
      `${id}:y`;

    parameterChangedFragmentIds.push(
      Y_FRAGMENT.id,
    );
  }

  if (
    zChanged
  ) {
    replacementFragmentIds[
      Z_FRAGMENT.id
    ] =
      `${id}:z`;

    parameterChangedFragmentIds.push(
      Z_FRAGMENT.id,
    );
  }

  const discoveryMeanSquaredError =
    COLLAPSE_EVIDENCE.reduce(
      (
        sum,
        item,
      ) => {
        const error =
          item
            .measuredEffect -
          predictHierarchicalProgramEffect(
            program,
            item
              .experiment
              .interventions,
          );

        return sum +
          error *
          error;
      },
      0,
    ) /
    COLLAPSE_EVIDENCE.length;

  return {
    id,

    componentCandidateIds: {
      [
        Y_FRAGMENT.id
      ]:
        `${id}:y-component`,

      [
        Z_FRAGMENT.id
      ]:
        `${id}:z-component`,
    },

    replacementFragmentIds,

    retiredFragmentIds:
      Object.keys(
        replacementFragmentIds,
      ).sort(),

    topologyChangedFragmentIds:
      [],

    parameterChangedFragmentIds:
      parameterChangedFragmentIds.sort(),

    program,

    discoveryMeanSquaredError,

    complexityPenalty:
      0,

    objective:
      discoveryMeanSquaredError,
  };
}

const FAILED_CANDIDATES:
  readonly MultiFragmentStructuralRevisionCandidate[] = [
    failedCandidate(
      "v1.36-failed-y060-z025",
      0.6,
      0.25,
    ),
    failedCandidate(
      "v1.36-failed-y060-z050",
      0.6,
      0.5,
    ),
    failedCandidate(
      "v1.36-failed-y090-z025",
      0.9,
      0.25,
    ),
    failedCandidate(
      "v1.36-failed-y090-z050",
      0.9,
      0.5,
    ),
  ];

const COLLAPSE_PROBES:
  readonly StructuralMutationProbe[] = [
    {
      id:
        "v1.36-collapse-probe-y",

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
        "v1.36-collapse-probe-z",

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
        0.02,

      cost:
        0.01,

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
    1,

  effectGap:
    0.98,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:v1.36",

  repairCandidateId:
    "composition:linear-y+linear-z+linear-q",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        1,

      "boost-finish":
        1.3,
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
      1,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function lineage() {
  return createRevisionLineage(
    "v1.36-root",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "v1.36-historical-a",
      "v1.36-historical-b",
      "v1.36-historical-c",
      "v1.36-historical-d",
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
        `2026-09-22T19:50:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.36-terminal",

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
      "Re-synthesize only blamed local fragments.",
      "Preserve healthy fragments.",
      "Require fresh protected validation before installation.",
    ],

    createdAt:
      "2026-09-22T19:50:00Z",

    updatedAt:
      "2026-09-22T19:50:00Z",
  });

  return reasoner;
}

export function runAutomaticBoundedStructuralResynthesisBenchmark():
  AutomaticBoundedStructuralResynthesisBenchmarkReport {
  const collapse =
    runControlledAdaptivePrunedStructuralDiagnosis(
      FAILED_CANDIDATES,
      COLLAPSE_PROBES,
      ACTUAL_PROGRAM,
      COLLAPSE_EVIDENCE,
      {
        maximumSteps:
          2,

        minimumEvidenceBeforeReopen:
          6,

        maximumAcceptableMeanSquaredError:
          0.005,
      },
    );

  if (
    collapse.decision !==
      "reopen-search"
  ) {
    throw new Error(
      "v1.36 benchmark did not collapse the stale structural family.",
    );
  }

  const recovery =
    runControlledAutomaticStructuralRecovery(
      PROGRAM,
      FAILED_CANDIDATES,
      collapse,
      "v1.35-stale-family",
      1,
      ACTUAL_PROGRAM,
      [],
      {
        resynthesis: {
          minimumLocalEvidence:
            3,

          minimumLocalMeanSquaredError:
            0.005,

          maximumTargets:
            2,

          maximumLocalCandidates:
            2,

          minimumLocalCandidates:
            2,

          localObjectiveGap:
            0.02,

          maximumJointCandidates:
            8,

          jointObjectiveGap:
            0.03,

          maximumResynthesizedMeanSquaredError:
            0.01,
        },

        diagnosis: {
          maximumSteps:
            4,

          minimumEvidenceBeforePrune:
            1,

          maximumProbabilityForPrune:
            0.02,

          maximumRelativeProbabilityForPrune:
            0.05,

          minimumEvidenceBeforeReopen:
            3,

          maximumAcceptableMeanSquaredError:
            0.01,
        },
      },
    );

  if (
    recovery.decision !==
      "resolved" ||
    !recovery
      .diagnosis
      ?.selectedCandidateId
  ) {
    throw new Error(
      "v1.36 benchmark did not resolve the automatically re-synthesized family.",
    );
  }

  const search =
    buildResynthesizedStructuralRepairSearch(
      recovery,
    );

  const protectedValidation =
    runControlledActiveProtectedStructuralValidation(
      lineage(),
      PROGRAM,
      search,
      recovery
        .diagnosis
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
          recovery
            .diagnosis
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
      "v1.36 benchmark did not actively validate the re-synthesized winner.",
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
      "v1.36 benchmark could not build the incumbent plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.36-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "v1.36-root",
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
            1,
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
      "v1.36-terminal",
      "rev-v1.36-resynthesized",
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
      "v1.36 benchmark failed to install the protected re-synthesized structure.",
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
    failedCandidates: [
      ...FAILED_CANDIDATES,
    ],

    collapse,

    recovery,

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

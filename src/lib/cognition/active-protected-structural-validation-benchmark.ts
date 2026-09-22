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
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

export interface ActiveProtectedStructuralValidationBenchmarkReport {
  validated:
    ActiveProtectedStructuralValidationResult;
  falsified:
    ActiveProtectedStructuralValidationResult;
  reopened:
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

const INCUMBENT_Y =
  fragment(
    "incumbent-y",
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

const INCUMBENT_Z =
  fragment(
    "incumbent-z",
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

const INCUMBENT:
  HierarchicalCausalProgram = {
  id:
    "v1.34-incumbent",

  baseEffects: {
    y:
      0,
    z:
      0,
    w:
      0,
  },

  fragments: [
    INCUMBENT_Y,
    INCUMBENT_Z,
  ],

  observationStdDev:
    0.03,

  depth:
    3,

  complexity:
    2,
};

function candidateProgram(
  id: string,
  yKind:
    "linear" |
    "saturating",
  zKind:
    "linear" |
    "interaction",
): HierarchicalCausalProgram {
  return {
    ...INCUMBENT,

    id,

    fragments: [
      fragment(
        `${id}:y`,
        {
          id:
            `${yKind}(y)`,

          kind:
            yKind,

          variables: [
            "y",
          ],

          coefficient:
            0.9,
        },
      ),
      fragment(
        `${id}:z`,
        {
          id:
            zKind ===
              "linear"
              ? "linear(z)"
              : "interaction(z,w)",

          kind:
            zKind,

          variables:
            zKind ===
              "linear"
              ? [
                  "z",
                ]
              : [
                  "z",
                  "w",
                ],

          coefficient:
            0.5,
        },
      ),
    ],

    complexity:
      2,
  };
}

const LINEAR_LINEAR =
  candidateProgram(
    "v1.34-linear-linear",
    "linear",
    "linear",
  );

const LINEAR_INTERACTION =
  candidateProgram(
    "v1.34-linear-interaction",
    "linear",
    "interaction",
  );

const SATURATING_LINEAR =
  candidateProgram(
    "v1.34-saturating-linear",
    "saturating",
    "linear",
  );

const SELECTED =
  candidateProgram(
    "v1.34-saturating-interaction",
    "saturating",
    "interaction",
  );

const OUTSIDE:
  HierarchicalCausalProgram = {
  ...INCUMBENT,

  id:
    "v1.34-outside",

  fragments: [
    fragment(
      "v1.34-outside-y",
      {
        id:
          "linear(y)",

        kind:
          "linear",

        variables: [
          "y",
        ],

        coefficient:
          0.15,
      },
    ),
    fragment(
      "v1.34-outside-bias",
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
  ],
};

function repairCandidate(
  program:
    HierarchicalCausalProgram,
  replacements:
    Record<string, string>,
): LocalRepairSearchCandidate {
  return {
    id:
      program.id,

    program,

    replacementFragmentIds:
      replacements,

    retiredFragmentIds:
      Object.keys(
        replacements,
      ).sort(),

    discoveryMeanSquaredError:
      0,

    complexityPenalty:
      0,

    objective:
      0,
  };
}

const CANDIDATES:
  readonly LocalRepairSearchCandidate[] = [
    repairCandidate(
      LINEAR_LINEAR,
      {
        "incumbent-y":
          "v1.34-linear-linear:y",
      },
    ),
    repairCandidate(
      LINEAR_INTERACTION,
      {
        "incumbent-y":
          "v1.34-linear-interaction:y",

        "incumbent-z":
          "v1.34-linear-interaction:z",
      },
    ),
    repairCandidate(
      SATURATING_LINEAR,
      {
        "incumbent-y":
          "v1.34-saturating-linear:y",
      },
    ),
    repairCandidate(
      SELECTED,
      {
        "incumbent-y":
          "v1.34-saturating-interaction:y",

        "incumbent-z":
          "v1.34-saturating-interaction:z",
      },
    ),
  ];

const SEARCH:
  ProbabilisticLocalRepairSearch = {
  decision:
    "search",

  faultExplanation: {
    id:
      "v1.34-joint-structure",

    kind:
      "multi-fragment",

    fragmentIds: [
      "incumbent-y",
      "incumbent-z",
    ],
  },

  faultConfidence:
    0.99,

  faultFragmentIds: [
    "incumbent-y",
    "incumbent-z",
  ],

  repairEvidenceIds: [
    "v1.34-discovery-y",
    "v1.34-discovery-z",
  ],

  candidates: [
    ...CANDIDATES,
  ],

  selectedCandidate:
    CANDIDATES[
      3
    ],

  reason:
    "fault-posterior-authorized-local-repair-search",
};

const DIAGNOSTIC_IDS = [
  "v1.34-diagnostic-y",
  "v1.34-diagnostic-z",
] as const;

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
    "hypothesis:v1.34",

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

function lineage() {
  return createRevisionLineage(
    "v1.34-root",
    INCUMBENT,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "v1.34-historical-a",
      "v1.34-historical-b",
      "v1.34-historical-c",
      "v1.34-historical-d",
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
        `2026-09-22T18:35:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "v1.34-terminal",

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
      "Acquire protected evidence actively.",
      "Reject selected revision on independent falsification.",
      "Reopen bounded search if every retained structure is inadequate.",
    ],

    createdAt:
      "2026-09-22T18:35:00Z",

    updatedAt:
      "2026-09-22T18:35:00Z",
  });

  return reasoner;
}

export function runActiveProtectedStructuralValidationBenchmark():
  ActiveProtectedStructuralValidationBenchmarkReport {
  const validated =
    runControlledActiveProtectedStructuralValidation(
      lineage(),
      INCUMBENT,
      SEARCH,
      DIAGNOSTIC_IDS,
      SELECTED,
      [],
      {
        uncertaintyAtInstall:
          0.2,

        maximumSteps:
          8,
      },
    );

  if (
    validated.decision !==
      "validated" ||
    !validated
      .protectedDecision
  ) {
    throw new Error(
      "v1.34 benchmark did not actively validate the selected joint structure.",
    );
  }

  const falsified =
    runControlledActiveProtectedStructuralValidation(
      lineage(),
      INCUMBENT,
      SEARCH,
      DIAGNOSTIC_IDS,
      SATURATING_LINEAR,
      [],
      {
        maximumSteps:
          8,

        minimumFalsificationEvidence:
          2,
      },
    );

  if (
    falsified.decision !==
      "falsified"
  ) {
    throw new Error(
      "v1.34 benchmark did not falsify the selected joint structure.",
    );
  }

  const reopened =
    runControlledActiveProtectedStructuralValidation(
      lineage(),
      INCUMBENT,
      SEARCH,
      DIAGNOSTIC_IDS,
      OUTSIDE,
      [],
      {
        maximumSteps:
          8,

        minimumFalsificationEvidence:
          2,

        maximumAcceptableMeanSquaredError:
          0.001,
      },
    );

  if (
    reopened.decision !==
      "reopen-search"
  ) {
    throw new Error(
      "v1.34 benchmark did not reopen bounded structural search.",
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
      "v1.34 benchmark could not build the incumbent plan.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "v1.34-terminal",
    oldPlan,
  );

  const provenance =
    initializeFragmentProvenance(
      "v1.34-root",
      INCUMBENT,
      {
        "incumbent-y": {
          sourceRevisionId:
            "rev-y",

          sourceFragmentId:
            "program-y-fragment",
        },

        "incumbent-z": {
          sourceRevisionId:
            "rev-z",

          sourceFragmentId:
            "program-z-fragment",
        },
      },
    );

  const installation =
    installProbabilisticLocalRepair(
      lineage(),
      validated
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
      "v1.34-terminal",
      "rev-v1.34-active-protected",
      1,
      validated
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
      "v1.34 benchmark failed to install the actively protected joint revision.",
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
    validated,

    falsified,

    reopened,

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

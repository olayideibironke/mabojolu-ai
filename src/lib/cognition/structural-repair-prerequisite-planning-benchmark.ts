import {
  generatePrerequisiteAwarePlan,
  learnActionPrerequisite,
  materializePrerequisiteAwareSubgoals,
  revisePrerequisiteAwareGoalChain,
  synthesizeStructuralRepairCandidates,
  validateStructuralRepairCandidates,
  type ActionPrerequisiteObservation,
  type PrerequisitePlanRevision,
  type StructuralRepairDecision,
} from "./structural-repair-prerequisite-planning";

import {
  HierarchicalGoalReasoner,
  type GoalHierarchySnapshot,
} from "./goal-hierarchy";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  MultidimensionalCausalModel,
} from "./multidimensional-self-revision";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

export interface StructuralRepairPrerequisiteBenchmarkReport {
  structuralRepairDecision:
    StructuralRepairDecision;
  selectedRepairTermId?: string;
  selectedRepairCoefficient?: number;
  repairEvidenceIds: string[];
  protectedEvidenceIds: string[];
  initialPrerequisiteThreshold: number;
  revisedPrerequisiteThreshold: number;
  initialActionIds: string[];
  revisedActionIds: string[];
  planRevision:
    PrerequisitePlanRevision;
  hierarchyAfterRevision:
    GoalHierarchySnapshot;
  nextActionableGoalId?: string;
}

const BAD_LINEAR_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "bad-linear-y",

  terms: [
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
  ],

  validationMeanSquaredError:
    0,

  sourceEvidenceCount:
    4,
};

const FLAWED_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "wrong-topology-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    BAD_LINEAR_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
};

const QUARANTINED:
  FragmentReliabilitySummary = {
  fragments: [
    {
      fragmentId:
        "bad-linear-y",

      episodes:
        3,

      supportEpisodes:
        0,

      blameEpisodes:
        3,

      neutralEpisodes:
        0,

      posteriorReliability:
        0.2,

      quarantined:
        true,
    },
  ],

  quarantinedFragmentIds: [
    "bad-linear-y",
  ],
};

function repairObservation(
  id:
    string,

  y:
    number,

  z:
    number,

  measuredEffect:
    number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        x:
          0,
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

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "repair-joint-full",
      1,
      1,
      0.7,
    ),
    repairObservation(
      "repair-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "repair-half-y-full-z",
      0.5,
      1,
      0.4,
    ),
    repairObservation(
      "repair-half-joint",
      0.5,
      0.5,
      0.225,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "protected-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "protected-z-only",
      0,
      1,
      0.1,
    ),
    repairObservation(
      "protected-quarter-joint",
      0.25,
      0.5,
      0.1375,
    ),
    repairObservation(
      "protected-full-joint",
      1,
      1,
      0.7,
    ),
  ];

const INITIAL_PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.1,
        nuisance:
          0.1,
      },

      observedEffects: {
        progress:
          0.02,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.2,
        nuisance:
          0.9,
      },

      observedEffects: {
        progress:
          0.03,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.5,
        nuisance:
          0.1,
      },

      observedEffects: {
        progress:
          0.8,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.6,
        nuisance:
          0.9,
      },

      observedEffects: {
        progress:
          0.78,
      },
    },
  ];

const REVISED_PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.4,
      },

      observedEffects: {
        progress:
          0.02,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.6,
      },

      observedEffects: {
        progress:
          0.03,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.8,
      },

      observedEffects: {
        progress:
          0.8,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.9,
      },

      observedEffects: {
        progress:
          0.82,
      },
    },
  ];

function simpleProgram(
  id:
    string,

  effects:
    Record<
      string,
      number
    >,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      ...effects,
    },

    fragments:
      [],

    observationStdDev:
      0.05,

    depth:
      1,

    complexity:
      0,
  };
}

const MODEL:
  MultidimensionalCausalModel = {
  id:
    "vector-model",

  dimensionPrograms: {
    readiness:
      simpleProgram(
        "readiness-program",
        {
          "prep-light":
            0.5,
          "prep-strong":
            0.8,
        },
      ),

    progress:
      simpleProgram(
        "progress-program",
        {
          finish:
            0.8,
          shortcut:
            1,
        },
      ),

    exposure:
      simpleProgram(
        "exposure-program",
        {
          "prep-light":
            0.05,
          "prep-strong":
            0.1,
          finish:
            0.1,
          shortcut:
            0.8,
        },
      ),
  },
};

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "prep-light",

      interventions: {
        "prep-light":
          1,
      },

      risk:
        0.05,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "prep-strong",

      interventions: {
        "prep-strong":
          1,
      },

      risk:
        0.1,

      cost:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "finish",

      interventions: {
        finish:
          1,
      },

      risk:
        0.1,

      cost:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "shortcut",

      interventions: {
        shortcut:
          1,
      },

      risk:
        0.1,

      cost:
        0.02,

      reversible:
        true,
    },
  ];

const GOAL = {
  minimums: {
    progress:
      0.8,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function createReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T20:40:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "terminal-vector-goal",

    description:
      "Reach progress >= 0.800 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.800",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions.",
      "Honor learned prerequisites.",
    ],

    createdAt:
      "2026-09-21T20:40:00Z",

    updatedAt:
      "2026-09-21T20:40:00Z",
  });

  return reasoner;
}

export function runStructuralRepairPrerequisiteBenchmark():
  StructuralRepairPrerequisiteBenchmarkReport {
  const repairCandidates =
    synthesizeStructuralRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      REPAIR_EVIDENCE,
      [
        "y",
        "z",
      ],
    );

  const structuralRepairDecision =
    validateStructuralRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      repairCandidates,
      PROTECTED,
    );

  if (
    structuralRepairDecision.decision !==
      "repaired"
  ) {
    throw new Error(
      "v1.18 benchmark failed to validate the topology-changing repair.",
    );
  }

  const initialPrerequisite =
    learnActionPrerequisite(
      INITIAL_PREREQUISITE_EVIDENCE,
      "finish",
      "progress",
      [
        "readiness",
        "nuisance",
      ],
    );

  const revisedPrerequisite =
    learnActionPrerequisite(
      REVISED_PREREQUISITE_EVIDENCE,
      "finish",
      "progress",
      [
        "readiness",
      ],
    );

  if (
    !initialPrerequisite ||
    !revisedPrerequisite
  ) {
    throw new Error(
      "v1.18 benchmark failed to learn the prerequisite thresholds.",
    );
  }

  const belief =
    new Map([
      [
        "vector-model",
        1,
      ],
    ]);

  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const initialPlan =
    generatePrerequisiteAwarePlan(
      [
        MODEL,
      ],
      belief,
      state,
      GOAL,
      ACTIONS,
      [
        initialPrerequisite,
      ],
    );

  const revisedPlan =
    generatePrerequisiteAwarePlan(
      [
        MODEL,
      ],
      belief,
      state,
      GOAL,
      ACTIONS,
      [
        revisedPrerequisite,
      ],
    );

  if (
    initialPlan.decision !==
      "planned" ||
    revisedPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.18 benchmark failed to construct prerequisite-aware plans.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "terminal-vector-goal",
    initialPlan,
  );

  const planRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      "terminal-vector-goal",
      initialPlan,
      revisedPlan,
      1,
    );

  const selectedRepair =
    structuralRepairDecision
      .program
      .fragments
      .find(
        (fragment) =>
          fragment.id ===
          structuralRepairDecision
            .synthesizedFragmentId,
      );

  return {
    structuralRepairDecision,

    selectedRepairTermId:
      selectedRepair
        ?.terms[
          0
        ]
        ?.id,

    selectedRepairCoefficient:
      selectedRepair
        ?.terms[
          0
        ]
        ?.coefficient,

    repairEvidenceIds:
      REPAIR_EVIDENCE.map(
        (item) =>
          item.experiment.id,
      ),

    protectedEvidenceIds:
      PROTECTED.map(
        (item) =>
          item.experiment.id,
      ),

    initialPrerequisiteThreshold:
      initialPrerequisite
        .threshold,

    revisedPrerequisiteThreshold:
      revisedPrerequisite
        .threshold,

    initialActionIds: [
      ...initialPlan.actionIds,
    ],

    revisedActionIds: [
      ...revisedPlan.actionIds,
    ],

    planRevision,

    hierarchyAfterRevision:
      reasoner.getSnapshot(),

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

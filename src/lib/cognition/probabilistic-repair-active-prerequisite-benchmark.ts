import {
  JointRepairPrerequisitePosterior,
  generatePrerequisiteHypotheses,
  type JointDiscoveryExperiment,
  type JointRepairPrerequisiteBelief,
} from "./probabilistic-repair-active-prerequisite";

import {
  generatePrerequisiteAwarePlan,
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

export interface ProbabilisticRepairActivePrerequisiteBenchmarkReport {
  initialBelief:
    JointRepairPrerequisiteBelief;
  experimentIds: string[];
  totalExperimentCost: number;
  maximumExperimentRisk: number;
  finalBelief:
    JointRepairPrerequisiteBelief;
  protectedRepairDecision:
    StructuralRepairDecision;
  initialActionIds: string[];
  resolvedActionIds: string[];
  planRevision:
    PrerequisitePlanRevision;
  hierarchy:
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
      "fit-joint-full",
      1,
      1,
      0.7,
    ),
    repairObservation(
      "fit-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "fit-half-y-full-z",
      0.5,
      1,
      0.4,
    ),
    repairObservation(
      "fit-half-joint",
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

const PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
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
      },

      observedEffects: {
        progress:
          0.35,
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
          0.4,
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

function vectorProgram(
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
      vectorProgram(
        "readiness-program",
        {
          "prep-light":
            0.5,
          "prep-strong":
            0.8,
        },
      ),

    progress:
      vectorProgram(
        "progress-program",
        {
          finish:
            0.8,
          shortcut:
            1,
        },
      ),

    exposure:
      vectorProgram(
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

const EXPERIMENTS:
  readonly JointDiscoveryExperiment[] = [
    {
      id:
        "probe-readiness-0.6",

      kind:
        "prerequisite",

      actionId:
        "finish",

      targetDimension:
        "progress",

      beforeState: {
        readiness:
          0.6,
      },

      risk:
        0.1,

      cost:
        0.04,

      reversible:
        true,

      observationStdDev:
        0.02,
    },
    {
      id:
        "probe-repair-y-only",

      kind:
        "repair",

      interventions: {
        x:
          0,
        y:
          1,
        z:
          0,
      },

      risk:
        0.1,

      cost:
        0.03,

      reversible:
        true,

      observationStdDev:
        0.02,
    },
    {
      id:
        "unsafe-joint-probe",

      kind:
        "repair",

      interventions: {
        x:
          0,
        y:
          1,
        z:
          0,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,

      observationStdDev:
        0.01,
    },
  ];

function createReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T21:00:${String(
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
      "2026-09-21T21:00:00Z",

    updatedAt:
      "2026-09-21T21:00:00Z",
  });

  return reasoner;
}

export function runProbabilisticRepairActivePrerequisiteBenchmark():
  ProbabilisticRepairActivePrerequisiteBenchmarkReport {
  const allRepairs =
    synthesizeStructuralRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      REPAIR_EVIDENCE,
      [
        "y",
        "z",
      ],
    );

  const interaction =
    allRepairs.find(
      (candidate) =>
        candidate.fragment.id ===
        "bad-linear-y+structure:interaction(y,z)",
    );

  const linear =
    allRepairs.find(
      (candidate) =>
        candidate.fragment.id ===
        "bad-linear-y+structure:linear(y)",
    );

  if (
    !interaction ||
    !linear
  ) {
    throw new Error(
      "v1.19 benchmark repair candidates are missing.",
    );
  }

  const prerequisiteHypotheses =
    generatePrerequisiteHypotheses(
      PREREQUISITE_EVIDENCE,
      "finish",
      "progress",
      [
        "readiness",
      ],
      {
        maximumHypotheses:
          3,
      },
    );

  if (
    prerequisiteHypotheses.length !==
      3
  ) {
    throw new Error(
      "v1.19 benchmark expected three prerequisite hypotheses.",
    );
  }

  const truePrerequisite =
    prerequisiteHypotheses.find(
      (hypothesis) =>
        Math.abs(
          hypothesis.threshold -
            0.7,
        ) <
        1e-9,
    );

  if (
    !truePrerequisite
  ) {
    throw new Error(
      "v1.19 benchmark true prerequisite hypothesis is missing.",
    );
  }

  const posterior =
    new JointRepairPrerequisitePosterior(
      FLAWED_PROGRAM,
      [
        interaction,
        linear,
      ],
      prerequisiteHypotheses,
    );

  const initialBelief =
    posterior.getBelief();

  const remaining = [
    ...EXPERIMENTS,
  ];

  const experimentIds:
    string[] =
      [];

  let totalExperimentCost =
    0;

  let maximumExperimentRisk =
    0;

  for (
    let step =
      0;
    step <
      4;
    step +=
      1
  ) {
    const belief =
      posterior.getBelief();

    if (
      belief.sufficientlyCertain
    ) {
      break;
    }

    const choice =
      posterior.chooseExperiment(
        remaining,
      );

    if (
      choice.decision !==
        "experiment" ||
      !choice.experiment
    ) {
      break;
    }

    const experiment =
      choice.experiment;

    const observation =
      posterior.simulateObservation(
        interaction.fragment.id,
        truePrerequisite.id,
        experiment,
      );

    posterior.recordObservation(
      experiment,
      observation,
    );

    experimentIds.push(
      experiment.id,
    );

    totalExperimentCost +=
      experiment.cost;

    maximumExperimentRisk =
      Math.max(
        maximumExperimentRisk,
        experiment.risk,
      );

    const usedIndex =
      remaining.findIndex(
        (candidate) =>
          candidate.id ===
          experiment.id,
      );

    if (
      usedIndex >=
        0
    ) {
      remaining.splice(
        usedIndex,
        1,
      );
    }
  }

  const finalBelief =
    posterior.getBelief();

  if (
    !finalBelief.sufficientlyCertain
  ) {
    throw new Error(
      "v1.19 benchmark failed to resolve the joint hypothesis.",
    );
  }

  const resolvedRepair =
    [
      interaction,
      linear,
    ].find(
      (candidate) =>
        candidate.fragment.id ===
        finalBelief
          .topRepairCandidateId,
    );

  if (
    !resolvedRepair
  ) {
    throw new Error(
      "v1.19 benchmark resolved repair candidate is missing.",
    );
  }

  const protectedRepairDecision =
    validateStructuralRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      [
        resolvedRepair,
      ],
      PROTECTED,
    );

  if (
    protectedRepairDecision.decision !==
      "repaired"
  ) {
    throw new Error(
      "v1.19 benchmark resolved repair did not pass protected installation.",
    );
  }

  const resolvedPrerequisite =
    posterior.getPrerequisite(
      finalBelief
        .topPrerequisiteHypothesisId,
    );

  const initialPrerequisite =
    prerequisiteHypotheses
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          left.threshold -
          right.threshold,
      )[
        0
      ]!;

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

  const resolvedPlan =
    generatePrerequisiteAwarePlan(
      [
        MODEL,
      ],
      belief,
      state,
      GOAL,
      ACTIONS,
      [
        resolvedPrerequisite,
      ],
    );

  if (
    initialPlan.decision !==
      "planned" ||
    resolvedPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.19 benchmark failed to create initial and resolved vector plans.",
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
      resolvedPlan,
      1,
    );

  return {
    initialBelief,

    experimentIds,

    totalExperimentCost,

    maximumExperimentRisk,

    finalBelief,

    protectedRepairDecision,

    initialActionIds: [
      ...initialPlan.actionIds,
    ],

    resolvedActionIds: [
      ...resolvedPlan.actionIds,
    ],

    planRevision,

    hierarchy:
      reasoner.getSnapshot(),

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

import {
  chooseEpistemicSubgoal,
  generateMultidimensionalPlan,
  materializeEpistemicSubgoal,
  materializeMultidimensionalSubgoals,
  synthesizeFragmentRepairCandidates,
  updateMultidimensionalBeliefFromExperiment,
  validateAutonomousFragmentRepairs,
  type AutonomousRepairDecision,
  type EpistemicSelection,
  type MultidimensionalCausalModel,
  type MultidimensionalPlan,
} from "./multidimensional-self-revision";

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
  WorldModelAction,
  WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface MultidimensionalSelfRevisionBenchmarkReport {
  repairDecision:
    AutonomousRepairDecision;
  synthesizedRepairCoefficient: number;
  repairEvidenceIds: string[];
  protectedEvidenceIds: string[];
  priorEpistemicSelection:
    EpistemicSelection;
  posteriorModelBProbability: number;
  vectorPlan:
    MultidimensionalPlan;
  hierarchy:
    GoalHierarchySnapshot;
  nextActionableBeforeEpistemicCompletion?: string;
  nextActionableAfterEpistemicCompletion?: string;
}

const XY_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "xy-fragment",

  terms: [
    {
      id:
        "interaction(x,y)",

      kind:
        "interaction",

      variables: [
        "x",
        "y",
      ],

      coefficient:
        0.4,
    },
  ],

  validationMeanSquaredError:
    0,

  sourceEvidenceCount:
    4,
};

const BAD_YZ_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "bad-yz-fragment",

  terms: [
    {
      id:
        "interaction(y,z)",

      kind:
        "interaction",

      variables: [
        "y",
        "z",
      ],

      coefficient:
        0.7,
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
    "flawed-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    XY_FRAGMENT,
    BAD_YZ_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
};

const QUARANTINED:
  FragmentReliabilitySummary = {
  fragments: [
    {
      fragmentId:
        "xy-fragment",

      episodes:
        2,

      supportEpisodes:
        2,

      blameEpisodes:
        0,

      neutralEpisodes:
        0,

      posteriorReliability:
        0.75,

      quarantined:
        false,
    },
    {
      fragmentId:
        "bad-yz-fragment",

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
    "bad-yz-fragment",
  ],
};

function repairObservation(
  id:
    string,

  x:
    number,

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
        x,
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
      "repair-yz-1",
      0,
      1,
      1,
      0.5,
    ),
    repairObservation(
      "repair-yz-2",
      0,
      0.5,
      0.5,
      0.175,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "protected-x",
      1,
      0,
      0,
      0.1,
    ),
    repairObservation(
      "protected-y",
      0,
      1,
      0,
      0.1,
    ),
    repairObservation(
      "protected-z",
      0,
      0,
      1,
      0.1,
    ),
    repairObservation(
      "protected-yz",
      0,
      1,
      1,
      0.5,
    ),
    repairObservation(
      "protected-all",
      1,
      1,
      1,
      1,
    ),
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

const MODELS:
  readonly MultidimensionalCausalModel[] = [
    {
      id:
        "model-a",

      dimensionPrograms: {
        progress:
          vectorProgram(
            "model-a-progress",
            {
              a:
                0.5,
              b:
                0.5,
              shortcut:
                1,
              probe:
                0.2,
            },
          ),

        exposure:
          vectorProgram(
            "model-a-exposure",
            {
              a:
                0.1,
              b:
                0.1,
              shortcut:
                0.8,
              probe:
                0,
            },
          ),
      },
    },
    {
      id:
        "model-b",

      dimensionPrograms: {
        progress:
          vectorProgram(
            "model-b-progress",
            {
              a:
                0.45,
              b:
                0.55,
              shortcut:
                1,
              probe:
                0.8,
            },
          ),

        exposure:
          vectorProgram(
            "model-b-exposure",
            {
              a:
                0.12,
              b:
                0.08,
              shortcut:
                0.8,
              probe:
                0,
            },
          ),
      },
    },
  ];

const PRIOR =
  new Map([
    [
      "model-a",
      0.5,
    ],
    [
      "model-b",
      0.5,
    ],
  ]);

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "01-a",

      interventions: {
        a:
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
        "02-b",

      interventions: {
        b:
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
        "cheap-nuisance",

      interventions: {
        nuisance:
          1,
      },

      risk:
        0.05,

      cost:
        0.01,

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
        0.05,

      reversible:
        true,
    },
    {
      id:
        "unsafe",

      interventions: {
        a:
          1,
        b:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

const EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "probe-route",

      interventions: {
        probe:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "unsafe-probe",

      interventions: {
        probe:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

export function runMultidimensionalSelfRevisionBenchmark():
  MultidimensionalSelfRevisionBenchmarkReport {
  const repairCandidates =
    synthesizeFragmentRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      REPAIR_EVIDENCE,
    );

  if (
    repairCandidates.length !==
      1
  ) {
    throw new Error(
      "v1.17 benchmark expected one synthesized repair candidate.",
    );
  }

  const repairDecision =
    validateAutonomousFragmentRepairs(
      FLAWED_PROGRAM,
      QUARANTINED,
      repairCandidates,
      PROTECTED,
    );

  if (
    repairDecision.decision !==
      "repaired"
  ) {
    throw new Error(
      "v1.17 benchmark failed to validate the autonomous repair.",
    );
  }

  const priorEpistemicSelection =
    chooseEpistemicSubgoal(
      MODELS,
      PRIOR,
      EXPERIMENTS,
      "progress",
    );

  if (
    priorEpistemicSelection.decision !==
      "selected" ||
    !priorEpistemicSelection
      .subgoal
  ) {
    throw new Error(
      "v1.17 benchmark failed to choose a safe epistemic prerequisite.",
    );
  }

  const posterior =
    updateMultidimensionalBeliefFromExperiment(
      MODELS,
      PRIOR,
      EXPERIMENTS[
        0
      ]!,
      "progress",
      0.79,
    );

  const vectorPlan =
    generateMultidimensionalPlan(
      MODELS,
      posterior,
      {
        progress:
          0,
        exposure:
          0,
      },
      {
        minimums: {
          progress:
            1,
        },

        maximums: {
          exposure:
            0.3,
        },
      },
      ACTIONS,
    );

  if (
    vectorPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.17 benchmark failed to create the multidimensional progress plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T20:20:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "vector-terminal-goal",

    description:
      "Reach progress at least 1.000 while exposure stays at or below 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 1.000",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions and experiments.",
    ],

    createdAt:
      "2026-09-21T20:20:00Z",

    updatedAt:
      "2026-09-21T20:20:00Z",
  });

  const epistemic =
    materializeEpistemicSubgoal(
      reasoner,
      "vector-terminal-goal",
      priorEpistemicSelection,
    );

  materializeMultidimensionalSubgoals(
    reasoner,
    "vector-terminal-goal",
    vectorPlan,
    epistemic.id,
  );

  const nextActionableBeforeEpistemicCompletion =
    reasoner
      .nextActionableGoal()
      ?.id;

  reasoner.complete(
    epistemic.id,
  );

  const nextActionableAfterEpistemicCompletion =
    reasoner
      .nextActionableGoal()
      ?.id;

  return {
    repairDecision,

    synthesizedRepairCoefficient:
      repairCandidates[
        0
      ]!
        .fittedCoefficient,

    repairEvidenceIds:
      REPAIR_EVIDENCE.map(
        (item) =>
          item
            .experiment
            .id,
      ),

    protectedEvidenceIds:
      PROTECTED.map(
        (item) =>
          item
            .experiment
            .id,
      ),

    priorEpistemicSelection,

    posteriorModelBProbability:
      posterior.get(
        "model-b",
      ) ??
      0,

    vectorPlan,

    hierarchy:
      reasoner.getSnapshot(),

    nextActionableBeforeEpistemicCompletion,

    nextActionableAfterEpistemicCompletion,
  };
}

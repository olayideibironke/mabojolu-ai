import {
  HierarchicalProgramPosterior,
  diagnoseHierarchicalFragmentFailure,
  generateAutonomousSubgoalPlan,
  materializeAutonomousSubgoals,
  reconcileAutonomousSubgoals,
  type AutonomousSubgoalPlan,
  type FragmentFailureDiagnosis,
  type HierarchicalProgramBelief,
} from "./uncertain-hierarchical-program";

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

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

export interface UncertainHierarchicalProgramBenchmarkReport {
  priorBelief: HierarchicalProgramBelief;
  priorSubgoalPlan: AutonomousSubgoalPlan;
  posteriorBelief: HierarchicalProgramBelief;
  posteriorSubgoalPlan: AutonomousSubgoalPlan;
  fragmentFailureDiagnosis: FragmentFailureDiagnosis;
  materializedGoalIds: string[];
  completedAfterIntermediateObservation: string[];
  hierarchyAfterIntermediateObservation: GoalHierarchySnapshot;
  nextActionableGoalId?: string;
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

const YZ_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "yz-fragment",

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
        0.3,
    },
  ],

  validationMeanSquaredError:
    0,

  sourceEvidenceCount:
    4,
};

const FULL_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "full-program",

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
    YZ_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    3,

  complexity:
    2,
};

const PARTIAL_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "partial-program",

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
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
};

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "01-prepare-xy",

      interventions: {
        x:
          1,
        y:
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
        "02-bridge-yz",

      interventions: {
        y:
          1,
        z:
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
        "unsafe-shortcut",

      interventions: {
        x:
          1,
        y:
          1,
        z:
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

function observation(
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

function makeGoalReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-21T19:30:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "terminal-goal",

    description:
      "Reach state 1.000.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "Observed state is at least 1.000.",
    ],

    constraints: [
      "Use only reversible actions within the approved risk ceiling.",
    ],

    createdAt:
      "2026-09-21T19:30:00Z",

    updatedAt:
      "2026-09-21T19:30:00Z",
  });

  return reasoner;
}

export function runUncertainHierarchicalProgramBenchmark():
  UncertainHierarchicalProgramBenchmarkReport {
  const posterior =
    new HierarchicalProgramPosterior([
      FULL_PROGRAM,
      PARTIAL_PROGRAM,
    ]);

  const priorBelief =
    posterior.getBelief();

  const priorSubgoalPlan =
    generateAutonomousSubgoalPlan(
      posterior.getPrograms(),
      posterior.getProbabilityMap(),
      0.1,
      1,
      ACTIONS,
      {
        minimumGoalSuccessProbability:
          0.9,
      },
    );

  posterior.recordObservation(
    observation(
      "noisy-yz-evidence",
      0,
      1,
      1,
      0.48,
    ),
  );

  const posteriorBelief =
    posterior.getBelief();

  const posteriorSubgoalPlan =
    generateAutonomousSubgoalPlan(
      posterior.getPrograms(),
      posterior.getProbabilityMap(),
      0.1,
      1,
      ACTIONS,
      {
        minimumGoalSuccessProbability:
          0.9,
      },
    );

  const flawedProgram:
    HierarchicalCausalProgram = {
    ...FULL_PROGRAM,

    id:
      "flawed-program",

    fragments: [
      XY_FRAGMENT,
      {
        ...YZ_FRAGMENT,

        id:
          "bad-yz-fragment",

        terms: [
          {
            ...YZ_FRAGMENT
              .terms[
                0
              ]!,

            coefficient:
              0.7,
          },
        ],
      },
    ],
  };

  const fragmentFailureDiagnosis =
    diagnoseHierarchicalFragmentFailure(
      flawedProgram,
      observation(
        "later-failure-yz",
        0,
        1,
        1,
        0.2,
      ),
    );

  const reasoner =
    makeGoalReasoner();

  const materialized =
    materializeAutonomousSubgoals(
      reasoner,
      "terminal-goal",
      posteriorSubgoalPlan,
    );

  const completedAfterIntermediateObservation =
    reconcileAutonomousSubgoals(
      reasoner,
      posteriorSubgoalPlan,
      0.75,
    );

  const hierarchyAfterIntermediateObservation =
    reasoner.getSnapshot();

  return {
    priorBelief,
    priorSubgoalPlan,
    posteriorBelief,
    posteriorSubgoalPlan,
    fragmentFailureDiagnosis,

    materializedGoalIds:
      materialized.map(
        (goal) =>
          goal.id,
      ),

    completedAfterIntermediateObservation,

    hierarchyAfterIntermediateObservation,

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

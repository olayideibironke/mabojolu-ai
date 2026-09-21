import {
  accumulateFragmentReliability,
  reviseAutonomousSubgoalsAfterDivergence,
  reviseHierarchicalProgramFromReliability,
  type AutonomousSubgoalRevision,
  type FragmentReliabilitySummary,
  type HierarchicalProgramRevision,
} from "./self-revising-hierarchical-program";

import {
  generateAutonomousSubgoalPlan,
  materializeAutonomousSubgoals,
  type AutonomousSubgoalPlan,
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

export interface SelfRevisingHierarchicalProgramBenchmarkReport {
  reliability:
    FragmentReliabilitySummary;
  programRevision:
    HierarchicalProgramRevision;
  originalSubgoalPlan:
    AutonomousSubgoalPlan;
  subgoalRevision:
    AutonomousSubgoalRevision;
  hierarchyBeforeRevision:
    GoalHierarchySnapshot;
  hierarchyAfterRevision:
    GoalHierarchySnapshot;
  terminalGoalDescriptionBefore: string;
  terminalGoalDescriptionAfter: string;
  terminalGoalConstraintsBefore: string[];
  terminalGoalConstraintsAfter: string[];
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

const REPAIRED_YZ_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "repaired-yz-fragment",

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
    5,
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

const RELIABILITY_EPISODES:
  readonly StructuralMechanismObservation[] = [
    observation(
      "failure-yz-1",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "support-xy-1",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "failure-yz-2",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "support-xy-2",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "failure-yz-3",
      0,
      1,
      1,
      0.5,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-x",
      1,
      0,
      0,
      0.1,
    ),
    observation(
      "protected-y",
      0,
      1,
      0,
      0.1,
    ),
    observation(
      "protected-z",
      0,
      0,
      1,
      0.1,
    ),
    observation(
      "protected-yz",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "protected-all",
      1,
      1,
      1,
      1,
    ),
  ];

const ORIGINAL_ACTIONS:
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
  ];

const REVISION_ACTIONS:
  readonly WorldModelAction[] = [
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
        "03-finish-x",

      interventions: {
        x:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
  ];

function createReasoner():
  HierarchicalGoalReasoner {
  let tick =
    0;

  return new HierarchicalGoalReasoner(
    () =>
      `2026-09-21T20:30:${String(
        tick++,
      ).padStart(
        2,
        "0",
      )}Z`,
  );
}

export function runSelfRevisingHierarchicalProgramBenchmark():
  SelfRevisingHierarchicalProgramBenchmarkReport {
  const reliabilityResult =
    accumulateFragmentReliability(
      FLAWED_PROGRAM,
      RELIABILITY_EPISODES,
    );

  const programRevision =
    reviseHierarchicalProgramFromReliability(
      FLAWED_PROGRAM,
      reliabilityResult.summary,
      [
        REPAIRED_YZ_FRAGMENT,
      ],
      PROTECTED,
    );

  if (
    programRevision.decision !==
      "repaired"
  ) {
    throw new Error(
      "Self-revising benchmark failed to repair the repeatedly blamed fragment.",
    );
  }

  const repairedProgram =
    programRevision.program;

  const originalSubgoalPlan =
    generateAutonomousSubgoalPlan(
      [
        repairedProgram,
      ],
      new Map([
        [
          repairedProgram.id,
          1,
        ],
      ]),
      0.1,
      1,
      ORIGINAL_ACTIONS,
    );

  if (
    originalSubgoalPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "Self-revising benchmark failed to create the initial posterior-supported subgoal plan.",
    );
  }

  const reasoner =
    createReasoner();

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
      "Use only safe reversible actions.",
      "Preserve terminal objective.",
    ],

    createdAt:
      "2026-09-21T20:30:00Z",

    updatedAt:
      "2026-09-21T20:30:00Z",
  });

  materializeAutonomousSubgoals(
    reasoner,
    "terminal-goal",
    originalSubgoalPlan,
  );

  const hierarchyBeforeRevision =
    reasoner.getSnapshot();

  const terminalBefore =
    hierarchyBeforeRevision
      .goals
      .find(
        (goal) =>
          goal.id ===
          "terminal-goal",
      );

  if (
    !terminalBefore
  ) {
    throw new Error(
      "Self-revising benchmark lost the terminal goal before revision.",
    );
  }

  const subgoalRevision =
    reviseAutonomousSubgoalsAfterDivergence(
      reasoner,
      "terminal-goal",
      originalSubgoalPlan,
      1,
      0.45,
      [
        repairedProgram,
      ],
      new Map([
        [
          repairedProgram.id,
          1,
        ],
      ]),
      REVISION_ACTIONS,
      {
        divergenceTolerance:
          0.1,

        revisionNumber:
          1,
      },
    );

  const hierarchyAfterRevision =
    reasoner.getSnapshot();

  const terminalAfter =
    hierarchyAfterRevision
      .goals
      .find(
        (goal) =>
          goal.id ===
          "terminal-goal",
      );

  if (
    !terminalAfter
  ) {
    throw new Error(
      "Self-revising benchmark lost the terminal goal after revision.",
    );
  }

  return {
    reliability:
      reliabilityResult.summary,

    programRevision,

    originalSubgoalPlan,

    subgoalRevision,

    hierarchyBeforeRevision,

    hierarchyAfterRevision,

    terminalGoalDescriptionBefore:
      terminalBefore.description,

    terminalGoalDescriptionAfter:
      terminalAfter.description,

    terminalGoalConstraintsBefore: [
      ...terminalBefore
        .constraints,
    ],

    terminalGoalConstraintsAfter: [
      ...terminalAfter
        .constraints,
    ],

    nextActionableGoalId:
      reasoner
        .nextActionableGoal()
        ?.id,
  };
}

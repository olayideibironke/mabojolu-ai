import {
  chooseDecisionAwareEpistemicStep,
  planMultiStepEpistemicPolicy,
  synthesizeJointDiscoveryExperiments,
  type DecisionAwareEpistemicChoice,
  type MultiStepEpistemicPlan,
} from "./autonomous-experiment-synthesis";

import {
  JointRepairPrerequisitePosterior,
  generatePrerequisiteHypotheses,
  type JointRepairPrerequisiteBelief,
} from "./probabilistic-repair-active-prerequisite";

import {
  generatePrerequisiteAwarePlan,
  synthesizeStructuralRepairCandidates,
  type ActionPrerequisiteObservation,
} from "./structural-repair-prerequisite-planning";

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

export interface AutonomousExperimentSynthesisBenchmarkReport {
  synthesizedExperimentIds: string[];
  repairExperimentIds: string[];
  prerequisiteExperimentIds: string[];
  oneStepEntropyPlan: MultiStepEpistemicPlan;
  twoStepEntropyPlan: MultiStepEpistemicPlan;
  initialDecisionAwareChoice: DecisionAwareEpistemicChoice;
  executedDecisionExperimentId?: string;
  executedDecisionExperimentCost: number;
  beliefAfterDecisionProbe: JointRepairPrerequisiteBelief;
  finalDecisionAwareChoice: DecisionAwareEpistemicChoice;
  repairProbabilityAfterStop: number;
  dominantPlanSignatureAfterStop?: string;
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
  ];

function planSignatureMap(
  prerequisites:
    ReturnType<
      typeof generatePrerequisiteHypotheses
    >,
): Record<
  string,
  string
> {
  const signatures:
    Record<
      string,
      string
    > = {};

  for (
    const prerequisite of
      prerequisites
  ) {
    const plan =
      generatePrerequisiteAwarePlan(
        [
          MODEL,
        ],
        new Map([
          [
            "vector-model",
            1,
          ],
        ]),
        {
          readiness:
            0,
          progress:
            0,
          exposure:
            0,
        },
        {
          minimums: {
            progress:
              0.8,
          },

          maximums: {
            exposure:
              0.3,
          },
        },
        ACTIONS,
        [
          prerequisite,
        ],
      );

    if (
      plan.decision !==
        "planned"
    ) {
      throw new Error(
        "v1.20 benchmark prerequisite did not yield a safe plan.",
      );
    }

    signatures[
      prerequisite.id
    ] =
      plan.actionIds.join(
        "->",
      );
  }

  return signatures;
}

export function runAutonomousExperimentSynthesisBenchmark():
  AutonomousExperimentSynthesisBenchmarkReport {
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
      "v1.20 benchmark repair candidates are missing.",
    );
  }

  const repairs = [
    interaction,
    linear,
  ] as const;

  const prerequisites =
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
    prerequisites.length !==
      3
  ) {
    throw new Error(
      "v1.20 benchmark expected three prerequisite hypotheses.",
    );
  }

  const experiments =
    synthesizeJointDiscoveryExperiments(
      repairs,
      prerequisites,
    );

  const entropyPosterior =
    new JointRepairPrerequisitePosterior(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
    );

  const oneStepEntropyPlan =
    planMultiStepEpistemicPolicy(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
      entropyPosterior,
      experiments.experiments,
      {
        horizon:
          1,
      },
    );

  const twoStepEntropyPlan =
    planMultiStepEpistemicPolicy(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
      entropyPosterior,
      experiments.experiments,
      {
        horizon:
          2,
      },
    );

  const decisionPosterior =
    new JointRepairPrerequisitePosterior(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
    );

  const signatures =
    planSignatureMap(
      prerequisites,
    );

  const initialDecisionAwareChoice =
    chooseDecisionAwareEpistemicStep(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
      decisionPosterior,
      experiments.experiments,
      signatures,
    );

  if (
    initialDecisionAwareChoice.decision !==
      "experiment" ||
    !initialDecisionAwareChoice
      .experimentPlan
      ?.firstExperiment
  ) {
    throw new Error(
      "v1.20 benchmark failed to choose a decision-relevant synthesized probe.",
    );
  }

  const firstExperiment =
    initialDecisionAwareChoice
      .experimentPlan
      .firstExperiment;

  const truePrerequisite =
    prerequisites.find(
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
      "v1.20 benchmark true prerequisite is missing.",
    );
  }

  decisionPosterior.recordObservation(
    firstExperiment,
    decisionPosterior.simulateObservation(
      interaction.fragment.id,
      truePrerequisite.id,
      firstExperiment,
    ),
  );

  const beliefAfterDecisionProbe =
    decisionPosterior.getBelief();

  const finalDecisionAwareChoice =
    chooseDecisionAwareEpistemicStep(
      FLAWED_PROGRAM,
      repairs,
      prerequisites,
      decisionPosterior,
      experiments.experiments.filter(
        (experiment) =>
          experiment.id !==
          firstExperiment.id,
      ),
      signatures,
    );

  return {
    synthesizedExperimentIds:
      experiments
        .experiments
        .map(
          (experiment) =>
            experiment.id,
        ),

    repairExperimentIds: [
      ...experiments
        .repairExperimentIds,
    ],

    prerequisiteExperimentIds: [
      ...experiments
        .prerequisiteExperimentIds,
    ],

    oneStepEntropyPlan,

    twoStepEntropyPlan,

    initialDecisionAwareChoice,

    executedDecisionExperimentId:
      firstExperiment.id,

    executedDecisionExperimentCost:
      firstExperiment.cost,

    beliefAfterDecisionProbe,

    finalDecisionAwareChoice,

    repairProbabilityAfterStop:
      beliefAfterDecisionProbe
        .repairProbabilities[
          interaction.fragment.id
        ] ??
      0,

    dominantPlanSignatureAfterStop:
      finalDecisionAwareChoice
        .assessment
        .dominantPlanSignature,
  };
}

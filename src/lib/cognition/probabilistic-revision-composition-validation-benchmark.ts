import {
  ProbabilisticCompositionBelief,
  installCompositeRevision,
  planCompositionValidation,
  proposeRevisionComposition,
  validateRevisionComposition,
  type CompositeLineageInstallation,
  type CompositionBelief,
  type CompositionExplanation,
  type CompositionValidationPlan,
  type ProtectedCompositionDecision,
  type RevisionCompositionProposal,
} from "./probabilistic-revision-composition-validation";

import {
  appendInstalledRevision,
  createRevisionLineage,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  synthesizeProtectedValidationProbes,
} from "./active-protected-evidence-probabilistic-lineage";

import {
  buildPlanForLiveHypothesis,
  replaceLiveHypothesisCatalog,
} from "./online-belief-model-coevolution";

import {
  materializePrerequisiteAwareSubgoals,
  revisePrerequisiteAwareGoalChain,
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
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface ProbabilisticRevisionCompositionValidationBenchmarkReport {
  proposal:
    RevisionCompositionProposal;
  oneStepPlan:
    CompositionValidationPlan;
  twoStepPlan:
    CompositionValidationPlan;
  finalCompositionBelief:
    CompositionBelief;
  protectedDecision:
    ProtectedCompositionDecision;
  installation:
    CompositeLineageInstallation;
  protectedEvidenceIds:
    string[];
  oldActionIds:
    string[];
  compositeActionIds:
    string[];
  nextRecedingDecision:
    RecedingVectorDecision;
  hierarchy:
    GoalHierarchySnapshot;
  nextActionableGoalId?:
    string;
}

function linearFragment(
  id: string,
  variable: string,
  coefficient: number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        id:
          `linear(${variable})`,

        kind:
          "linear",

        variables: [
          variable,
        ],

        coefficient,
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

function program(
  id: string,
  variable: string,
  coefficient: number,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      y:
        0,
      z:
        0,
    },

    fragments: [
      linearFragment(
        `${id}-fragment`,
        variable,
        coefficient,
      ),
    ],

    observationStdDev:
      0.05,

    depth:
      2,

    complexity:
      1,
  };
}

const PROGRAM_Z =
  program(
    "program-z",
    "z",
    0.5,
  );

const PROGRAM_Y =
  program(
    "program-y",
    "y",
    0.6,
  );

const PREREQUISITE_Z:
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
    0.5,

  effectGap:
    0.48,

  evidenceCount:
    4,
};

const PREREQUISITE_Y:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_Z,

  threshold:
    0.35,

  activeMeanEffect:
    0.6,

  effectGap:
    0.58,
};

function hypothesis(
  id: string,
  repairCandidateId: string,
  prerequisite:
    LearnedActionPrerequisite,
  finishEffect: number,
): RecedingVectorHypothesis {
  return {
    id,

    repairCandidateId,

    prerequisiteHypothesisId:
      `finish:readiness>=${prerequisite.threshold.toFixed(
        3,
      )}`,

    dimensionEffects: {
      readiness: {
        "prep-light":
          0.5,
        "prep-strong":
          0.8,
      },

      progress: {
        finish:
          finishEffect,
      },

      exposure: {
        "prep-light":
          0.05,
        "prep-strong":
          0.1,
        finish:
          0.1,
      },
    },

    observationStdDev:
      0.05,

    actionPrerequisites: {
      finish: {
        readiness:
          prerequisite.threshold,
      },
    },
  };
}

const HYPOTHESIS_Z =
  hypothesis(
    "hypothesis-z",
    "revision-z",
    PREREQUISITE_Z,
    0.5,
  );

const HYPOTHESIS_Y =
  hypothesis(
    "hypothesis-y",
    "revision-y",
    PREREQUISITE_Y,
    0.6,
  );

const ACTIONS:
  readonly RecedingVectorAction[] = [
    {
      id:
        "prep-light",

      risk:
        0.05,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "readiness",
    },
    {
      id:
        "prep-strong",

      risk:
        0.1,

      cost:
        0.1,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "readiness",
    },
    {
      id:
        "finish",

      risk:
        0.1,

      cost:
        0.1,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "progress",
    },
  ];

const GOAL = {
  minimums: {
    progress:
      0.6,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function observation(
  id: string,
  y: number,
  z: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
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

const COMPOSITION_FIT:
  readonly StructuralMechanismObservation[] = [
    observation(
      "fit-y-1",
      1,
      0,
      0.6,
    ),
    observation(
      "fit-y-half",
      0.5,
      0,
      0.3,
    ),
    observation(
      "fit-z-1",
      0,
      1,
      0.5,
    ),
    observation(
      "fit-z-half",
      0,
      0.5,
      0.25,
    ),
    observation(
      "fit-joint",
      1,
      1,
      1.1,
    ),
  ];

function lineage():
  RevisionLineage {
  const result =
    createRevisionLineage(
      "rev-z",
      PROGRAM_Z,
      HYPOTHESIS_Z,
      PREREQUISITE_Z,
      [
        "install-z-1",
        "install-z-2",
      ],
      0,
      4,
    );

  return appendInstalledRevision(
    result,
    "rev-y",
    PROGRAM_Y,
    HYPOTHESIS_Y,
    PREREQUISITE_Y,
    [
      "install-y-1",
      "install-y-2",
    ],
    0.1,
  );
}

function createReasoner() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T10:45:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "composition-terminal-goal",

    description:
      "Reach progress >= 0.600 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.600",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions.",
      "Install compositions only after independent protected validation.",
    ],

    createdAt:
      "2026-09-22T10:45:00Z",

    updatedAt:
      "2026-09-22T10:45:00Z",
  });

  return reasoner;
}

export function runProbabilisticRevisionCompositionValidationBenchmark():
  ProbabilisticRevisionCompositionValidationBenchmarkReport {
  const currentLineage =
    lineage();

  const proposal =
    proposeRevisionComposition(
      currentLineage,
      COMPOSITION_FIT,
    );

  if (
    proposal.decision !==
      "compose" ||
    !proposal.candidate
  ) {
    throw new Error(
      "v1.27 benchmark failed to synthesize a composition proposal.",
    );
  }

  const explanations:
    CompositionExplanation[] = [
    {
      id:
        "rev-y",

      program:
        PROGRAM_Y,

      kind:
        "single",
    },
    {
      id:
        "rev-z",

      program:
        PROGRAM_Z,

      kind:
        "single",
    },
    {
      id:
        "composite",

      program:
        proposal.candidate,

      kind:
        "composition",
    },
  ];

  const beliefModel =
    new ProbabilisticCompositionBelief(
      explanations,
    );

  const initialBelief =
    beliefModel.getBelief();

  const unaryProbes =
    synthesizeProtectedValidationProbes(
      currentLineage,
      [],
      {
        maximumArity:
          1,
      },
    );

  const oneStepPlan =
    planCompositionValidation(
      explanations,
      initialBelief,
      unaryProbes,
      1,
    );

  const twoStepPlan =
    planCompositionValidation(
      explanations,
      initialBelief,
      unaryProbes,
      2,
    );

  if (
    twoStepPlan.decision !==
      "plan" ||
    !twoStepPlan.firstProbe
  ) {
    throw new Error(
      "v1.27 benchmark failed to create a two-step protected validation plan.",
    );
  }

  const firstObservation =
    predictHierarchicalProgramEffect(
      proposal.candidate,
      twoStepPlan
        .firstProbe
        .interventions,
    );

  const firstProtected:
    StructuralMechanismObservation = {
    experiment: {
      id:
        "protected-composition-step-1",

      interventions: {
        ...twoStepPlan
          .firstProbe
          .interventions,
      },

      risk:
        twoStepPlan
          .firstProbe
          .risk,

      cost:
        twoStepPlan
          .firstProbe
          .cost,

      reversible:
        true,
    },

    measuredEffect:
      firstObservation,
  };

  beliefModel.recordObservation(
    twoStepPlan.firstProbe,
    firstObservation,
  );

  const compositeBranch =
    twoStepPlan
      .branches
      .find(
        (branch) =>
          branch
            .truthExplanationId ===
          "composite",
      );

  const secondProbe =
    unaryProbes.find(
      (probe) =>
        probe.id ===
        compositeBranch
          ?.secondProbeId,
    );

  if (!secondProbe) {
    throw new Error(
      "v1.27 benchmark did not produce a conditional second validation probe.",
    );
  }

  const secondObservation =
    predictHierarchicalProgramEffect(
      proposal.candidate,
      secondProbe
        .interventions,
    );

  const secondProtected:
    StructuralMechanismObservation = {
    experiment: {
      id:
        "protected-composition-step-2",

      interventions: {
        ...secondProbe
          .interventions,
      },

      risk:
        secondProbe.risk,

      cost:
        secondProbe.cost,

      reversible:
        true,
    },

    measuredEffect:
      secondObservation,
  };

  const finalCompositionBelief =
    beliefModel.recordObservation(
      secondProbe,
      secondObservation,
    );

  const protectedEvidence:
    StructuralMechanismObservation[] = [
    firstProtected,
    secondProtected,
    observation(
      "protected-completion-y-half",
      0.5,
      0,
      0.3,
    ),
    observation(
      "protected-completion-z-half",
      0,
      0.5,
      0.25,
    ),
  ];

  const protectedDecision =
    validateRevisionComposition(
      currentLineage,
      proposal,
      protectedEvidence,
    );

  if (
    protectedDecision.decision !==
      "installed"
  ) {
    throw new Error(
      "v1.27 benchmark protected reserve did not install the composition.",
    );
  }

  const installation =
    installCompositeRevision(
      currentLineage,
      protectedDecision,
      protectedEvidence,
      "rev-composite",
      {
        y:
          1,
        z:
          1,
      },
      finalCompositionBelief
        .normalizedEntropy,
    );

  if (
    installation.decision !==
      "installed" ||
    !installation
      .lineage ||
    !installation
      .hypothesis ||
    !installation
      .prerequisite
  ) {
    throw new Error(
      "v1.27 benchmark failed to append the protected composite revision.",
    );
  }

  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const oldPlan =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_Y,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_Y,
    );

  const compositePlan =
    buildPlanForLiveHypothesis(
      installation
        .hypothesis,
      state,
      GOAL,
      ACTIONS,
      installation
        .prerequisite,
    );

  if (
    oldPlan.decision !==
      "planned" ||
    compositePlan.decision !==
      "planned"
  ) {
    throw new Error(
      "v1.27 benchmark could not build old and composite plans.",
    );
  }

  const reasoner =
    createReasoner();

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "composition-terminal-goal",
    oldPlan,
  );

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      "composition-terminal-goal",
      oldPlan,
      compositePlan,
      1,
    );

  if (
    goalRevision.decision !==
      "revised"
  ) {
    throw new Error(
      "v1.27 benchmark failed to replace the live goal branch.",
    );
  }

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      [
        HYPOTHESIS_Y,
      ],
      {
        probabilities: {
          "hypothesis-y":
            1,
        },

        topHypothesisId:
          "hypothesis-y",

        confidence:
          1,

        normalizedEntropy:
          0,
      },
      "hypothesis-y",
      installation
        .hypothesis,
    );

  const controller =
    createRecedingVectorController(
      state,
      catalogRevision
        .belief
        .probabilities,
    );

  const nextRecedingDecision =
    chooseRecedingHorizonVectorControl(
      catalogRevision
        .hypotheses,
      controller,
      GOAL,
      ACTIONS,
      [],
    );

  return {
    proposal,

    oneStepPlan,

    twoStepPlan,

    finalCompositionBelief,

    protectedDecision,

    installation,

    protectedEvidenceIds:
      protectedEvidence.map(
        (item) =>
          item
            .experiment
            .id,
      ),

    oldActionIds: [
      ...oldPlan
        .actionIds,
    ],

    compositeActionIds: [
      ...compositePlan
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

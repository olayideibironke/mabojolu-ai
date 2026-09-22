import type {
  StructuralRepairTopologyCandidate,
} from "./structural-repair-prerequisite-planning";

import {
  JointRepairPrerequisitePosterior,
  type JointDiscoveryExperiment,
  type JointRepairPrerequisiteBelief,
  type PrerequisiteHypothesis,
} from "./probabilistic-repair-active-prerequisite";

export interface SynthesizedJointExperimentSet {
  experiments: JointDiscoveryExperiment[];
  repairExperimentIds: string[];
  prerequisiteExperimentIds: string[];
}

export interface EpistemicPolicyBranch {
  truthJointHypothesisId: string;
  representativeObservation: number;
  secondExperimentId?: string;
  terminalNormalizedEntropy: number;
}

export interface MultiStepEpistemicPlan {
  decision:
    | "plan"
    | "abstained";
  firstExperiment?: JointDiscoveryExperiment;
  branches: EpistemicPolicyBranch[];
  expectedTerminalNormalizedEntropy: number;
  expectedInformationGain: number;
  expectedCost: number;
  maximumRisk: number;
  horizon: number;
  score: number;
  reason:
    | "safe-multi-step-epistemic-plan"
    | "no-safe-informative-plan";
}

export interface PlanInvarianceAssessment {
  decision:
    | "stop"
    | "experiment";
  dominantPlanSignature?: string;
  supportingProbability: number;
  competingPlanProbability: number;
  reason:
    | "plan-invariant-under-posterior"
    | "decision-relevant-uncertainty-remains";
}

export interface DecisionAwareEpistemicChoice {
  decision:
    | "stop"
    | "experiment"
    | "abstained";
  assessment: PlanInvarianceAssessment;
  experimentPlan?: MultiStepEpistemicPlan;
  reason:
    | "plan-invariant-under-posterior"
    | "safe-decision-relevant-experiment"
    | "no-safe-informative-plan";
}

function validateUnitInterval(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0 ||
    value >
      1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validateNonNegativeFinite(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function parseJointHypothesisId(
  id:
    string,
): {
  repairCandidateId: string;
  prerequisiteHypothesisId: string;
} {
  const separator =
    id.indexOf(
      "::",
    );

  if (
    separator <=
      0 ||
    separator >=
      id.length -
        2
  ) {
    throw new Error(
      `Invalid joint hypothesis id ${id}.`,
    );
  }

  return {
    repairCandidateId:
      id.slice(
        0,
        separator,
      ),

    prerequisiteHypothesisId:
      id.slice(
        separator +
          2,
      ),
  };
}

function normalizedEntropyFromBelief(
  belief:
    JointRepairPrerequisiteBelief,
): number {
  return belief
    .normalizedEntropy;
}

function absoluteEntropyFromBelief(
  belief:
    JointRepairPrerequisiteBelief,
): number {
  const probabilities =
    Object.values(
      belief.jointProbabilities,
    );

  let entropy =
    0;

  for (
    const probability of
      probabilities
  ) {
    if (
      probability >
        0
    ) {
      entropy -=
        probability *
        Math.log(
          probability,
        );
    }
  }

  return entropy;
}

function combinations(
  values:
    readonly string[],

  maximumArity:
    number,
): string[][] {
  const output:
    string[][] =
      [];

  function visit(
    start:
      number,

    chosen:
      string[],
  ): void {
    if (
      chosen.length >
        0
    ) {
      output.push([
        ...chosen,
      ]);
    }

    if (
      chosen.length >=
        maximumArity
    ) {
      return;
    }

    for (
      let index =
        start;
      index <
        values.length;
      index +=
        1
    ) {
      const value =
        values[
          index
        ];

      if (
        value ===
          undefined
      ) {
        continue;
      }

      chosen.push(
        value,
      );

      visit(
        index +
          1,
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    0,
    [],
  );

  return output;
}

function repairVariables(
  candidates:
    readonly StructuralRepairTopologyCandidate[],
): string[] {
  return Array.from(
    new Set(
      candidates.flatMap(
        (candidate) =>
          candidate
            .fragment
            .terms
            .flatMap(
              (term) =>
                term.variables,
            ),
      ),
    ),
  ).sort();
}

export function synthesizeJointDiscoveryExperiments(
  repairCandidates:
    readonly StructuralRepairTopologyCandidate[],

  prerequisiteHypotheses:
    readonly PrerequisiteHypothesis[],

  options?: {
    maximumRepairInterventionArity?: number;
    repairRisk?: number;
    repairCost?: number;
    prerequisiteRisk?: number;
    prerequisiteCost?: number;
    observationStdDev?: number;
  },
): SynthesizedJointExperimentSet {
  if (
    repairCandidates.length <
      2
  ) {
    throw new Error(
      "Autonomous experiment synthesis requires at least two repair candidates.",
    );
  }

  if (
    prerequisiteHypotheses.length <
      2
  ) {
    throw new Error(
      "Autonomous experiment synthesis requires at least two prerequisite hypotheses.",
    );
  }

  const maximumRepairInterventionArity =
    options
      ?.maximumRepairInterventionArity ??
    2;

  if (
    !Number.isInteger(
      maximumRepairInterventionArity,
    ) ||
    maximumRepairInterventionArity <
      1
  ) {
    throw new Error(
      "maximumRepairInterventionArity must be a positive integer.",
    );
  }

  const repairRisk =
    options
      ?.repairRisk ??
    0.1;

  const repairCost =
    options
      ?.repairCost ??
    0.03;

  const prerequisiteRisk =
    options
      ?.prerequisiteRisk ??
    0.1;

  const prerequisiteCost =
    options
      ?.prerequisiteCost ??
    0.04;

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.02;

  validateUnitInterval(
    "repairRisk",
    repairRisk,
  );

  validateUnitInterval(
    "prerequisiteRisk",
    prerequisiteRisk,
  );

  validateNonNegativeFinite(
    "repairCost",
    repairCost,
  );

  validateNonNegativeFinite(
    "prerequisiteCost",
    prerequisiteCost,
  );

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <=
      0
  ) {
    throw new Error(
      "observationStdDev must be positive and finite.",
    );
  }

  const experiments:
    JointDiscoveryExperiment[] =
      [];

  const repairExperimentIds:
    string[] =
      [];

  const prerequisiteExperimentIds:
    string[] =
      [];

  const variables =
    repairVariables(
      repairCandidates,
    );

  for (
    const variableSet of
      combinations(
        variables,
        Math.min(
          maximumRepairInterventionArity,
          variables.length,
        ),
      )
  ) {
    const interventions:
      Record<
        string,
        number
      > = {};

    for (
      const variable of
        variables
    ) {
      interventions[
        variable
      ] =
        variableSet.includes(
          variable,
        )
          ? 1
          : 0;
    }

    const id =
      `synth-repair:${variableSet.join(
        "+",
      )}`;

    experiments.push({
      id,

      kind:
        "repair",

      interventions,

      risk:
        repairRisk,

      cost:
        repairCost,

      reversible:
        true,

      observationStdDev,
    });

    repairExperimentIds.push(
      id,
    );
  }

  const grouped =
    new Map<
      string,
      {
        actionId:
          string;
        targetDimension:
          string;
        stateDimension:
          string;
        thresholds:
          number[];
      }
    >();

  for (
    const hypothesis of
      prerequisiteHypotheses
  ) {
    const key =
      `${hypothesis.actionId}::${hypothesis.targetDimension}::${hypothesis.stateDimension}`;

    const existing =
      grouped.get(
        key,
      );

    if (
      existing
    ) {
      existing
        .thresholds
        .push(
          hypothesis.threshold,
        );
    } else {
      grouped.set(
        key,
        {
          actionId:
            hypothesis.actionId,

          targetDimension:
            hypothesis.targetDimension,

          stateDimension:
            hypothesis.stateDimension,

          thresholds: [
            hypothesis.threshold,
          ],
        },
      );
    }
  }

  for (
    const group of
      grouped.values()
  ) {
    const thresholds =
      Array.from(
        new Set(
          group.thresholds,
        ),
      ).sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      );

    for (
      let index =
        0;
      index <
        thresholds.length -
          1;
      index +=
        1
    ) {
      const left =
        thresholds[
          index
        ];

      const right =
        thresholds[
          index +
            1
        ];

      if (
        left ===
          undefined ||
        right ===
          undefined
      ) {
        continue;
      }

      const probeState =
        (
          left +
          right
        ) /
        2;

      const id =
        `synth-prerequisite:${group.actionId}:${group.targetDimension}:${group.stateDimension}:${probeState.toFixed(
          6,
        )}`;

      experiments.push({
        id,

        kind:
          "prerequisite",

        actionId:
          group.actionId,

        targetDimension:
          group.targetDimension,

        beforeState: {
          [
            group
              .stateDimension
          ]:
            probeState,
        },

        risk:
          prerequisiteRisk,

        cost:
          prerequisiteCost,

        reversible:
          true,

        observationStdDev,
      });

      prerequisiteExperimentIds.push(
        id,
      );
    }
  }

  experiments.sort(
    (
      left,
      right,
    ) =>
      left.id.localeCompare(
        right.id,
      ),
  );

  repairExperimentIds.sort();

  prerequisiteExperimentIds.sort();

  return {
    experiments,

    repairExperimentIds,

    prerequisiteExperimentIds,
  };
}

function clonePosterior(
  incumbent:
    HierarchicalCausalProgram,

  repairCandidates:
    readonly StructuralRepairTopologyCandidate[],

  prerequisiteHypotheses:
    readonly PrerequisiteHypothesis[],

  belief:
    JointRepairPrerequisiteBelief,
): JointRepairPrerequisitePosterior {
  return new JointRepairPrerequisitePosterior(
    incumbent,
    repairCandidates,
    prerequisiteHypotheses,
    belief.jointProbabilities,
  );
}

function safeExperiments(
  experiments:
    readonly JointDiscoveryExperiment[],

  maximumRisk:
    number,
): JointDiscoveryExperiment[] {
  return experiments
    .filter(
      (experiment) =>
        experiment.reversible &&
        experiment.risk <=
          maximumRisk,
    )
    .map(
      (experiment) =>
        experiment.kind ===
          "repair"
          ? {
              ...experiment,

              interventions: {
                ...experiment.interventions,
              },
            }
          : {
              ...experiment,

              beforeState: {
                ...experiment.beforeState,
              },
            },
    );
}

export function planMultiStepEpistemicPolicy(
  incumbent:
    HierarchicalCausalProgram,

  repairCandidates:
    readonly StructuralRepairTopologyCandidate[],

  prerequisiteHypotheses:
    readonly PrerequisiteHypothesis[],

  posterior:
    JointRepairPrerequisitePosterior,

  experiments:
    readonly JointDiscoveryExperiment[],

  options?: {
    horizon?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
    costPenalty?: number;
  },
): MultiStepEpistemicPlan {
  const horizon =
    options
      ?.horizon ??
    2;

  if (
    horizon !==
      1 &&
    horizon !==
      2
  ) {
    throw new Error(
      "v1.20 epistemic planning currently supports horizon 1 or 2.",
    );
  }

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const minimumInformationGain =
    options
      ?.minimumInformationGain ??
    0.05;

  const costPenalty =
    options
      ?.costPenalty ??
    0.1;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "minimumInformationGain",
    minimumInformationGain,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  const candidates =
    safeExperiments(
      experiments,
      maximumRisk,
    );

  const priorBelief =
    posterior.getBelief();

  const priorEntropy =
    absoluteEntropyFromBelief(
      priorBelief,
    );

  let best:
    MultiStepEpistemicPlan |
    undefined;

  for (
    const first of
      candidates
  ) {
    const branches:
      EpistemicPolicyBranch[] =
        [];

    let expectedTerminalEntropy =
      0;

    let expectedCost =
      first.cost;

    let branchMaximumRisk =
      first.risk;

    for (
      const [
        truthJointHypothesisId,
        truthProbability,
      ] of
        Object.entries(
          priorBelief
            .jointProbabilities,
        )
    ) {
      if (
        truthProbability <=
          0
      ) {
        continue;
      }

      const truth =
        parseJointHypothesisId(
          truthJointHypothesisId,
        );

      const firstObservation =
        posterior.simulateObservation(
          truth.repairCandidateId,
          truth.prerequisiteHypothesisId,
          first,
        );

      const child =
        clonePosterior(
          incumbent,
          repairCandidates,
          prerequisiteHypotheses,
          priorBelief,
        );

      child.recordObservation(
        first,
        firstObservation,
      );

      let secondExperimentId:
        string |
        undefined;

      let terminalBelief =
        child.getBelief();

      if (
        horizon ===
          2
      ) {
        const remaining =
          candidates.filter(
            (experiment) =>
              experiment.id !==
              first.id,
          );

        const secondChoice =
          child.chooseExperiment(
            remaining,
            {
              maximumRisk,

              minimumInformationGain,

              costPenalty,
            },
          );

        if (
          secondChoice.decision ===
            "experiment" &&
          secondChoice.experiment
        ) {
          const second =
            secondChoice.experiment;

          const secondObservation =
            child.simulateObservation(
              truth.repairCandidateId,
              truth.prerequisiteHypothesisId,
              second,
            );

          child.recordObservation(
            second,
            secondObservation,
          );

          secondExperimentId =
            second.id;

          terminalBelief =
            child.getBelief();

          expectedCost +=
            truthProbability *
            second.cost;

          branchMaximumRisk =
            Math.max(
              branchMaximumRisk,
              second.risk,
            );
        }
      }

      const terminalAbsoluteEntropy =
        absoluteEntropyFromBelief(
          terminalBelief,
        );

      expectedTerminalEntropy +=
        truthProbability *
        terminalAbsoluteEntropy;

      branches.push({
        truthJointHypothesisId,

        representativeObservation:
          firstObservation,

        secondExperimentId,

        terminalNormalizedEntropy:
          normalizedEntropyFromBelief(
            terminalBelief,
          ),
      });
    }

    const expectedInformationGain =
      Math.max(
        0,
        priorEntropy -
          expectedTerminalEntropy,
      );

    if (
      expectedInformationGain <
        minimumInformationGain
    ) {
      continue;
    }

    const score =
      expectedInformationGain -
      costPenalty *
        expectedCost;

    const normalizedExpectedTerminalEntropy =
      priorBelief
        .normalizedEntropy ===
        0
        ? 0
        : expectedTerminalEntropy /
          Math.log(
            Object.keys(
              priorBelief
                .jointProbabilities,
            ).length,
          );

    const candidate:
      MultiStepEpistemicPlan = {
      decision:
        "plan",

      firstExperiment:
        first,

      branches:
        branches.sort(
          (
            left,
            right,
          ) =>
            left.truthJointHypothesisId.localeCompare(
              right.truthJointHypothesisId,
            ),
        ),

      expectedTerminalNormalizedEntropy:
        normalizedExpectedTerminalEntropy,

      expectedInformationGain,

      expectedCost,

      maximumRisk:
        branchMaximumRisk,

      horizon,

      score,

      reason:
        "safe-multi-step-epistemic-plan",
    };

    if (
      !best ||
      candidate.score >
        best.score +
          Number.EPSILON ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        candidate.expectedCost <
          best.expectedCost -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.expectedCost -
            best.expectedCost,
        ) <=
          Number.EPSILON &&
        (
          candidate
            .firstExperiment
            ?.id ??
          ""
        ) <
          (
            best
              .firstExperiment
              ?.id ??
            ""
          )
      )
    ) {
      best =
        candidate;
    }
  }

  return best ?? {
    decision:
      "abstained",

    branches:
      [],

    expectedTerminalNormalizedEntropy:
      priorBelief
        .normalizedEntropy,

    expectedInformationGain:
      0,

    expectedCost:
      0,

    maximumRisk:
      0,

    horizon,

    score:
      Number.NEGATIVE_INFINITY,

    reason:
      "no-safe-informative-plan",
  };
}

export function assessPlanInvariance(
  belief:
    JointRepairPrerequisiteBelief,

  planSignatureByPrerequisiteHypothesisId:
    Readonly<
      Record<
        string,
        string
      >
    >,

  requiredProbability =
    0.95,
): PlanInvarianceAssessment {
  validateUnitInterval(
    "requiredProbability",
    requiredProbability,
  );

  const probabilityByPlan =
    new Map<
      string,
      number
    >();

  for (
    const [
      jointHypothesisId,
      probability,
    ] of
      Object.entries(
        belief.jointProbabilities,
      )
  ) {
    const {
      prerequisiteHypothesisId,
    } =
      parseJointHypothesisId(
        jointHypothesisId,
      );

    const signature =
      planSignatureByPrerequisiteHypothesisId[
        prerequisiteHypothesisId
      ];

    if (
      signature ===
        undefined
    ) {
      throw new Error(
        `Missing plan signature for prerequisite hypothesis ${prerequisiteHypothesisId}.`,
      );
    }

    probabilityByPlan.set(
      signature,
      (
        probabilityByPlan.get(
          signature,
        ) ??
        0
      ) +
        probability,
    );
  }

  const ranked =
    Array.from(
      probabilityByPlan.entries(),
    ).sort(
      (
        left,
        right,
      ) =>
        right[
          1
        ] -
          left[
            1
          ] ||
        left[
          0
        ].localeCompare(
          right[
            0
          ],
        ),
    );

  const top =
    ranked[
      0
    ];

  if (
    !top
  ) {
    throw new Error(
      "Plan invariance requires at least one posterior-supported plan.",
    );
  }

  const supportingProbability =
    top[
      1
    ];

  const competingPlanProbability =
    1 -
    supportingProbability;

  if (
    supportingProbability >=
      requiredProbability
  ) {
    return {
      decision:
        "stop",

      dominantPlanSignature:
        top[
          0
        ],

      supportingProbability,

      competingPlanProbability,

      reason:
        "plan-invariant-under-posterior",
    };
  }

  return {
    decision:
      "experiment",

    dominantPlanSignature:
      top[
        0
      ],

    supportingProbability,

    competingPlanProbability,

    reason:
      "decision-relevant-uncertainty-remains",
  };
}

export function chooseDecisionAwareEpistemicStep(
  incumbent:
    HierarchicalCausalProgram,

  repairCandidates:
    readonly StructuralRepairTopologyCandidate[],

  prerequisiteHypotheses:
    readonly PrerequisiteHypothesis[],

  posterior:
    JointRepairPrerequisitePosterior,

  experiments:
    readonly JointDiscoveryExperiment[],

  planSignatureByPrerequisiteHypothesisId:
    Readonly<
      Record<
        string,
        string
      >
    >,

  options?: {
    requiredPlanProbability?: number;
    horizon?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
    costPenalty?: number;
  },
): DecisionAwareEpistemicChoice {
  const assessment =
    assessPlanInvariance(
      posterior.getBelief(),
      planSignatureByPrerequisiteHypothesisId,
      options
        ?.requiredPlanProbability ??
        0.95,
    );

  if (
    assessment.decision ===
      "stop"
  ) {
    return {
      decision:
        "stop",

      assessment,

      reason:
        "plan-invariant-under-posterior",
    };
  }

  const experimentPlan =
    planMultiStepEpistemicPolicy(
      incumbent,
      repairCandidates,
      prerequisiteHypotheses,
      posterior,
      experiments,
      {
        horizon:
          options
            ?.horizon ??
          2,

        maximumRisk:
          options
            ?.maximumRisk ??
          0.3,

        minimumInformationGain:
          options
            ?.minimumInformationGain ??
          0.05,

        costPenalty:
          options
            ?.costPenalty ??
          0.1,
      },
    );

  if (
    experimentPlan.decision !==
      "plan"
  ) {
    return {
      decision:
        "abstained",

      assessment,

      experimentPlan,

      reason:
        "no-safe-informative-plan",
    };
  }

  return {
    decision:
      "experiment",

    assessment,

    experimentPlan,

    reason:
      "safe-decision-relevant-experiment",
  };
}

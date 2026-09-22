import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assessPlanInvariance,
  chooseDecisionAwareEpistemicStep,
  planMultiStepEpistemicPolicy,
  synthesizeJointDiscoveryExperiments,
} from "./autonomous-experiment-synthesis";

import {
  JointRepairPrerequisitePosterior,
  generatePrerequisiteHypotheses,
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

function setupHypotheses() {
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
      "Expected repair candidates are missing.",
    );
  }

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
      "Expected three prerequisite hypotheses.",
    );
  }

  return {
    repairs: [
      interaction,
      linear,
    ] as const,

    prerequisites,
  };
}

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

function planSignatures(
  prerequisites:
    ReturnType<
      typeof setupHypotheses
    >[
      "prerequisites"
    ],
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
        "Prerequisite hypothesis did not produce a safe plan.",
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

describe(
  "autonomous joint experiment synthesis",
  () => {
    it(
      "generates repair and prerequisite probes directly from competing hypotheses",
      () => {
        const setup =
          setupHypotheses();

        const synthesized =
          synthesizeJointDiscoveryExperiments(
            setup.repairs,
            setup.prerequisites,
          );

        expect(
          synthesized
            .repairExperimentIds,
        ).toEqual([
          "synth-repair:y",
          "synth-repair:y+z",
          "synth-repair:z",
        ]);

        expect(
          synthesized
            .prerequisiteExperimentIds,
        ).toEqual([
          "synth-prerequisite:finish:progress:readiness:0.450000",
          "synth-prerequisite:finish:progress:readiness:0.625000",
        ]);

        expect(
          synthesized.experiments,
        ).toHaveLength(
          5,
        );

        expect(
          synthesized
            .experiments
            .every(
              (experiment) =>
                experiment.reversible &&
                experiment.risk <=
                  0.1,
            ),
        ).toBe(
          true,
        );
      },
    );
  },
);

describe(
  "multi-step epistemic planning",
  () => {
    it(
      "reduces expected terminal entropy more with horizon two than with horizon one",
      () => {
        const setup =
          setupHypotheses();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
          );

        const synthesized =
          synthesizeJointDiscoveryExperiments(
            setup.repairs,
            setup.prerequisites,
          );

        const oneStep =
          planMultiStepEpistemicPolicy(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
            posterior,
            synthesized.experiments,
            {
              horizon:
                1,
            },
          );

        const twoStep =
          planMultiStepEpistemicPolicy(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
            posterior,
            synthesized.experiments,
            {
              horizon:
                2,
            },
          );

        expect(
          oneStep.decision,
        ).toBe(
          "plan",
        );

        expect(
          twoStep.decision,
        ).toBe(
          "plan",
        );

        expect(
          twoStep
            .expectedTerminalNormalizedEntropy,
        ).toBeLessThan(
          oneStep
            .expectedTerminalNormalizedEntropy,
        );

        expect(
          twoStep
            .branches
            .some(
              (branch) =>
                Boolean(
                  branch.secondExperimentId,
                ),
            ),
        ).toBe(
          true,
        );

        expect(
          twoStep.maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );
  },
);

describe(
  "decision-aware epistemic stopping",
  () => {
    it(
      "keeps experimenting while posterior-supported hypotheses still imply different safe plans",
      () => {
        const setup =
          setupHypotheses();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
          );

        const assessment =
          assessPlanInvariance(
            posterior.getBelief(),
            planSignatures(
              setup.prerequisites,
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "experiment",

          reason:
            "decision-relevant-uncertainty-remains",
        });

        expect(
          assessment
            .supportingProbability,
        ).toBeCloseTo(
          2 /
            3,
        );
      },
    );

    it(
      "stops after one synthesized prerequisite probe when residual repair uncertainty cannot change the safe plan",
      () => {
        const setup =
          setupHypotheses();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
          );

        const synthesized =
          synthesizeJointDiscoveryExperiments(
            setup.repairs,
            setup.prerequisites,
          );

        const firstChoice =
          chooseDecisionAwareEpistemicStep(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
            posterior,
            synthesized.experiments,
            planSignatures(
              setup.prerequisites,
            ),
          );

        expect(
          firstChoice.decision,
        ).toBe(
          "experiment",
        );

        const firstExperiment =
          firstChoice
            .experimentPlan
            ?.firstExperiment;

        expect(
          firstExperiment,
        ).toBeDefined();

        expect(
          firstExperiment
            ?.kind,
        ).toBe(
          "prerequisite",
        );

        const truthPrerequisite =
          setup
            .prerequisites
            .find(
              (hypothesis) =>
                Math.abs(
                  hypothesis.threshold -
                    0.7,
                ) <
                1e-9,
            )!;

        posterior.recordObservation(
          firstExperiment!,
          posterior.simulateObservation(
            setup
              .repairs[
                0
              ]
              .fragment
              .id,
            truthPrerequisite.id,
            firstExperiment!,
          ),
        );

        const afterProbe =
          posterior.getBelief();

        expect(
          afterProbe.sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          afterProbe
            .repairProbabilities[
              setup
                .repairs[
                  0
                ]
                .fragment
                .id
            ],
        ).toBeCloseTo(
          0.5,
        );

        const nextChoice =
          chooseDecisionAwareEpistemicStep(
            FLAWED_PROGRAM,
            setup.repairs,
            setup.prerequisites,
            posterior,
            synthesized.experiments.filter(
              (experiment) =>
                experiment.id !==
                firstExperiment
                  ?.id,
            ),
            planSignatures(
              setup.prerequisites,
            ),
          );

        expect(
          nextChoice,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "plan-invariant-under-posterior",

          assessment: {
            decision:
              "stop",

            dominantPlanSignature:
              "prep-strong->finish",
          },
        });

        expect(
          nextChoice
            .assessment
            .supportingProbability,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );
  },
);

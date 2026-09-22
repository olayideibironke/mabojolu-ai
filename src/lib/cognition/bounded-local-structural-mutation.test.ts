import {
  describe,
  expect,
  it,
} from "vitest";

import {
  JointParameterStructurePosterior,
  buildResolvedStructuralMutationSearch,
  chooseStructuralMutationProbe,
  synthesizeBoundedLocalStructuralMutations,
  synthesizeStructuralMutationProbes,
} from "./bounded-local-structural-mutation";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  initializeFragmentProvenance,
} from "./active-fragment-fault-localization-provenance";

import {
  installProbabilisticLocalRepair,
  validateProbabilisticLocalRepairSearch,
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
  type RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

import {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

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

const Y_FRAGMENT =
  fragment(
    "rev-y:program-y-fragment",
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

const Z_FRAGMENT =
  fragment(
    "rev-z:program-z-fragment",
    {
      id:
        "linear(z)",

      kind:
        "linear",

      variables: [
        "z",
      ],

      coefficient:
        0.2,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "structural-mutation-composite",

  baseEffects: {
    y:
      0,
    z:
      0,
  },

  fragments: [
    Y_FRAGMENT,
    Z_FRAGMENT,
  ],

  observationStdDev:
    0.04,

  depth:
    3,

  complexity:
    2,
};

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "structural-mutation-actual",

  fragments: [
    fragment(
      "actual-saturating-y",
      {
        id:
          "saturating(y)",

        kind:
          "saturating",

        variables: [
          "y",
        ],

        coefficient:
          0.9,
      },
    ),
    Z_FRAGMENT,
  ],
};

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "structure-discovery-y-half",
      0.5,
      0,
      0.45,
    ),
    observation(
      "structure-discovery-z",
      0,
      1,
      0.2,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "structure-protected-y-quarter",
      0.25,
      0,
      0.3,
    ),
    observation(
      "structure-protected-y-half",
      0.5,
      0,
      0.45,
    ),
    observation(
      "structure-protected-y-full",
      1,
      0,
      0.6,
    ),
    observation(
      "structure-protected-joint",
      0.5,
      1,
      0.65,
    ),
  ];

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
    0.6,

  effectGap:
    0.58,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:structural-mutation",

  repairCandidateId:
    "composition:linear-y+linear-z",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        0.3,
      "boost-finish":
        0.6,
    },

    exposure: {
      finish:
        0.1,
      "boost-finish":
        0.15,
    },
  },

  observationStdDev:
    0.04,

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
      0.4,
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
  measuredEffect:
    number,
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

function candidates() {
  return synthesizeBoundedLocalStructuralMutations(
    PROGRAM,
    Y_FRAGMENT.id,
    DISCOVERY,
    [
      "y",
      "z",
    ],
    {
      includeSaturating:
        true,

      includeInteractions:
        true,

      includeLatentBias:
        true,

      maximumCandidates:
        12,
    },
  );
}

function posterior() {
  return new JointParameterStructurePosterior(
    candidates(),
    {
      maximumDiscoveryObjectiveGap:
        0.005,

      sufficientConfidence:
        0.95,

      minimumMargin:
        0.1,
    },
  );
}

function resolvedPosterior() {
  const result =
    posterior();

  result.recordObservation(
    observation(
      "structure-diagnostic-y-full",
      1,
      0,
      0.6,
    ),
    0.03,
  );

  return result;
}

function lineage() {
  return createRevisionLineage(
    "rev-structural-incumbent",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "structure-install-a",
      "structure-install-b",
      "structure-install-c",
      "structure-install-d",
    ],
    0.2,
    4,
  );
}

function provenance() {
  return initializeFragmentProvenance(
    "rev-structural-incumbent",
    PROGRAM,
    {
      [
        Y_FRAGMENT.id
      ]: {
        sourceRevisionId:
          "rev-y",

        sourceFragmentId:
          "program-y-fragment",
      },

      [
        Z_FRAGMENT.id
      ]: {
        sourceRevisionId:
          "rev-z",

        sourceFragmentId:
          "program-z-fragment",
      },
    },
  );
}

function reasonerAndPlan() {
  const plan =
    buildPlanForLiveHypothesis(
      HYPOTHESIS,
      STATE,
      GOAL,
      ACTIONS,
      PREREQUISITE,
    );

  if (
    plan.decision !==
      "planned"
  ) {
    throw new Error(
      "Expected structural-mutation incumbent plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T15:10:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "structural-mutation-terminal",

    description:
      "Reach progress >= 0.400 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.400",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve parameter versus structure uncertainty.",
      "Protect topology mutation before installation.",
    ],

    createdAt:
      "2026-09-22T15:10:00Z",

    updatedAt:
      "2026-09-22T15:10:00Z",
  });

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "structural-mutation-terminal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

describe(
  "bounded local structural mutation synthesis",
  () => {
    it(
      "supports a bounded saturating structural term",
      () => {
        expect(
          predictHierarchicalProgramEffect(
            ACTUAL_PROGRAM,
            {
              y:
                0.5,
              z:
                0,
            },
          ),
        ).toBeCloseTo(
          0.45,
        );

        expect(
          predictHierarchicalProgramEffect(
            ACTUAL_PROGRAM,
            {
              y:
                1,
              z:
                0,
            },
          ),
        ).toBeCloseTo(
          0.6,
        );
      },
    );

    it(
      "synthesizes same-topology parameter drift and bounded topology alternatives",
      () => {
        const synthesized =
          candidates();

        expect(
          synthesized.some(
            (candidate) =>
              candidate.kind ===
                "linear" &&
              candidate
                .topologyChanged ===
                false &&
              Math.abs(
                candidate.coefficient -
                0.9,
              ) <
                1e-9,
          ),
        ).toBe(
          true,
        );

        expect(
          synthesized.some(
            (candidate) =>
              candidate.kind ===
                "saturating" &&
              candidate
                .topologyChanged ===
                true &&
              Math.abs(
                candidate.coefficient -
                0.9,
              ) <
                1e-9,
          ),
        ).toBe(
          true,
        );

        expect(
          synthesized.some(
            (candidate) =>
              candidate.kind ===
                "interaction",
          ),
        ).toBe(
          true,
        );

        expect(
          synthesized.some(
            (candidate) =>
              candidate.kind ===
                "latent-bias",
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "keeps the one-term local mutation grammar bounded",
      () => {
        expect(
          candidates().length,
        ).toBeLessThanOrEqual(
          12,
        );

        expect(
          () =>
            synthesizeBoundedLocalStructuralMutations(
              {
                ...PROGRAM,

                fragments: [
                  {
                    ...Y_FRAGMENT,

                    id:
                      "two-term-target",

                    terms: [
                      ...Y_FRAGMENT
                        .terms,
                      {
                        id:
                          "extra-bias",

                        kind:
                          "latent-bias",

                        variables:
                          [],

                        coefficient:
                          0.1,
                      },
                    ],
                  },
                  Z_FRAGMENT,
                ],
              },
              "two-term-target",
              DISCOVERY,
              [
                "y",
                "z",
              ],
            ),
        ).toThrow(
          "Bounded local structural mutation currently requires a one-term target fragment.",
        );
      },
    );
  },
);

describe(
  "joint parameter-structure uncertainty",
  () => {
    it(
      "retains the discovery-plausible linear-refit and saturating explanations without premature resolution",
      () => {
        const result =
          posterior();

        expect(
          result
            .getCandidates()
            .map(
              (candidate) =>
                candidate.kind,
            )
            .sort(),
        ).toEqual([
          "linear",
          "saturating",
        ]);

        expect(
          result
            .getBelief()
            .sufficientlyResolved,
        ).toBe(
          false,
        );
      },
    );

    it(
      "chooses the safe full-y diagnostic because it separates parameter drift from saturation",
      () => {
        const result =
          posterior();

        const probes =
          synthesizeStructuralMutationProbes(
            [
              "y",
              "z",
            ],
            {
              levels: [
                1,
              ],

              includeJointProbe:
                false,

              observationStdDev:
                0.03,
            },
          );

        const choice =
          chooseStructuralMutationProbe(
            result,
            probes,
          );

        expect(
          choice,
        ).toMatchObject({
          decision:
            "probe",

          probe: {
            id:
              "structure-probe:y=1.00",
          },

          reason:
            "safe-structural-information-probe",
        });

        expect(
          choice
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );

    it(
      "abstains when every structural diagnostic exceeds the external risk ceiling",
      () => {
        const result =
          posterior();

        const unsafe =
          synthesizeStructuralMutationProbes(
            [
              "y",
            ],
            {
              levels: [
                1,
              ],

              baseRisk:
                0.9,
            },
          );

        const choice =
          chooseStructuralMutationProbe(
            result,
            unsafe,
            {
              maximumRisk:
                0.3,
            },
          );

        expect(
          choice,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-structural-information-probe",
        });
      },
    );

    it(
      "resolves saturation only after observing the discriminating diagnostic",
      () => {
        const belief =
          resolvedPosterior()
            .getBelief();

        expect(
          belief,
        ).toMatchObject({
          topKind:
            "saturating",

          topologyChanged:
            true,

          sufficientlyResolved:
            true,
        });

        expect(
          belief.topCoefficient,
        ).toBeCloseTo(
          0.9,
        );

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.99,
        );
      },
    );

    it(
      "does not open a topology mutation search while parameter-structure uncertainty remains",
      () => {
        const search =
          buildResolvedStructuralMutationSearch(
            posterior(),
            DISCOVERY,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "fault-posterior-not-resolved",
        });
      },
    );

    it(
      "opens a local replacement search only after the structural posterior resolves",
      () => {
        const search =
          buildResolvedStructuralMutationSearch(
            resolvedPosterior(),
            DISCOVERY,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "search",

          faultExplanation: {
            id:
              "joint-parameter-structure:saturating",
          },

          selectedCandidate: {
            replacementFragmentIds: {
              [
                Y_FRAGMENT.id
              ]:
                "rev-y:program-y-fragment:mutation:saturating:y:0.900",
            },

            retiredFragmentIds: [
              "rev-y:program-y-fragment",
            ],
          },

          reason:
            "fault-posterior-authorized-local-repair-search",
        });
      },
    );

    it(
      "keeps diagnostic evidence disjoint from protected structural validation",
      () => {
        const result =
          resolvedPosterior();

        const search =
          buildResolvedStructuralMutationSearch(
            result,
            DISCOVERY,
          );

        expect(
          () =>
            validateProbabilisticLocalRepairSearch(
              lineage(),
              PROGRAM,
              search,
              [
                observation(
                  "structure-diagnostic-y-full",
                  1,
                  0,
                  0.6,
                ),
                ...PROTECTED.slice(
                  1,
                ),
              ],
              [
                "structure-diagnostic-y-full",
              ],
              result
                .getBelief()
                .normalizedEntropy,
            ),
        ).toThrow(
          "Local repair search, diagnostic, and protected evidence must remain disjoint.",
        );
      },
    );

    it(
      "requires the complete adaptive protected reserve before installing the topology mutation",
      () => {
        const result =
          resolvedPosterior();

        const search =
          buildResolvedStructuralMutationSearch(
            result,
            DISCOVERY,
          );

        const shortDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED.slice(
              0,
              3,
            ),
            [
              "structure-diagnostic-y-full",
            ],
            result
              .getBelief()
              .normalizedEntropy,
          );

        expect(
          shortDecision,
        ).toMatchObject({
          decision:
            "abstained",

          requirement: {
            minimumProtectedEvidence:
              4,
          },

          reason:
            "adaptive-protected-local-repair-reserve-insufficient",
        });

        const fullDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED,
            [
              "structure-diagnostic-y-full",
            ],
            result
              .getBelief()
              .normalizedEntropy,
          );

        expect(
          fullDecision,
        ).toMatchObject({
          decision:
            "installed",

          reason:
            "protected-local-repair-selected",
        });

        expect(
          fullDecision
            .candidateProtectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "installs the protected topology mutation, advances provenance, and changes live control",
      () => {
        const result =
          resolvedPosterior();

        const search =
          buildResolvedStructuralMutationSearch(
            result,
            DISCOVERY,
          );

        const protectedDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED,
            [
              "structure-diagnostic-y-full",
            ],
            result
              .getBelief()
              .normalizedEntropy,
          );

        const {
          reasoner,
          plan,
        } =
          reasonerAndPlan();

        expect(
          plan.actionIds,
        ).toEqual([
          "boost-finish",
        ]);

        const installation =
          installProbabilisticLocalRepair(
            lineage(),
            protectedDecision,
            "progress",
            {
              finish: {
                y:
                  0.5,
                z:
                  0,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  0,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "structural-mutation-terminal",
            "rev-saturating-y",
            1,
            result
              .getBelief()
              .normalizedEntropy,
            provenance(),
          );

        expect(
          installation,
        ).toMatchObject({
          decision:
            "installed",

          revisedPlan: {
            actionIds: [
              "finish",
            ],
          },

          goalRevision: {
            decision:
              "revised",

            terminalGoalPreserved:
              true,
          },

          reason:
            "probabilistic-local-repair-installed",
        });

        expect(
          installation
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.45,

          "boost-finish":
            0.6,
        });

        const y =
          installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                Y_FRAGMENT.id,
            );

        const z =
          installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                Z_FRAGMENT.id,
            );

        expect(
          y,
        ).toMatchObject({
          originRevisionId:
            "rev-y",

          activeFragmentId:
            "rev-y:program-y-fragment:mutation:saturating:y:0.900",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          activeFragmentId:
            "rev-z:program-z-fragment",

          generation:
            1,
        });

        const controller =
          createRecedingVectorController(
            STATE,
            installation
              .catalogRevision!
              .belief
              .probabilities,
          );

        const next =
          chooseRecedingHorizonVectorControl(
            installation
              .catalogRevision!
              .hypotheses,
            controller,
            GOAL,
            ACTIONS,
            [],
          );

        expect(
          next,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "finish",

          reason:
            "direct-action-best",
        });
      },
    );
  },
);

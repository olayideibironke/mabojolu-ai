import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AdaptiveFaultModelPosterior,
  chooseAdaptiveFaultRepairAction,
  createAdaptiveRepairPosterior,
  expectedProbeInformationGainForAdaptiveFaults,
  inferFragmentFaultMagnitudes,
  synthesizeAdaptiveFaultModels,
  validateAdaptiveRepairPosterior,
} from "./adaptive-fault-model-repair-uncertainty";

import {
  initializeFragmentProvenance,
  synthesizeFragmentFaultProbes,
} from "./active-fragment-fault-localization-provenance";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  installProbabilisticLocalRepair,
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

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

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

const Y_FRAGMENT =
  linearFragment(
    "rev-y:program-y-fragment",
    "y",
    0.6,
  );

const Z_FRAGMENT =
  linearFragment(
    "rev-z:program-z-fragment",
    "z",
    0.5,
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "adaptive-fault-composite",

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
    0.05,

  depth:
    3,

  complexity:
    2,
};

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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:adaptive-fault",

  repairCandidateId:
    "composition:rev-y+rev-z",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        0.8,
      "boost-finish":
        1.1,
    },

    exposure: {
      finish:
        0.1,
      "boost-finish":
        0.15,
    },
  },

  observationStdDev:
    0.05,

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
      0.5,
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

const MAGNITUDE_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "magnitude-y-half",
      0.5,
      0,
      0.12,
    ),
    observation(
      "magnitude-z-half",
      0,
      0.5,
      0.175,
    ),
  ];

const DIAGNOSTIC_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "diagnostic-y-full",
      1,
      0,
      0.24,
    ),
    observation(
      "diagnostic-z-full",
      0,
      1,
      0.35,
    ),
  ];

const REPAIR_SELECTION_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "repair-select-y",
      1,
      0,
      0.24,
    ),
    observation(
      "repair-select-z",
      0,
      1,
      0.35,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "adaptive-protected-y",
      1,
      0,
      0.24,
    ),
    observation(
      "adaptive-protected-z",
      0,
      1,
      0.35,
    ),
    observation(
      "adaptive-protected-joint",
      1,
      1,
      0.59,
    ),
    observation(
      "adaptive-protected-half-joint",
      0.5,
      1,
      0.47,
    ),
  ];

function lineage() {
  return createRevisionLineage(
    "rev-composite",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "adaptive-install-a",
      "adaptive-install-b",
      "adaptive-install-c",
      "adaptive-install-d",
    ],
    0.2,
    4,
  );
}

function estimates() {
  return inferFragmentFaultMagnitudes(
    PROGRAM,
    MAGNITUDE_EVIDENCE,
    {
      uncertaintyRadius:
        0.1,
    },
  );
}

function candidates() {
  return synthesizeAdaptiveFaultModels(
    PROGRAM,
    estimates(),
    {
      maximumChangedFragments:
        2,

      maximumCandidates:
        64,
    },
  );
}

function faultPosterior() {
  const posterior =
    new AdaptiveFaultModelPosterior(
      candidates(),
    );

  for (
    const item of
      MAGNITUDE_EVIDENCE
  ) {
    posterior.recordObservation(
      item,
      0.08,
    );
  }

  return posterior;
}

function resolvedFaultPosterior() {
  const posterior =
    faultPosterior();

  for (
    const item of
      DIAGNOSTIC_EVIDENCE
  ) {
    posterior.recordObservation(
      item,
      0.02,
    );
  }

  return posterior;
}

function repairPosterior() {
  return createAdaptiveRepairPosterior(
    PROGRAM,
    candidates(),
    MAGNITUDE_EVIDENCE,
    {
      maximumRepairCandidates:
        8,
    },
  );
}

function resolvedRepairPosterior() {
  const posterior =
    repairPosterior();

  for (
    const item of
      REPAIR_SELECTION_EVIDENCE
  ) {
    posterior.recordObservation(
      item,
      0.018,
    );
  }

  return posterior;
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
      "Expected adaptive-fault incumbent plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T14:10:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "adaptive-fault-terminal",

    description:
      "Reach progress >= 0.500 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.500",
      "exposure <= 0.300",
    ],

    constraints: [
      "Infer fault magnitude from evidence.",
      "Protect uncertain repair selection.",
    ],

    createdAt:
      "2026-09-22T14:10:00Z",

    updatedAt:
      "2026-09-22T14:10:00Z",
  });

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "adaptive-fault-terminal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

function provenance() {
  return initializeFragmentProvenance(
    "rev-composite",
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

describe(
  "adaptive fault magnitude synthesis",
  () => {
    it(
      "infers continuous fragment scales from counterfactual contribution evidence",
      () => {
        const inferred =
          estimates();

        expect(
          inferred,
        ).toMatchObject([
          {
            fragmentId:
              "rev-y:program-y-fragment",

            estimatedScale:
              0.4,

            effectiveEvidenceCount:
              1,

            lowerBound:
              0.3,

            upperBound:
              0.5,
          },
          {
            fragmentId:
              "rev-z:program-z-fragment",

            estimatedScale:
              0.7,

            effectiveEvidenceCount:
              1,

            lowerBound:
              0.6,

            upperBound:
              0.8,
          },
        ]);
      },
    );

    it(
      "keeps the incumbent and a bounded neighborhood around evidence-derived scales",
      () => {
        const synthesized =
          candidates();

        expect(
          synthesized.some(
            (candidate) =>
              candidate.scales[
                Y_FRAGMENT.id
              ] ===
                1 &&
              candidate.scales[
                Z_FRAGMENT.id
              ] ===
                1,
          ),
        ).toBe(
          true,
        );

        expect(
          synthesized.some(
            (candidate) =>
              candidate.scales[
                Y_FRAGMENT.id
              ] ===
                0.4 &&
              candidate.scales[
                Z_FRAGMENT.id
              ] ===
                0.7,
          ),
        ).toBe(
          true,
        );

        expect(
          synthesized.length,
        ).toBeLessThanOrEqual(
          64,
        );
      },
    );

    it(
      "can synthesize a structural retirement candidate when evidence drives a fragment near zero",
      () => {
        const nearZero =
          inferFragmentFaultMagnitudes(
            PROGRAM,
            [
              observation(
                "near-zero-y",
                1,
                0,
                0.02,
              ),
              observation(
                "healthy-z",
                0,
                1,
                0.5,
              ),
            ],
            {
              uncertaintyRadius:
                0.1,
            },
          );

        const synthesized =
          synthesizeAdaptiveFaultModels(
            PROGRAM,
            nearZero,
            {
              retirementThreshold:
                0.15,
            },
          );

        expect(
          synthesized.some(
            (candidate) =>
              candidate
                .retiredFragmentIds
                .includes(
                  Y_FRAGMENT.id,
                ),
          ),
        ).toBe(
          true,
        );
      },
    );
  },
);

describe(
  "adaptive fault and repair uncertainty",
  () => {
    it(
      "keeps the evidence-derived fault model uncertain after sparse magnitude evidence",
      () => {
        const belief =
          faultPosterior()
            .getBelief();

        expect(
          belief.topScales,
        ).toMatchObject({
          [
            Y_FRAGMENT.id
          ]:
            0.4,

          [
            Z_FRAGMENT.id
          ]:
            0.7,
        });

        expect(
          belief
            .sufficientlyResolved,
        ).toBe(
          false,
        );
      },
    );

    it(
      "computes positive information value for a safe diagnostic probe",
      () => {
        const posterior =
          faultPosterior();

        const probes =
          synthesizeFragmentFaultProbes(
            PROGRAM,
            {
              observationStdDev:
                0.02,
            },
          );

        const yProbe =
          probes.find(
            (probe) =>
              probe.id ===
              "fault-probe:y",
          );

        expect(
          yProbe,
        ).toBeDefined();

        expect(
          expectedProbeInformationGainForAdaptiveFaults(
            posterior,
            yProbe!,
          ),
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "chooses diagnosis while fault-model uncertainty remains and information value is positive",
      () => {
        const belief =
          faultPosterior()
            .getBelief();

        const decision =
          chooseAdaptiveFaultRepairAction(
            belief,
            undefined,
            false,
            {
              diagnosticExpectedInformationGain:
                0.5,

              diagnosticCost:
                0.05,

              diagnosticRisk:
                0.05,

              validationExpectedInformationGain:
                0.1,

              validationCost:
                0.1,

              validationRisk:
                0.1,
            },
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "diagnose",

          reason:
            "fault-uncertainty-favors-diagnosis",
        });
      },
    );

    it(
      "resolves the non-fixed 0.40 and 0.70 fault magnitudes after stronger diagnostics",
      () => {
        const belief =
          resolvedFaultPosterior()
            .getBelief();

        expect(
          belief,
        ).toMatchObject({
          topScales: {
            [
              Y_FRAGMENT.id
            ]:
              0.4,

            [
              Z_FRAGMENT.id
            ]:
              0.7,
          },

          sufficientlyResolved:
            true,
        });

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.9,
        );
      },
    );

    it(
      "keeps several repair candidates alive before repair-selection evidence arrives",
      () => {
        const posterior =
          repairPosterior();

        const belief =
          posterior.getBelief();

        expect(
          posterior
            .getCandidates()
            .length,
        ).toBeGreaterThan(
          2,
        );

        expect(
          belief
            .sufficientlyResolved,
        ).toBe(
          false,
        );
      },
    );

    it(
      "chooses validation after fault resolution while repair identity remains uncertain",
      () => {
        const faultBelief =
          resolvedFaultPosterior()
            .getBelief();

        const repairBelief =
          repairPosterior()
            .getBelief();

        const decision =
          chooseAdaptiveFaultRepairAction(
            faultBelief,
            repairBelief,
            false,
            {
              validationExpectedInformationGain:
                0.5,

              validationCost:
                0.05,

              validationRisk:
                0.05,
            },
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "validate",

          reason:
            "repair-uncertainty-favors-validation",
        });
      },
    );

    it(
      "concentrates repair belief on the evidence-derived 0.40 and 0.70 candidate",
      () => {
        const posterior =
          resolvedRepairPosterior();

        const belief =
          posterior.getBelief();

        const top =
          posterior
            .getCandidates()
            .find(
              (candidate) =>
                candidate.id ===
                belief.topCandidateId,
            );

        expect(
          belief
            .sufficientlyResolved,
        ).toBe(
          true,
        );

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.9,
        );

        expect(
          top
            ?.replacementFragmentIds,
        ).toMatchObject({
          [
            Y_FRAGMENT.id
          ]:
            "rev-y:program-y-fragment:adaptive-scale-0.400",

          [
            Z_FRAGMENT.id
          ]:
            "rev-z:program-z-fragment:adaptive-scale-0.700",
        });
      },
    );

    it(
      "keeps candidate-selection evidence disjoint from the final protected reserve",
      () => {
        const posterior =
          resolvedRepairPosterior();

        expect(
          () =>
            validateAdaptiveRepairPosterior(
              lineage(),
              PROGRAM,
              posterior,
              [
                ...MAGNITUDE_EVIDENCE,
                ...REPAIR_SELECTION_EVIDENCE,
              ],
              DIAGNOSTIC_EVIDENCE,
              [
                REPAIR_SELECTION_EVIDENCE[
                  0
                ]!,
                ...PROTECTED_EVIDENCE.slice(
                  1,
                ),
              ],
              posterior
                .getBelief()
                .normalizedEntropy,
            ),
        ).toThrow(
          "Adaptive discovery, diagnostic, and protected evidence must remain disjoint.",
        );
      },
    );

    it(
      "requires a complete adaptive protected reserve before authorizing the selected repair",
      () => {
        const posterior =
          resolvedRepairPosterior();

        const selectionEvidence = [
          ...MAGNITUDE_EVIDENCE,
          ...REPAIR_SELECTION_EVIDENCE,
        ];

        const shortDecision =
          validateAdaptiveRepairPosterior(
            lineage(),
            PROGRAM,
            posterior,
            selectionEvidence,
            DIAGNOSTIC_EVIDENCE,
            PROTECTED_EVIDENCE.slice(
              0,
              3,
            ),
            posterior
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
          validateAdaptiveRepairPosterior(
            lineage(),
            PROGRAM,
            posterior,
            selectionEvidence,
            DIAGNOSTIC_EVIDENCE,
            PROTECTED_EVIDENCE,
            posterior
              .getBelief()
              .normalizedEntropy,
          );

        expect(
          fullDecision,
        ).toMatchObject({
          decision:
            "installed",

          candidateProtectedMeanSquaredError:
            0,

          reason:
            "protected-local-repair-selected",
        });
      },
    );

    it(
      "moves from protected validation to repair only after candidate belief and reserve are ready",
      () => {
        const faultBelief =
          resolvedFaultPosterior()
            .getBelief();

        const repairBelief =
          resolvedRepairPosterior()
            .getBelief();

        const beforeProtected =
          chooseAdaptiveFaultRepairAction(
            faultBelief,
            repairBelief,
            false,
            {
              validationExpectedInformationGain:
                0.2,

              validationCost:
                0.05,

              validationRisk:
                0.05,
            },
          );

        const afterProtected =
          chooseAdaptiveFaultRepairAction(
            faultBelief,
            repairBelief,
            true,
          );

        expect(
          beforeProtected.decision,
        ).toBe(
          "validate",
        );

        expect(
          afterProtected,
        ).toMatchObject({
          decision:
            "repair",

          reason:
            "protected-repair-ready",
        });
      },
    );

    it(
      "installs the protected adaptive repair and feeds it into live receding control",
      () => {
        const repair =
          resolvedRepairPosterior();

        const protectedDecision =
          validateAdaptiveRepairPosterior(
            lineage(),
            PROGRAM,
            repair,
            [
              ...MAGNITUDE_EVIDENCE,
              ...REPAIR_SELECTION_EVIDENCE,
            ],
            DIAGNOSTIC_EVIDENCE,
            PROTECTED_EVIDENCE,
            repair
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
          "finish",
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
                  1,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  1,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "adaptive-fault-terminal",
            "rev-adaptive-repair",
            1,
            repair
              .getBelief()
              .normalizedEntropy,
            provenance(),
          );

        expect(
          installation,
        ).toMatchObject({
          decision:
            "installed",

          lineage: {
            activeRevisionId:
              "rev-adaptive-repair",
          },

          revisedPlan: {
            actionIds: [
              "boost-finish",
            ],
          },

          goalRevision: {
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
            0.47,

          "boost-finish":
            0.59,
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
            "boost-finish",

          reason:
            "direct-action-best",
        });
      },
    );
  },
);

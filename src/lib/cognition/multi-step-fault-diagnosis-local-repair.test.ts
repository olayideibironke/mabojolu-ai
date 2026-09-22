import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BoundedMultiFaultPosterior,
  conditionBoundedFaultPosterior,
  installProbabilisticLocalRepair,
  planMultiStepFaultDiagnosis,
  runControlledMultiStepFaultDiagnosis,
  searchProbabilisticLocalRepairs,
  validateProbabilisticLocalRepairSearch,
} from "./multi-step-fault-diagnosis-local-repair";

import {
  CompositeFragmentMonitor,
} from "./selective-composite-fragment-maintenance";

import {
  initializeFragmentProvenance,
  synthesizeFragmentFaultProbes,
} from "./active-fragment-fault-localization-provenance";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

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

const REPAIR_Y =
  linearFragment(
    "repair-y-0.15",
    "y",
    0.15,
  );

const REPAIR_Y_ALT =
  linearFragment(
    "repair-y-0.3",
    "y",
    0.3,
  );

const REPAIR_Z =
  linearFragment(
    "repair-z-0.125",
    "z",
    0.125,
  );

const REPAIR_Z_ALT =
  linearFragment(
    "repair-z-0.25",
    "z",
    0.25,
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "multi-fault-composite",

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

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "multi-fault-actual",

  fragments: [
    REPAIR_Y,
    REPAIR_Z,
  ],
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
    "hypothesis:multi-fault-composite",

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
      0.25,
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

const INITIAL_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "passive-y-half",
      0.5,
      0,
      0.075,
    ),
    observation(
      "passive-z-half",
      0,
      0.5,
      0.0625,
    ),
  ];

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "repair-y",
      1,
      0,
      0.15,
    ),
    observation(
      "repair-z",
      0,
      1,
      0.125,
    ),
    observation(
      "repair-joint",
      1,
      1,
      0.275,
    ),
    observation(
      "repair-half-joint",
      0.5,
      1,
      0.2,
    ),
  ];

const PROTECTED_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-y",
      1,
      0,
      0.15,
    ),
    observation(
      "protected-z",
      0,
      1,
      0.125,
    ),
    observation(
      "protected-joint",
      1,
      1,
      0.275,
    ),
    observation(
      "protected-half-joint",
      0.5,
      1,
      0.2,
    ),
  ];

function lineage() {
  return createRevisionLineage(
    "rev-composite",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "install-multi-a",
      "install-multi-b",
      "install-multi-c",
      "install-multi-d",
    ],
    0.2,
    4,
  );
}

function probes() {
  return synthesizeFragmentFaultProbes(
    PROGRAM,
    {
      riskByVariable: {
        y:
          0.1,
        z:
          0.05,
      },

      costByVariable: {
        y:
          0.05,
        z:
          0.03,
      },

      observationStdDev:
        0.15,
    },
  );
}

function monitorAfterDiagnosis(
  diagnosis:
    ReturnType<
      typeof runControlledMultiStepFaultDiagnosis
    >,
) {
  const monitor =
    new CompositeFragmentMonitor(
      PROGRAM,
    );

  for (
    const item of
      INITIAL_EVIDENCE
  ) {
    monitor.record(
      item,
    );
  }

  for (
    const item of
      diagnosis.acquiredObservations
  ) {
    monitor.record(
      item,
    );
  }

  return monitor;
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
      "Expected v1.30 incumbent plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T12:05:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "multi-fault-terminal",

    description:
      "Reach progress >= 0.250 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.250",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve bounded fault uncertainty before repair search.",
      "Protect repair search with fresh validation evidence.",
    ],

    createdAt:
      "2026-09-22T12:05:00Z",

    updatedAt:
      "2026-09-22T12:05:00Z",
  });

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "multi-fault-terminal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

describe(
  "bounded multi-fragment fault diagnosis",
  () => {
    it(
      "represents no-fault, both single faults, and the bounded two-fragment fault",
      () => {
        const posterior =
          new BoundedMultiFaultPosterior(
            PROGRAM,
            {
              maximumFaultFragments:
                2,

              faultScale:
                0.25,
            },
          );

        expect(
          posterior
            .getExplanations()
            .map(
              (explanation) => ({
                id:
                  explanation.id,

                kind:
                  explanation.kind,
              }),
            ),
        ).toEqual([
          {
            id:
              "fault:none",

            kind:
              "no-fault",
          },
          {
            id:
              "fault:rev-y:program-y-fragment",

            kind:
              "single-fragment",
          },
          {
            id:
              "fault:rev-z:program-z-fragment",

            kind:
              "single-fragment",
          },
          {
            id:
              "fault:rev-y:program-y-fragment+rev-z:program-z-fragment",

            kind:
              "multi-fragment",
          },
        ]);
      },
    );

    it(
      "keeps the two-fragment explanation unresolved after passive evidence",
      () => {
        const posterior =
          new BoundedMultiFaultPosterior(
            PROGRAM,
            {
              faultScale:
                0.25,
            },
          );

        const belief =
          conditionBoundedFaultPosterior(
            posterior,
            INITIAL_EVIDENCE,
            0.15,
          );

        expect(
          belief,
        ).toMatchObject({
          topKind:
            "multi-fragment",

          topFragmentIds: [
            "rev-y:program-y-fragment",
            "rev-z:program-z-fragment",
          ],

          sufficientlyResolved:
            false,
        });

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.5,
        );

        expect(
          belief.confidence,
        ).toBeLessThan(
          0.95,
        );
      },
    );

    it(
      "values a contingent two-step diagnostic policy above a one-step policy",
      () => {
        const posterior =
          new BoundedMultiFaultPosterior(
            PROGRAM,
            {
              faultScale:
                0.25,
            },
          );

        conditionBoundedFaultPosterior(
          posterior,
          INITIAL_EVIDENCE,
          0.15,
        );

        const oneStep =
          planMultiStepFaultDiagnosis(
            posterior,
            probes(),
            1,
          );

        const twoStep =
          planMultiStepFaultDiagnosis(
            posterior,
            probes(),
            2,
          );

        expect(
          oneStep.decision,
        ).toBe(
          "plan",
        );

        expect(
          twoStep,
        ).toMatchObject({
          decision:
            "plan",

          firstProbe: {
            id:
              "fault-probe:y",
          },

          reason:
            "safe-contingent-fault-diagnostic-plan",
        });

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
                branch
                  .secondProbeId ===
                "fault-probe:z",
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "resolves the bounded two-fragment fault only after the second diagnostic step",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,

              observationStdDev:
                0.15,
            },
          );

        expect(
          diagnosis,
        ).toMatchObject({
          decision:
            "resolved",

          reason:
            "bounded-fault-posterior-resolved",
        });

        expect(
          diagnosis.steps,
        ).toHaveLength(
          2,
        );

        expect(
          diagnosis.steps[
            0
          ],
        ).toMatchObject({
          probeId:
            "fault-probe:y",

          observedEffect:
            0.15,
        });

        expect(
          diagnosis.steps[
            0
          ]!
            .belief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          diagnosis.steps[
            1
          ],
        ).toMatchObject({
          probeId:
            "fault-probe:z",

          observedEffect:
            0.125,
        });

        expect(
          diagnosis.finalBelief,
        ).toMatchObject({
          topKind:
            "multi-fragment",

          topFragmentIds: [
            "rev-y:program-y-fragment",
            "rev-z:program-z-fragment",
          ],

          sufficientlyResolved:
            true,
        });

        expect(
          diagnosis
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );

    it(
      "abstains when no diagnostic probe satisfies the external risk ceiling",
      () => {
        const unsafe =
          synthesizeFragmentFaultProbes(
            PROGRAM,
            {
              defaultRisk:
                0.9,

              observationStdDev:
                0.15,
            },
          );

        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            unsafe,
            {
              maximumSteps:
                2,

              maximumRisk:
                0.3,

              faultScale:
                0.25,
            },
          );

        expect(
          diagnosis,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-contingent-fault-plan",
        });
      },
    );

    it(
      "can retain the incumbent when a resolved posterior supports no fault",
      () => {
        const posterior =
          new BoundedMultiFaultPosterior(
            PROGRAM,
            {
              faultScale:
                0.25,

              sufficientConfidence:
                0.9,
            },
          );

        const belief =
          conditionBoundedFaultPosterior(
            posterior,
            [
              observation(
                "no-fault-y",
                1,
                0,
                0.6,
              ),
              observation(
                "no-fault-z",
                0,
                1,
                0.5,
              ),
            ],
            0.05,
          );

        expect(
          belief,
        ).toMatchObject({
          topKind:
            "no-fault",

          sufficientlyResolved:
            true,
        });

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            belief,
            {
              fragments:
                [],

              quarantinedFragmentIds:
                [],
            },
            [
              REPAIR_Y,
              REPAIR_Z,
            ],
            REPAIR_EVIDENCE,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "retain-no-fault",

          reason:
            "no-fault-posterior-retains-incumbent",
        });
      },
    );
  },
);

describe(
  "probabilistic local repair search",
  () => {
    it(
      "does not open repair search before the fault posterior is resolved",
      () => {
        const posterior =
          new BoundedMultiFaultPosterior(
            PROGRAM,
            {
              faultScale:
                0.25,
            },
          );

        const belief =
          conditionBoundedFaultPosterior(
            posterior,
            INITIAL_EVIDENCE,
            0.15,
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            belief,
            {
              fragments:
                [],

              quarantinedFragmentIds: [
                Y_FRAGMENT.id,
                Z_FRAGMENT.id,
              ],
            },
            [
              REPAIR_Y,
              REPAIR_Z,
            ],
            REPAIR_EVIDENCE,
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
      "does not let resolved fault probability bypass repeated-blame quarantine",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            {
              fragments:
                [],

              quarantinedFragmentIds: [
                Y_FRAGMENT.id,
              ],
            },
            [
              REPAIR_Y,
              REPAIR_Z,
            ],
            REPAIR_EVIDENCE,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "fault-fragments-not-quarantined",
        });
      },
    );

    it(
      "searches combinations of same-topology local repairs only after both damaged fragments are quarantined",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const monitor =
          monitorAfterDiagnosis(
            diagnosis,
          );

        expect(
          monitor
            .getReliability()
            .quarantinedFragmentIds,
        ).toEqual([
          "rev-y:program-y-fragment",
          "rev-z:program-z-fragment",
        ]);

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            monitor
              .getReliability(),
            [
              REPAIR_Y,
              REPAIR_Y_ALT,
              REPAIR_Z,
              REPAIR_Z_ALT,
            ],
            REPAIR_EVIDENCE,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "search",

          faultExplanation: {
            kind:
              "multi-fragment",
          },

          selectedCandidate: {
            replacementFragmentIds: {
              "rev-y:program-y-fragment":
                "repair-y-0.15",

              "rev-z:program-z-fragment":
                "repair-z-0.125",
            },

            discoveryMeanSquaredError:
              0,
          },

          reason:
            "fault-posterior-authorized-local-repair-search",
        });

        expect(
          search.candidates.length,
        ).toBeGreaterThan(
          4,
        );
      },
    );

    it(
      "keeps repair-search evidence disjoint from protected validation",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const monitor =
          monitorAfterDiagnosis(
            diagnosis,
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            monitor
              .getReliability(),
            [
              REPAIR_Y,
              REPAIR_Z,
            ],
            REPAIR_EVIDENCE,
          );

        expect(
          () =>
            validateProbabilisticLocalRepairSearch(
              lineage(),
              PROGRAM,
              search,
              [
                REPAIR_EVIDENCE[
                  0
                ]!,
                ...PROTECTED_EVIDENCE.slice(
                  1,
                ),
              ],
              [
                ...INITIAL_EVIDENCE.map(
                  (item) =>
                    item
                      .experiment
                      .id,
                ),
                ...diagnosis
                  .acquiredObservations
                  .map(
                    (item) =>
                      item
                        .experiment
                        .id,
                  ),
              ],
              diagnosis
                .finalBelief
                .normalizedEntropy,
            ),
        ).toThrow(
          "Local repair search, diagnostic, and protected evidence must remain disjoint.",
        );
      },
    );

    it(
      "requires the discovery-selected repair combination to remain best on fresh protected evidence",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const monitor =
          monitorAfterDiagnosis(
            diagnosis,
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            monitor
              .getReliability(),
            [
              REPAIR_Y,
              REPAIR_Y_ALT,
              REPAIR_Z,
              REPAIR_Z_ALT,
            ],
            REPAIR_EVIDENCE,
          );

        const conflictingProtected = [
          observation(
            "conflict-y",
            1,
            0,
            0.3,
          ),
          observation(
            "conflict-z",
            0,
            1,
            0.25,
          ),
          observation(
            "conflict-joint",
            1,
            1,
            0.55,
          ),
          observation(
            "conflict-half",
            0.5,
            1,
            0.4,
          ),
        ];

        const decision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            conflictingProtected,
            [
              ...INITIAL_EVIDENCE.map(
                (item) =>
                  item
                    .experiment
                    .id,
              ),
              ...diagnosis
                .acquiredObservations
                .map(
                  (item) =>
                    item
                      .experiment
                      .id,
                ),
            ],
            diagnosis
              .finalBelief
              .normalizedEntropy,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "retained",

          reason:
            "repair-search-selection-not-protected",
        });
      },
    );

    it(
      "installs the protected multi-fragment repair only after the adaptive reserve is sufficient",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const monitor =
          monitorAfterDiagnosis(
            diagnosis,
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            monitor
              .getReliability(),
            [
              REPAIR_Y,
              REPAIR_Y_ALT,
              REPAIR_Z,
              REPAIR_Z_ALT,
            ],
            REPAIR_EVIDENCE,
          );

        const shortDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED_EVIDENCE.slice(
              0,
              3,
            ),
            [
              ...INITIAL_EVIDENCE.map(
                (item) =>
                  item
                    .experiment
                    .id,
              ),
              ...diagnosis
                .acquiredObservations
                .map(
                  (item) =>
                    item
                      .experiment
                      .id,
                ),
            ],
            diagnosis
              .finalBelief
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

        const protectedDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED_EVIDENCE,
            [
              ...INITIAL_EVIDENCE.map(
                (item) =>
                  item
                    .experiment
                    .id,
              ),
              ...diagnosis
                .acquiredObservations
                .map(
                  (item) =>
                    item
                      .experiment
                      .id,
                ),
            ],
            diagnosis
              .finalBelief
              .normalizedEntropy,
          );

        expect(
          protectedDecision,
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
      "installs the protected repair, advances both fragment provenances, and changes live control",
      () => {
        const diagnosis =
          runControlledMultiStepFaultDiagnosis(
            PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_EVIDENCE,
            probes(),
            {
              maximumSteps:
                2,

              faultScale:
                0.25,
            },
          );

        const monitor =
          monitorAfterDiagnosis(
            diagnosis,
          );

        const search =
          searchProbabilisticLocalRepairs(
            PROGRAM,
            diagnosis
              .finalBelief,
            monitor
              .getReliability(),
            [
              REPAIR_Y,
              REPAIR_Y_ALT,
              REPAIR_Z,
              REPAIR_Z_ALT,
            ],
            REPAIR_EVIDENCE,
          );

        const protectedDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED_EVIDENCE,
            [
              ...INITIAL_EVIDENCE.map(
                (item) =>
                  item
                    .experiment
                    .id,
              ),
              ...diagnosis
                .acquiredObservations
                .map(
                  (item) =>
                    item
                      .experiment
                      .id,
                ),
            ],
            diagnosis
              .finalBelief
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

        const installed =
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
            "multi-fault-terminal",
            "rev-multi-repaired",
            1,
            diagnosis
              .finalBelief
              .normalizedEntropy,
            provenance(),
          );

        expect(
          installed,
        ).toMatchObject({
          decision:
            "installed",

          lineage: {
            activeRevisionId:
              "rev-multi-repaired",
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
          installed
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.2,

          "boost-finish":
            0.275,
        });

        const y =
          installed
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                Y_FRAGMENT.id,
            );

        const z =
          installed
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
          activeFragmentId:
            "repair-y-0.15",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          activeFragmentId:
            "repair-z-0.125",

          generation:
            1,
        });

        const controller =
          createRecedingVectorController(
            STATE,
            installed
              .catalogRevision!
              .belief
              .probabilities,
          );

        const next =
          chooseRecedingHorizonVectorControl(
            installed
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

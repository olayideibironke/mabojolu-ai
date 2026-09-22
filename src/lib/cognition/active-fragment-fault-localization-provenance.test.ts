import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProbabilisticFragmentFaultLocalizer,
  conditionFaultPosteriorOnEvidence,
  initializeFragmentProvenance,
  runControlledLocalizedCompositeMaintenance,
  runControlledFragmentFaultLocalization,
  synthesizeFragmentFaultProbes,
  updateFragmentProvenanceAfterMaintenance,
} from "./active-fragment-fault-localization-provenance";

import {
  CompositeFragmentMonitor,
  maintainCompositeRevisionSelectively,
} from "./selective-composite-fragment-maintenance";

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

const REPAIR_Z =
  linearFragment(
    "repair-z-0.2",
    "z",
    0.2,
  );

const COMPOSITE_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "fault-localization-composite",

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
  ...COMPOSITE_PROGRAM,

  id:
    "fault-localization-actual",

  fragments: [
    Y_FRAGMENT,
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

const ACTIVE_HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:fault-localization-composite",

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
      0.75,
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

const INITIAL_MONITORING:
  readonly StructuralMechanismObservation[] = [
    observation(
      "passive-z-half",
      0,
      0.5,
      0.1,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "fault-protected-y",
      1,
      0,
      0.6,
    ),
    observation(
      "fault-protected-z",
      0,
      1,
      0.2,
    ),
    observation(
      "fault-protected-joint",
      1,
      1,
      0.8,
    ),
    observation(
      "fault-protected-half-joint",
      0.5,
      1,
      0.5,
    ),
  ];

function lineage() {
  return createRevisionLineage(
    "rev-composite",
    COMPOSITE_PROGRAM,
    ACTIVE_HYPOTHESIS,
    PREREQUISITE,
    [
      "install-fault-a",
      "install-fault-b",
      "install-fault-c",
      "install-fault-d",
    ],
    0.2,
    4,
  );
}

function provenance() {
  return initializeFragmentProvenance(
    "rev-composite",
    COMPOSITE_PROGRAM,
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

function probes() {
  return synthesizeFragmentFaultProbes(
    COMPOSITE_PROGRAM,
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
        0.1,
    },
  );
}

function reasonerAndPlan() {
  const plan =
    buildPlanForLiveHypothesis(
      ACTIVE_HYPOTHESIS,
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
      "Expected active fault localization incumbent plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T11:35:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "fault-localization-terminal",

    description:
      "Reach progress >= 0.750 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.750",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve fragment fault uncertainty before local repair.",
      "Preserve healthy fragment provenance.",
    ],

    createdAt:
      "2026-09-22T11:35:00Z",

    updatedAt:
      "2026-09-22T11:35:00Z",
  });

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "fault-localization-terminal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

describe(
  "active causal fragment fault localization",
  () => {
    it(
      "conditions on passive evidence without prematurely resolving which fragment failed",
      () => {
        const localizer =
          new ProbabilisticFragmentFaultLocalizer(
            COMPOSITE_PROGRAM,
          );

        const belief =
          conditionFaultPosteriorOnEvidence(
            localizer,
            INITIAL_MONITORING,
            0.1,
          );

        expect(
          belief
            .topFragmentId,
        ).toBe(
          Z_FRAGMENT.id,
        );

        expect(
          belief
            .confidence,
        ).toBeGreaterThan(
          0.6,
        );

        expect(
          belief
            .confidence,
        ).toBeLessThan(
          0.95,
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
      "synthesizes unit-bounded fragment diagnostic probes with variable-specific risk and cost",
      () => {
        expect(
          probes(),
        ).toEqual([
          {
            id:
              "fault-probe:y",

            interventions: {
              y:
                1,

              z:
                0,
            },

            risk:
              0.1,

            cost:
              0.05,

            reversible:
              true,

            observationStdDev:
              0.1,
          },
          {
            id:
              "fault-probe:z",

            interventions: {
              y:
                0,

              z:
                1,
            },

            risk:
              0.05,

            cost:
              0.03,

            reversible:
              true,

            observationStdDev:
              0.1,
          },
        ]);
      },
    );

    it(
      "chooses the lower-risk informative z probe from the ambiguous posterior",
      () => {
        const localizer =
          new ProbabilisticFragmentFaultLocalizer(
            COMPOSITE_PROGRAM,
          );

        conditionFaultPosteriorOnEvidence(
          localizer,
          INITIAL_MONITORING,
          0.1,
        );

        const choice =
          localizer.chooseProbe(
            probes(),
          );

        expect(
          choice,
        ).toMatchObject({
          decision:
            "probe",

          probe: {
            id:
              "fault-probe:z",

            risk:
              0.05,
          },

          reason:
            "safe-fault-localization-probe",
        });

        expect(
          choice
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.1,
        );
      },
    );

    it(
      "resolves the z fault only after the selected diagnostic outcome arrives",
      () => {
        const result =
          runControlledFragmentFaultLocalization(
            COMPOSITE_PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_MONITORING,
            probes(),
            {
              maximumSteps:
                1,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "resolved",

          selectedFragmentId:
            "rev-z:program-z-fragment",

          reason:
            "fragment-fault-posterior-resolved",
        });

        expect(
          result
            .acquiredObservations,
        ).toHaveLength(
          1,
        );

        expect(
          result
            .steps[
              0
            ],
        ).toMatchObject({
          probeId:
            "fault-probe:z",

          observedEffect:
            0.2,
        });

        expect(
          result
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );

    it(
      "abstains when every diagnostic probe violates the external risk ceiling",
      () => {
        const unsafe =
          synthesizeFragmentFaultProbes(
            COMPOSITE_PROGRAM,
            {
              defaultRisk:
                0.9,

              observationStdDev:
                0.1,
            },
          );

        const result =
          runControlledFragmentFaultLocalization(
            COMPOSITE_PROGRAM,
            ACTUAL_PROGRAM,
            INITIAL_MONITORING,
            unsafe,
            {
              maximumSteps:
                1,

              maximumRisk:
                0.3,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-informative-fault-probe",
        });
      },
    );
  },
);

describe(
  "fragment-specific provenance",
  () => {
    it(
      "records explicit historical origin for every inherited composite fragment",
      () => {
        const ledger =
          provenance();

        expect(
          ledger.records,
        ).toMatchObject([
          {
            logicalFragmentId:
              "rev-y:program-y-fragment",

            originRevisionId:
              "rev-y",

            originFragmentId:
              "program-y-fragment",

            currentRevisionId:
              "rev-composite",

            activeFragmentId:
              "rev-y:program-y-fragment",

            status:
              "active",
          },
          {
            logicalFragmentId:
              "rev-z:program-z-fragment",

            originRevisionId:
              "rev-z",

            originFragmentId:
              "program-z-fragment",

            currentRevisionId:
              "rev-composite",

            activeFragmentId:
              "rev-z:program-z-fragment",

            status:
              "active",
          },
        ]);
      },
    );

    it(
      "does not launch local maintenance when localization remains unresolved",
      () => {
        const {
          reasoner,
          plan,
        } =
          reasonerAndPlan();

        const result =
          runControlledLocalizedCompositeMaintenance(
            lineage(),
            ACTUAL_PROGRAM,
            [],
            [],
            [
              REPAIR_Z,
            ],
            PROTECTED,
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
            "fault-localization-terminal",
            "rev-localized-maintenance",
            1,
            provenance(),
            {
              maximumSteps:
                1,
            },
          );

        expect(
          result,
        ).toMatchObject({
          reason:
            "fault-localization-unresolved",

          provenance: {
            records: [
              {
                generation:
                  0,
              },
              {
                generation:
                  0,
              },
            ],
          },
        });

        expect(
          result.maintenance,
        ).toBeUndefined();
      },
    );

    it(
      "localizes z, satisfies repeated-blame quarantine, and installs only the local z repair",
      () => {
        const {
          reasoner,
          plan,
        } =
          reasonerAndPlan();

        const result =
          runControlledLocalizedCompositeMaintenance(
            lineage(),
            ACTUAL_PROGRAM,
            INITIAL_MONITORING,
            probes(),
            [
              REPAIR_Z,
            ],
            PROTECTED,
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
            "fault-localization-terminal",
            "rev-localized-maintenance",
            1,
            provenance(),
            {
              maximumSteps:
                1,
            },
          );

        expect(
          result,
        ).toMatchObject({
          reason:
            "localized-fragment-maintained",

          localization: {
            selectedFragmentId:
              "rev-z:program-z-fragment",
          },

          maintenance: {
            decision:
              "repaired",

            preservedFragmentIds: [
              "rev-y:program-y-fragment",
            ],

            replacementFragmentIds: {
              "rev-z:program-z-fragment":
                "repair-z-0.2",
            },
          },
        });
      },
    );

    it(
      "preserves y provenance while advancing z provenance through a protected repair generation",
      () => {
        const {
          reasoner,
          plan,
        } =
          reasonerAndPlan();

        const result =
          runControlledLocalizedCompositeMaintenance(
            lineage(),
            ACTUAL_PROGRAM,
            INITIAL_MONITORING,
            probes(),
            [
              REPAIR_Z,
            ],
            PROTECTED,
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
            "fault-localization-terminal",
            "rev-localized-maintenance",
            1,
            provenance(),
            {
              maximumSteps:
                1,
            },
          );

        const y =
          result
            .provenance
            .records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                Y_FRAGMENT.id,
            );

        const z =
          result
            .provenance
            .records
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
            "rev-y:program-y-fragment",

          currentRevisionId:
            "rev-localized-maintenance",

          generation:
            1,

          status:
            "active",
        });

        expect(
          y
            ?.history[
              1
            ],
        ).toMatchObject({
          kind:
            "preserved",

          revisionId:
            "rev-localized-maintenance",
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          originFragmentId:
            "program-z-fragment",

          activeFragmentId:
            "repair-z-0.2",

          currentRevisionId:
            "rev-localized-maintenance",

          generation:
            1,

          status:
            "active",
        });

        expect(
          z
            ?.history[
              1
            ],
        ).toMatchObject({
          kind:
            "repaired",

          fromFragmentId:
            "rev-z:program-z-fragment",

          toFragmentId:
            "repair-z-0.2",

          protectedEvidenceIds: [
            "fault-protected-half-joint",
            "fault-protected-joint",
            "fault-protected-y",
            "fault-protected-z",
          ],
        });
      },
    );

    it(
      "records fragment-only rollback as retirement in provenance",
      () => {
        const monitor =
          new CompositeFragmentMonitor(
            COMPOSITE_PROGRAM,
          );

        monitor.record(
          observation(
            "rollback-monitor-z-1",
            0,
            1,
            0,
          ),
        );

        monitor.record(
          observation(
            "rollback-monitor-z-2",
            0,
            0.5,
            0,
          ),
        );

        const rollbackProtected = [
          observation(
            "rollback-protected-y",
            1,
            0,
            0.6,
          ),
          observation(
            "rollback-protected-z",
            0,
            1,
            0,
          ),
          observation(
            "rollback-protected-joint",
            1,
            1,
            0.6,
          ),
          observation(
            "rollback-protected-half",
            0.5,
            1,
            0.3,
          ),
        ];

        const rollbackGoal = {
          minimums: {
            progress:
              0.6,
          },

          maximums: {
            exposure:
              0.3,
          },
        };

        const rollbackPlan =
          buildPlanForLiveHypothesis(
            ACTIVE_HYPOTHESIS,
            STATE,
            rollbackGoal,
            ACTIONS,
            PREREQUISITE,
          );

        if (
          rollbackPlan.decision !==
            "planned"
        ) {
          throw new Error(
            "Expected provenance rollback incumbent plan.",
          );
        }

        let tick =
          0;

        const reasoner =
          new HierarchicalGoalReasoner(
            () =>
              `2026-09-22T11:40:${String(
                tick++,
              ).padStart(
                2,
                "0",
              )}Z`,
          );

        reasoner.registerRoot({
          id:
            "provenance-rollback-terminal",

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
            "Preserve healthy fragment provenance.",
          ],

          createdAt:
            "2026-09-22T11:40:00Z",

          updatedAt:
            "2026-09-22T11:40:00Z",
        });

        materializePrerequisiteAwareSubgoals(
          reasoner,
          "provenance-rollback-terminal",
          rollbackPlan,
        );

        const maintenance =
          maintainCompositeRevisionSelectively(
            lineage(),
            monitor,
            [],
            rollbackProtected,
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
            rollbackGoal,
            ACTIONS,
            rollbackPlan,
            reasoner,
            "provenance-rollback-terminal",
            "rev-fragment-rollback",
            1,
          );

        expect(
          maintenance.decision,
        ).toBe(
          "rolled-back-fragment",
        );

        const updated =
          updateFragmentProvenanceAfterMaintenance(
            provenance(),
            maintenance,
            "rev-fragment-rollback",
          );

        const z =
          updated.records.find(
            (record) =>
              record
                .logicalFragmentId ===
              Z_FRAGMENT.id,
          );

        expect(
          z,
        ).toMatchObject({
          activeFragmentId:
            undefined,

          status:
            "retired",

          generation:
            1,
        });

        expect(
          z
            ?.history[
              1
            ],
        ).toMatchObject({
          kind:
            "rolled-back",

          fromFragmentId:
            "rev-z:program-z-fragment",
        });
      },
    );

    it(
      "feeds the localized maintained composite into receding-horizon control",
      () => {
        const {
          reasoner,
          plan,
        } =
          reasonerAndPlan();

        const result =
          runControlledLocalizedCompositeMaintenance(
            lineage(),
            ACTUAL_PROGRAM,
            INITIAL_MONITORING,
            probes(),
            [
              REPAIR_Z,
            ],
            PROTECTED,
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
            "fault-localization-terminal",
            "rev-localized-maintenance",
            1,
            provenance(),
            {
              maximumSteps:
                1,
            },
          );

        const controller =
          createRecedingVectorController(
            STATE,
            result
              .maintenance!
              .catalogRevision!
              .belief
              .probabilities,
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            result
              .maintenance!
              .catalogRevision!
              .hypotheses,
            controller,
            GOAL,
            ACTIONS,
            [],
          );

        expect(
          decision,
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

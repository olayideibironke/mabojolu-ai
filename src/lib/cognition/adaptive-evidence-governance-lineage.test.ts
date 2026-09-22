import {
  describe,
  expect,
  it,
} from "vitest";

import {
  activateRevisionLineageSelection,
  appendInstalledRevision,
  assessAdaptiveProtectedEvidence,
  createRevisionLineage,
  deriveAdaptiveEvidenceRequirement,
  evaluateRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  buildPlanForLiveHypothesis,
} from "./online-belief-model-coevolution";

import {
  materializePrerequisiteAwareSubgoals,
  revisePrerequisiteAwareGoalChain,
  type LearnedActionPrerequisite,
  type PrerequisiteAwarePlan,
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

function fragment(
  id: string,
  kind:
    | "linear"
    | "interaction",
  variables: string[],
  coefficient: number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        id:
          `${kind}(${variables.join(",")})`,

        kind,

        variables,

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
  term:
    | {
        kind:
          "linear";
        variables:
          string[];
        coefficient:
          number;
      }
    | {
        kind:
          "interaction";
        variables:
          string[];
        coefficient:
          number;
      },
  complexity: number,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      y:
        0.1,
      z:
        0.1,
    },

    fragments: [
      fragment(
        `${id}-fragment`,
        term.kind,
        term.variables,
        term.coefficient,
      ),
    ],

    observationStdDev:
      0.05,

    depth:
      2,

    complexity,
  };
}

const PROGRAM_0 =
  program(
    "program-0",
    {
      kind:
        "linear",

      variables: [
        "y",
      ],

      coefficient:
        0.6,
    },
    1,
  );

const PROGRAM_1 =
  program(
    "program-1",
    {
      kind:
        "interaction",

      variables: [
        "y",
        "z",
      ],

      coefficient:
        0.5,
    },
    2,
  );

const PROGRAM_2 =
  program(
    "program-2",
    {
      kind:
        "interaction",

      variables: [
        "y",
        "z",
      ],

      coefficient:
        0.9,
    },
    4,
  );

const PREREQUISITE_0:
  LearnedActionPrerequisite = {
  actionId:
    "finish",

  targetDimension:
    "progress",

  stateDimension:
    "readiness",

  threshold:
    0.35,

  inactiveMeanEffect:
    0.02,

  activeMeanEffect:
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    4,
};

const PREREQUISITE_1:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_0,

  threshold:
    0.7,
};

const PREREQUISITE_2:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_0,

  threshold:
    0.9,
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
        "prep-ultra":
          1,
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
        "prep-ultra":
          0.15,
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

const HYPOTHESIS_0 =
  hypothesis(
    "hypothesis-0",
    "revision-0-linear",
    PREREQUISITE_0,
    0.8,
  );

const HYPOTHESIS_1 =
  hypothesis(
    "hypothesis-1",
    "revision-1-interaction",
    PREREQUISITE_1,
    0.7,
  );

const HYPOTHESIS_2 =
  hypothesis(
    "hypothesis-2",
    "revision-2-interaction",
    PREREQUISITE_2,
    1.1,
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
        "prep-ultra",

      risk:
        0.1,

      cost:
        0.15,

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
      0.7,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function obs(
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

function evidenceFor(
  source:
    "root"
    | "parent"
    | "active"
    | "bad",
): StructuralMechanismObservation[] {
  const points = [
    [
      1,
      0,
    ],
    [
      0,
      1,
    ],
    [
      1,
      1,
    ],
    [
      0.5,
      1,
    ],
    [
      1,
      0.5,
    ],
    [
      0.5,
      0.5,
    ],
  ] as const;

  function predict(
    y: number,
    z: number,
  ): number {
    if (
      source ===
        "root"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.6 *
        y;
    }

    if (
      source ===
        "parent"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.5 *
        y *
        z;
    }

    if (
      source ===
        "active"
    ) {
      return 0.1 *
        y +
        0.1 *
        z +
        0.9 *
        y *
        z;
    }

    return 2;
  }

  return points.map(
    (
      [
        y,
        z,
      ],
      index,
    ) =>
      obs(
        `${source}-fresh-${index + 1}`,
        y,
        z,
        predict(
          y,
          z,
        ),
      ),
  );
}

function lineage() {
  let result =
    createRevisionLineage(
      "rev-0",
      PROGRAM_0,
      HYPOTHESIS_0,
      PREREQUISITE_0,
      [
        "install-0-a",
        "install-0-b",
      ],
      0,
      4,
    );

  result =
    appendInstalledRevision(
      result,
      "rev-1",
      PROGRAM_1,
      HYPOTHESIS_1,
      PREREQUISITE_1,
      [
        "install-1-a",
        "install-1-b",
        "install-1-c",
      ],
      0.2,
    );

  return appendInstalledRevision(
    result,
    "rev-2",
    PROGRAM_2,
    HYPOTHESIS_2,
    PREREQUISITE_2,
    [
      "install-2-a",
      "install-2-b",
      "install-2-c",
      "install-2-d",
    ],
    0.6,
  );
}

function remapPlan(
  plan: PrerequisiteAwarePlan,
  revisionNumber: number,
): PrerequisiteAwarePlan {
  return {
    ...plan,

    actionIds: [
      ...plan.actionIds,
    ],

    subgoals:
      plan.subgoals.map(
        (subgoal, index) => ({
          ...subgoal,

          id:
            `prerequisite-revised-${revisionNumber}-${index + 1}`,

          targetState: {
            ...subgoal.targetState,
          },

          prerequisiteDescriptions: [
            ...subgoal.prerequisiteDescriptions,
          ],

          dependsOnGoalIds:
            index ===
              0
              ? []
              : [
                  `prerequisite-revised-${revisionNumber}-${index}`,
                ],
        }),
      ),

    expectedFinalState: {
      ...plan.expectedFinalState,
    },
  };
}

function createReasonerWithCurrentPlan() {
  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T10:15:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "lineage-terminal-goal",

    description:
      "Reach progress >= 0.700 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.700",
      "exposure <= 0.300",
    ],

    constraints: [
      "Use only safe reversible actions.",
      "Activate revisions only from fresh protected evidence.",
    ],

    createdAt:
      "2026-09-22T10:15:00Z",

    updatedAt:
      "2026-09-22T10:15:00Z",
  });

  const state = {
    readiness:
      0,
    progress:
      0,
    exposure:
      0,
  };

  const plan0 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_0,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_0,
    );

  const plan1 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_1,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_1,
    );

  const plan2 =
    buildPlanForLiveHypothesis(
      HYPOTHESIS_2,
      state,
      GOAL,
      ACTIONS,
      PREREQUISITE_2,
    );

  if (
    plan0.decision !==
      "planned" ||
    plan1.decision !==
      "planned" ||
    plan2.decision !==
      "planned"
  ) {
    throw new Error(
      "Expected all lineage plans to be available.",
    );
  }

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "lineage-terminal-goal",
    plan0,
  );

  const revision1 =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      "lineage-terminal-goal",
      plan0,
      plan1,
      1,
    );

  if (
    revision1.decision !==
      "revised"
  ) {
    throw new Error(
      "Expected first lineage goal revision.",
    );
  }

  const revision2 =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      "lineage-terminal-goal",
      remapPlan(
        plan1,
        1,
      ),
      plan2,
      2,
    );

  if (
    revision2.decision !==
      "revised"
  ) {
    throw new Error(
      "Expected second lineage goal revision.",
    );
  }

  return {
    reasoner,
    state,
    plan2,
  };
}

describe(
  "adaptive protected evidence governance",
  () => {
    it(
      "requires more protected evidence and intervention coverage for a complex uncertain revision",
      () => {
        const simple =
          deriveAdaptiveEvidenceRequirement(
            PROGRAM_0,
            0,
          );

        const complex =
          deriveAdaptiveEvidenceRequirement(
            PROGRAM_2,
            0.6,
          );

        expect(
          simple,
        ).toMatchObject({
          minimumProtectedEvidence:
            2,

          minimumUniqueInterventionSignatures:
            1,

          complexityBand:
            0,

          uncertaintyBand:
            0,
        });

        expect(
          complex,
        ).toMatchObject({
          minimumProtectedEvidence:
            6,

          minimumUniqueInterventionSignatures:
            3,

          complexityBand:
            2,

          uncertaintyBand:
            2,
        });
      },
    );

    it(
      "rejects a numerically large protected reserve that lacks causal-region coverage",
      () => {
        const requirement =
          deriveAdaptiveEvidenceRequirement(
            PROGRAM_2,
            0.6,
          );

        const repeated =
          Array.from(
            {
              length:
                6,
            },
            (
              _,
              index,
            ) =>
              obs(
                `same-${index + 1}`,
                1,
                1,
                1.1,
              ),
          );

        const assessment =
          assessAdaptiveProtectedEvidence(
            repeated,
            requirement,
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "adaptive-protected-reserve-insufficient",
        });

        expect(
          assessment
            .uniqueInterventionSignatures,
        ).toHaveLength(
          1,
        );
      },
    );

    it(
      "rejects protected evidence reused from any installation in the lineage",
      () => {
        const requirement =
          deriveAdaptiveEvidenceRequirement(
            PROGRAM_0,
            0,
          );

        expect(
          () =>
            assessAdaptiveProtectedEvidence(
              [
                obs(
                  "install-1-a",
                  1,
                  0,
                  0.7,
                ),
                obs(
                  "fresh",
                  0,
                  1,
                  0.1,
                ),
              ],
              requirement,
              [
                "install-1-a",
              ],
            ),
        ).toThrow(
          "Adaptive protected evidence overlaps an excluded validation reserve.",
        );
      },
    );
  },
);

describe(
  "bounded revision lineage",
  () => {
    it(
      "keeps the lineage bounded and rewires ancestry when an old archived node is pruned",
      () => {
        let bounded =
          createRevisionLineage(
            "r0",
            PROGRAM_0,
            HYPOTHESIS_0,
            PREREQUISITE_0,
            [],
            0,
            3,
          );

        bounded =
          appendInstalledRevision(
            bounded,
            "r1",
            PROGRAM_1,
            HYPOTHESIS_1,
            PREREQUISITE_1,
            [],
            0,
          );

        bounded =
          appendInstalledRevision(
            bounded,
            "r2",
            PROGRAM_2,
            HYPOTHESIS_2,
            PREREQUISITE_2,
            [],
            0,
          );

        bounded =
          appendInstalledRevision(
            bounded,
            "r3",
            PROGRAM_2,
            {
              ...HYPOTHESIS_2,

              id:
                "hypothesis-3",
            },
            PREREQUISITE_2,
            [],
            0,
          );

        expect(
          bounded.nodes,
        ).toHaveLength(
          3,
        );

        expect(
          bounded
            .nodes
            .map(
              (node) =>
                node.revisionId,
            ),
        ).toEqual([
          "r1",
          "r2",
          "r3",
        ]);

        expect(
          bounded
            .nodes
            .find(
              (node) =>
                node.revisionId ===
                "r1",
            )
            ?.parentRevisionId,
        ).toBeUndefined();

        expect(
          bounded
            .activeRevisionId,
        ).toBe(
          "r3",
        );
      },
    );

    it(
      "retains the active revision when it is best on an adequate fresh reserve",
      () => {
        const assessment =
          evaluateRevisionLineage(
            lineage(),
            evidenceFor(
              "active",
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "retain",

          selectedRevisionId:
            "rev-2",

          reason:
            "active-revision-still-best",
        });
      },
    );

    it(
      "rolls back one generation when the direct parent materially wins",
      () => {
        const assessment =
          evaluateRevisionLineage(
            lineage(),
            evidenceFor(
              "parent",
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "rollback-parent",

          selectedRevisionId:
            "rev-1",

          reason:
            "direct-parent-materially-better",
        });
      },
    );

    it(
      "branches directly to an older ancestor when it beats both the active revision and direct parent",
      () => {
        const assessment =
          evaluateRevisionLineage(
            lineage(),
            evidenceFor(
              "root",
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "branch-ancestor",

          selectedRevisionId:
            "rev-0",

          reason:
            "older-ancestor-materially-better",
        });

        expect(
          assessment
            .improvement,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "reopens structural search when every retained lineage revision is inadequate",
      () => {
        const assessment =
          evaluateRevisionLineage(
            lineage(),
            evidenceFor(
              "bad",
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "reopen-search",

          reason:
            "all-lineage-revisions-inadequate",
        });

        expect(
          assessment
            .activeMeanSquaredError,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "abstains when fresh protected evidence does not satisfy the adaptive budget",
      () => {
        const assessment =
          evaluateRevisionLineage(
            lineage(),
            evidenceFor(
              "root",
            ).slice(
              0,
              3,
            ),
          );

        expect(
          assessment,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "adaptive-protected-evidence-insufficient",
        });

        expect(
          assessment
            .requirement
            .minimumProtectedEvidence,
        ).toBe(
          6,
        );
      },
    );

    it(
      "activates an older ancestor, revises the materialized goal branch, and changes the next receding control",
      () => {
        const currentLineage =
          lineage();

        const assessment =
          evaluateRevisionLineage(
            currentLineage,
            evidenceFor(
              "root",
            ),
          );

        const {
          reasoner,
          state,
          plan2,
        } =
          createReasonerWithCurrentPlan();

        const activation =
          activateRevisionLineageSelection(
            currentLineage,
            assessment,
            [
              HYPOTHESIS_2,
            ],
            {
              probabilities: {
                "hypothesis-2":
                  1,
              },

              topHypothesisId:
                "hypothesis-2",

              confidence:
                1,

              normalizedEntropy:
                0,
            },
            state,
            GOAL,
            ACTIONS,
            plan2,
            2,
            reasoner,
            "lineage-terminal-goal",
            3,
          );

        expect(
          activation,
        ).toMatchObject({
          decision:
            "activated",

          reason:
            "lineage-revision-activated",

          lineage: {
            activeRevisionId:
              "rev-0",
          },

          activatedPlan: {
            actionIds: [
              "prep-light",
              "finish",
            ],
          },

          goalRevision: {
            decision:
              "revised",

            terminalGoalPreserved:
              true,

            replacementGoalIds: [
              "prerequisite-revised-3-1",
              "prerequisite-revised-3-2",
            ],
          },
        });

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "prerequisite-revised-3-1",
        );

        const controller =
          createRecedingVectorController(
            state,
            activation
              .catalogRevision!
              .belief
              .probabilities,
          );

        const next =
          chooseRecedingHorizonVectorControl(
            activation
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
            "prep-light",

          reason:
            "direct-action-best",
        });
      },
    );
  },
);

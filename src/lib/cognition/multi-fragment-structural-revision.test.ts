import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MultiFragmentStructuralPosterior,
  buildResolvedMultiFragmentStructuralSearch,
  planContingentMultiFragmentStructuralDiagnostics,
  runControlledContingentStructuralDiagnosis,
  synthesizeBoundedMultiFragmentStructuralRevisions,
} from "./multi-fragment-structural-revision";

import {
  synthesizeBoundedLocalStructuralMutations,
  type LocalStructuralMutationCandidate,
  type StructuralMutationProbe,
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

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
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
        0.5,
    },
  );

const PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "multi-structure-composite",

  baseEffects: {
    y:
      0,
    z:
      0,
    w:
      0,
  },

  fragments: [
    Y_FRAGMENT,
    Z_FRAGMENT,
  ],

  observationStdDev:
    0.03,

  depth:
    3,

  complexity:
    2,
};

const ACTUAL_PROGRAM:
  HierarchicalCausalProgram = {
  ...PROGRAM,

  id:
    "multi-structure-actual",

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
    fragment(
      "actual-interaction-z-w",
      {
        id:
          "interaction(z,w)",

        kind:
          "interaction",

        variables: [
          "z",
          "w",
        ],

        coefficient:
          0.5,
      },
    ),
  ],
};

function observation(
  id: string,
  y: number,
  z: number,
  w: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        y,
        z,
        w,
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

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "joint-discovery-y-half",
      0.5,
      0,
      1,
      0.45,
    ),
    observation(
      "joint-discovery-z-context-full",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "joint-discovery-combined",
      0.5,
      1,
      1,
      0.95,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "joint-protected-y-quarter",
      0.25,
      0,
      1,
      0.3,
    ),
    observation(
      "joint-protected-y-full",
      1,
      0,
      1,
      0.6,
    ),
    observation(
      "joint-protected-z-half-context",
      0,
      1,
      0.5,
      0.25,
    ),
    observation(
      "joint-protected-z-full-context",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "joint-protected-combined",
      0.5,
      1,
      0.5,
      0.7,
    ),
  ];

const PROBES:
  readonly StructuralMutationProbe[] = [
    {
      id:
        "joint-structure:y=1.00",

      interventions: {
        y:
          1,
        z:
          0,
        w:
          1,
      },

      risk:
        0.02,

      cost:
        0.01,

      reversible:
        true,

      observationStdDev:
        0.03,
    },
    {
      id:
        "joint-structure:z=1.00+w=0.50",

      interventions: {
        y:
          0,
        z:
          1,
        w:
          0.5,
      },

      risk:
        0.08,

      cost:
        0.25,

      reversible:
        true,

      observationStdDev:
        0.03,
    },
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
    0.8,

  effectGap:
    0.78,

  evidenceCount:
    8,
};

const HYPOTHESIS:
  RecedingVectorHypothesis = {
  id:
    "hypothesis:multi-structure",

  repairCandidateId:
    "composition:linear-y+linear-z",

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
    0.03,

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
      0.79,
  },

  maximums: {
    exposure:
      0.3,
  },
};

function localCandidateSets(): {
  y:
    LocalStructuralMutationCandidate[];
  z:
    LocalStructuralMutationCandidate[];
} {
  const yAll =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Y_FRAGMENT.id,
      DISCOVERY,
      [
        "y",
        "z",
        "w",
      ],
      {
        maximumCandidates:
          12,
      },
    );

  const zAll =
    synthesizeBoundedLocalStructuralMutations(
      PROGRAM,
      Z_FRAGMENT.id,
      DISCOVERY,
      [
        "y",
        "z",
        "w",
      ],
      {
        maximumCandidates:
          12,
      },
    );

  const y =
    yAll.filter(
      (candidate) =>
        (
          candidate.kind ===
            "linear" &&
          !candidate
            .topologyChanged &&
          Math.abs(
            candidate.coefficient -
              0.9,
          ) <
            1e-9
        ) ||
        (
          candidate.kind ===
            "saturating" &&
          Math.abs(
            candidate.coefficient -
              0.9,
          ) <
            1e-9
        ),
    );

  const z =
    zAll.filter(
      (candidate) =>
        candidate.kind ===
          "incumbent" ||
        (
          candidate.kind ===
            "interaction" &&
          candidate.variables
            .includes(
              "z",
            ) &&
          candidate.variables
            .includes(
              "w",
            ) &&
          Math.abs(
            candidate.coefficient -
              0.5,
          ) <
            1e-9
        ),
    );

  if (
    y.length !==
      2 ||
    z.length !==
      2
  ) {
    throw new Error(
      "Controlled v1.33 local candidate calibration failed.",
    );
  }

  return {
    y,
    z,
  };
}

function revisions() {
  const local =
    localCandidateSets();

  return synthesizeBoundedMultiFragmentStructuralRevisions(
    PROGRAM,
    {
      [
        Y_FRAGMENT.id
      ]:
        local.y,

      [
        Z_FRAGMENT.id
      ]:
        local.z,
    },
    DISCOVERY,
    {
      maximumChangedFragments:
        2,

      maximumCandidates:
        8,

      complexityPenaltyPerTopologyChange:
        0,
    },
  );
}

function candidateByKinds(
  yKind:
    string,
  zKind:
    string,
) {
  const candidate =
    revisions().find(
      (revision) => {
        const yId =
          revision
            .componentCandidateIds[
              Y_FRAGMENT.id
            ] ??
          "";

        const zId =
          revision
            .componentCandidateIds[
              Z_FRAGMENT.id
            ] ??
          "";

        return (
          yId.includes(
            `:mutation:${yKind}:`,
          ) &&
          (
            zKind ===
              "incumbent"
              ? zId.endsWith(
                  ":mutation:incumbent",
                )
              : zId.includes(
                  `:mutation:${zKind}:`,
                )
          )
        );
      },
    );

  if (!candidate) {
    throw new Error(
      `Missing controlled joint candidate ${yKind} + ${zKind}.`,
    );
  }

  return candidate;
}

function prior() {
  const satInteraction =
    candidateByKinds(
      "saturating",
      "interaction",
    );

  const satIncumbent =
    candidateByKinds(
      "saturating",
      "incumbent",
    );

  const linearIncumbent =
    candidateByKinds(
      "linear",
      "incumbent",
    );

  const linearInteraction =
    candidateByKinds(
      "linear",
      "interaction",
    );

  return {
    [
      satInteraction.id
    ]:
      0.35,

    [
      satIncumbent.id
    ]:
      0.35,

    [
      linearIncumbent.id
    ]:
      0.29,

    [
      linearInteraction.id
    ]:
      0.01,
  };
}

function posterior() {
  return new MultiFragmentStructuralPosterior(
    revisions(),
    prior(),
    0.95,
    0.1,
  );
}

function resolvedPosterior() {
  const result =
    posterior();

  result.recordObservation(
    observation(
      "controlled-y-full",
      1,
      0,
      1,
      0.6,
    ),
    0.03,
  );

  result.recordObservation(
    observation(
      "controlled-z-half-context",
      0,
      1,
      0.5,
      0.25,
    ),
    0.03,
  );

  return result;
}

function lineage() {
  return createRevisionLineage(
    "rev-joint-structure-incumbent",
    PROGRAM,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "joint-structure-install-a",
      "joint-structure-install-b",
      "joint-structure-install-c",
      "joint-structure-install-d",
    ],
    0.2,
    4,
  );
}

function provenance() {
  return initializeFragmentProvenance(
    "rev-joint-structure-incumbent",
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
      "Expected v1.33 incumbent plan.",
    );
  }

  let tick =
    0;

  const reasoner =
    new HierarchicalGoalReasoner(
      () =>
        `2026-09-22T15:25:${String(
          tick++,
        ).padStart(
          2,
          "0",
        )}Z`,
    );

  reasoner.registerRoot({
    id:
      "joint-structure-terminal",

    description:
      "Reach progress >= 0.790 while exposure <= 0.300.",

    priority:
      100,

    status:
      "active",

    successCriteria: [
      "progress >= 0.790",
      "exposure <= 0.300",
    ],

    constraints: [
      "Resolve bounded joint topology uncertainty.",
      "Use contingent structural diagnostics.",
      "Protect the same joint revision before installation.",
    ],

    createdAt:
      "2026-09-22T15:25:00Z",

    updatedAt:
      "2026-09-22T15:25:00Z",
  });

  materializePrerequisiteAwareSubgoals(
    reasoner,
    "joint-structure-terminal",
    plan,
  );

  return {
    reasoner,
    plan,
  };
}

describe(
  "bounded multi-fragment structural revision",
  () => {
    it(
      "forms the four bounded joint structures from two local uncertainties",
      () => {
        const candidates =
          revisions();

        expect(
          candidates,
        ).toHaveLength(
          4,
        );

        expect(
          candidates.some(
            (candidate) =>
              candidate
                .topologyChangedFragmentIds
                .length ===
                2,
          ),
        ).toBe(
          true,
        );

        expect(
          candidateByKinds(
            "saturating",
            "interaction",
          )
            .replacementFragmentIds,
        ).toMatchObject({
          [
            Y_FRAGMENT.id
          ]:
            "rev-y:program-y-fragment:mutation:saturating:y:0.900",

          [
            Z_FRAGMENT.id
          ]:
            "rev-z:program-z-fragment:mutation:interaction:z+w:0.500",
        });
      },
    );

    it(
      "keeps the bounded joint structural posterior unresolved initially",
      () => {
        const belief =
          posterior()
            .getBelief();

        expect(
          belief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          Object.keys(
            belief
              .probabilities,
          ),
        ).toHaveLength(
          4,
        );
      },
    );

    it(
      "chooses y first because its contingent two-step value exceeds the more expensive context probe",
      () => {
        const plan =
          planContingentMultiFragmentStructuralDiagnostics(
            posterior(),
            PROBES,
            {
              horizon:
                2,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "plan",

          firstProbe: {
            id:
              "joint-structure:y=1.00",
          },

          reason:
            "safe-contingent-structural-plan",
        });

        expect(
          plan
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );

    it(
      "makes the second diagnostic contingent on the first structural outcome",
      () => {
        const plan =
          planContingentMultiFragmentStructuralDiagnostics(
            posterior(),
            PROBES,
            {
              horizon:
                2,
            },
          );

        const satInteraction =
          candidateByKinds(
            "saturating",
            "interaction",
          );

        const satIncumbent =
          candidateByKinds(
            "saturating",
            "incumbent",
          );

        const linearIncumbent =
          candidateByKinds(
            "linear",
            "incumbent",
          );

        const satBranches =
          plan.branches.filter(
            (branch) =>
              branch
                .truthCandidateId ===
                satInteraction.id ||
              branch
                .truthCandidateId ===
                satIncumbent.id,
          );

        expect(
          satBranches.every(
            (branch) =>
              branch
                .secondProbeId ===
              "joint-structure:z=1.00+w=0.50",
          ),
        ).toBe(
          true,
        );

        const linearBranch =
          plan.branches.find(
            (branch) =>
              branch
                .truthCandidateId ===
              linearIncumbent.id,
          );

        expect(
          linearBranch
            ?.secondProbeId,
        ).toBeUndefined();

        expect(
          linearBranch
            ?.posteriorConfidenceAfterFirst,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );

    it(
      "abstains when every joint structural probe violates the external risk ceiling",
      () => {
        const unsafe =
          PROBES.map(
            (probe) => ({
              ...probe,

              risk:
                0.9,
            }),
          );

        const plan =
          planContingentMultiFragmentStructuralDiagnostics(
            posterior(),
            unsafe,
            {
              maximumRisk:
                0.3,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-contingent-structural-plan",
        });
      },
    );

    it(
      "executes the saturating branch of the contingent tree and resolves both topology changes",
      () => {
        const diagnosis =
          runControlledContingentStructuralDiagnosis(
            posterior(),
            ACTUAL_PROGRAM,
            PROBES,
            {
              maximumSteps:
                2,
            },
          );

        expect(
          diagnosis,
        ).toMatchObject({
          decision:
            "resolved",

          executedProbeIds: [
            "joint-structure:y=1.00",
            "joint-structure:z=1.00+w=0.50",
          ],

          reason:
            "multi-fragment-structure-resolved",
        });

        expect(
          diagnosis
            .acquiredObservations[
              0
            ]
            ?.measuredEffect,
        ).toBeCloseTo(
          0.6,
        );

        expect(
          diagnosis
            .acquiredObservations[
              1
            ]
            ?.measuredEffect,
        ).toBeCloseTo(
          0.25,
        );

        expect(
          diagnosis
            .finalBelief
            .topTopologyChangedFragmentIds,
        ).toEqual([
          "rev-y:program-y-fragment",
          "rev-z:program-z-fragment",
        ]);

        expect(
          diagnosis
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );
  },
);

describe(
  "protected joint structural revision",
  () => {
    it(
      "does not open joint structural replacement while the posterior remains unresolved",
      () => {
        const search =
          buildResolvedMultiFragmentStructuralSearch(
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
      "opens a two-fragment structural replacement only after the joint posterior resolves",
      () => {
        const search =
          buildResolvedMultiFragmentStructuralSearch(
            resolvedPosterior(),
            DISCOVERY,
          );

        expect(
          search,
        ).toMatchObject({
          decision:
            "search",

          faultExplanation: {
            kind:
              "multi-fragment",

            fragmentIds: [
              "rev-y:program-y-fragment",
              "rev-z:program-z-fragment",
            ],
          },

          selectedCandidate: {
            replacementFragmentIds: {
              [
                Y_FRAGMENT.id
              ]:
                "rev-y:program-y-fragment:mutation:saturating:y:0.900",

              [
                Z_FRAGMENT.id
              ]:
                "rev-z:program-z-fragment:mutation:interaction:z+w:0.500",
            },
          },

          reason:
            "fault-posterior-authorized-local-repair-search",
        });
      },
    );

    it(
      "keeps both contingent diagnostic observations out of the final protected reserve",
      () => {
        const resolved =
          resolvedPosterior();

        const search =
          buildResolvedMultiFragmentStructuralSearch(
            resolved,
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
                  "controlled-y-full",
                  1,
                  0,
                  1,
                  0.6,
                ),
                ...PROTECTED.slice(
                  1,
                ),
              ],
              [
                "controlled-y-full",
                "controlled-z-half-context",
              ],
              resolved
                .getBelief()
                .normalizedEntropy,
            ),
        ).toThrow(
          "Local repair search, diagnostic, and protected evidence must remain disjoint.",
        );
      },
    );

    it(
      "requires a complete fresh reserve before the two-fragment topology revision can install",
      () => {
        const resolved =
          resolvedPosterior();

        const search =
          buildResolvedMultiFragmentStructuralSearch(
            resolved,
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
              "controlled-y-full",
              "controlled-z-half-context",
            ],
            resolved
              .getBelief()
              .normalizedEntropy,
          );

        expect(
          shortDecision,
        ).toMatchObject({
          decision:
            "abstained",

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
              "controlled-y-full",
              "controlled-z-half-context",
            ],
            resolved
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
      "installs both protected topology changes, advances both provenances, and changes live control",
      () => {
        const resolved =
          resolvedPosterior();

        const search =
          buildResolvedMultiFragmentStructuralSearch(
            resolved,
            DISCOVERY,
          );

        const protectedDecision =
          validateProbabilisticLocalRepairSearch(
            lineage(),
            PROGRAM,
            search,
            PROTECTED,
            [
              "controlled-y-full",
              "controlled-z-half-context",
            ],
            resolved
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
                w:
                  0.5,
              },

              "boost-finish": {
                y:
                  1,
                z:
                  1,
                w:
                  0.5,
              },
            },
            STATE,
            GOAL,
            ACTIONS,
            plan,
            reasoner,
            "joint-structure-terminal",
            "rev-joint-structure-repaired",
            1,
            resolved
              .getBelief()
              .normalizedEntropy,
            provenance(),
          );

        expect(
          installed,
        ).toMatchObject({
          decision:
            "installed",

          revisedPlan: {
            actionIds: [
              "boost-finish",
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
          installed
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.7,

          "boost-finish":
            0.85,
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
            "rev-y:program-y-fragment:mutation:saturating:y:0.900",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          activeFragmentId:
            "rev-z:program-z-fragment:mutation:interaction:z+w:0.500",

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

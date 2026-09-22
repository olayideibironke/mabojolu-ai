import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProtectedStructuralPosterior,
  runControlledActiveProtectedStructuralValidation,
  synthesizeProtectedStructuralValidationProbes,
} from "./active-protected-structural-validation";

import {
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  LocalRepairSearchCandidate,
  ProbabilisticLocalRepairSearch,
} from "./multi-step-fault-diagnosis-local-repair";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

import type {
  LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

import type {
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

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

const INCUMBENT_Y =
  fragment(
    "incumbent-y",
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

const INCUMBENT_Z =
  fragment(
    "incumbent-z",
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

const INCUMBENT:
  HierarchicalCausalProgram = {
  id:
    "protected-incumbent",

  baseEffects: {
    y:
      0,
    z:
      0,
    w:
      0,
  },

  fragments: [
    INCUMBENT_Y,
    INCUMBENT_Z,
  ],

  observationStdDev:
    0.03,

  depth:
    3,

  complexity:
    2,
};

function candidateProgram(
  id: string,
  yKind:
    "linear" |
    "saturating",
  zKind:
    "linear" |
    "interaction",
): HierarchicalCausalProgram {
  return {
    ...INCUMBENT,

    id,

    fragments: [
      fragment(
        `${id}:y`,
        {
          id:
            `${yKind}(y)`,

          kind:
            yKind,

          variables: [
            "y",
          ],

          coefficient:
            0.9,
        },
      ),
      fragment(
        `${id}:z`,
        {
          id:
            zKind ===
              "linear"
              ? "linear(z)"
              : "interaction(z,w)",

          kind:
            zKind,

          variables:
            zKind ===
              "linear"
              ? [
                  "z",
                ]
              : [
                  "z",
                  "w",
                ],

          coefficient:
            0.5,
        },
      ),
    ],

    complexity:
      2,
  };
}

const LINEAR_LINEAR =
  candidateProgram(
    "candidate-linear-linear",
    "linear",
    "linear",
  );

const LINEAR_INTERACTION =
  candidateProgram(
    "candidate-linear-interaction",
    "linear",
    "interaction",
  );

const SATURATING_LINEAR =
  candidateProgram(
    "candidate-saturating-linear",
    "saturating",
    "linear",
  );

const SELECTED =
  candidateProgram(
    "candidate-saturating-interaction",
    "saturating",
    "interaction",
  );

const OUTSIDE:
  HierarchicalCausalProgram = {
  ...INCUMBENT,

  id:
    "outside-retained-structure",

  fragments: [
    fragment(
      "outside-y",
      {
        id:
          "linear(y)",

        kind:
          "linear",

        variables: [
          "y",
        ],

        coefficient:
          0.15,
      },
    ),
    fragment(
      "outside-bias",
      {
        id:
          "latent-bias",

        kind:
          "latent-bias",

        variables:
          [],

        coefficient:
          0.1,
      },
    ),
  ],
};

function repairCandidate(
  program:
    HierarchicalCausalProgram,
  replacements:
    Record<string, string>,
): LocalRepairSearchCandidate {
  return {
    id:
      program.id,

    program,

    replacementFragmentIds:
      replacements,

    retiredFragmentIds:
      Object.keys(
        replacements,
      ).sort(),

    discoveryMeanSquaredError:
      0,

    complexityPenalty:
      0,

    objective:
      0,
  };
}

const CANDIDATES:
  readonly LocalRepairSearchCandidate[] = [
    repairCandidate(
      LINEAR_LINEAR,
      {
        "incumbent-y":
          "candidate-linear-linear:y",
      },
    ),
    repairCandidate(
      LINEAR_INTERACTION,
      {
        "incumbent-y":
          "candidate-linear-interaction:y",

        "incumbent-z":
          "candidate-linear-interaction:z",
      },
    ),
    repairCandidate(
      SATURATING_LINEAR,
      {
        "incumbent-y":
          "candidate-saturating-linear:y",
      },
    ),
    repairCandidate(
      SELECTED,
      {
        "incumbent-y":
          "candidate-saturating-interaction:y",

        "incumbent-z":
          "candidate-saturating-interaction:z",
      },
    ),
  ];

const SEARCH:
  ProbabilisticLocalRepairSearch = {
  decision:
    "search",

  faultExplanation: {
    id:
      "protected-joint-structure",

    kind:
      "multi-fragment",

    fragmentIds: [
      "incumbent-y",
      "incumbent-z",
    ],
  },

  faultConfidence:
    0.99,

  faultFragmentIds: [
    "incumbent-y",
    "incumbent-z",
  ],

  repairEvidenceIds: [
    "discovery-y",
    "discovery-z",
  ],

  candidates: [
    ...CANDIDATES,
  ],

  selectedCandidate:
    CANDIDATES[
      3
    ],

  reason:
    "fault-posterior-authorized-local-repair-search",
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
    "hypothesis:protected-structural",

  repairCandidateId:
    "protected-structural",

  prerequisiteHypothesisId:
    "finish:readiness>=0.700",

  dimensionEffects: {
    progress: {
      finish:
        0.8,
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

function lineage() {
  return createRevisionLineage(
    "protected-root",
    INCUMBENT,
    HYPOTHESIS,
    PREREQUISITE,
    [
      "historical-protected-a",
      "historical-protected-b",
      "historical-protected-c",
      "historical-protected-d",
    ],
    0.2,
    4,
  );
}

function observation(
  id: string,
  interventions:
    Record<string, number>,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions,

      risk:
        0.05,

      cost:
        0.02,

      reversible:
        true,
    },

    measuredEffect,
  };
}

describe(
  "active protected structural validation",
  () => {
    it(
      "synthesizes bounded mid-level and joint protected falsification probes",
      () => {
        const probes =
          synthesizeProtectedStructuralValidationProbes(
            CANDIDATES,
            [],
            {
              maximumArity:
                2,

              maximumProbes:
                64,
            },
          );

        expect(
          probes.some(
            (probe) =>
              probe
                .interventions
                .y ===
                0.5 &&
              probe
                .interventions
                .z ===
                1 &&
              probe
                .interventions
                .w ===
                0,
          ),
        ).toBe(
          true,
        );

        expect(
          probes.some(
            (probe) =>
              probe
                .interventions
                .z ===
                1 &&
              probe
                .interventions
                .w ===
                0.5 &&
              probe
                .interventions
                .y ===
                0,
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "keeps the protected posterior normalized under repeated strong evidence",
      () => {
        const posterior =
          new ProtectedStructuralPosterior(
            CANDIDATES,
            SELECTED.id,
          );

        for (
          let index =
            0;
          index <
            40;
          index +=
            1
        ) {
          posterior.recordObservation(
            observation(
              `repeated-${index}`,
              {
                y:
                  1,
                z:
                  1,
                w:
                  0.5,
              },
              0.85,
            ),
            0.03,
          );
        }

        const belief =
          posterior.getBelief();

        expect(
          Object.values(
            belief
              .probabilities,
          ).every(
            Number.isFinite,
          ),
        ).toBe(
          true,
        );

        expect(
          Object.values(
            belief
              .probabilities,
          ).reduce(
            (sum, value) =>
              sum +
              value,
            0,
          ),
        ).toBeCloseTo(
          1,
        );

        expect(
          belief
            .topCandidateId,
        ).toBe(
          SELECTED.id,
        );
      },
    );

    it(
      "actively completes the adaptive reserve before validating the selected joint revision",
      () => {
        const result =
          runControlledActiveProtectedStructuralValidation(
            lineage(),
            INCUMBENT,
            SEARCH,
            [
              "diagnostic-y",
              "diagnostic-z",
            ],
            SELECTED,
            [],
            {
              uncertaintyAtInstall:
                0.2,

              maximumSteps:
                8,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "validated",

          finalGap: {
            assessment: {
              decision:
                "ready",
            },

            requirement: {
              minimumProtectedEvidence:
                4,

              minimumUniqueInterventionSignatures:
                2,
            },
          },

          protectedDecision: {
            decision:
              "installed",

            reason:
              "protected-local-repair-selected",
          },

          reason:
            "protected-structural-revision-validated",
        });

        expect(
          result
            .allProtectedEvidence
            .length,
        ).toBeGreaterThanOrEqual(
          4,
        );

        expect(
          result
            .finalBelief
            .selectedIsTop,
        ).toBe(
          true,
        );

        expect(
          result
            .finalBelief
            .sufficientlySeparated,
        ).toBe(
          true,
        );
      },
    );

    it(
      "falsifies the selected revision before a full installation reserve when another retained structure dominates",
      () => {
        const result =
          runControlledActiveProtectedStructuralValidation(
            lineage(),
            INCUMBENT,
            SEARCH,
            [
              "diagnostic-y",
              "diagnostic-z",
            ],
            SATURATING_LINEAR,
            [],
            {
              maximumSteps:
                8,

              minimumFalsificationEvidence:
                2,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "falsified",

          falsifyingCandidateId:
            SATURATING_LINEAR.id,

          reason:
            "selected-structural-revision-falsified",
        });

        expect(
          result
            .allProtectedEvidence
            .length,
        ).toBeLessThan(
          4,
        );

        expect(
          result
            .protectedDecision,
        ).toBeUndefined();
      },
    );

    it(
      "reopens bounded structural search when every retained joint candidate is inadequate",
      () => {
        const result =
          runControlledActiveProtectedStructuralValidation(
            lineage(),
            INCUMBENT,
            SEARCH,
            [
              "diagnostic-y",
              "diagnostic-z",
            ],
            OUTSIDE,
            [],
            {
              maximumSteps:
                8,

              minimumFalsificationEvidence:
                2,

              maximumAcceptableMeanSquaredError:
                0.001,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "reopen-search",

          reason:
            "all-retained-structural-candidates-inadequate",
        });

        expect(
          result
            .allProtectedEvidence
            .length,
        ).toBeGreaterThanOrEqual(
          2,
        );
      },
    );

    it(
      "abstains when every synthesized protected probe violates the risk ceiling",
      () => {
        const result =
          runControlledActiveProtectedStructuralValidation(
            lineage(),
            INCUMBENT,
            SEARCH,
            [
              "diagnostic-y",
              "diagnostic-z",
            ],
            SELECTED,
            [],
            {
              maximumRisk:
                0.3,

              probeRisk:
                0.9,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-protected-structural-probe",
        });

        expect(
          result
            .allProtectedEvidence,
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      "rejects protected evidence that reuses discovery evidence",
      () => {
        expect(
          () =>
            runControlledActiveProtectedStructuralValidation(
              lineage(),
              INCUMBENT,
              SEARCH,
              [
                "diagnostic-y",
                "diagnostic-z",
              ],
              SELECTED,
              [
                observation(
                  "discovery-y",
                  {
                    y:
                      1,
                    z:
                      0,
                    w:
                      0,
                  },
                  0.6,
                ),
              ],
            ),
        ).toThrow(
          "Adaptive protected evidence overlaps an excluded validation reserve.",
        );
      },
    );

    it(
      "can exhaust a deliberately short protected budget without self-authorizing",
      () => {
        const result =
          runControlledActiveProtectedStructuralValidation(
            lineage(),
            INCUMBENT,
            SEARCH,
            [
              "diagnostic-y",
              "diagnostic-z",
            ],
            SELECTED,
            [],
            {
              maximumSteps:
                1,

              minimumFalsificationEvidence:
                3,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "protected-structural-budget-exhausted",
        });

        expect(
          result
            .protectedDecision,
        ).toBeUndefined();

        expect(
          result
            .allProtectedEvidence,
        ).toHaveLength(
          1,
        );
      },
    );
  },
);

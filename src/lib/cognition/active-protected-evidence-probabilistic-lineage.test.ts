import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProbabilisticRevisionAncestry,
  analyzeProtectedCoverageGap,
  runControlledProtectedEvidenceAcquisition,
  synthesizeProtectedValidationProbes,
} from "./active-protected-evidence-probabilistic-lineage";

import {
  appendInstalledRevision,
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import type {
  LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

import type {
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

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
  kind:
    "linear"
    | "interaction",
  variables: string[],
  coefficient: number,
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
        kind,
        variables,
        coefficient,
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
    "linear",
    [
      "y",
    ],
    0.6,
    1,
  );

const PROGRAM_1 =
  program(
    "program-1",
    "interaction",
    [
      "y",
      "z",
    ],
    0.5,
    2,
  );

const PROGRAM_2 =
  program(
    "program-2",
    "interaction",
    [
      "y",
      "z",
    ],
    0.9,
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
          0.8,
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
  );

const HYPOTHESIS_1 =
  hypothesis(
    "hypothesis-1",
    "revision-1-interaction",
    PREREQUISITE_1,
  );

const HYPOTHESIS_2 =
  hypothesis(
    "hypothesis-2",
    "revision-2-interaction",
    PREREQUISITE_2,
  );

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
      "fresh-y",
      1,
      0,
      0.1,
    ),
    observation(
      "fresh-z",
      0,
      1,
      0.1,
    ),
  ];

describe(
  "active protected evidence coverage",
  () => {
    it(
      "detects both missing evidence count and missing intervention coverage",
      () => {
        const gap =
          analyzeProtectedCoverageGap(
            lineage(),
            INITIAL_EVIDENCE,
          );

        expect(
          gap,
        ).toMatchObject({
          decision:
            "acquire",

          currentEvidenceCount:
            2,

          missingEvidenceCount:
            4,

          missingUniqueInterventionSignatures:
            1,

          requirement: {
            minimumProtectedEvidence:
              6,

            minimumUniqueInterventionSignatures:
              3,
          },
        });
      },
    );

    it(
      "synthesizes a joint intervention probe that fills the missing coverage region",
      () => {
        const probes =
          synthesizeProtectedValidationProbes(
            lineage(),
            INITIAL_EVIDENCE,
          );

        const joint =
          probes.find(
            (probe) =>
              probe.id ===
              "protected-probe:y+z",
          );

        expect(
          joint,
        ).toMatchObject({
          fillsMissingCoverage:
            true,

          interventions: {
            y:
              1,

            z:
              1,
          },

          risk:
            0.1,

          reversible:
            true,
        });
      },
    );

    it(
      "rejects protected acquisition evidence reused from lineage installation reserves",
      () => {
        expect(
          () =>
            analyzeProtectedCoverageGap(
              lineage(),
              [
                observation(
                  "install-1-a",
                  1,
                  0,
                  0.1,
                ),
              ],
            ),
        ).toThrow(
          "Active protected evidence overlaps lineage installation evidence.",
        );
      },
    );
  },
);

describe(
  "probabilistic revision ancestry",
  () => {
    it(
      "uses existing protected evidence to eliminate the incompatible root while retaining uncertainty between interaction revisions",
      () => {
        const currentLineage =
          lineage();

        const posterior =
          new ProbabilisticRevisionAncestry(
            currentLineage,
          );

        for (
          const item of
            INITIAL_EVIDENCE
        ) {
          posterior.recordObservation(
            {
              id:
                `existing:${item.experiment.id}`,

              interventions: {
                ...item
                  .experiment
                  .interventions,
              },

              signature:
                item.experiment.id,

              fillsMissingCoverage:
                false,

              risk:
                0.1,

              cost:
                0.05,

              reversible:
                true,

              observationStdDev:
                0.05,
            },
            item.measuredEffect,
          );
        }

        const belief =
          posterior.getBelief();

        expect(
          belief
            .probabilities[
              "rev-0"
            ],
        ).toBeLessThan(
          1e-10,
        );

        expect(
          belief
            .probabilities[
              "rev-1"
            ],
        ).toBeCloseTo(
          0.5,
          4,
        );

        expect(
          belief
            .probabilities[
              "rev-2"
            ],
        ).toBeCloseTo(
          0.5,
          4,
        );

        expect(
          belief
            .sufficientlyCertain,
        ).toBe(
          false,
        );
      },
    );

    it(
      "selects a safe joint probe because it both fills coverage and separates the remaining ancestors",
      () => {
        const currentLineage =
          lineage();

        const posterior =
          new ProbabilisticRevisionAncestry(
            currentLineage,
          );

        for (
          const item of
            INITIAL_EVIDENCE
        ) {
          posterior.recordObservation(
            {
              id:
                `existing:${item.experiment.id}`,

              interventions: {
                ...item
                  .experiment
                  .interventions,
              },

              signature:
                item.experiment.id,

              fillsMissingCoverage:
                false,

              risk:
                0.1,

              cost:
                0.05,

              reversible:
                true,

              observationStdDev:
                0.05,
            },
            item.measuredEffect,
          );
        }

        const choice =
          posterior.chooseProbe(
            synthesizeProtectedValidationProbes(
              currentLineage,
              INITIAL_EVIDENCE,
            ),
            INITIAL_EVIDENCE,
          );

        expect(
          choice,
        ).toMatchObject({
          decision:
            "probe",

          probe: {
            id:
              "protected-probe:y+z",

            fillsMissingCoverage:
              true,
          },

          reason:
            "safe-protected-validation-probe",
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
      "abstains when every candidate validation probe exceeds the external risk ceiling",
      () => {
        const currentLineage =
          lineage();

        const posterior =
          new ProbabilisticRevisionAncestry(
            currentLineage,
          );

        const probes =
          synthesizeProtectedValidationProbes(
            currentLineage,
            INITIAL_EVIDENCE,
            {
              risk:
                0.9,
            },
          );

        const choice =
          posterior.chooseProbe(
            probes,
            INITIAL_EVIDENCE,
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
            "no-safe-protected-validation-probe",
        });
      },
    );

    it(
      "actively fills the adaptive reserve and resolves the direct parent without collapsing lineage uncertainty prematurely",
      () => {
        const result =
          runControlledProtectedEvidenceAcquisition(
            lineage(),
            INITIAL_EVIDENCE,
            "rev-1",
          );

        expect(
          result.decision,
        ).toBe(
          "ready",
        );

        expect(
          result
            .initialBelief
            .sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          result
            .initialBelief
            .probabilities[
              "rev-1"
            ],
        ).toBeCloseTo(
          0.5,
          4,
        );

        expect(
          result
            .finalGap,
        ).toMatchObject({
          decision:
            "ready",

          currentEvidenceCount:
            6,
        });

        expect(
          result
            .finalGap
            .currentUniqueInterventionSignatures
            .length,
        ).toBeGreaterThanOrEqual(
          3,
        );

        expect(
          result
            .finalBelief,
        ).toMatchObject({
          topRevisionId:
            "rev-1",

          sufficientlyCertain:
            true,
        });

        expect(
          result
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          result
            .lineageAssessment,
        ).toMatchObject({
          decision:
            "rollback-parent",

          selectedRevisionId:
            "rev-1",
        });
      },
    );
  },
);

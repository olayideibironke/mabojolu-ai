import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runActiveProtectedStructuralValidationBenchmark,
} from "./active-protected-structural-validation-benchmark";

describe(
  "active protected structural validation benchmark",
  () => {
    it(
      "actively completes the protected reserve and validates the selected joint revision",
      () => {
        const report =
          runActiveProtectedStructuralValidationBenchmark();

        expect(
          report.validated,
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
          report
            .validated
            .allProtectedEvidence
            .length,
        ).toBeGreaterThanOrEqual(
          4,
        );

        expect(
          report
            .validated
            .steps
            .length,
        ).toBe(
          report
            .validated
            .acquiredProtectedEvidence
            .length,
        );
      },
    );

    it(
      "stops early when protected evidence falsifies the selected joint revision",
      () => {
        const report =
          runActiveProtectedStructuralValidationBenchmark();

        expect(
          report.falsified,
        ).toMatchObject({
          decision:
            "falsified",

          reason:
            "selected-structural-revision-falsified",
        });

        expect(
          report
            .falsified
            .allProtectedEvidence
            .length,
        ).toBeLessThan(
          report
            .validated
            .allProtectedEvidence
            .length,
        );

        expect(
          report
            .falsified
            .falsifyingCandidateId,
        ).toBe(
          "v1.34-saturating-linear",
        );
      },
    );

    it(
      "reopens bounded structural search when no retained candidate fits protected evidence",
      () => {
        const report =
          runActiveProtectedStructuralValidationBenchmark();

        expect(
          report.reopened,
        ).toMatchObject({
          decision:
            "reopen-search",

          reason:
            "all-retained-structural-candidates-inadequate",
        });

        expect(
          report
            .reopened
            .allProtectedEvidence
            .length,
        ).toBeGreaterThanOrEqual(
          2,
        );
      },
    );

    it(
      "installs only the actively protected winner and advances both fragment provenances",
      () => {
        const report =
          runActiveProtectedStructuralValidationBenchmark();

        expect(
          report.installation,
        ).toMatchObject({
          decision:
            "installed",

          lineage: {
            activeRevisionId:
              "rev-v1.34-active-protected",
          },

          goalRevision: {
            terminalGoalPreserved:
              true,
          },

          reason:
            "probabilistic-local-repair-installed",
        });

        const y =
          report
            .installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "incumbent-y",
            );

        const z =
          report
            .installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "incumbent-z",
            );

        expect(
          y,
        ).toMatchObject({
          originRevisionId:
            "rev-y",

          activeFragmentId:
            "v1.34-saturating-interaction:y",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          activeFragmentId:
            "v1.34-saturating-interaction:z",

          generation:
            1,
        });
      },
    );

    it(
      "feeds the actively protected revision into receding control",
      () => {
        const report =
          runActiveProtectedStructuralValidationBenchmark();

        expect(
          report.oldActionIds,
        ).toEqual([
          "finish",
        ]);

        expect(
          report.newActionIds,
        ).toEqual([
          "boost-finish",
        ]);

        expect(
          report
            .installation
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.7,

          "boost-finish":
            0.85,
        });

        expect(
          report
            .nextRecedingDecision,
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

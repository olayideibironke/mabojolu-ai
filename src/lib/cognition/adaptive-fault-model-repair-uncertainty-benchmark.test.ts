import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAdaptiveFaultModelRepairUncertaintyBenchmark,
} from "./adaptive-fault-model-repair-uncertainty-benchmark";

describe(
  "adaptive fault-model synthesis and repair uncertainty benchmark",
  () => {
    it(
      "infers non-fixed 0.40 and 0.70 fragment fault magnitudes from evidence",
      () => {
        const report =
          runAdaptiveFaultModelRepairUncertaintyBenchmark();

        expect(
          report.estimates[
            0
          ]
            ?.estimatedScale,
        ).toBeCloseTo(
          0.4,
        );

        expect(
          report.estimates[
            1
          ]
            ?.estimatedScale,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          report
            .initialFaultBelief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          report
            .resolvedFaultBelief,
        ).toMatchObject({
          topScales: {
            "rev-y:program-y-fragment":
              0.4,

            "rev-z:program-z-fragment":
              0.7,
          },

          sufficientlyResolved:
            true,
        });
      },
    );

    it(
      "moves from diagnosis to validation instead of treating fault resolution as repair authority",
      () => {
        const report =
          runAdaptiveFaultModelRepairUncertaintyBenchmark();

        expect(
          report
            .diagnoseDecision,
        ).toMatchObject({
          decision:
            "diagnose",

          reason:
            "fault-uncertainty-favors-diagnosis",
        });

        expect(
          report
            .initialRepairBelief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          report
            .validateDecision,
        ).toMatchObject({
          decision:
            "validate",

          reason:
            "repair-uncertainty-favors-validation",
        });

        expect(
          report
            .resolvedRepairBelief
            .sufficientlyResolved,
        ).toBe(
          true,
        );
      },
    );

    it(
      "requires the resolved repair candidate to survive the adaptive protected reserve",
      () => {
        const report =
          runAdaptiveFaultModelRepairUncertaintyBenchmark();

        expect(
          report
            .protectedDecision,
        ).toMatchObject({
          decision:
            "installed",

          requirement: {
            minimumProtectedEvidence:
              4,
          },

          candidateProtectedMeanSquaredError:
            0,

          reason:
            "protected-local-repair-selected",
        });

        expect(
          report
            .repairDecision,
        ).toMatchObject({
          decision:
            "repair",

          reason:
            "protected-repair-ready",
        });
      },
    );

    it(
      "advances both fragment provenances to the evidence-derived adaptive replacements",
      () => {
        const report =
          runAdaptiveFaultModelRepairUncertaintyBenchmark();

        const y =
          report
            .installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "rev-y:program-y-fragment",
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
                "rev-z:program-z-fragment",
            );

        expect(
          y,
        ).toMatchObject({
          originRevisionId:
            "rev-y",

          activeFragmentId:
            "rev-y:program-y-fragment:adaptive-scale-0.400",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          activeFragmentId:
            "rev-z:program-z-fragment:adaptive-scale-0.700",

          generation:
            1,
        });
      },
    );

    it(
      "changes the live branch from finish to boost-finish and feeds it into receding control",
      () => {
        const report =
          runAdaptiveFaultModelRepairUncertaintyBenchmark();

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
            .goalRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          replacementGoalIds: [
            "prerequisite-revised-1-1",
          ],
        });

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );

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

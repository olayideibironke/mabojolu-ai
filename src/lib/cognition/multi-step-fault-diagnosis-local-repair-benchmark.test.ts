import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runMultiStepFaultDiagnosisLocalRepairBenchmark,
} from "./multi-step-fault-diagnosis-local-repair-benchmark";

describe(
  "multi-step fault diagnosis and probabilistic local repair benchmark",
  () => {
    it(
      "uses two contingent diagnostics to resolve the bounded two-fragment fault",
      () => {
        const report =
          runMultiStepFaultDiagnosisLocalRepairBenchmark();

        expect(
          report
            .diagnosis
            .initialBelief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          report
            .diagnosis
            .steps,
        ).toHaveLength(
          2,
        );

        expect(
          report
            .diagnosis
            .steps[
              0
            ],
        ).toMatchObject({
          probeId:
            "fault-probe:z",

          observedEffect:
            0.125,
        });

        expect(
          report
            .diagnosis
            .steps[
              1
            ],
        ).toMatchObject({
          probeId:
            "fault-probe:y",

          observedEffect:
            0.15,
        });

        expect(
          report
            .diagnosis
            .finalBelief,
        ).toMatchObject({
          topKind:
            "multi-fragment",

          sufficientlyResolved:
            true,
        });

        expect(
          report
            .diagnosis
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );

    it(
      "opens repair search only after both implicated fragments have earned quarantine",
      () => {
        const report =
          runMultiStepFaultDiagnosisLocalRepairBenchmark();

        expect(
          report.search,
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

          reason:
            "fault-posterior-authorized-local-repair-search",
        });

        expect(
          report.search
            .selectedCandidate,
        ).toMatchObject({
          replacementFragmentIds: {
            "rev-y:program-y-fragment":
              "repair-y-0.15",

            "rev-z:program-z-fragment":
              "repair-z-0.125",
          },

          discoveryMeanSquaredError:
            0,
        });
      },
    );

    it(
      "requires the repair-search winner to remain best on the fresh adaptive protected reserve",
      () => {
        const report =
          runMultiStepFaultDiagnosisLocalRepairBenchmark();

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
            .protectedDecision
            .improvement,
        ).toBeGreaterThan(
          0.1,
        );
      },
    );

    it(
      "advances both fragment provenances and replaces only the live child goal branch",
      () => {
        const report =
          runMultiStepFaultDiagnosisLocalRepairBenchmark();

        expect(
          report.installation,
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
            decision:
              "revised",

            terminalGoalPreserved:
              true,

            replacementGoalIds: [
              "prerequisite-revised-1-1",
            ],
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
            "repair-y-0.15",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          activeFragmentId:
            "repair-z-0.125",

          generation:
            1,
        });

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );
      },
    );

    it(
      "feeds the protected multi-fragment repair directly into receding-horizon control",
      () => {
        const report =
          runMultiStepFaultDiagnosisLocalRepairBenchmark();

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
            .nextRecedingDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "boost-finish",

          reason:
            "direct-action-best",
        });

        expect(
          report
            .nextRecedingDecision
            .maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );
  },
);

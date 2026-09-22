import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAdaptiveJointCandidatePruningBenchmark,
} from "./adaptive-joint-candidate-pruning-benchmark";

describe(
  "adaptive joint candidate pruning benchmark",
  () => {
    it(
      "starts with eight bounded joint structures and contracts 8 to 4 to 2 to 1",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

        expect(
          report.candidates,
        ).toHaveLength(
          8,
        );

        expect(
          report
            .diagnosis
            .steps
            .map(
              (step) => [
                step
                  .activeCandidateCountBefore,
                step
                  .activeCandidateCountAfter,
              ],
            ),
        ).toEqual([
          [
            8,
            4,
          ],
          [
            4,
            2,
          ],
          [
            2,
            1,
          ],
        ]);

        expect(
          report
            .diagnosis
            .finalCandidateSet
            .activeCandidateIds,
        ).toHaveLength(
          1,
        );

        expect(
          report
            .diagnosis
            .finalCandidateSet
            .prunedCandidateIds,
        ).toHaveLength(
          7,
        );
      },
    );

    it(
      "replans after every observation and chooses the three discriminating probes in cost-aware order",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

        expect(
          report
            .diagnosis
            .executedProbeIds,
        ).toEqual([
          "v1.35-probe:y=1.00",
          "v1.35-probe:q=1.00",
          "v1.35-probe:z=1.00+w=0.50",
        ]);

        expect(
          report
            .diagnosis
            .steps
            .every(
              (step) =>
                step.replanned,
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .diagnosis,
        ).toMatchObject({
          decision:
            "resolved",

          reason:
            "single-structural-candidate-remains",
        });
      },
    );

    it(
      "preserves reversible pruning history and can restore a removed candidate without erasing prior evidence",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

        expect(
          report
            .diagnosis
            .finalCandidateSet
            .auditHistory,
        ).toHaveLength(
          7,
        );

        expect(
          report
            .restoredAuditLength,
        ).toBe(
          8,
        );

        expect(
          report
            .diagnosis
            .finalCandidateSet
            .prunedCandidateIds,
        ).toContain(
          report
            .restoredCandidateId,
        );
      },
    );

    it(
      "reopens structural synthesis when a changed environment makes every retained candidate inadequate",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

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
            .acquiredObservations
            .length,
        ).toBeGreaterThanOrEqual(
          1,
        );
      },
    );

    it(
      "requires the resolved pruned winner to pass active protected validation before installation",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

        expect(
          report
            .protectedValidation,
        ).toMatchObject({
          decision:
            "validated",

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
            .protectedValidation
            .finalGap
            .assessment
            .decision,
        ).toBe(
          "ready",
        );
      },
    );

    it(
      "installs the protected three-fragment revision and changes live control from finish to boost-finish",
      () => {
        const report =
          runAdaptiveJointCandidatePruningBenchmark();

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
            1,

          "boost-finish":
            1.25,
        });

        expect(
          report
            .installation
            .goalRevision,
        ).toMatchObject({
          terminalGoalPreserved:
            true,
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

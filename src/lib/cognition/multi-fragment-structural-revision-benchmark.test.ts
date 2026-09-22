import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runMultiFragmentStructuralRevisionBenchmark,
} from "./multi-fragment-structural-revision-benchmark";

describe(
  "multi-fragment structural revision benchmark",
  () => {
    it(
      "keeps four bounded joint structural hypotheses live before active diagnosis",
      () => {
        const report =
          runMultiFragmentStructuralRevisionBenchmark();

        expect(
          report.candidates,
        ).toHaveLength(
          4,
        );

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
            .candidates
            .some(
              (candidate) =>
                candidate
                  .topologyChangedFragmentIds
                  .length ===
                  2,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "plans an outcome-contingent second structural diagnostic",
      () => {
        const report =
          runMultiFragmentStructuralRevisionBenchmark();

        expect(
          report.initialPlan,
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
          report
            .initialPlan
            .branches
            .some(
              (branch) =>
                branch
                  .secondProbeId ===
                "joint-structure:z=1.00+w=0.50",
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .initialPlan
            .branches
            .some(
              (branch) =>
                branch
                  .secondProbeId ===
                undefined &&
                branch
                  .posteriorConfidenceAfterFirst >
                0.95,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "executes the saturating branch and resolves the joint saturating-plus-interaction structure",
      () => {
        const report =
          runMultiFragmentStructuralRevisionBenchmark();

        expect(
          report.diagnosis,
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
          report
            .diagnosis
            .finalBelief
            .topTopologyChangedFragmentIds,
        ).toEqual([
          "rev-y:program-y-fragment",
          "rev-z:program-z-fragment",
        ]);

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
      "requires the same joint structure to survive fresh protected validation and advances both provenances",
      () => {
        const report =
          runMultiFragmentStructuralRevisionBenchmark();

        expect(
          report
            .protectedDecision,
        ).toMatchObject({
          decision:
            "installed",

          reason:
            "protected-local-repair-selected",
        });

        expect(
          report
            .protectedDecision
            .candidateProtectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );

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
      },
    );

    it(
      "changes the live branch from finish to boost-finish and feeds the joint revision into receding control",
      () => {
        const report =
          runMultiFragmentStructuralRevisionBenchmark();

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
            .installation
            .goalRevision,
        ).toMatchObject({
          decision:
            "revised",

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

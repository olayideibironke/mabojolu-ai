import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runUncertainHierarchicalProgramBenchmark,
} from "./uncertain-hierarchical-program-benchmark";

describe(
  "uncertain hierarchical program and autonomous subgoal benchmark",
  () => {
    it(
      "withholds a confident subgoal chain while hierarchical program uncertainty is unresolved",
      () => {
        const report =
          runUncertainHierarchicalProgramBenchmark();

        expect(
          report
            .priorBelief
            .confidence,
        ).toBeCloseTo(
          0.5,
        );

        expect(
          report
            .priorBelief
            .normalizedEntropy,
        ).toBeCloseTo(
          1,
        );

        expect(
          report
            .priorSubgoalPlan,
        ).toMatchObject({
          decision:
            "abstained",

          subgoals:
            [],

          reason:
            "no-safe-subgoal-plan",
        });
      },
    );

    it(
      "retains nonzero model uncertainty while concentrating on the better hierarchical program",
      () => {
        const report =
          runUncertainHierarchicalProgramBenchmark();

        expect(
          report
            .posteriorBelief
            .topProgramId,
        ).toBe(
          "full-program",
        );

        expect(
          report
            .posteriorBelief
            .confidence,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          report
            .posteriorBelief
            .probabilities[
              "partial-program"
            ],
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "forms a two-stage subgoal chain only after posterior evidence supports it",
      () => {
        const report =
          runUncertainHierarchicalProgramBenchmark();

        expect(
          report
            .posteriorSubgoalPlan,
        ).toMatchObject({
          decision:
            "planned",

          actionIds: [
            "01-prepare-xy",
            "02-bridge-yz",
          ],

          reason:
            "posterior-supported-subgoals",
        });

        expect(
          report
            .posteriorSubgoalPlan
            .goalSuccessProbability,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          report
            .posteriorSubgoalPlan
            .subgoals,
        ).toHaveLength(
          2,
        );

        expect(
          report
            .posteriorSubgoalPlan
            .subgoals[
              0
            ]!
            .targetState,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          report
            .posteriorSubgoalPlan
            .subgoals[
              1
            ]!
            .targetState,
        ).toBeCloseTo(
          1,
        );
      },
    );

    it(
      "localizes a later prediction failure to the fragment whose removal repairs the model",
      () => {
        const report =
          runUncertainHierarchicalProgramBenchmark();

        expect(
          report
            .fragmentFailureDiagnosis
            .blamedFragmentIds,
        ).toEqual([
          "bad-yz-fragment",
        ]);

        expect(
          report
            .fragmentFailureDiagnosis
            .attributions[
              0
            ],
        ).toMatchObject({
          fragmentId:
            "bad-yz-fragment",

          blamed:
            true,
        });
      },
    );

    it(
      "materializes and advances autonomous subgoals inside the existing goal hierarchy",
      () => {
        const report =
          runUncertainHierarchicalProgramBenchmark();

        expect(
          report
            .materializedGoalIds,
        ).toEqual([
          "autonomous-subgoal-1",
          "autonomous-subgoal-2",
        ]);

        expect(
          report
            .completedAfterIntermediateObservation,
        ).toEqual([
          "autonomous-subgoal-1",
        ]);

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "autonomous-subgoal-2",
        );

        const first =
          report
            .hierarchyAfterIntermediateObservation
            .goals
            .find(
              (goal) =>
                goal.id ===
                "autonomous-subgoal-1",
            );

        const second =
          report
            .hierarchyAfterIntermediateObservation
            .goals
            .find(
              (goal) =>
                goal.id ===
                "autonomous-subgoal-2",
            );

        expect(
          first
            ?.status,
        ).toBe(
          "completed",
        );

        expect(
          second
            ?.status,
        ).toBe(
          "pending",
        );
      },
    );
  },
);

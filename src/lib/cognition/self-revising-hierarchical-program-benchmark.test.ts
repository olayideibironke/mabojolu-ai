import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runSelfRevisingHierarchicalProgramBenchmark,
} from "./self-revising-hierarchical-program-benchmark";

describe(
  "self-revising hierarchical causal program benchmark",
  () => {
    it(
      "accumulates cross-episode reliability and quarantines only the repeatedly blamed fragment",
      () => {
        const report =
          runSelfRevisingHierarchicalProgramBenchmark();

        const xy =
          report
            .reliability
            .fragments
            .find(
              (fragment) =>
                fragment.fragmentId ===
                "xy-fragment",
            );

        const yz =
          report
            .reliability
            .fragments
            .find(
              (fragment) =>
                fragment.fragmentId ===
                "bad-yz-fragment",
            );

        expect(
          xy,
        ).toMatchObject({
          supportEpisodes:
            2,

          blameEpisodes:
            0,

          quarantined:
            false,
        });

        expect(
          xy!
            .posteriorReliability,
        ).toBeCloseTo(
          0.75,
        );

        expect(
          yz,
        ).toMatchObject({
          blameEpisodes:
            3,

          quarantined:
            true,
        });

        expect(
          yz!
            .posteriorReliability,
        ).toBeCloseTo(
          0.2,
        );

        expect(
          report
            .reliability
            .quarantinedFragmentIds,
        ).toEqual([
          "bad-yz-fragment",
        ]);
      },
    );

    it(
      "repairs the quarantined fragment only after the replacement wins protected validation",
      () => {
        const report =
          runSelfRevisingHierarchicalProgramBenchmark();

        expect(
          report
            .programRevision,
        ).toMatchObject({
          decision:
            "repaired",

          retiredFragmentIds: [
            "bad-yz-fragment",
          ],

          replacementFragmentIds: {
            "bad-yz-fragment":
              "repaired-yz-fragment",
          },

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-repair",
        });

        expect(
          report
            .programRevision
            .program
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "repaired-yz-fragment",
        ]);

        expect(
          report
            .programRevision
            .improvement,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "detects a material progress miss and replaces the stale subgoal chain from the observed state",
      () => {
        const report =
          runSelfRevisingHierarchicalProgramBenchmark();

        expect(
          report
            .originalSubgoalPlan
            .subgoals[
              0
            ]!
            .targetState,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          report
            .subgoalRevision,
        ).toMatchObject({
          decision:
            "revised",

          observedState:
            0.45,

          staleGoalIds: [
            "autonomous-subgoal-1",
            "autonomous-subgoal-2",
          ],

          replacementGoalIds: [
            "revised-subgoal-1-1",
            "revised-subgoal-1-2",
          ],

          reason:
            "posterior-supported-revision",
        });

        expect(
          report
            .subgoalRevision
            .divergence,
        ).toBeCloseTo(
          0.25,
        );

        expect(
          report
            .subgoalRevision
            .revisedPlan
            ?.actionIds,
        ).toEqual([
          "02-bridge-yz",
          "03-finish-x",
        ]);

        expect(
          report
            .subgoalRevision
            .revisedPlan
            ?.subgoals[
              0
            ]!
            .targetState,
        ).toBeCloseTo(
          0.95,
        );

        expect(
          report
            .subgoalRevision
            .revisedPlan
            ?.subgoals[
              1
            ]!
            .targetState,
        ).toBeCloseTo(
          1,
        );
      },
    );

    it(
      "retires the stale goals and makes the first revised goal actionable",
      () => {
        const report =
          runSelfRevisingHierarchicalProgramBenchmark();

        const oldOne =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "autonomous-subgoal-1",
            );

        const oldTwo =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "autonomous-subgoal-2",
            );

        const revisedOne =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "revised-subgoal-1-1",
            );

        const revisedTwo =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "revised-subgoal-1-2",
            );

        expect(
          oldOne
            ?.status,
        ).toBe(
          "abandoned",
        );

        expect(
          oldTwo
            ?.status,
        ).toBe(
          "abandoned",
        );

        expect(
          revisedOne
            ?.status,
        ).toBe(
          "pending",
        );

        expect(
          revisedTwo
            ?.dependsOnGoalIds,
        ).toEqual([
          "revised-subgoal-1-1",
        ]);

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "revised-subgoal-1-1",
        );
      },
    );

    it(
      "preserves the protected terminal objective and inherited safety constraints through revision",
      () => {
        const report =
          runSelfRevisingHierarchicalProgramBenchmark();

        expect(
          report
            .subgoalRevision
            .terminalGoalPreserved,
        ).toBe(
          true,
        );

        expect(
          report
            .terminalGoalDescriptionAfter,
        ).toBe(
          report
            .terminalGoalDescriptionBefore,
        );

        expect(
          report
            .terminalGoalConstraintsAfter,
        ).toEqual(
          report
            .terminalGoalConstraintsBefore,
        );

        const revisedOne =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "revised-subgoal-1-1",
            );

        expect(
          revisedOne
            ?.constraints,
        ).toEqual(
          expect.arrayContaining([
            "Use only safe reversible actions.",
            "Preserve terminal objective.",
            "Preserve the terminal objective and inherited safety constraints during revision.",
          ]),
        );
      },
    );
  },
);

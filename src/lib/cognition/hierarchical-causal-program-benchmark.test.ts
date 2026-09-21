import {
  describe,
  expect,
  it,
} from "vitest";

import {
  summarizePolicyPathForMechanism,
} from "./hierarchical-causal-program";

import {
  runHierarchicalCausalProgramBenchmark,
} from "./hierarchical-causal-program-benchmark";

describe(
  "hierarchical causal program and long-horizon dual-control benchmark",
  () => {
    it(
      "promotes a two-fragment causal program that beats every single-fragment baseline on protected evidence",
      () => {
        const report =
          runHierarchicalCausalProgramBenchmark();

        expect(
          report
            .hierarchicalDecision,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "base-program",

          reason:
            "validated-hierarchical-program",
        });

        expect(
          report
            .hierarchicalDecision
            .champion
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "yz-fragment",
        ]);

        expect(
          report
            .hierarchicalProtectedError,
        ).toBeCloseTo(
          0,
        );

        expect(
          report
            .hierarchicalProtectedError,
        ).toBeLessThan(
          report
            .bestSingleFragmentProtectedError,
        );
      },
    );

    it(
      "keeps discovery and protected hierarchical-program evidence disjoint",
      () => {
        const report =
          runHierarchicalCausalProgramBenchmark();

        expect(
          report
            .discoveryObservationIds,
        ).toHaveLength(
          3,
        );

        expect(
          report
            .protectedObservationIds,
        ).toHaveLength(
          5,
        );

        expect(
          report
            .discoveryObservationIds
            .some(
              (id) =>
                report
                  .protectedObservationIds
                  .includes(
                    id,
                  ),
            ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "uses a depth-three mixed experiment-action policy to reach the goal with certainty",
      () => {
        const report =
          runHierarchicalCausalProgramBenchmark();

        expect(
          report
            .longHorizonPlan,
        ).toMatchObject({
          decision:
            "plan",

          expectedGoalSuccessProbability:
            1,

          expectedCost:
            0.13,

          maximumRisk:
            0.1,

          reason:
            "safe-long-horizon-policy",
        });

        expect(
          report
            .longHorizonPlan
            .root,
        ).toMatchObject({
          kind:
            "experiment",

          selectedId:
            "probe-z",

          depthRemaining:
            3,
        });
      },
    );

    it(
      "branches into different reusable action programs after the causal probe",
      () => {
        const report =
          runHierarchicalCausalProgramBenchmark();

        expect(
          summarizePolicyPathForMechanism(
            report
              .longHorizonPlan
              .root!,
            "slow",
          ),
        ).toEqual([
          "probe-z",
          "slow-a",
          "slow-b",
          "stop",
        ]);

        expect(
          summarizePolicyPathForMechanism(
            report
              .longHorizonPlan
              .root!,
            "fast",
          ),
        ).toEqual([
          "probe-z",
          "fast-a",
          "fast-b",
          "stop",
        ]);
      },
    );

    it(
      "shows that the same horizon cannot reach the goal when information gathering is removed",
      () => {
        const report =
          runHierarchicalCausalProgramBenchmark();

        expect(
          report
            .actionOnlyPlan
            .decision,
        ).toBe(
          "plan",
        );

        expect(
          report
            .actionOnlyGoalSuccessProbability,
        ).toBe(
          0,
        );

        expect(
          report
            .longHorizonGoalSuccessProbability,
        ).toBe(
          1,
        );

        expect(
          report
            .longHorizonPlan
            .expectedUtility,
        ).toBeGreaterThan(
          report
            .actionOnlyPlan
            .expectedUtility,
        );
      },
    );
  },
);

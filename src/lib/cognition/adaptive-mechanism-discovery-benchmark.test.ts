import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAdaptiveMechanismDiscoveryBenchmark,
} from "./adaptive-mechanism-discovery-benchmark";

describe(
  "adaptive mechanism discovery benchmark",
  () => {
    it(
      "learns the missing causal effect online and detects incumbent model inadequacy",
      () => {
        const report =
          runAdaptiveMechanismDiscoveryBenchmark();

        expect(
          report
            .parameterLearning
            .effects
            .x!
            .mean,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          report
            .parameterLearning
            .effects
            .x!
            .samples,
        ).toBe(
          3,
        );

        expect(
          report
            .inadequacy
            .adequate,
        ).toBe(
          false,
        );
      },
    );

    it(
      "promotes a bounded challenger only after separate protected validation",
      () => {
        const report =
          runAdaptiveMechanismDiscoveryBenchmark();

        expect(
          report
            .championDecision,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "incumbent-low-x",

          reason:
            "validated-challenger",
        });

        expect(
          report
            .championDecision
            .champion
            .effects
            .x,
        ).toBeCloseTo(
          0.72,
        );

        expect(
          report
            .championDecision
            .improvement,
        ).toBeGreaterThan(
          0.25,
        );
      },
    );

    it(
      "uses a contingent experiment tree to stop early when the first observation is decisive",
      () => {
        const report =
          runAdaptiveMechanismDiscoveryBenchmark();

        expect(
          report
            .openLoopExperimentIds,
        ).toEqual([
          "cheap-x",
          "cheap-y",
        ]);

        expect(
          report
            .openLoopExperimentCost,
        ).toBeCloseTo(
          0.1,
        );

        expect(
          report
            .contingentPolicy
            .firstExperimentId,
        ).toBe(
          "cheap-x",
        );

        expect(
          report
            .contingentRuntimeBranch,
        ).toMatchObject({
          representativeMechanismId:
            "mechanism-3",

          nextExperimentId:
            undefined,
        });

        expect(
          report
            .contingentExecutedExperimentIds,
        ).toEqual([
          "cheap-x",
        ]);

        expect(
          report
            .contingentExecutedCost,
        ).toBeCloseTo(
          0.05,
        );

        expect(
          report
            .contingentExecutedCost,
        ).toBeLessThan(
          report
            .openLoopExperimentCost,
        );
      },
    );

    it(
      "executes only the first action of an initial multi-step plan and stops after the observed state already reaches the goal",
      () => {
        const report =
          runAdaptiveMechanismDiscoveryBenchmark();

        expect(
          report
            .initialActionDecision,
        ).toMatchObject({
          decision:
            "act",

          actionId:
            "boost-x",

          reason:
            "execute-first-safe-action",
        });

        expect(
          report
            .initialActionDecision
            .underlyingPlan
            ?.actionIds,
        ).toEqual([
          "boost-x",
          "boost-y",
        ]);

        expect(
          report
            .replannedActionDecision,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "goal-already-reached",
        });
      },
    );
  },
);

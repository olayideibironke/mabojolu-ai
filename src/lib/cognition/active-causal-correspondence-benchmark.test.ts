import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runActiveCausalCorrespondenceBenchmark,
} from "./active-causal-correspondence-benchmark";

describe(
  "active causal correspondence benchmark",
  () => {
    it(
      "resolves the hidden mapping with fewer experiments than the passive single-probe baseline",
      () => {
        const report =
          runActiveCausalCorrespondenceBenchmark();

        expect(
          report
            .activeResolution,
        ).toMatchObject({
          decision:
            "resolved",

          variableSet: [
            "demandShock",
            "forecastUncertainty",
            "queuePressure",
          ],
        });

        expect(
          report
            .passiveResolution
            .decision,
        ).toBe(
          "resolved",
        );

        expect(
          report
            .activeExperimentIds,
        ).toEqual([
          "pair-core",
          "pair-holiday",
          "pair-queue",
        ]);

        expect(
          report
            .activeExperimentIds
            .length,
        ).toBeLessThan(
          report
            .passiveExperimentIds
            .length,
        );
      },
    );

    it(
      "uses lower total experiment cost while respecting the causal safety ceiling",
      () => {
        const report =
          runActiveCausalCorrespondenceBenchmark();

        expect(
          report
            .activeExperimentCost,
        ).toBeLessThan(
          report
            .passiveExperimentCost,
        );

        expect(
          report
            .activeMaximumRisk,
        ).toBeLessThanOrEqual(
          0.3,
        );

        expect(
          report
            .blockedUnsafeExperimentIds,
        ).toContain(
          "unsafe-triple",
        );

        expect(
          report
            .activeExperimentIds,
        ).not.toContain(
          "unsafe-triple",
        );
      },
    );

    it(
      "uses the learned correspondence to produce a safe goal-reaching plan",
      () => {
        const report =
          runActiveCausalCorrespondenceBenchmark();

        expect(
          report
            .plannerDecision,
        ).toMatchObject({
          decision:
            "act",

          action: {
            id:
              "raise-demand",
          },

          reason:
            "safe-goal-reaching-action",
        });

        expect(
          report
            .plannerGoalReached,
        ).toBe(
          true,
        );
      },
    );

    it(
      "beats a cheapest-action baseline that is fooled by an irrelevant target variable",
      () => {
        const report =
          runActiveCausalCorrespondenceBenchmark();

        expect(
          report
            .cheapestBaselineActionId,
        ).toBe(
          "cheap-nuisance",
        );

        expect(
          report
            .cheapestBaselineGoalReached,
        ).toBe(
          false,
        );

        expect(
          report
            .plannerGoalReached,
        ).toBe(
          true,
        );
      },
    );
  },
);

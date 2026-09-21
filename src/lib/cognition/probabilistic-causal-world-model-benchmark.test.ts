import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runProbabilisticCausalWorldModelBenchmark,
} from "./probabilistic-causal-world-model-benchmark";

describe(
  "probabilistic causal world-model transfer benchmark",
  () => {
    it(
      "uses multi-step experiment lookahead to replace one expensive probe with two cheap complementary probes",
      () => {
        const report =
          runProbabilisticCausalWorldModelBenchmark();

        expect(
          report
            .myopicExperimentPlan,
        ).toMatchObject({
          decision:
            "plan",

          experimentIds: [
            "direct-z",
          ],

          totalCost:
            0.5,
        });

        expect(
          report
            .lookaheadExperimentPlan,
        ).toMatchObject({
          decision:
            "plan",

          experimentIds: [
            "cheap-x",
            "cheap-y",
          ],

          totalCost:
            0.1,
        });

        expect(
          report
            .lookaheadExperimentPlan
            .score,
        ).toBeGreaterThan(
          report
            .myopicExperimentPlan
            .score,
        );
      },
    );

    it(
      "preserves strong identification under noisy observations while cutting experiment cost",
      () => {
        const report =
          runProbabilisticCausalWorldModelBenchmark();

        expect(
          report
            .myopicBelief
            .topMechanismId,
        ).toBe(
          report
            .trueMechanismId,
        );

        expect(
          report
            .lookaheadBelief
            .topMechanismId,
        ).toBe(
          report
            .trueMechanismId,
        );

        expect(
          report
            .myopicBelief
            .confidence,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          report
            .lookaheadBelief
            .confidence,
        ).toBeGreaterThan(
          0.999999,
        );

        expect(
          report
            .lookaheadExecutedCost,
        ).toBeLessThan(
          report
            .myopicExecutedCost,
        );

        expect(
          report
            .lookaheadExecutedCost,
        ).toBeCloseTo(
          0.1,
        );

        expect(
          report
            .myopicExecutedCost,
        ).toBeCloseTo(
          0.5,
        );
      },
    );

    it(
      "keeps every executed experiment below the safety ceiling and blocks the irreversible probe",
      () => {
        const report =
          runProbabilisticCausalWorldModelBenchmark();

        expect(
          report
            .myopicExecutedRisk,
        ).toBeLessThanOrEqual(
          0.3,
        );

        expect(
          report
            .lookaheadExecutedRisk,
        ).toBeLessThanOrEqual(
          0.3,
        );

        expect(
          report
            .blockedUnsafeExperimentIds,
        ).toContain(
          "unsafe-all",
        );
      },
    );

    it(
      "requires multi-step world-model planning when no single safe action can reach the goal",
      () => {
        const report =
          runProbabilisticCausalWorldModelBenchmark();

        expect(
          report
            .horizonOneActionPlan,
        ).toMatchObject({
          decision:
            "abstained",

          actionIds:
            [],

          reason:
            "no-safe-goal-plan",
        });

        expect(
          report
            .horizonTwoActionPlan,
        ).toMatchObject({
          decision:
            "plan",

          actionIds: [
            "boost-x",
            "boost-y",
          ],

          goalSuccessProbability:
            1,

          totalCost:
            0.22,

          maximumRisk:
            0.1,

          reason:
            "safe-probabilistic-goal-plan",
        });
      },
    );

    it(
      "uses the posterior over competing mechanisms rather than collapsing uncertainty before planning",
      () => {
        const report =
          runProbabilisticCausalWorldModelBenchmark();

        const probabilities =
          Object.values(
            report
              .lookaheadBelief
              .probabilities,
          );

        expect(
          probabilities.reduce(
            (
              total,
              probability,
            ) =>
              total +
              probability,
            0,
          ),
        ).toBeCloseTo(
          1,
        );

        expect(
          probabilities.filter(
            (probability) =>
              probability >
              0,
          ),
        ).toHaveLength(
          3,
        );

        expect(
          report
            .horizonTwoActionPlan
            .goalSuccessProbability,
        ).toBeGreaterThanOrEqual(
          0.9,
        );
      },
    );
  },
);

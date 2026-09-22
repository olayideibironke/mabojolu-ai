import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runRecedingHorizonMultidimensionalBenchmark,
} from "./receding-horizon-multidimensional-dual-control-benchmark";

describe(
  "receding-horizon multidimensional dual-control benchmark",
  () => {
    it(
      "starts with an informative preparation action because it both advances readiness and resolves route uncertainty",
      () => {
        const report =
          runRecedingHorizonMultidimensionalBenchmark();

        expect(
          report.initialDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "prepare-diagnostic",

          reason:
            "informative-action-best",
        });

        expect(
          report
            .initialDecision
            .valueOverOpenLoop,
        ).toBeGreaterThan(
          0.2,
        );
      },
    );

    it(
      "updates the fast-world posterior and vector state after the real preparation observation",
      () => {
        const report =
          runRecedingHorizonMultidimensionalBenchmark();

        expect(
          report
            .fastPosteriorConfidenceAfterPrepare,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          report
            .fastStateAfterPrepare,
        ).toMatchObject({
          readiness:
            0.8,

          progress:
            0.1,

          exposure:
            0.05,
        });
      },
    );

    it(
      "replans to different finish actions after the same first action under different realized worlds",
      () => {
        const report =
          runRecedingHorizonMultidimensionalBenchmark();

        expect(
          report.fastReplan,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "finish-fast",

          reason:
            "direct-action-best",
        });

        expect(
          report.slowReplan,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "finish-slow",

          reason:
            "direct-action-best",
        });
      },
    );

    it(
      "executes only the selected next control and then stops after the multidimensional goal is reached",
      () => {
        const report =
          runRecedingHorizonMultidimensionalBenchmark();

        expect(
          report.fastHistoryIds,
        ).toEqual([
          "prepare-diagnostic",
          "finish-fast",
        ]);

        expect(
          report.fastFinalDecision,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "goal-satisfied",
        });
      },
    );

    it(
      "can switch to a pure experiment when readiness is already satisfied and blind route execution is more expensive",
      () => {
        const report =
          runRecedingHorizonMultidimensionalBenchmark();

        expect(
          report
            .readyStateExperimentDecision,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "probe-route",

          reason:
            "pure-experiment-best",
        });

        expect(
          report
            .readyStateExperimentDecision
            .valueOverOpenLoop,
        ).toBeGreaterThan(
          0,
        );
      },
    );
  },
);

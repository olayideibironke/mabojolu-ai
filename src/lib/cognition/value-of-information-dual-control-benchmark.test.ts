import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runValueOfInformationDualControlBenchmark,
} from "./value-of-information-dual-control-benchmark";

describe(
  "value-of-information mixed dual-control benchmark",
  () => {
    it(
      "selects an informative task action when learning and progress together beat both open-loop control and a pure experiment",
      () => {
        const report =
          runValueOfInformationDualControlBenchmark();

        expect(
          report
            .informativeActionDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "diagnostic-progress",

          reason:
            "informative-action-worth-value",
        });

        expect(
          report
            .informativeActionValueOfInformation,
        ).toBeGreaterThan(
          0.05,
        );

        expect(
          report
            .informativeActionFollowUps,
        ).toEqual({
          "slow-world":
            "finish-slow",

          "fast-world":
            "finish-fast",
        });
      },
    );

    it(
      "switches to a pure experiment when informative task actions become too expensive and slow",
      () => {
        const report =
          runValueOfInformationDualControlBenchmark();

        expect(
          report
            .pureExperimentDecision,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "pure-probe",

          reason:
            "pure-experiment-worth-value",
        });

        expect(
          report
            .pureExperimentValueOfInformation,
        ).toBeGreaterThan(
          0.1,
        );
      },
    );

    it(
      "stops buying information when every plausible mechanism already implies the same safe action",
      () => {
        const report =
          runValueOfInformationDualControlBenchmark();

        expect(
          report
            .invariantPlanDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "universal-finish",

          valueOfInformation:
            0,

          reason:
            "information-not-worth-cost",
        });
      },
    );

    it(
      "keeps the informative-action policy inside the hard risk ceiling",
      () => {
        const report =
          runValueOfInformationDualControlBenchmark();

        expect(
          report
            .informativeActionDecision
            .maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );

        expect(
          report
            .informativeActionDecision
            .selectedPolicy
            ?.expectedTaskUtility,
        ).toBeCloseTo(
          1,
        );
      },
    );
  },
);

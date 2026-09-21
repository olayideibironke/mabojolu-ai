import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runSelfCalibratingRepresentationBenchmark,
} from "./self-calibrating-representation-benchmark";

describe(
  "self-calibrating representation benchmark",
  () => {
    it(
      "promotes the derived representation only after protected validation beats the raw champion",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        const raw =
          report.validationResults.find(
            (result) =>
              result.profileId ===
              "raw-default",
          );

        const derived =
          report.validationResults.find(
            (result) =>
              result.profileId ===
              "drift-compressed",
          );

        expect(
          raw,
        ).toBeDefined();

        expect(
          derived,
        ).toBeDefined();

        expect(
          derived!
            .cumulativeRegret,
        ).toBeLessThan(
          raw!
            .cumulativeRegret,
        );

        expect(
          report
            .calibrationDecision,
        ).toMatchObject({
          championProfileId:
            "drift-compressed",

          previousChampionProfileId:
            "raw-default",

          promoted:
            true,

          reason:
            "validated-improvement",
        });
      },
    );

    it(
      "uses fresh protected evaluations so the raw representation cannot learn through validation exposure",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        const raw =
          report.validationResults.find(
            (result) =>
              result.profileId ===
              "raw-default",
          );

        expect(
          raw,
        ).toMatchObject({
          episodes:
            4,

          abstentions:
            4,

          oracleMatches:
            0,
        });

        expect(
          raw!
            .cumulativeRegret,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "lets the promoted representation resolve every protected validation episode without unsafe outcomes",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        const derived =
          report.validationResults.find(
            (result) =>
              result.profileId ===
              "drift-compressed",
          );

        expect(
          derived,
        ).toMatchObject({
          episodes:
            4,

          cumulativeRegret:
            0,

          abstentions:
            0,

          oracleMatches:
            4,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });
      },
    );

    it(
      "generalizes the promoted representation to a shifted final holdout",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        expect(
          report
            .finalChampionResult
            .profileId,
        ).toBe(
          "drift-compressed",
        );

        expect(
          report
            .finalChampionResult
            .episodes,
        ).toBe(
          8,
        );

        expect(
          report
            .finalChampionResult
            .cumulativeRegret,
        ).toBe(
          0,
        );

        expect(
          report
            .finalChampionResult
            .oracleMatches,
        ).toBe(
          8,
        );

        expect(
          report
            .finalArchivedChampionResult
            .cumulativeRegret,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "retains the promoted champion when final protected evidence confirms the gain",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        expect(
          report
            .rollbackDecision,
        ).toMatchObject({
          championProfileId:
            "drift-compressed",

          rolledBack:
            false,

          reason:
            "champion-retained",
        });

        expect(
          report
            .championProfileId,
        ).toBe(
          "drift-compressed",
        );
      },
    );

    it(
      "preserves structural revision under the promoted representation",
      () => {
        const report =
          runSelfCalibratingRepresentationBenchmark();

        expect(
          report
            .championRevision
            .events,
        ).toHaveLength(
          1,
        );

        expect(
          report
            .championRevision
            .events[
              0
            ],
        ).toMatchObject({
          type:
            "split",
        });
      },
    );
  },
);

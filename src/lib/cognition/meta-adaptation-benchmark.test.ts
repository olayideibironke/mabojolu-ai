import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DEFAULT_META_ADAPTATION_BENCHMARK,
  runMetaAdaptationBenchmark,
  type MetaAdaptationBenchmarkEpisode,
} from "./meta-adaptation-benchmark";

describe(
  "meta-adaptation benchmark",
  () => {
    it(
      "compares the learning controller against the fixed balanced baseline without oracle leakage",
      () => {
        const report =
          runMetaAdaptationBenchmark(
            DEFAULT_META_ADAPTATION_BENCHMARK,
          );

        expect(
          report.staticPolicyId,
        ).toBe(
          "balanced",
        );

        expect(
          report.episodes,
        ).toHaveLength(
          24,
        );

        expect(
          report.episodes[0],
        ).toMatchObject({
          episodeId:
            "cal-stationary-1",

          selectedPolicyId:
            "conservative",

          selectionReason:
            "family-exploration",

          oraclePolicyId:
            "conservative",

          regret:
            0,
        });

        expect(
          report.episodes[4],
        ).toMatchObject({
          episodeId:
            "cal-gradual-1",

          selectedPolicyId:
            "conservative",

          selectionReason:
            "cross-family-transfer",

          oraclePolicyId:
            "balanced",
        });

        expect(
          report.episodes[8],
        ).toMatchObject({
          episodeId:
            "cal-abrupt-1",

          selectedPolicyId:
            "conservative",

          selectionReason:
            "cross-family-transfer",

          oraclePolicyId:
            "responsive",
        });
      },
    );

    it(
      "reduces regret after calibration on the held-out mixed regime sequence",
      () => {
        const report =
          runMetaAdaptationBenchmark(
            DEFAULT_META_ADAPTATION_BENCHMARK,
          );

        expect(
          report.calibration
            .meanRegret,
        ).toBeGreaterThan(
          0.3,
        );

        expect(
          report.heldOut
            .meanRegret,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .meanRegret,
        ).toBeLessThan(
          report.calibration
            .meanRegret,
        );

        expect(
          report.heldOut
            .cumulativeRegret,
        ).toBe(
          0,
        );
      },
    );

    it(
      "outperforms the fixed balanced policy on held-out utility, false alarms, and abrupt-change delay",
      () => {
        const report =
          runMetaAdaptationBenchmark(
            DEFAULT_META_ADAPTATION_BENCHMARK,
          );

        expect(
          report.heldOut
            .metaAdaptive
            .cumulativeUtility,
        ).toBeGreaterThan(
          report.heldOut
            .staticBaseline
            .cumulativeUtility,
        );

        expect(
          report.heldOut
            .metaAdaptive
            .falseAlarms,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .falseAlarms,
        );

        expect(
          report.heldOut
            .metaAdaptive
            .meanDetectionDelay,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .meanDetectionDelay!,
        );

        expect(
          report.heldOut
            .metaAdaptive
            .falsePromotions,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .metaAdaptive
            .missedChanges,
        ).toBe(
          0,
        );
      },
    );

    it(
      "selects the learned family-specific oracle policy throughout the held-out sequence",
      () => {
        const report =
          runMetaAdaptationBenchmark(
            DEFAULT_META_ADAPTATION_BENCHMARK,
          );

        const heldOut =
          report.episodes.filter(
            (episode) =>
              episode.phase ===
              "held-out",
          );

        for (
          const episode of
            heldOut
        ) {
          expect(
            episode
              .selectedPolicyId,
          ).toBe(
            episode
              .oraclePolicyId,
          );

          expect(
            episode.regret,
          ).toBe(
            0,
          );

          expect(
            episode
              .selectionReason,
          ).toBe(
            "family-evidence",
          );
        }
      },
    );

    it(
      "tracks non-negative cumulative regret against the episode oracle",
      () => {
        const report =
          runMetaAdaptationBenchmark(
            DEFAULT_META_ADAPTATION_BENCHMARK,
          );

        let previous =
          0;

        for (
          const episode of
            report.episodes
        ) {
          expect(
            episode.regret,
          ).toBeGreaterThanOrEqual(
            0,
          );

          expect(
            episode
              .oracleUtility,
          ).toBeGreaterThanOrEqual(
            episode
              .metaUtility,
          );

          expect(
            episode
              .cumulativeRegret,
          ).toBeGreaterThanOrEqual(
            previous,
          );

          previous =
            episode
              .cumulativeRegret;
        }

        expect(
          report.overall
            .cumulativeRegret,
        ).toBeCloseTo(
          previous,
        );
      },
    );

    it(
      "rejects benchmark episodes that omit a bounded policy counterfactual",
      () => {
        const incomplete:
          MetaAdaptationBenchmarkEpisode = {
          id:
            "incomplete",

          phase:
            "calibration",

          family:
            "abrupt-drift",

          outcomes: {
            balanced: {
              trueRegimeChange:
                true,

              changeDetected:
                true,

              detectionDelay:
                2,

              recoverySucceeded:
                true,

              falsePromotion:
                false,

              validationEvidenceCost:
                3,
            },
          },
        };

        expect(
          () =>
            runMetaAdaptationBenchmark([
              incomplete,
            ]),
        ).toThrow(
          /missing outcome for policy conservative/,
        );
      },
    );

    it(
      "rejects duplicate episode ids so regret traces remain auditable",
      () => {
        const first =
          DEFAULT_META_ADAPTATION_BENCHMARK[0];

        expect(
          () =>
            runMetaAdaptationBenchmark([
              first,
              first,
            ]),
        ).toThrow(
          /Duplicate benchmark episode id/,
        );
      },
    );
  },
);

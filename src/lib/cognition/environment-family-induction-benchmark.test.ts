import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK,
  runEnvironmentFamilyInductionBenchmark,
} from "./environment-family-induction-benchmark";

describe(
  "environment-family induction benchmark",
  () => {
    it(
      "runs observation-only induction against both label-supplied meta-adaptation and the fixed baseline",
      () => {
        const report =
          runEnvironmentFamilyInductionBenchmark();

        expect(
          report.episodes,
        ).toHaveLength(
          DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK.length,
        );

        expect(
          report.heldOut
            .autonomous
            .cumulativeUtility,
        ).toBeCloseTo(
          report.heldOut
            .labelSupplied
            .cumulativeUtility,
        );

        expect(
          report.heldOut
            .autonomous
            .cumulativeUtility,
        ).toBeGreaterThan(
          report.heldOut
            .staticBaseline
            .cumulativeUtility,
        );
      },
    );

    it(
      "resolves shifted held-out signals correctly whenever confidence is sufficient",
      () => {
        const report =
          runEnvironmentFamilyInductionBenchmark();

        expect(
          report.heldOut
            .inference
            .inferredEpisodes,
        ).toBe(
          7,
        );

        expect(
          report.heldOut
            .inference
            .abstentions,
        ).toBe(
          1,
        );

        expect(
          report.heldOut
            .inference
            .inferenceCoverage,
        ).toBeCloseTo(
          7 /
            8,
        );

        expect(
          report.heldOut
            .inference
            .resolvedFamilyAccuracy,
        ).toBe(
          1,
        );
      },
    );

    it(
      "abstains on the deliberately ambiguous held-out episode instead of fabricating certainty",
      () => {
        const report =
          runEnvironmentFamilyInductionBenchmark();

        const ambiguous =
          report.episodes.find(
            (episode) =>
              episode.episodeId ===
              "held-gradual-2",
          );

        expect(
          ambiguous,
        ).toMatchObject({
          trueFamily:
            "gradual-drift",

          decision:
            "uncertainty-abstention",

          autonomousPolicyId:
            "balanced",

          labelSuppliedPolicyId:
            "balanced",
        });

        expect(
          ambiguous!
            .inferenceConfidence,
        ).toBeLessThan(
          0.58,
        );
      },
    );

    it(
      "keeps held-out false promotions and missed changes at zero while improving on the static baseline",
      () => {
        const report =
          runEnvironmentFamilyInductionBenchmark();

        expect(
          report.heldOut
            .autonomous
            .falsePromotions,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .autonomous
            .missedChanges,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .autonomous
            .falseAlarms,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .falseAlarms,
        );

        expect(
          report.heldOut
            .autonomous
            .meanDetectionDelay,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .meanDetectionDelay!,
        );
      },
    );

    it(
      "matches the label-supplied control's held-out regret without receiving true labels for policy selection",
      () => {
        const report =
          runEnvironmentFamilyInductionBenchmark();

        expect(
          report.heldOut
            .autonomousCumulativeRegret,
        ).toBeCloseTo(
          report.heldOut
            .labelSuppliedCumulativeRegret,
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
              .autonomousPolicyId,
          ).toBe(
            episode
              .labelSuppliedPolicyId,
          );
        }
      },
    );
  },
);

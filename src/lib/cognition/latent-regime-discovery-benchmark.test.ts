import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runLatentRegimeDiscoveryBenchmark,
} from "./latent-regime-discovery-benchmark";

describe(
  "latent regime discovery benchmark",
  () => {
    it(
      "discovers four pure unnamed regimes during calibration",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

        expect(
          report.calibration
            .discovery
            .uniqueRegimes,
        ).toBe(
          4,
        );

        expect(
          report.calibration
            .discovery
            .newRegimeAssignments,
        ).toBe(
          4,
        );

        expect(
          report.calibration
            .discovery
            .clusterPurity,
        ).toBe(
          1,
        );

        expect(
          report.latentAudit
            .regimeCount,
        ).toBe(
          4,
        );

        expect(
          report.latentAudit
            .regimes
            .map(
              (regime) =>
                regime.id,
            ),
        ).toEqual([
          "regime-001",
          "regime-002",
          "regime-003",
          "regime-004",
        ]);
      },
    );

    it(
      "reuses learned latent regimes throughout the held-out mixed sequence",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

        expect(
          report.heldOut
            .discovery
            .newRegimeAssignments,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .discovery
            .existingRegimeAssignments,
        ).toBe(
          7,
        );

        expect(
          report.heldOut
            .discovery
            .abstentions,
        ).toBe(
          1,
        );

        expect(
          report.heldOut
            .discovery
            .assignmentCoverage,
        ).toBeCloseTo(
          7 /
            8,
        );

        expect(
          report.heldOut
            .discovery
            .clusterPurity,
        ).toBe(
          1,
        );

        expect(
          report.heldOut
            .discovery
            .reactivations,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "matches the label-supplied controller's held-out policy choices without using family names",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

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
              .latentPolicyId,
          ).toBe(
            episode
              .labelSuppliedPolicyId,
          );
        }

        expect(
          report.heldOut
            .latent
            .cumulativeUtility,
        ).toBeCloseTo(
          report.heldOut
            .labelSupplied
            .cumulativeUtility,
        );

        expect(
          report.heldOut
            .latentCumulativeRegret,
        ).toBeCloseTo(
          report.heldOut
            .labelSuppliedCumulativeRegret,
        );
      },
    );

    it(
      "beats the fixed balanced baseline on held-out utility and false alarms without introducing false promotions",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

        expect(
          report.heldOut
            .latent
            .cumulativeUtility,
        ).toBeGreaterThan(
          report.heldOut
            .staticBaseline
            .cumulativeUtility,
        );

        expect(
          report.heldOut
            .latent
            .falseAlarms,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .falseAlarms,
        );

        expect(
          report.heldOut
            .latent
            .meanDetectionDelay,
        ).toBeLessThan(
          report.heldOut
            .staticBaseline
            .meanDetectionDelay!,
        );

        expect(
          report.heldOut
            .latent
            .falsePromotions,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .latent
            .missedChanges,
        ).toBe(
          0,
        );
      },
    );

    it(
      "abstains on the ambiguous held-out observation instead of contaminating either neighboring latent regime",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

        const ambiguous =
          report.episodes.find(
            (episode) =>
              episode.episodeId ===
              "held-gradual-2",
          );

        expect(
          ambiguous,
        ).toMatchObject({
          latentRegimeId:
            undefined,

          latentDecision:
            "membership-abstention",

          latentPolicyReason:
            "uncertainty-fallback",

          latentPolicyId:
            "balanced",

          labelSuppliedPolicyId:
            "balanced",
        });

        expect(
          report.latentAudit
            .regimeCount,
        ).toBe(
          4,
        );
      },
    );

    it(
      "keeps evaluator labels out of the latent regime identities",
      () => {
        const report =
          runLatentRegimeDiscoveryBenchmark();

        for (
          const regime of
            report.latentAudit
              .regimes
        ) {
          expect(
            regime.id,
          ).toMatch(
            /^regime-\d{3}$/,
          );

          expect(
            regime.id,
          ).not.toMatch(
            /stationary|gradual|abrupt|recurring/,
          );
        }
      },
    );
  },
);

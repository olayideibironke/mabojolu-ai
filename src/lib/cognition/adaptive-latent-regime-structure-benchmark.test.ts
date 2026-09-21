import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAdaptiveStructureBenchmark,
} from "./adaptive-latent-regime-structure-benchmark";

describe(
  "adaptive latent regime structure benchmark",
  () => {
    it(
      "splits the overloaded latent regime before post-revision calibration",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

        expect(
          report.revision.events,
        ).toHaveLength(
          1,
        );

        expect(
          report.revision.events[
            0
          ],
        ).toMatchObject({
          type:
            "split",

          feature:
            "changePointStrength",

          policyId:
            "conservative",
        });

        expect(
          report.splitCount,
        ).toBe(
          1,
        );

        expect(
          report.finalRegimeCount,
        ).toBe(
          2,
        );
      },
    );

    it(
      "learns that the outcome-linked feature matters more than nuisance dimensions",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

        expect(
          report.featureWeights
            .changePointStrength,
        ).toBeGreaterThan(
          1,
        );

        expect(
          report.featureWeights
            .changePointStrength,
        ).toBeGreaterThan(
          report.featureWeights
            .recentErrorRate,
        );

        expect(
          report.featureWeights
            .recentErrorRate,
        ).toBeCloseTo(
          0.15,
        );
      },
    );

    it(
      "learns different policies for the two child regimes after the split",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

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
              .adaptivePolicyId,
          ).toBe(
            episode.context ===
              "mode-low"
              ? "conservative"
              : "responsive",
          );

          expect(
            episode
              .adaptivePolicyId,
          ).toBe(
            episode
              .oraclePolicyId,
          );
        }
      },
    );

    it(
      "eliminates held-out oracle regret after structural revision",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

        expect(
          report.heldOut
            .adaptiveCumulativeRegret,
        ).toBe(
          0,
        );

        expect(
          report.heldOut
            .frozenCumulativeRegret,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report.heldOut
            .staticCumulativeRegret,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "outperforms both the frozen latent taxonomy and fixed balanced baseline on held-out utility",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

        expect(
          report.heldOut
            .adaptiveCumulativeUtility,
        ).toBeGreaterThan(
          report.heldOut
            .frozenCumulativeUtility,
        );

        expect(
          report.heldOut
            .adaptiveCumulativeUtility,
        ).toBeGreaterThan(
          report.heldOut
            .staticCumulativeUtility,
        );

        expect(
          report.heldOut
            .adaptiveCumulativeUtility,
        ).toBeCloseTo(
          4.38,
        );
      },
    );

    it(
      "shows why a frozen category fails by keeping one policy across incompatible held-out contexts",
      () => {
        const report =
          runAdaptiveStructureBenchmark();

        const heldOut =
          report.episodes.filter(
            (episode) =>
              episode.phase ===
              "held-out",
          );

        expect(
          new Set(
            heldOut.map(
              (episode) =>
                episode
                  .frozenPolicyId,
            ),
          ),
        ).toEqual(
          new Set([
            "conservative",
          ]),
        );

        expect(
          new Set(
            heldOut.map(
              (episode) =>
                episode
                  .adaptivePolicyId,
            ),
          ),
        ).toEqual(
          new Set([
            "conservative",
            "responsive",
          ]),
        );
      },
    );
  },
);

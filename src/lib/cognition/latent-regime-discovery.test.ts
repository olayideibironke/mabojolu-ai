import {
  describe,
  expect,
  it,
} from "vitest";

import {
  LatentRegimeDiscoveryController,
  type LatentRegimeSelection,
} from "./latent-regime-discovery";

import type {
  AutonomousEpisodeOutcome,
  EnvironmentSignalObservation,
} from "./environment-family-induction";

const STATIONARY:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.12,
    errorBurstiness:
      0.22,
    driftConfidence:
      0.18,
    changePointStrength:
      0.16,
    priorRegimeSimilarity:
      0.15,
    trendPersistence:
      0.12,
  };

const GRADUAL:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.42,
    errorBurstiness:
      0.36,
    driftConfidence:
      0.58,
    changePointStrength:
      0.48,
    priorRegimeSimilarity:
      0.28,
    trendPersistence:
      0.78,
  };

const ABRUPT:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.74,
    errorBurstiness:
      0.86,
    driftConfidence:
      0.92,
    changePointStrength:
      0.95,
    priorRegimeSimilarity:
      0.22,
    trendPersistence:
      0.94,
  };

const RECURRING:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.58,
    errorBurstiness:
      0.66,
    driftConfidence:
      0.78,
    changePointStrength:
      0.74,
    priorRegimeSimilarity:
      0.92,
    trendPersistence:
      0.62,
  };

const AMBIGUOUS:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.58,
    errorBurstiness:
      0.61,
    driftConfidence:
      0.75,
    changePointStrength:
      0.715,
    priorRegimeSimilarity:
      0.25,
    trendPersistence:
      0.86,
  };

function outcome(
  overrides:
    Partial<AutonomousEpisodeOutcome> = {},
): AutonomousEpisodeOutcome {
  return {
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
    ...overrides,
  };
}

function runEpisode(
  controller:
    LatentRegimeDiscoveryController,

  observation:
    EnvironmentSignalObservation,

  episodeOutcome:
    AutonomousEpisodeOutcome,
): LatentRegimeSelection {
  const selection =
    controller.selectPolicy(
      observation,
    );

  controller.recordEpisode(
    selection,
    episodeOutcome,
  );

  return selection;
}

describe(
  "LatentRegimeDiscoveryController",
  () => {
    it(
      "discovers distinct latent regimes from observations without family names",
      () => {
        const controller =
          new LatentRegimeDiscoveryController();

        const first =
          runEpisode(
            controller,
            STATIONARY,
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                false,
            }),
          );

        const second =
          runEpisode(
            controller,
            GRADUAL,
            outcome(),
          );

        const third =
          runEpisode(
            controller,
            ABRUPT,
            outcome(),
          );

        const fourth =
          runEpisode(
            controller,
            RECURRING,
            outcome(),
          );

        expect(
          [
            first.regimeId,
            second.regimeId,
            third.regimeId,
            fourth.regimeId,
          ],
        ).toEqual([
          "regime-001",
          "regime-002",
          "regime-003",
          "regime-004",
        ]);

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          4,
        );
      },
    );

    it(
      "recognizes and reactivates a previously learned regime after intervening regimes",
      () => {
        const controller =
          new LatentRegimeDiscoveryController();

        const first =
          runEpisode(
            controller,
            STATIONARY,
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                false,
            }),
          );

        runEpisode(
          controller,
          GRADUAL,
          outcome(),
        );

        runEpisode(
          controller,
          ABRUPT,
          outcome(),
        );

        const returned =
          runEpisode(
            controller,
            {
              ...STATIONARY,

              recentErrorRate:
                0.15,

              errorBurstiness:
                0.25,
            },
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                false,
            }),
          );

        expect(
          returned,
        ).toMatchObject({
          regimeId:
            first.regimeId,

          decision:
            "existing-regime",

          reactivatedRegime:
            true,
        });

        expect(
          controller
            .getAuditSummary()
            .totalReactivations,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "learns a distinct policy preference inside a discovered regime",
      () => {
        const controller =
          new LatentRegimeDiscoveryController();

        const outcomes:
          AutonomousEpisodeOutcome[] = [
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                false,
              recoverySucceeded:
                true,
              validationEvidenceCost:
                2,
            }),
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                true,
              recoverySucceeded:
                true,
              validationEvidenceCost:
                6,
            }),
            outcome({
              trueRegimeChange:
                false,
              changeDetected:
                true,
              recoverySucceeded:
                false,
              falsePromotion:
                true,
              validationEvidenceCost:
                9,
            }),
          ];

        for (
          const episodeOutcome of
            outcomes
        ) {
          runEpisode(
            controller,
            STATIONARY,
            episodeOutcome,
          );
        }

        const learned =
          controller.selectPolicy(
            STATIONARY,
          );

        expect(
          learned,
        ).toMatchObject({
          regimeId:
            "regime-001",

          policyReason:
            "regime-evidence",

          policy: {
            id:
              "conservative",
          },
        });
      },
    );

    it(
      "abstains when an observation is nearly equidistant between learned regimes",
      () => {
        const controller =
          new LatentRegimeDiscoveryController();

        runEpisode(
          controller,
          GRADUAL,
          outcome(),
        );

        runEpisode(
          controller,
          ABRUPT,
          outcome(),
        );

        const selection =
          controller.selectPolicy(
            AMBIGUOUS,
          );

        expect(
          selection,
        ).toMatchObject({
          decision:
            "membership-abstention",

          policyReason:
            "uncertainty-fallback",

          policy: {
            id:
              "balanced",
          },

          createdRegime:
            false,
        });

        expect(
          selection.regimeId,
        ).toBeUndefined();
      },
    );

    it(
      "bounds regime creation and abstains when novel evidence arrives after capacity is exhausted",
      () => {
        const controller =
          new LatentRegimeDiscoveryController(
            undefined,
            0.055,
            0.01,
            1,
          );

        runEpisode(
          controller,
          STATIONARY,
          outcome({
            trueRegimeChange:
              false,
            changeDetected:
              false,
          }),
        );

        const selection =
          controller.selectPolicy(
            ABRUPT,
          );

        expect(
          selection,
        ).toMatchObject({
          decision:
            "capacity-abstention",

          policy: {
            id:
              "balanced",
          },
        });

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "quarantines unsafe fallback policies globally and fails closed when uncertainty fallbacks are exhausted",
      () => {
        const controller =
          new LatentRegimeDiscoveryController(
            undefined,
            0.055,
            0.01,
            1,
          );

        runEpisode(
          controller,
          STATIONARY,
          outcome({
            trueRegimeChange:
              false,
            changeDetected:
              false,
          }),
        );

        const balanced =
          controller.selectPolicy(
            ABRUPT,
          );

        controller.recordEpisode(
          balanced,
          outcome({
            unsafeIrreversibleAction:
              true,
          }),
        );

        const conservative =
          controller.selectPolicy(
            ABRUPT,
          );

        expect(
          conservative.policy.id,
        ).toBe(
          "conservative",
        );

        controller.recordEpisode(
          conservative,
          outcome({
            unsafeIrreversibleAction:
              true,
          }),
        );

        expect(
          () =>
            controller.selectPolicy(
              ABRUPT,
            ),
        ).toThrow(
          /No safe latent-regime uncertainty fallback remains/,
        );
      },
    );

    it(
      "rejects malformed observation signals before they can alter latent memory",
      () => {
        const controller =
          new LatentRegimeDiscoveryController();

        expect(
          () =>
            controller.selectPolicy({
              ...STATIONARY,

              changePointStrength:
                -0.1,
            }),
        ).toThrow(
          /changePointStrength must be a finite number in \[0, 1\]/,
        );

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          0,
        );
      },
    );
  },
);

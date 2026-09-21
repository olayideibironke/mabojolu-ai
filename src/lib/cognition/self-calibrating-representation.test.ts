import {
  describe,
  expect,
  it,
} from "vitest";

import {
  DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES,
  SelfCalibratingRepresentationSelector,
  encodeRepresentationObservation,
} from "./self-calibrating-representation";

import type {
  EnvironmentSignalObservation,
} from "./environment-family-induction";

const OBSERVATION:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.3,
    errorBurstiness:
      0.6,
    driftConfidence:
      0.8,
    changePointStrength:
      0.9,
    priorRegimeSimilarity:
      0.2,
    trendPersistence:
      0.7,
  };

describe(
  "self-calibrating representation",
  () => {
    it(
      "keeps the raw encoder behaviorally transparent",
      () => {
        const raw =
          DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES.find(
            (profile) =>
              profile.id ===
              "raw-default",
          );

        expect(
          raw,
        ).toBeDefined();

        expect(
          encodeRepresentationObservation(
            raw!,
            OBSERVATION,
          ),
        ).toEqual(
          OBSERVATION,
        );
      },
    );

    it(
      "constructs a derived drift-compressed representation while suppressing a nuisance recurrence channel",
      () => {
        const profile =
          DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES.find(
            (candidate) =>
              candidate.id ===
              "drift-compressed",
          );

        expect(
          profile,
        ).toBeDefined();

        const encoded =
          encodeRepresentationObservation(
            profile!,
            OBSERVATION,
          );

        expect(
          encoded
            .priorRegimeSimilarity,
        ).toBe(
          0.5,
        );

        expect(
          encoded
            .recentErrorRate,
        ).toBeCloseTo(
          (
            OBSERVATION
              .recentErrorRate +
            OBSERVATION
              .driftConfidence +
            OBSERVATION
              .changePointStrength
          ) /
            3,
        );

        expect(
          encoded
            .changePointStrength,
        ).toBeCloseTo(
          encoded
            .recentErrorRate,
        );
      },
    );

    it(
      "promotes a safely validated challenger with materially lower regret",
      () => {
        const selector =
          new SelfCalibratingRepresentationSelector();

        selector.recordEvaluation({
          profileId:
            "raw-default",

          episodes:
            8,

          cumulativeRegret:
            2.4,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        selector.recordEvaluation({
          profileId:
            "drift-compressed",

          episodes:
            8,

          cumulativeRegret:
            0.4,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        const decision =
          selector.chooseChampion();

        expect(
          decision,
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

        expect(
          selector
            .getAuditSummary()
            .archivedChampionProfileIds,
        ).toEqual([
          "raw-default",
        ]);
      },
    );

    it(
      "quarantines an unsafe representation even when its regret looks attractive",
      () => {
        const selector =
          new SelfCalibratingRepresentationSelector();

        selector.recordEvaluation({
          profileId:
            "raw-default",

          episodes:
            8,

          cumulativeRegret:
            1.4,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        selector.recordEvaluation({
          profileId:
            "raw-tight",

          episodes:
            8,

          cumulativeRegret:
            0,

          unsafeIrreversibleActions:
            1,

          falsePromotions:
            0,
        });

        const decision =
          selector.chooseChampion();

        expect(
          decision
            .championProfileId,
        ).toBe(
          "raw-default",
        );

        expect(
          selector
            .getAuditSummary()
            .quarantinedProfileIds,
        ).toContain(
          "raw-tight",
        );
      },
    );

    it(
      "replaces an unsafe current champion even when its regret score is lower",
      () => {
        const selector =
          new SelfCalibratingRepresentationSelector();

        selector.recordEvaluation({
          profileId:
            "raw-default",

          episodes:
            8,

          cumulativeRegret:
            0,

          unsafeIrreversibleActions:
            1,

          falsePromotions:
            0,
        });

        selector.recordEvaluation({
          profileId:
            "drift-compressed",

          episodes:
            8,

          cumulativeRegret:
            1,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        const decision =
          selector.chooseChampion();

        expect(
          decision,
        ).toMatchObject({
          championProfileId:
            "drift-compressed",

          previousChampionProfileId:
            "raw-default",

          promoted:
            true,

          reason:
            "unsafe-champion-replaced",
        });
      },
    );

    it(
      "rolls back a promoted representation when protected follow-up evaluation regresses",
      () => {
        const selector =
          new SelfCalibratingRepresentationSelector();

        selector.recordEvaluation({
          profileId:
            "raw-default",

          episodes:
            8,

          cumulativeRegret:
            2,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        selector.recordEvaluation({
          profileId:
            "drift-compressed",

          episodes:
            8,

          cumulativeRegret:
            0.5,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        selector.chooseChampion();

        const rollback =
          selector.considerRollback(
            1.4,
            0.7,
          );

        expect(
          rollback,
        ).toMatchObject({
          championProfileId:
            "raw-default",

          rolledBack:
            true,

          reason:
            "validation-regression",
        });

        expect(
          selector
            .getAuditSummary()
            .quarantinedProfileIds,
        ).toContain(
          "drift-compressed",
        );
      },
    );
  },
);

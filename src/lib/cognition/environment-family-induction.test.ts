import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousMetaAdaptationController,
  DEFAULT_ENVIRONMENT_FAMILY_PROTOTYPES,
  EnvironmentFamilyInducer,
  type AutonomousEpisodeOutcome,
  type EnvironmentSignalObservation,
} from "./environment-family-induction";

function ambiguousObservation():
  EnvironmentSignalObservation {
  return {
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
}

function successfulOutcome():
  AutonomousEpisodeOutcome {
  return {
    trueRegimeChange:
      true,
    changeDetected:
      true,
    detectionDelay:
      1,
    recoverySucceeded:
      true,
    falsePromotion:
      false,
    validationEvidenceCost:
      3,
  };
}

describe(
  "EnvironmentFamilyInducer",
  () => {
    it(
      "infers each known family from observable signals without receiving a family label",
      () => {
        const inducer =
          new EnvironmentFamilyInducer();

        for (
          const prototype of
            DEFAULT_ENVIRONMENT_FAMILY_PROTOTYPES
        ) {
          const belief =
            inducer.infer(
              prototype.observation,
            );

          expect(
            belief.topFamily,
          ).toBe(
            prototype.family,
          );

          expect(
            belief.sufficientlyCertain,
          ).toBe(
            true,
          );

          expect(
            belief.confidence,
          ).toBeGreaterThan(
            0.58,
          );

          expect(
            belief.margin,
          ).toBeGreaterThan(
            0.18,
          );
        }
      },
    );

    it(
      "keeps an ambiguous gradual-versus-abrupt observation unresolved",
      () => {
        const belief =
          new EnvironmentFamilyInducer().infer(
            ambiguousObservation(),
          );

        expect(
          belief.sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          belief.confidence,
        ).toBeLessThan(
          0.58,
        );

        expect(
          belief.normalizedEntropy,
        ).toBeGreaterThan(
          0.6,
        );
      },
    );

    it(
      "rejects invalid signal values instead of normalizing malformed evidence",
      () => {
        const observation = {
          ...ambiguousObservation(),

          driftConfidence:
            1.2,
        };

        expect(
          () =>
            new EnvironmentFamilyInducer().infer(
              observation,
            ),
        ).toThrow(
          /driftConfidence must be a finite number in \[0, 1\]/,
        );
      },
    );
  },
);

describe(
  "AutonomousMetaAdaptationController",
  () => {
    it(
      "uses the inferred family as the evidence partition for confident observations",
      () => {
        const controller =
          new AutonomousMetaAdaptationController();

        const abrupt =
          DEFAULT_ENVIRONMENT_FAMILY_PROTOTYPES.find(
            (prototype) =>
              prototype.family ===
              "abrupt-drift",
          );

        expect(
          abrupt,
        ).toBeDefined();

        const selection =
          controller.selectPolicy(
            abrupt!.observation,
          );

        expect(
          selection,
        ).toMatchObject({
          decision:
            "inferred-family",

          evidenceFamily:
            "abrupt-drift",
        });

        controller.recordEpisode(
          selection,
          successfulOutcome(),
        );

        const evidence =
          controller
            .getAuditSummary()
            .familyEvidence[
              "abrupt-drift"
            ]
            .find(
              (entry) =>
                entry.policyId ===
                selection.policy.id,
            );

        expect(
          evidence?.episodes,
        ).toBe(
          1,
        );
      },
    );

    it(
      "abstains to balanced adaptation when family evidence is ambiguous",
      () => {
        const controller =
          new AutonomousMetaAdaptationController();

        const selection =
          controller.selectPolicy(
            ambiguousObservation(),
          );

        expect(
          selection,
        ).toMatchObject({
          decision:
            "uncertainty-abstention",

          evidenceFamily:
            "unknown",

          policy: {
            id:
              "balanced",
          },
        });
      },
    );

    it(
      "falls back conservatively after balanced is quarantined and then fails closed when uncertainty fallbacks are exhausted",
      () => {
        const controller =
          new AutonomousMetaAdaptationController();

        const balanced =
          controller.selectPolicy(
            ambiguousObservation(),
          );

        controller.recordEpisode(
          balanced,
          {
            ...successfulOutcome(),

            unsafeIrreversibleAction:
              true,
          },
        );

        const conservative =
          controller.selectPolicy(
            ambiguousObservation(),
          );

        expect(
          conservative,
        ).toMatchObject({
          decision:
            "uncertainty-abstention",

          policy: {
            id:
              "conservative",
          },
        });

        controller.recordEpisode(
          conservative,
          {
            ...successfulOutcome(),

            unsafeIrreversibleAction:
              true,
          },
        );

        expect(
          () =>
            controller.selectPolicy(
              ambiguousObservation(),
            ),
        ).toThrow(
          /No safe uncertainty fallback policy remains/,
        );
      },
    );
  },
);

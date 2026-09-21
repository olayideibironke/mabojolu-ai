import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AdaptiveValidatedPredicateApplicabilityModel,
} from "./adaptive-predicate-champion";

import {
  DEFAULT_META_ADAPTATION_POLICIES,
  MetaAdaptationController,
  createAdaptivePredicateModelForPolicy,
  type MetaAdaptationEpisode,
} from "./meta-adaptation";

function episode(
  input:
    Partial<
      MetaAdaptationEpisode
    > &
    Pick<
      MetaAdaptationEpisode,
      "family" |
      "policyId"
    >,
): MetaAdaptationEpisode {
  return {
    family:
      input.family,

    policyId:
      input.policyId,

    trueRegimeChange:
      input.trueRegimeChange ??
      true,

    changeDetected:
      input.changeDetected ??
      true,

    detectionDelay:
      input.detectionDelay ??
      1,

    recoverySucceeded:
      input.recoverySucceeded ??
      true,

    falsePromotion:
      input.falsePromotion ??
      false,

    validationEvidenceCost:
      input.validationEvidenceCost ??
      3,

    unsafeIrreversibleAction:
      input.unsafeIrreversibleAction ??
      false,
  };
}

function teachAbruptFamily(
  controller:
    MetaAdaptationController,
): void {
  controller.recordEpisode(
    episode({
      family:
        "abrupt-drift",

      policyId:
        "conservative",

      changeDetected:
        false,

      recoverySucceeded:
        false,

      validationEvidenceCost:
        8,
    }),
  );

  controller.recordEpisode(
    episode({
      family:
        "abrupt-drift",

      policyId:
        "balanced",

      detectionDelay:
        8,

      validationEvidenceCost:
        8,
    }),
  );

  controller.recordEpisode(
    episode({
      family:
        "abrupt-drift",

      policyId:
        "responsive",

      detectionDelay:
        1,

      validationEvidenceCost:
        3,
    }),
  );
}

describe(
  "MetaAdaptationController",
  () => {
    it(
      "explores every safe bounded policy before exploiting family evidence",
      () => {
        const controller =
          new MetaAdaptationController();

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ),
        ).toMatchObject({
          reason:
            "family-exploration",

          policy: {
            id:
              "conservative",
          },
        });

        controller.recordEpisode(
          episode({
            family:
              "abrupt-drift",

            policyId:
              "conservative",

            changeDetected:
              false,

            recoverySucceeded:
              false,
          }),
        );

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ),
        ).toMatchObject({
          reason:
            "family-exploration",

          policy: {
            id:
              "balanced",
          },
        });

        controller.recordEpisode(
          episode({
            family:
              "abrupt-drift",

            policyId:
              "balanced",
          }),
        );

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ),
        ).toMatchObject({
          reason:
            "family-exploration",

          policy: {
            id:
              "responsive",
          },
        });

        controller.recordEpisode(
          episode({
            family:
              "abrupt-drift",

            policyId:
              "responsive",

            detectionDelay:
              0,

            validationEvidenceCost:
              0,
          }),
        );

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ),
        ).toMatchObject({
          reason:
            "family-evidence",

          policy: {
            id:
              "responsive",
          },
        });
      },
    );

    it(
      "learns different adaptation policies for noisy-stable and abrupt-drift families",
      () => {
        const controller =
          new MetaAdaptationController();

        teachAbruptFamily(
          controller,
        );

        controller.recordEpisode(
          episode({
            family:
              "stationary-noisy",

            policyId:
              "conservative",

            trueRegimeChange:
              false,

            changeDetected:
              false,

            recoverySucceeded:
              true,

            validationEvidenceCost:
              2,
          }),
        );

        controller.recordEpisode(
          episode({
            family:
              "stationary-noisy",

            policyId:
              "balanced",

            trueRegimeChange:
              false,

            changeDetected:
              true,

            recoverySucceeded:
              true,

            validationEvidenceCost:
              6,
          }),
        );

        controller.recordEpisode(
          episode({
            family:
              "stationary-noisy",

            policyId:
              "responsive",

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
        );

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ).policy.id,
        ).toBe(
          "responsive",
        );

        expect(
          controller.selectPolicy(
            "stationary-noisy",
          ).policy.id,
        ).toBe(
          "conservative",
        );
      },
    );

    it(
      "transfers learned adaptation evidence to an unseen environment family",
      () => {
        const controller =
          new MetaAdaptationController();

        teachAbruptFamily(
          controller,
        );

        expect(
          controller.selectPolicy(
            "unknown",
          ),
        ).toMatchObject({
          reason:
            "cross-family-transfer",

          policy: {
            id:
              "responsive",
          },
        });
      },
    );

    it(
      "quarantines a policy after an unsafe irreversible outcome and excludes it from future selection",
      () => {
        const controller =
          new MetaAdaptationController();

        controller.recordEpisode(
          episode({
            family:
              "abrupt-drift",

            policyId:
              "responsive",

            unsafeIrreversibleAction:
              true,
          }),
        );

        const audit =
          controller.getAuditSummary();

        expect(
          audit
            .quarantinedPolicyIds,
        ).toContain(
          "responsive",
        );

        expect(
          controller.selectPolicy(
            "abrupt-drift",
          ).policy.id,
        ).not.toBe(
          "responsive",
        );

        expect(
          audit.globalEvidence.find(
            (entry) =>
              entry.policyId ===
              "responsive",
          ),
        ).toMatchObject({
          episodes:
            1,

          successes:
            0,

          failures:
            1,

          meanUtility:
            -1,

          quarantined:
            true,
        });
      },
    );

    it(
      "keeps episode utility bounded while penalizing false alarms and false promotions",
      () => {
        const controller =
          new MetaAdaptationController();

        const good =
          controller.recordEpisode(
            episode({
              family:
                "recurring-regime",

              policyId:
                "balanced",

              trueRegimeChange:
                true,

              changeDetected:
                true,

              detectionDelay:
                0,

              recoverySucceeded:
                true,

              validationEvidenceCost:
                0,
            }),
          );

        const bad =
          controller.recordEpisode(
            episode({
              family:
                "recurring-regime",

              policyId:
                "responsive",

              trueRegimeChange:
                false,

              changeDetected:
                true,

              recoverySucceeded:
                false,

              falsePromotion:
                true,

              validationEvidenceCost:
                100,
            }),
          );

        expect(
          good,
        ).toBeGreaterThan(
          0,
        );

        expect(
          bad,
        ).toBeLessThan(
          0,
        );

        expect(
          good,
        ).toBeLessThanOrEqual(
          1,
        );

        expect(
          bad,
        ).toBeGreaterThanOrEqual(
          -1,
        );
      },
    );

    it(
      "creates the existing adaptive champion model from a selected bounded policy",
      () => {
        const balanced =
          DEFAULT_META_ADAPTATION_POLICIES.find(
            (policy) =>
              policy.id ===
              "balanced",
          );

        expect(
          balanced,
        ).toBeDefined();

        const model =
          createAdaptivePredicateModelForPolicy(
            balanced!,
          );

        expect(
          model,
        ).toBeInstanceOf(
          AdaptiveValidatedPredicateApplicabilityModel,
        );
      },
    );

    it(
      "rejects duplicate policy identifiers so meta-learning remains auditable",
      () => {
        const policy =
          DEFAULT_META_ADAPTATION_POLICIES[0];

        expect(
          () =>
            new MetaAdaptationController([
              policy,
              {
                ...policy,
              },
            ]),
        ).toThrow(
          /Duplicate meta-adaptation policy id/,
        );
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AdaptiveLatentRegimeStructureController,
  adaptiveRegimeDistance,
} from "./adaptive-latent-regime-structure";

import type {
  AutonomousEpisodeOutcome,
  EnvironmentSignalObservation,
} from "./environment-family-induction";

const LOW:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.2,
    errorBurstiness:
      0.3,
    driftConfidence:
      0.4,
    changePointStrength:
      0.2,
    priorRegimeSimilarity:
      0.25,
    trendPersistence:
      0.5,
  };

const HIGH:
  EnvironmentSignalObservation = {
    ...LOW,

    changePointStrength:
      0.65,
  };

function stableGood():
  AutonomousEpisodeOutcome {
  return {
    trueRegimeChange:
      false,
    changeDetected:
      false,
    recoverySucceeded:
      true,
    falsePromotion:
      false,
    validationEvidenceCost:
      0,
  };
}

function missedChange():
  AutonomousEpisodeOutcome {
  return {
    trueRegimeChange:
      true,
    changeDetected:
      false,
    recoverySucceeded:
      false,
    falsePromotion:
      false,
    validationEvidenceCost:
      0,
  };
}

function run(
  controller:
    AdaptiveLatentRegimeStructureController,

  observation:
    EnvironmentSignalObservation,

  outcome:
    AutonomousEpisodeOutcome,
) {
  const selection =
    controller.selectPolicy(
      observation,
    );

  const utility =
    controller.recordEpisode(
      selection,
      outcome,
    );

  return {
    selection,
    utility,
  };
}

describe(
  "AdaptiveLatentRegimeStructureController",
  () => {
    it(
      "splits an overloaded regime when the same policy has incompatible outcomes across separable observations",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController(
            undefined,
            0.12,
            0.008,
            8,
            undefined,
            7,
            2,
            0.5,
            0.15,
          );

        run(
          controller,
          LOW,
          missedChange(),
        );

        run(
          controller,
          LOW,
          stableGood(),
        );

        run(
          controller,
          LOW,
          missedChange(),
        );

        const secondBalanced =
          run(
            controller,
            LOW,
            stableGood(),
          );

        expect(
          secondBalanced
            .selection
            .policy
            .id,
        ).toBe(
          "balanced",
        );

        for (
          let index =
            0;
          index <
            3;
          index +=
            1
        ) {
          const high =
            run(
              controller,
              HIGH,
              missedChange(),
            );

          expect(
            high
              .selection
              .policy
              .id,
          ).toBe(
            "balanced",
          );
        }

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          1,
        );

        const revision =
          controller.reviseStructure();

        expect(
          revision.events,
        ).toHaveLength(
          1,
        );

        expect(
          revision.events[
            0
          ],
        ).toMatchObject({
          type:
            "split",

          parentRegimeId:
            "regime-001",

          feature:
            "changePointStrength",

          policyId:
            "balanced",
        });

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          2,
        );
      },
    );

    it(
      "relearns feature relevance from outcome-linked regime differences and suppresses nuisance dimensions",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController(
            undefined,
            0.12,
            0.008,
            8,
            undefined,
            7,
            2,
            0.5,
            0.15,
          );

        run(
          controller,
          LOW,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );
        run(
          controller,
          LOW,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );

        for (
          let index =
            0;
          index <
            3;
          index +=
            1
        ) {
          run(
            controller,
            HIGH,
            missedChange(),
          );
        }

        controller.reviseStructure();

        const weights =
          controller
            .getAuditSummary()
            .featureWeights;

        expect(
          weights
            .changePointStrength,
        ).toBeGreaterThan(
          weights
            .recentErrorRate,
        );

        expect(
          weights
            .changePointStrength,
        ).toBeGreaterThan(
          1,
        );

        expect(
          weights
            .recentErrorRate,
        ).toBeCloseTo(
          0.15,
        );
      },
    );

    it(
      "forces fresh policy evidence after a structural split",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController(
            undefined,
            0.12,
            0.008,
            8,
            undefined,
            7,
            2,
            0.5,
            0.15,
          );

        run(
          controller,
          LOW,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );
        run(
          controller,
          LOW,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );

        for (
          let index =
            0;
          index <
            3;
          index +=
            1
        ) {
          run(
            controller,
            HIGH,
            missedChange(),
          );
        }

        controller.reviseStructure();

        const lowAfterSplit =
          controller.selectPolicy(
            LOW,
          );

        const highAfterSplit =
          controller.selectPolicy(
            HIGH,
          );

        expect(
          lowAfterSplit
            .policyReason,
        ).toBe(
          "regime-exploration",
        );

        expect(
          highAfterSplit
            .policyReason,
        ).toBe(
          "regime-exploration",
        );

        expect(
          lowAfterSplit
            .policy
            .id,
        ).toBe(
          "conservative",
        );

        expect(
          highAfterSplit
            .policy
            .id,
        ).toBe(
          "conservative",
        );

        expect(
          lowAfterSplit
            .regimeId,
        ).not.toBe(
          highAfterSplit
            .regimeId,
        );
      },
    );

    it(
      "merges redundant nearby regimes when their learned policy profiles agree",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController(
            undefined,
            0.001,
            0,
            8,
            undefined,
            9,
            2,
            0.5,
            0.15,
            0.04,
            0.2,
          );

        const nearby = {
          ...LOW,

          recentErrorRate:
            0.32,
        };

        for (
          const observation of
            [
              LOW,
              nearby,
              LOW,
              nearby,
              LOW,
              nearby,
            ]
        ) {
          run(
            controller,
            observation,
            stableGood(),
          );
        }

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          2,
        );

        const revision =
          controller.reviseStructure();

        expect(
          revision.events,
        ).toHaveLength(
          1,
        );

        expect(
          revision.events[
            0
          ],
        ).toMatchObject({
          type:
            "merge",

          preferredPolicyId:
            "conservative",
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
      "does not merge nearby regimes whose policy outcomes disagree",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController(
            undefined,
            0.001,
            0,
            8,
            undefined,
            9,
            2,
            0.5,
            0.15,
            0.04,
            0.2,
          );

        const nearby = {
          ...LOW,

          recentErrorRate:
            0.32,
        };

        run(
          controller,
          LOW,
          stableGood(),
        );
        run(
          controller,
          nearby,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );
        run(
          controller,
          nearby,
          missedChange(),
        );
        run(
          controller,
          LOW,
          stableGood(),
        );
        run(
          controller,
          nearby,
          missedChange(),
        );

        const revision =
          controller.reviseStructure();

        expect(
          revision.events,
        ).toHaveLength(
          0,
        );

        expect(
          controller
            .getAuditSummary()
            .regimeCount,
        ).toBe(
          2,
        );
      },
    );

    it(
      "keeps learned feature weights bounded and usable as a metric",
      () => {
        const weights:
          EnvironmentSignalObservation = {
          recentErrorRate:
            0.15,
          errorBurstiness:
            0.15,
          driftConfidence:
            0.15,
          changePointStrength:
            3,
          priorRegimeSimilarity:
            0.15,
          trendPersistence:
            0.15,
        };

        const distance =
          adaptiveRegimeDistance(
            LOW,
            HIGH,
            weights,
          );

        expect(
          distance,
        ).toBeGreaterThan(
          0,
        );

        expect(
          distance,
        ).toBeLessThanOrEqual(
          1,
        );
      },
    );

    it(
      "preserves global unsafe-policy quarantine through structural revision",
      () => {
        const controller =
          new AdaptiveLatentRegimeStructureController();

        const selected =
          controller.selectPolicy(
            LOW,
          );

        controller.recordEpisode(
          selected,
          {
            ...stableGood(),

            unsafeIrreversibleAction:
              true,
          },
        );

        controller.reviseStructure();

        expect(
          controller
            .getAuditSummary()
            .quarantinedPolicyIds,
        ).toContain(
          selected.policy.id,
        );

        const next =
          controller.selectPolicy(
            LOW,
          );

        expect(
          next.policy.id,
        ).not.toBe(
          selected.policy.id,
        );
      },
    );
  },
);

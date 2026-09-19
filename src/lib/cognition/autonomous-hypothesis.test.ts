import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousCausalHypothesisEngine,
} from "./autonomous-hypothesis";

function seedContrastiveEvidence(
  engine:
    AutonomousCausalHypothesisEngine,
): void {
  engine.observeTransition({
    observationId:
      "obs-1",

    action: "B",

    before: {
      power: false,
      latch: false,
      target: false,
    },

    after: {
      power: false,
      latch: false,
      target: false,
    },

    accepted:
      true,

    observedAt:
      "2026-09-19T12:00:00.000Z",
  });

  engine.observeTransition({
    observationId:
      "obs-2",

    action: "B",

    before: {
      power: true,
      latch: false,
      target: false,
    },

    after: {
      power: true,
      latch: false,
      target: false,
    },

    accepted:
      true,

    observedAt:
      "2026-09-19T12:01:00.000Z",
  });

  engine.observeTransition({
    observationId:
      "obs-3",

    action: "B",

    before: {
      power: true,
      latch: true,
      target: false,
    },

    after: {
      power: true,
      latch: true,
      target: true,
    },

    accepted:
      true,

    observedAt:
      "2026-09-19T12:02:00.000Z",
  });
}

function conditionKeys(
  conditions:
    Record<
      string,
      unknown
    >,
): string {
  return Object.keys(
    conditions,
  )
    .sort()
    .join("+");
}

describe(
  "Mabojolu G autonomous causal hypothesis generation",
  () => {
    it(
      "requires contrastive evidence instead of inventing an explanation from one success",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        engine.observeTransition({
          observationId:
            "obs-1",

          action: "B",

          before: {
            power: true,
            latch: true,
            target: false,
          },

          after: {
            power: true,
            latch: true,
            target: true,
          },

          accepted:
            true,

          observedAt:
            "2026-09-19T12:00:00.000Z",
        });

        expect(
          engine
            .getHypotheses(),
        ).toEqual([]);
      },
    );

    it(
      "generates competing prerequisite explanations from state-dependent outcomes",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        seedContrastiveEvidence(
          engine,
        );

        const hypotheses =
          engine
            .getHypotheses();

        expect(
          hypotheses,
        ).toHaveLength(3);

        expect(
          hypotheses
            .map(
              (hypothesis) =>
                conditionKeys(
                  hypothesis
                    .conditions,
                ),
            )
            .sort(),
        ).toEqual([
          "latch",
          "latch+power",
          "power",
        ]);

        const latchOnly =
          hypotheses.find(
            (hypothesis) =>
              conditionKeys(
                hypothesis
                  .conditions,
              ) ===
              "latch",
          );

        const conjunction =
          hypotheses.find(
            (hypothesis) =>
              conditionKeys(
                hypothesis
                  .conditions,
              ) ===
              "latch+power",
          );

        expect(
          latchOnly
            ?.status,
        ).toBe(
          "supported",
        );

        expect(
          conjunction
            ?.status,
        ).toBe(
          "supported",
        );

        expect(
          latchOnly
            ?.confidence,
        ).toBeCloseTo(
          0.8,
        );
      },
    );

    it(
      "uses generated hypotheses to identify an information-seeking experiment",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        seedContrastiveEvidence(
          engine,
        );

        const recommendation =
          engine
            .recommendExperiment({
              currentState: {
                power: false,
                latch: true,
                target: false,
              },

              availableActions: [
                "A",
                "B",
                "C",
              ],
            });

        expect(
          recommendation,
        ).toBeDefined();

        expect(
          recommendation
            ?.action,
        ).toBe("B");

        expect(
          recommendation
            ?.informationGain,
        ).toBeGreaterThan(0);

        expect(
          recommendation
            ?.hypothesisIds,
        ).toHaveLength(3);

        expect(
          recommendation
            ?.predictedOutcomes,
        ).toHaveLength(2);
      },
    );

    it(
      "uses the experiment result to weaken a wrong explanation while preserving a consistent conjunction",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        seedContrastiveEvidence(
          engine,
        );

        engine.observeTransition({
          observationId:
            "obs-4",

          action: "B",

          before: {
            power: false,
            latch: true,
            target: false,
          },

          after: {
            power: false,
            latch: true,
            target: false,
          },

          accepted:
            true,

          observedAt:
            "2026-09-19T12:03:00.000Z",
        });

        const hypotheses =
          engine
            .getHypotheses();

        const latchOnly =
          hypotheses.find(
            (hypothesis) =>
              conditionKeys(
                hypothesis
                  .conditions,
              ) ===
              "latch",
          );

        const conjunction =
          hypotheses.find(
            (hypothesis) =>
              conditionKeys(
                hypothesis
                  .conditions,
              ) ===
              "latch+power",
          );

        expect(
          latchOnly
            ?.contradictionCount,
        ).toBe(1);

        expect(
          conjunction
            ?.contradictionCount,
        ).toBe(0);

        expect(
          conjunction
            ?.supportCount,
        ).toBe(4);

        expect(
          conjunction
            ?.confidence,
        ).toBeGreaterThan(
          latchOnly
            ?.confidence ??
            0,
        );

        expect(
          conjunction
            ?.status,
        ).toBe(
          "supported",
        );
      },
    );

    it(
      "does not repeat an information-seeking experiment in an already tested state",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        seedContrastiveEvidence(
          engine,
        );

        const state = {
          power: false,
          latch: true,
          target: false,
        };

        engine.observeTransition({
          observationId:
            "obs-4",

          action: "B",

          before:
            state,

          after:
            state,

          accepted:
            true,

          observedAt:
            "2026-09-19T12:03:00.000Z",
        });

        expect(
          engine
            .recommendExperiment({
              currentState:
                state,

              availableActions: [
                "B",
              ],
            }),
        ).toBeUndefined();
      },
    );

    it(
      "ignores rejected actions as causal evidence",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        engine.observeTransition({
          observationId:
            "obs-1",

          action:
            "UNKNOWN",

          before: {
            flag: false,
          },

          after: {
            flag: true,
          },

          accepted:
            false,

          observedAt:
            "2026-09-19T12:00:00.000Z",
        });

        expect(
          engine
            .getHypotheses(),
        ).toEqual([]);
      },
    );

    it(
      "returns defensive hypothesis copies",
      () => {
        const engine =
          new AutonomousCausalHypothesisEngine();

        seedContrastiveEvidence(
          engine,
        );

        const first =
          engine
            .getHypotheses();

        first[0]
          .conditions.tampered =
          true;

        first[0]
          .evidenceForIds
          .push(
            "tampered",
          );

        const second =
          engine
            .getHypotheses();

        expect(
          second[0]
            .conditions
            .tampered,
        ).toBeUndefined();

        expect(
          second[0]
            .evidenceForIds,
        ).not.toContain(
          "tampered",
        );
      },
    );
  },
);

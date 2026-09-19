import {
  describe,
  expect,
  it,
} from "vitest";

import {
  WorldModel,
} from "./world-model";

function observeAdvance(
  model:
    WorldModel,

  noiseA:
    boolean,

  noiseB:
    boolean,

  observedAt:
    string,
): void {
  model.observeTransition({
    action: "A",

    before: {
      stage: 0,
      noiseA,
      noiseB,
    },

    after: {
      stage: 1,
      noiseA,
      noiseB,
    },

    accepted:
      true,

    observedAt,
  });
}

describe(
  "Mabojolu G causal generalization",
  () => {
    it(
      "does not generalize from fewer than three distinct states",
      () => {
        const model =
          new WorldModel();

        observeAdvance(
          model,
          false,
          false,
          "2026-09-19T09:00:00.000Z",
        );

        observeAdvance(
          model,
          true,
          false,
          "2026-09-19T09:01:00.000Z",
        );

        const generalized =
          model
            .getRules()
            .filter(
              (rule) =>
                rule.scope ===
                "generalized",
            );

        expect(
          generalized,
        ).toEqual([]);
      },
    );

    it(
      "generalizes across variables demonstrated to be irrelevant to an effect",
      () => {
        const model =
          new WorldModel();

        observeAdvance(
          model,
          false,
          false,
          "2026-09-19T09:00:00.000Z",
        );

        observeAdvance(
          model,
          true,
          false,
          "2026-09-19T09:01:00.000Z",
        );

        observeAdvance(
          model,
          false,
          true,
          "2026-09-19T09:02:00.000Z",
        );

        const prediction =
          model.predict(
            "A",
            {
              stage: 0,
              noiseA: true,
              noiseB: true,
            },
          );

        expect(
          prediction,
        ).toBeDefined();

        expect(
          prediction?.scope,
        ).toBe(
          "generalized",
        );

        expect(
          prediction
            ?.conditions,
        ).toEqual({
          stage: 0,
        });

        expect(
          prediction
            ?.effects,
        ).toEqual([
          {
            key: "stage",
            before: 0,
            after: 1,
          },
        ]);

        expect(
          prediction
            ?.variations
            .map(
              (variation) =>
                variation.key,
            ),
        ).toEqual([
          "noiseA",
          "noiseB",
        ]);

        const generalized =
          model
            .getRules()
            .find(
              (rule) =>
                rule.scope ===
                  "generalized" &&
                rule.action ===
                  "A",
            );

        expect(
          generalized
            ?.sourceRuleIds,
        ).toHaveLength(3);
      },
    );

    it(
      "retains conditions that have never been shown to vary",
      () => {
        const model =
          new WorldModel();

        for (
          const [
            noiseA,
            noiseB,
            observedAt,
          ] of [
            [
              false,
              false,
              "2026-09-19T09:00:00.000Z",
            ],
            [
              true,
              false,
              "2026-09-19T09:01:00.000Z",
            ],
            [
              false,
              true,
              "2026-09-19T09:02:00.000Z",
            ],
          ] as const
        ) {
          model.observeTransition({
            action: "A",

            before: {
              stage: 0,
              mode: "safe",
              noiseA,
              noiseB,
            },

            after: {
              stage: 1,
              mode: "safe",
              noiseA,
              noiseB,
            },

            accepted:
              true,

            observedAt,
          });
        }

        expect(
          model.predict(
            "A",
            {
              stage: 0,
              mode: "unsafe",
              noiseA: true,
              noiseB: true,
            },
          ),
        ).toBeUndefined();
      },
    );

    it(
      "does not extrapolate a varying variable to values never observed",
      () => {
        const model =
          new WorldModel();

        for (
          const [
            context,
            observedAt,
          ] of [
            [
              "red",
              "2026-09-19T09:00:00.000Z",
            ],
            [
              "blue",
              "2026-09-19T09:01:00.000Z",
            ],
            [
              "green",
              "2026-09-19T09:02:00.000Z",
            ],
          ] as const
        ) {
          model.observeTransition({
            action: "A",

            before: {
              stage: 0,
              context,
            },

            after: {
              stage: 1,
              context,
            },

            accepted:
              true,

            observedAt,
          });
        }

        expect(
          model.predict(
            "A",
            {
              stage: 0,
              context:
                "yellow",
            },
          ),
        ).toBeUndefined();
      },
    );

    it(
      "lets exact contradictory evidence override a generalized prediction",
      () => {
        const model =
          new WorldModel();

        observeAdvance(
          model,
          false,
          false,
          "2026-09-19T09:00:00.000Z",
        );

        observeAdvance(
          model,
          true,
          false,
          "2026-09-19T09:01:00.000Z",
        );

        observeAdvance(
          model,
          false,
          true,
          "2026-09-19T09:02:00.000Z",
        );

        const unseenState = {
          stage: 0,
          noiseA: true,
          noiseB: true,
        };

        expect(
          model.predict(
            "A",
            unseenState,
          )?.effects,
        ).toEqual([
          {
            key: "stage",
            before: 0,
            after: 1,
          },
        ]);

        model.observeTransition({
          action: "A",

          before:
            unseenState,

          after:
            unseenState,

          accepted:
            true,

          observedAt:
            "2026-09-19T09:03:00.000Z",
        });

        const corrected =
          model.predict(
            "A",
            unseenState,
          );

        expect(
          corrected?.scope,
        ).toBe(
          "exact",
        );

        expect(
          corrected?.effects,
        ).toEqual([]);

        const generalized =
          model
            .getRules()
            .find(
              (rule) =>
                rule.scope ===
                  "generalized" &&
                rule.action ===
                  "A" &&
                rule.effects
                  .length > 0,
            );

        expect(
          generalized
            ?.contradictionCount,
        ).toBe(1);

        expect(
          generalized
            ?.confidence,
        ).toBeLessThan(
          0.72,
        );
      },
    );
  },
);

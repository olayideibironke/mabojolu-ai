import {
  describe,
  expect,
  it,
} from "vitest";

import {
  WorldModel,
} from "./world-model";

describe(
  "Mabojolu G world model",
  () => {
    it(
      "learns an explicit state-action-effect causal rule",
      () => {
        const model =
          new WorldModel();

        const rule =
          model.observeTransition({
            action: "A",

            before: {
              power: false,
              latch: false,
              vaultOpen:
                false,
            },

            after: {
              power: true,
              latch: false,
              vaultOpen:
                false,
            },

            accepted: true,

            observedAt:
              "2026-09-19T06:00:00.000Z",
          });

        expect(
          rule,
        ).toBeDefined();

        expect(
          rule?.action,
        ).toBe("A");

        expect(
          rule?.conditions,
        ).toEqual({
          power: false,
          latch: false,
          vaultOpen: false,
        });

        expect(
          rule?.effects,
        ).toEqual([
          {
            key: "power",
            before: false,
            after: true,
          },
        ]);

        expect(
          rule?.supportCount,
        ).toBe(1);

        expect(
          rule?.confidence,
        ).toBeCloseTo(
          2 / 3,
        );
      },
    );

    it(
      "learns that the same action can have different consequences in different states",
      () => {
        const model =
          new WorldModel();

        const initialState = {
          power: false,
          latch: false,
          vaultOpen:
            false,
        };

        model.observeTransition({
          action: "B",

          before:
            initialState,

          after:
            initialState,

          accepted: true,

          observedAt:
            "2026-09-19T06:00:00.000Z",
        });

        const readyState = {
          power: true,
          latch: true,
          vaultOpen:
            false,
        };

        model.observeTransition({
          action: "B",

          before:
            readyState,

          after: {
            power: true,
            latch: true,
            vaultOpen:
              true,
          },

          accepted: true,

          observedAt:
            "2026-09-19T06:01:00.000Z",
        });

        const initialPrediction =
          model.predict(
            "B",
            initialState,
          );

        const readyPrediction =
          model.predict(
            "B",
            readyState,
          );

        expect(
          initialPrediction
            ?.effects,
        ).toEqual([]);

        expect(
          readyPrediction
            ?.effects,
        ).toEqual([
          {
            key:
              "vaultOpen",

            before:
              false,

            after:
              true,
          },
        ]);
      },
    );

    it(
      "raises confidence when the same causal relationship is observed repeatedly",
      () => {
        const model =
          new WorldModel();

        const observation = {
          action: "A",

          before: {
            power: false,
          },

          after: {
            power: true,
          },

          accepted: true,

          observedAt:
            "2026-09-19T06:00:00.000Z",
        };

        model.observeTransition(
          observation,
        );

        const reinforced =
          model.observeTransition({
            ...observation,

            observedAt:
              "2026-09-19T06:01:00.000Z",
          });

        expect(
          reinforced
            ?.supportCount,
        ).toBe(2);

        expect(
          reinforced
            ?.contradictionCount,
        ).toBe(0);

        expect(
          reinforced
            ?.confidence,
        ).toBe(0.75);
      },
    );

    it(
      "reduces confidence in an old rule when identical observable conditions produce a contradictory result",
      () => {
        const model =
          new WorldModel();

        const state = {
          switchOn:
            false,
        };

        const original =
          model.observeTransition({
            action: "A",

            before:
              state,

            after: {
              switchOn:
                true,
            },

            accepted: true,

            observedAt:
              "2026-09-19T06:00:00.000Z",
          });

        const contradictory =
          model.observeTransition({
            action: "A",

            before:
              state,

            after:
              state,

            accepted: true,

            observedAt:
              "2026-09-19T06:01:00.000Z",
          });

        const rules =
          model.getRules();

        const originalAfter =
          rules.find(
            (rule) =>
              rule.id ===
              original?.id,
          );

        expect(
          originalAfter
            ?.contradictionCount,
        ).toBe(1);

        expect(
          originalAfter
            ?.confidence,
        ).toBe(0.5);

        expect(
          contradictory
            ?.confidence,
        ).toBeCloseTo(
          2 / 3,
        );

        /*
         * The newer contradictory rule has stronger evidence than the
         * contradicted original, so prediction follows the better-supported
         * model rather than pretending the first observation was permanent.
         */
        expect(
          model.predict(
            "A",
            state,
          )?.effects,
        ).toEqual([]);
      },
    );

    it(
      "does not learn causal rules from rejected actions",
      () => {
        const model =
          new WorldModel();

        const result =
          model.observeTransition({
            action:
              "UNKNOWN",

            before: {
              solved:
                false,
            },

            after: {
              solved:
                false,
            },

            accepted:
              false,

            observedAt:
              "2026-09-19T06:00:00.000Z",
          });

        expect(
          result,
        ).toBeUndefined();

        expect(
          model.getRules(),
        ).toEqual([]);
      },
    );

    it(
      "does not predict beyond observable states it has actually modeled",
      () => {
        const model =
          new WorldModel();

        model.observeTransition({
          action: "A",

          before: {
            power: false,
            latch: false,
          },

          after: {
            power: true,
            latch: false,
          },

          accepted: true,

          observedAt:
            "2026-09-19T06:00:00.000Z",
        });

        expect(
          model.predict(
            "A",
            {
              power: false,
              latch: true,
            },
          ),
        ).toBeUndefined();
      },
    );

    it(
      "returns defensive copies so callers cannot mutate the learned model",
      () => {
        const model =
          new WorldModel();

        model.observeTransition({
          action: "A",

          before: {
            power: false,
          },

          after: {
            power: true,
          },

          accepted: true,

          observedAt:
            "2026-09-19T06:00:00.000Z",
        });

        const first =
          model.getRules();

        first[0]
          .conditions.power =
          true;

        first[0]
          .effects.push({
            key:
              "tampered",

            before:
              false,

            after:
              true,
          });

        const second =
          model.getRules();

        expect(
          second[0]
            .conditions,
        ).toEqual({
          power: false,
        });

        expect(
          second[0]
            .effects,
        ).toEqual([
          {
            key: "power",
            before: false,
            after: true,
          },
        ]);
      },
    );
  },
);
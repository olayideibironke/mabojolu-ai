import {
  describe,
  expect,
  it,
} from "vitest";

import {
  VaultWorld,
  type VaultActionMapping,
} from "./environments/vault-world";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  WorldModel,
} from "./world-model";

function makeClock():
  () => string {
  let milliseconds =
    0;

  return () => {
    const timestamp =
      new Date(
        Date.UTC(
          2026,
          8,
          19,
          8,
          0,
          0,
          milliseconds,
        ),
      ).toISOString();

    milliseconds +=
      1;

    return timestamp;
  };
}

describe(
  "Mabojolu G runtime with world-model-guided planning",
  () => {
    it(
      "learns causal rules in one episode and uses them to plan a shorter second episode without sequence memory",
      () => {
        const model =
          new WorldModel();

        const first =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          first.solved,
        ).toBe(true);

        expect(
          first.cycles,
        ).toBe(4);

        expect(
          model
            .getRules()
            .length,
        ).toBeGreaterThan(
          0,
        );

        const second =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          second.solved,
        ).toBe(true);

        expect(
          second.cycles,
        ).toBe(3);

        expect(
          second.actionHistory,
        ).toEqual([
          "Execute action A and observe the environment.",
          "Execute action C and observe the environment.",
          "Execute action B and observe the environment.",
        ]);

        /*
         * No CognitiveMemory was supplied.
         *
         * The improvement therefore comes from causal world-model planning,
         * not replay of a stored successful episode.
         */
        expect(
          second.recalledPlan,
        ).toBeUndefined();

        expect(
          second.state
            .actions
            .every(
              (action) =>
                action.proposal
                  .kind ===
                "world-model-plan",
            ),
        ).toBe(true);
      },
    );

    it(
      "revises a wrong causal model when the hidden world changes and uses the corrected model on the next episode",
      () => {
        const model =
          new WorldModel();

        /*
         * Episode 1 learns the original world:
         *
         * A = power
         * C = latch
         * B = open
         */
        const original =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          original.solved,
        ).toBe(true);

        const changedMapping:
          VaultActionMapping = {
          A: "power",

          B: "latch",

          C: "open",
        };

        /*
         * Episode 2 begins with the old causal model.
         *
         * The model initially predicts:
         *
         * A -> C -> B
         *
         * Reality now contradicts those later predictions. The runtime must
         * continue experimenting instead of treating its model as truth.
         */
        const changed =
          new CognitiveRuntime(
            new VaultWorld(
              changedMapping,
            ),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          changed.solved,
        ).toBe(true);

        expect(
          changed.cycles,
        ).toBe(5);

        expect(
          changed.state
            .learnings
            .some(
              (learning) =>
                learning.kind ===
                  "correction" &&
                learning.statement.includes(
                  "World-model-guided action C produced no observable effect",
                ),
            ),
        ).toBe(true);

        /*
         * The old model said C changed the latch in this state.
         *
         * The contradictory observation should reduce that old rule's
         * confidence and create a stronger no-effect alternative.
         */
        const powerState = {
          power: true,
          latch: false,
          vaultOpen:
            false,
        };

        expect(
          model.predict(
            "C",
            powerState,
          )?.effects,
        ).toEqual([]);

        /*
         * Episode 3 starts from scratch again, but with the corrected causal
         * model.
         *
         * It should now derive:
         *
         * A -> B -> C
         */
        const corrected =
          new CognitiveRuntime(
            new VaultWorld(
              changedMapping,
            ),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          corrected.solved,
        ).toBe(true);

        expect(
          corrected.cycles,
        ).toBe(3);

        expect(
          corrected.actionHistory,
        ).toEqual([
          "Execute action A and observe the environment.",
          "Execute action B and observe the environment.",
          "Execute action C and observe the environment.",
        ]);

        expect(
          corrected.state
            .actions
            .every(
              (action) =>
                action.proposal
                  .kind ===
                "world-model-plan",
            ),
        ).toBe(true);
      },
    );
  },
);
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  WorldModelPlanner,
} from "./planner";

import {
  WorldModel,
} from "./world-model";

function trainVaultModel():
  WorldModel {
  const model =
    new WorldModel();

  const initial = {
    power: false,
    latch: false,
    vaultOpen:
      false,
  };

  const powered = {
    power: true,
    latch: false,
    vaultOpen:
      false,
  };

  const ready = {
    power: true,
    latch: true,
    vaultOpen:
      false,
  };

  const open = {
    power: true,
    latch: true,
    vaultOpen:
      true,
  };

  model.observeTransition({
    action: "A",

    before:
      initial,

    after:
      powered,

    accepted:
      true,

    observedAt:
      "2026-09-19T07:00:00.000Z",
  });

  model.observeTransition({
    action: "B",

    before:
      powered,

    after:
      powered,

    accepted:
      true,

    observedAt:
      "2026-09-19T07:01:00.000Z",
  });

  model.observeTransition({
    action: "C",

    before:
      powered,

    after:
      ready,

    accepted:
      true,

    observedAt:
      "2026-09-19T07:02:00.000Z",
  });

  model.observeTransition({
    action: "B",

    before:
      ready,

    after:
      open,

    accepted:
      true,

    observedAt:
      "2026-09-19T07:03:00.000Z",
  });

  return model;
}

describe(
  "Mabojolu G world-model-guided planner",
  () => {
    it(
      "constructs a multi-step plan from learned causal rules",
      () => {
        const planner =
          new WorldModelPlanner(
            trainVaultModel(),
          );

        const plan =
          planner.plan({
            currentState: {
              power: false,
              latch: false,
              vaultOpen:
                false,
            },

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          plan,
        ).toBeDefined();

        expect(
          plan?.steps.map(
            (step) =>
              step.action,
          ),
        ).toEqual([
          "A",
          "C",
          "B",
        ]);

        expect(
          plan
            ?.predictedFinalState
            .vaultOpen,
        ).toBe(true);
      },
    );

    it(
      "uses modeled consequences rather than replaying no-effect actions",
      () => {
        const planner =
          new WorldModelPlanner(
            trainVaultModel(),
          );

        const plan =
          planner.plan({
            currentState: {
              power: true,
              latch: false,
              vaultOpen:
                false,
            },

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "B",
              "C",
            ],
          });

        expect(
          plan?.steps.map(
            (step) =>
              step.action,
          ),
        ).toEqual([
          "C",
          "B",
        ]);
      },
    );

    it(
      "returns no plan when the model lacks enough causal knowledge",
      () => {
        const model =
          new WorldModel();

        model.observeTransition({
          action: "A",

          before: {
            stage: 0,
          },

          after: {
            stage: 1,
          },

          accepted:
            true,

          observedAt:
            "2026-09-19T07:00:00.000Z",
        });

        const planner =
          new WorldModelPlanner(
            model,
          );

        expect(
          planner.plan({
            currentState: {
              stage: 0,
            },

            goalConditions: {
              stage: 3,
            },

            availableActions: [
              "A",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "returns an empty plan when the goal is already satisfied",
      () => {
        const planner =
          new WorldModelPlanner(
            new WorldModel(),
          );

        const plan =
          planner.plan({
            currentState: {
              solved:
                true,
            },

            goalConditions: {
              solved:
                true,
            },

            availableActions: [
              "A",
            ],
          });

        expect(
          plan?.steps,
        ).toEqual([]);

        expect(
          plan?.confidence,
        ).toBe(1);
      },
    );

    it(
      "respects the planning depth limit instead of searching indefinitely",
      () => {
        const model =
          trainVaultModel();

        const planner =
          new WorldModelPlanner(
            model,
            {
              maxDepth: 2,
            },
          );

        expect(
          planner.plan({
            currentState: {
              power: false,
              latch: false,
              vaultOpen:
                false,
            },

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          }),
        ).toBeUndefined();
      },
    );
  },
);
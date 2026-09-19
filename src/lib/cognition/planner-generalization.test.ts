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

describe(
  "Mabojolu G planning with generalized causal knowledge",
  () => {
    it(
      "plans through an unseen state combination using a supported causal abstraction",
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
              "2026-09-19T10:00:00.000Z",
            ],
            [
              true,
              false,
              "2026-09-19T10:01:00.000Z",
            ],
            [
              false,
              true,
              "2026-09-19T10:02:00.000Z",
            ],
          ] as const
        ) {
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

        const planner =
          new WorldModelPlanner(
            model,
          );

        const plan =
          planner.plan({
            currentState: {
              stage: 0,
              noiseA: true,
              noiseB: true,
            },

            goalConditions: {
              stage: 1,
            },

            availableActions: [
              "A",
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
        ]);

        expect(
          plan
            ?.predictedFinalState
            .stage,
        ).toBe(1);

        expect(
          plan
            ?.steps[0]
            .confidence,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );
  },
);

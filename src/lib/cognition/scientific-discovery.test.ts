import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousCausalHypothesisEngine,
} from "./autonomous-hypothesis";

import type {
  EnvironmentSnapshot,
} from "./environment";

import {
  ScientificDiscoveryPlanner,
} from "./scientific-discovery";

import {
  WorldModel,
} from "./world-model";

const S00:
  EnvironmentSnapshot = {
  power: false,
  latch: false,
  target: false,
};

const S10:
  EnvironmentSnapshot = {
  power: true,
  latch: false,
  target: false,
};

const S01:
  EnvironmentSnapshot = {
  power: false,
  latch: true,
  target: false,
};

const S11:
  EnvironmentSnapshot = {
  power: true,
  latch: true,
  target: false,
};

const S11_DONE:
  EnvironmentSnapshot = {
  power: true,
  latch: true,
  target: true,
};

function seedEngine():
  AutonomousCausalHypothesisEngine {
  const engine =
    new AutonomousCausalHypothesisEngine();

  engine.observeTransition({
    observationId:
      "obs-t-00",

    action: "T",

    before:
      S00,

    after:
      S00,

    accepted:
      true,

    observedAt:
      "2026-09-19T14:00:00.000Z",
  });

  engine.observeTransition({
    observationId:
      "obs-t-11",

    action: "T",

    before:
      S11,

    after:
      S11_DONE,

    accepted:
      true,

    observedAt:
      "2026-09-19T14:01:00.000Z",
  });

  return engine;
}

function learn(
  model:
    WorldModel,

  action:
    string,

  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,

  observedAt:
    string,
): void {
  model.observeTransition({
    action,
    before,
    after,
    accepted:
      true,
    observedAt,
  });
}

function seedWorldModel():
  WorldModel {
  const model =
    new WorldModel();

  learn(
    model,
    "P",
    S00,
    S10,
    "2026-09-19T14:10:00.000Z",
  );

  learn(
    model,
    "L",
    S00,
    S01,
    "2026-09-19T14:11:00.000Z",
  );

  learn(
    model,
    "L",
    S10,
    S11,
    "2026-09-19T14:12:00.000Z",
  );

  learn(
    model,
    "Q",
    S10,
    S00,
    "2026-09-19T14:13:00.000Z",
  );

  learn(
    model,
    "Q",
    S11,
    S01,
    "2026-09-19T14:14:00.000Z",
  );

  learn(
    model,
    "U",
    S01,
    S00,
    "2026-09-19T14:15:00.000Z",
  );

  learn(
    model,
    "U",
    S11,
    S10,
    "2026-09-19T14:16:00.000Z",
  );

  learn(
    model,
    "T",
    S00,
    S00,
    "2026-09-19T14:17:00.000Z",
  );

  learn(
    model,
    "T",
    S11,
    S11_DONE,
    "2026-09-19T14:18:00.000Z",
  );

  return model;
}

const ACTIONS = [
  "L",
  "P",
  "Q",
  "T",
  "U",
] as const;

describe(
  "Mabojolu G multi-step scientific discovery planner",
  () => {
    it(
      "plans how to reach an untested state where generated hypotheses disagree",
      () => {
        const engine =
          seedEngine();

        const model =
          seedWorldModel();

        const planner =
          new ScientificDiscoveryPlanner(
            model,
            engine,
          );

        const plan =
          planner.plan({
            currentState:
              S00,

            availableActions:
              ACTIONS,
          });

        expect(
          plan,
        ).toBeDefined();

        expect(
          plan
            ?.setupSteps,
        ).toHaveLength(1);

        expect(
          plan
            ?.setupSteps[0]
            ?.action,
        ).toBe("P");

        expect(
          plan
            ?.targetState,
        ).toEqual(
          S10,
        );

        expect(
          plan
            ?.probeAction,
        ).toBe("T");

        expect(
          plan
            ?.informationGain,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "replans to a different discriminating state after the first experiment",
      () => {
        const engine =
          seedEngine();

        const model =
          seedWorldModel();

        engine.observeTransition({
          observationId:
            "obs-t-10",

          action: "T",

          before:
            S10,

          after:
            S10,

          accepted:
            true,

          observedAt:
            "2026-09-19T14:20:00.000Z",
        });

        learn(
          model,
          "T",
          S10,
          S10,
          "2026-09-19T14:20:00.000Z",
        );

        const planner =
          new ScientificDiscoveryPlanner(
            model,
            engine,
          );

        const plan =
          planner.plan({
            currentState:
              S10,

            availableActions:
              ACTIONS,
          });

        expect(
          plan,
        ).toBeDefined();

        expect(
          plan
            ?.targetState,
        ).toEqual(
          S01,
        );

        expect(
          plan
            ?.setupSteps
            .map(
              (step) =>
                step.action,
            ),
        ).toEqual([
          "L",
          "Q",
        ]);

        expect(
          plan
            ?.probeAction,
        ).toBe("T");
      },
    );

    it(
      "stops proposing discovery experiments after all informative observed-value combinations have been tested",
      () => {
        const engine =
          seedEngine();

        const model =
          seedWorldModel();

        engine.observeTransition({
          observationId:
            "obs-t-10",

          action: "T",

          before:
            S10,

          after:
            S10,

          accepted:
            true,

          observedAt:
            "2026-09-19T14:20:00.000Z",
        });

        engine.observeTransition({
          observationId:
            "obs-t-01",

          action: "T",

          before:
            S01,

          after:
            S01,

          accepted:
            true,

          observedAt:
            "2026-09-19T14:21:00.000Z",
        });

        const planner =
          new ScientificDiscoveryPlanner(
            model,
            engine,
          );

        expect(
          planner.plan({
            currentState:
              S01,

            availableActions:
              ACTIONS,
          }),
        ).toBeUndefined();

        const conjunction =
          engine
            .getHypotheses()
            .find(
              (hypothesis) =>
                Object.keys(
                  hypothesis
                    .conditions,
                )
                  .sort()
                  .join("+") ===
                "latch+power",
            );

        expect(
          conjunction
            ?.status,
        ).toBe(
          "supported",
        );

        expect(
          conjunction
            ?.contradictionCount,
        ).toBe(0);
      },
    );
  },
);

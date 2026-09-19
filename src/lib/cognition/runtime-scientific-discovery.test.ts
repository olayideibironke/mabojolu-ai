import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousCausalHypothesisEngine,
} from "./autonomous-hypothesis";

import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

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
          15,
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

function seedEngine():
  AutonomousCausalHypothesisEngine {
  const engine =
    new AutonomousCausalHypothesisEngine();

  engine.observeTransition({
    observationId:
      "prior-t-00",

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
      "prior-t-11",

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

class DiscoveryWorld
  implements CognitiveEnvironment
{
  readonly id =
    "multi-step-discovery-world-v0.1";

  readonly goalDescription =
    "Activate the target.";

  private power =
    false;

  private latch =
    false;

  private target =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "L",
      "P",
      "Q",
      "T",
      "U",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      power:
        this.power,

      latch:
        this.latch,

      target:
        this.target,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      target:
        true,
    };
  }

  act(
    action: string,
  ):
    EnvironmentActionResult {
    switch (
      action
    ) {
      case "P":
        this.power =
          true;
        break;

      case "Q":
        this.power =
          false;
        break;

      case "L":
        this.latch =
          true;
        break;

      case "U":
        this.latch =
          false;
        break;

      case "T":
        if (
          this.power &&
          this.latch
        ) {
          this.target =
            true;
        }
        break;

      default:
        return {
          accepted:
            false,

          summary:
            "Action rejected.",
        };
    }

    return {
      accepted:
        true,

      summary:
        "Action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.target;
  }
}

describe(
  "Mabojolu G runtime multi-step autonomous scientific discovery",
  () => {
    it(
      "navigates to two different discriminating states, probes them, then returns to goal-directed planning",
      () => {
        const hypothesisEngine =
          seedEngine();

        const worldModel =
          seedWorldModel();

        const result =
          new CognitiveRuntime(
            new DiscoveryWorld(),
            {
              hypothesisEngine,

              worldModel,

              maxCycles:
                12,

              now:
                makeClock(),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(9);

        expect(
          result.actionHistory,
        ).toEqual([
          "Execute action P and observe the environment.",
          "Execute action T and observe the environment.",
          "Execute action L and observe the environment.",
          "Execute action Q and observe the environment.",
          "Execute action T and observe the environment.",
          "Execute action U and observe the environment.",
          "Execute action P and observe the environment.",
          "Execute action L and observe the environment.",
          "Execute action T and observe the environment.",
        ]);

        expect(
          result.state
            .actions
            .map(
              (action) =>
                action.proposal
                  .kind,
            ),
        ).toEqual([
          "scientific-discovery-setup",
          "hypothesis-experiment",
          "scientific-discovery-setup",
          "scientific-discovery-setup",
          "hypothesis-experiment",
          "world-model-plan",
          "world-model-plan",
          "world-model-plan",
          "world-model-plan",
        ]);
      },
    );

    it(
      "finishes with the conjunction stronger than the simpler causal explanations",
      () => {
        const hypothesisEngine =
          seedEngine();

        const worldModel =
          seedWorldModel();

        const result =
          new CognitiveRuntime(
            new DiscoveryWorld(),
            {
              hypothesisEngine,

              worldModel,

              maxCycles:
                12,

              now:
                makeClock(),
            },
          ).run();

        const targetHypotheses =
          result
            .generatedHypotheses
            .filter(
              (hypothesis) =>
                hypothesis.action ===
                  "T" &&
                hypothesis.effects
                  .some(
                    (effect) =>
                      effect.key ===
                        "target" &&
                      effect.after ===
                        true,
                  ),
            );

        const conjunction =
          targetHypotheses.find(
            (hypothesis) =>
              Object.keys(
                hypothesis
                  .conditions,
              )
                .sort()
                .join("+") ===
              "latch+power",
          );

        const powerOnly =
          targetHypotheses.find(
            (hypothesis) =>
              Object.keys(
                hypothesis
                  .conditions,
              )
                .sort()
                .join("+") ===
              "power",
          );

        const latchOnly =
          targetHypotheses.find(
            (hypothesis) =>
              Object.keys(
                hypothesis
                  .conditions,
              )
                .sort()
                .join("+") ===
              "latch",
          );

        expect(
          conjunction,
        ).toBeDefined();

        expect(
          powerOnly,
        ).toBeDefined();

        expect(
          latchOnly,
        ).toBeDefined();

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

        expect(
          powerOnly
            ?.contradictionCount,
        ).toBeGreaterThan(0);

        expect(
          latchOnly
            ?.contradictionCount,
        ).toBeGreaterThan(0);

        expect(
          conjunction
            ?.confidence,
        ).toBeGreaterThan(
          powerOnly
            ?.confidence ??
            0,
        );

        expect(
          conjunction
            ?.confidence,
        ).toBeGreaterThan(
          latchOnly
            ?.confidence ??
            0,
        );
      },
    );
  },
);

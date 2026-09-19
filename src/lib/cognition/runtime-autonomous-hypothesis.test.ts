import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

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
          13,
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

class HypothesisLabWorld
  implements CognitiveEnvironment
{
  readonly id =
    "hypothesis-lab-v0.1";

  readonly goalDescription =
    "Complete the experiment.";

  private power =
    false;

  private latch =
    false;

  private signal =
    false;

  private complete =
    false;

  private latchUnlocked =
    false;

  private resetUnlocked =
    false;

  private goalUnlocked =
    false;

  getAvailableActions():
    readonly string[] {
    const actions = [
      "T",
      "P",
    ];

    if (
      this.latchUnlocked
    ) {
      actions.push(
        "L",
      );
    }

    if (
      this.resetUnlocked
    ) {
      actions.push(
        "R",
      );
    }

    if (
      this.goalUnlocked
    ) {
      actions.push(
        "G",
      );
    }

    return actions;
  }

  observe():
    EnvironmentSnapshot {
    return {
      power:
        this.power,

      latch:
        this.latch,

      signal:
        this.signal,

      complete:
        this.complete,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      complete:
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
      case "T":
        if (
          this.power &&
          this.latch
        ) {
          this.signal =
            true;

          this.resetUnlocked =
            true;
        } else {
          if (
            this.power &&
            !this.latch
          ) {
            this.latchUnlocked =
              true;
          }

          if (
            !this.power &&
            this.latch
          ) {
            this.goalUnlocked =
              true;
          }
        }
        break;

      case "P":
        this.power =
          true;
        break;

      case "L":
        if (
          !this.latchUnlocked
        ) {
          return {
            accepted:
              false,

            summary:
              "Action unavailable.",
          };
        }

        this.latch =
          true;
        break;

      case "R":
        if (
          !this.resetUnlocked
        ) {
          return {
            accepted:
              false,

            summary:
              "Action unavailable.",
          };
        }

        this.power =
          false;

        this.signal =
          false;
        break;

      case "G":
        if (
          !this.goalUnlocked
        ) {
          return {
            accepted:
              false,

            summary:
              "Action unavailable.",
          };
        }

        this.complete =
          true;
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
    return this.complete;
  }
}

describe(
  "Mabojolu G runtime autonomous hypothesis generation",
  () => {
    it(
      "generates competing causal explanations and selects a discriminating experiment during a live run",
      () => {
        const result =
          new CognitiveRuntime(
            new HypothesisLabWorld(),
            {
              maxCycles:
                10,

              now:
                makeClock(),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(8);

        expect(
          result.actionHistory,
        ).toEqual([
          "Execute action T and observe the environment.",
          "Execute action P and observe the environment.",
          "Execute action T and observe the environment.",
          "Execute action L and observe the environment.",
          "Execute action T and observe the environment.",
          "Execute action R and observe the environment.",
          "Execute action T and observe the environment.",
          "Execute action G and observe the environment.",
        ]);

        expect(
          result.state
            .actions[6]
            ?.proposal
            .kind,
        ).toBe(
          "hypothesis-experiment",
        );

        expect(
          result.state
            .actions[6]
            ?.proposal
            .expectedEffects[0],
        ).toContain(
          "information gain",
        );

        expect(
          result
            .generatedHypotheses
            .length,
        ).toBeGreaterThanOrEqual(
          3,
        );
      },
    );

    it(
      "records autonomous hypotheses in cognitive state and strengthens the conjunction after falsifying a simpler explanation",
      () => {
        const result =
          new CognitiveRuntime(
            new HypothesisLabWorld(),
            {
              maxCycles:
                10,

              now:
                makeClock(),
            },
          ).run();

        const generated =
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
                        "signal" &&
                      effect.after ===
                        true,
                  ),
            );

        const conjunction =
          generated.find(
            (hypothesis) =>
              Object.keys(
                hypothesis
                  .conditions,
              )
                .sort()
                .join("+") ===
              "latch+power",
          );

        const latchOnly =
          generated.find(
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
          latchOnly,
        ).toBeDefined();

        expect(
          conjunction
            ?.contradictionCount,
        ).toBe(0);

        expect(
          latchOnly
            ?.contradictionCount,
        ).toBe(1);

        expect(
          conjunction
            ?.confidence,
        ).toBeGreaterThan(
          latchOnly
            ?.confidence ??
            0,
        );

        const stateHypothesis =
          result.state
            .hypotheses
            .find(
              (hypothesis) =>
                hypothesis.id ===
                conjunction
                  ?.id,
            );

        expect(
          stateHypothesis,
        ).toBeDefined();

        expect(
          stateHypothesis
            ?.status,
        ).toBe(
          "supported",
        );
      },
    );
  },
);

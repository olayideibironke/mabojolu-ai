import {
  describe,
  expect,
  it,
} from "vitest";

import {
  CrossFamilyPrincipleLibrary,
} from "./abstract-principle";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  SyntheticGatedSequenceEnvironment,
} from "./synthetic-challenge-environment";

import type {
  GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

import {
  ThresholdAccumulationEnvironment,
} from "./threshold-challenge-environment";

import type {
  ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

const GATED_TRAINING:
  GatedSequenceChallengeSpec = {
  id:
    "abstract-training-gated",

  family:
    "gated-family",

  kind:
    "gated-sequence",

  partition:
    "practice",

  difficulty:
    0.5,

  context:
    "gated-training",

  actionLabels: [
    "A",
    "B",
    "C",
  ],

  stateKeys: [
    "power",
    "latch",
    "open",
  ],

  actionRoleOrder: [
    0,
    2,
    1,
  ],

  actionPresentationOrder: [
    0,
    1,
    2,
  ],
};

const THRESHOLD_TRAINING:
  ThresholdAccumulationChallengeSpec = {
  id:
    "abstract-training-threshold",

  family:
    "threshold-family",

  kind:
    "threshold-accumulation",

  partition:
    "practice",

  difficulty:
    0.7,

  context:
    "threshold-training",

  actionLabels: [
    "FINISH",
    "INC",
  ],

  stateKeys: [
    "progress",
    "done",
  ],

  actionRoleOrder: [
    1,
    0,
  ],

  target:
    2,

  actionPresentationOrder: [
    0,
    1,
  ],
};

class CategoricalUnlockWorld
  implements CognitiveEnvironment
{
  readonly id =
    "categorical-held-out";

  readonly goalDescription =
    "Unlock the categorical gate.";

  private mode =
    "cold";

  private open =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "OPEN-GATE",
      "PREPARE-MODE",
      "DISTRACT-ONE",
      "DISTRACT-TWO",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      mode:
        this.mode,

      open:
        this.open,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      open:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
      "PREPARE-MODE"
    ) {
      this.mode =
        "ready";
    }

    if (
      action ===
        "OPEN-GATE" &&
      this.mode ===
        "ready"
    ) {
      this.open =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Categorical action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.open;
  }
}

function makeClock(
  hour:
    number,
):
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
          hour,
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
  "Mabojolu G runtime cross-family abstract transfer",
  () => {
    it(
      "induces a higher-order principle from two families and improves a third unfamiliar family",
      () => {
        const principles =
          new CrossFamilyPrincipleLibrary();

        const gated =
          new CognitiveRuntime(
            new SyntheticGatedSequenceEnvironment(
              GATED_TRAINING,
            ),
            {
              abstractPrincipleLibrary:
                principles,

              taskFamily:
                "gated-family",

              taskFamilyKind:
                "gated-sequence",

              maxCycles:
                8,

              now:
                makeClock(
                  18,
                ),
            },
          ).run();

        expect(
          gated.solved,
        ).toBe(true);

        expect(
          gated
            .abstractPrinciple
            ?.status,
        ).toBe(
          "candidate",
        );

        expect(
          gated
            .abstractPrinciple
            ?.supportFamilies,
        ).toEqual([
          "gated-family",
        ]);

        const threshold =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              THRESHOLD_TRAINING,
            ),
            {
              abstractPrincipleLibrary:
                principles,

              taskFamily:
                "threshold-family",

              taskFamilyKind:
                "threshold-accumulation",

              maxCycles:
                8,

              now:
                makeClock(
                  19,
                ),
            },
          ).run();

        expect(
          threshold.solved,
        ).toBe(true);

        expect(
          threshold
            .abstractPrinciple
            ?.status,
        ).toBe(
          "active",
        );

        expect(
          threshold
            .abstractPrinciple
            ?.supportFamilies,
        ).toEqual([
          "gated-family",
          "threshold-family",
        ]);

        expect(
          threshold
            .abstractPrinciple
            ?.supportFamilyKinds,
        ).toEqual([
          "gated-sequence",
          "threshold-accumulation",
        ]);

        const baseline =
          new CognitiveRuntime(
            new CategoricalUnlockWorld(),
            {
              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const transferred =
          new CognitiveRuntime(
            new CategoricalUnlockWorld(),
            {
              abstractPrincipleLibrary:
                principles,

              taskFamily:
                "categorical-family",

              taskFamilyKind:
                "categorical-mode-unlock",

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          baseline.solved,
        ).toBe(true);

        expect(
          transferred.solved,
        ).toBe(true);

        expect(
          baseline.cycles,
        ).toBe(5);

        expect(
          transferred.cycles,
        ).toBe(3);

        expect(
          transferred.cycles,
        ).toBeLessThan(
          baseline.cycles,
        );

        expect(
          transferred.state
            .actions[2]
            ?.proposal
            .kind,
        ).toBe(
          "abstract-principle",
        );

        expect(
          transferred
            .abstractPrinciple
            ?.supportFamilies,
        ).toEqual([
          "categorical-family",
          "gated-family",
          "threshold-family",
        ]);

        expect(
          transferred
            .abstractPrinciple
            ?.supportFamilyKinds,
        ).toEqual([
          "categorical-mode-unlock",
          "gated-sequence",
          "threshold-accumulation",
        ]);
      },
    );

    it(
      "does not change third-family behavior before the principle has cross-family support",
      () => {
        const principles =
          new CrossFamilyPrincipleLibrary();

        new CognitiveRuntime(
          new SyntheticGatedSequenceEnvironment(
            GATED_TRAINING,
          ),
          {
            abstractPrincipleLibrary:
              principles,

            taskFamily:
              "gated-family",

            maxCycles:
              8,

            now:
              makeClock(
                18,
              ),
          },
        ).run();

        expect(
          principles
            .getPrinciple()
            ?.status,
        ).toBe(
          "candidate",
        );

        const result =
          new CognitiveRuntime(
            new CategoricalUnlockWorld(),
            {
              abstractPrincipleLibrary:
                principles,

              taskFamily:
                "categorical-family",

              taskFamilyKind:
                "categorical-mode-unlock",

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(5);

        expect(
          result.state
            .actions
            .some(
              (action) =>
                action
                  .proposal
                  .kind ===
                "abstract-principle",
            ),
        ).toBe(false);
      },
    );
  },
);

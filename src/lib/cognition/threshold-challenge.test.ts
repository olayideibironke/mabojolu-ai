import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ThresholdAccumulationEnvironment,
} from "./threshold-challenge-environment";

import {
  thresholdChallengeFingerprint,
  validateThresholdChallengeSpec,
  type ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

function spec():
  ThresholdAccumulationChallengeSpec {
  return {
    id:
      "threshold-world",

    family:
      "threshold-reasoning",

    kind:
      "threshold-accumulation",

    partition:
      "practice",

    difficulty:
      0.4,

    context:
      "threshold-context",

    actionLabels: [
      "INC",
      "FINISH",
    ],

    stateKeys: [
      "progress",
      "done",
    ],

    actionRoleOrder: [
      0,
      1,
    ],

    target:
      2,

    actionPresentationOrder: [
      0,
      1,
    ],
  };
}

describe(
  "Mabojolu G threshold accumulation challenge family",
  () => {
    it(
      "requires repeated numeric progress before completion",
      () => {
        const environment =
          new ThresholdAccumulationEnvironment(
            spec(),
          );

        environment.act(
          "FINISH",
        );

        expect(
          environment.isGoalSatisfied(),
        ).toBe(false);

        environment.act(
          "INC",
        );

        expect(
          environment.observe(),
        ).toMatchObject({
          progress:
            1,

          done:
            false,
        });

        environment.act(
          "FINISH",
        );

        expect(
          environment.isGoalSatisfied(),
        ).toBe(false);

        environment.act(
          "INC",
        );

        environment.act(
          "FINISH",
        );

        expect(
          environment.isGoalSatisfied(),
        ).toBe(true);
      },
    );

    it(
      "can expose a hostile action order without changing the hidden numeric mechanics",
      () => {
        const environment =
          new ThresholdAccumulationEnvironment({
            ...spec(),

            actionPresentationOrder: [
              1,
              0,
            ],
          });

        expect(
          environment.getAvailableActions(),
        ).toEqual([
          "FINISH",
          "INC",
        ]);

        environment.act(
          "INC",
        );

        environment.act(
          "INC",
        );

        environment.act(
          "FINISH",
        );

        expect(
          environment.isGoalSatisfied(),
        ).toBe(true);
      },
    );

    it(
      "rejects malformed threshold targets and role mappings",
      () => {
        expect(
          () =>
            validateThresholdChallengeSpec({
              ...spec(),

              target:
                1,
            }),
        ).toThrow(
          "target",
        );

        expect(
          () =>
            validateThresholdChallengeSpec({
              ...spec(),

              actionRoleOrder: [
                0,
                0,
              ],
            }),
        ).toThrow(
          "permutation",
        );
      },
    );

    it(
      "keeps cosmetic metadata out of evaluation content fingerprints",
      () => {
        const original =
          spec();

        const relabeled:
          ThresholdAccumulationChallengeSpec = {
          ...original,

          id:
            "evaluation-copy",

          family:
            "renamed-family",

          partition:
            "evaluation",

          difficulty:
            0.9,

          context:
            "renamed-context",
        };

        expect(
          thresholdChallengeFingerprint(
            relabeled,
          ),
        ).toBe(
          thresholdChallengeFingerprint(
            original,
          ),
        );
      },
    );
  },
);

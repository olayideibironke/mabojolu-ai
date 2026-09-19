import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SyntheticGatedSequenceEnvironment,
} from "./synthetic-challenge-environment";

import type {
  GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

function spec():
  GatedSequenceChallengeSpec {
  return {
    id:
      "generated-world",

    family:
      "gated-sequence",

    kind:
      "gated-sequence",

    partition:
      "practice",

    difficulty:
      0.4,

    context:
      "generated-context",

    actionLabels: [
      "A",
      "B",
      "C",
    ],

    stateKeys: [
      "power",
      "latch",
      "vaultOpen",
    ],

    actionRoleOrder: [
      0,
      2,
      1,
    ],
  };
}

describe(
  "Mabojolu G synthetic challenge environment",
  () => {
    it(
      "keeps the hidden action-role mapping behind the CognitiveEnvironment interface",
      () => {
        const environment =
          new SyntheticGatedSequenceEnvironment(
            spec(),
          );

        expect(
          environment.observe(),
        ).toEqual({
          power:
            false,

          latch:
            false,

          vaultOpen:
            false,

          context:
            "generated-context",
        });

        environment.act(
          "A",
        );

        expect(
          environment.observe(),
        ).toMatchObject({
          power:
            true,

          latch:
            false,

          vaultOpen:
            false,
        });

        environment.act(
          "C",
        );

        expect(
          environment.observe(),
        ).toMatchObject({
          power:
            true,

          latch:
            true,

          vaultOpen:
            false,
        });

        environment.act(
          "B",
        );

        expect(
          environment.isGoalSatisfied(),
        ).toBe(true);
      },
    );

    it(
      "allows prerequisite-sensitive no-effect actions without leaking why they failed",
      () => {
        const environment =
          new SyntheticGatedSequenceEnvironment(
            spec(),
          );

        const result =
          environment.act(
            "B",
          );

        expect(
          result.accepted,
        ).toBe(true);

        expect(
          environment.observe(),
        ).toMatchObject({
          power:
            false,

          latch:
            false,

          vaultOpen:
            false,
        });

        expect(
          result.summary,
        ).toBe(
          "Generated action executed.",
        );
      },
    );

    it(
      "rejects actions outside the generated action interface",
      () => {
        const environment =
          new SyntheticGatedSequenceEnvironment(
            spec(),
          );

        const result =
          environment.act(
            "UNKNOWN",
          );

        expect(
          result.accepted,
        ).toBe(false);

        expect(
          environment.isGoalSatisfied(),
        ).toBe(false);
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MultiFamilyEvaluationIsolationGuard,
  syntheticChallengeFingerprint,
} from "./multi-family-challenge";

import type {
  GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

import type {
  ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

const GATED:
  GatedSequenceChallengeSpec = {
  id:
    "gated-practice",

  family:
    "gated-family",

  kind:
    "gated-sequence",

  partition:
    "practice",

  difficulty:
    0.4,

  context:
    "gated-context",

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
    2,
    1,
  ],
};

const THRESHOLD:
  ThresholdAccumulationChallengeSpec = {
  id:
    "threshold-practice",

  family:
    "threshold-family",

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

describe(
  "Mabojolu G multi-family evaluation isolation",
  () => {
    it(
      "keeps distinct causal kinds in distinct content fingerprints",
      () => {
        expect(
          syntheticChallengeFingerprint(
            GATED,
          ),
        ).not.toBe(
          syntheticChallengeFingerprint(
            THRESHOLD,
          ),
        );
      },
    );

    it(
      "tracks practice exposure from multiple challenge families",
      () => {
        const guard =
          new MultiFamilyEvaluationIsolationGuard();

        guard.registerPractice(
          GATED,
        );

        guard.registerPractice(
          THRESHOLD,
        );

        expect(
          guard.getPracticeCount(),
        ).toBe(2);
      },
    );

    it(
      "rejects a relabeled threshold evaluation that duplicates threshold practice content",
      () => {
        const guard =
          new MultiFamilyEvaluationIsolationGuard();

        guard.registerPractice(
          THRESHOLD,
        );

        expect(
          () =>
            guard.assertHeldOut({
              ...THRESHOLD,

              id:
                "threshold-evaluation-copy",

              family:
                "renamed-threshold-family",

              partition:
                "evaluation",

              difficulty:
                0.95,

              context:
                "renamed-threshold-context",
            }),
        ).toThrow(
          "duplicates practiced task content",
        );
      },
    );
  },
);

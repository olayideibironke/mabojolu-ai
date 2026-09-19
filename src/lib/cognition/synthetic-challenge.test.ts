import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EvaluationIsolationGuard,
  challengeFingerprint,
  initialChallengeSnapshot,
  validateChallengeSpec,
  type GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

function practiceSpec():
  GatedSequenceChallengeSpec {
  return {
    id:
      "practice-1",

    family:
      "gated-sequence",

    kind:
      "gated-sequence",

    partition:
      "practice",

    difficulty:
      0.4,

    context:
      "practice-context",

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
  "Mabojolu G synthetic challenge isolation",
  () => {
    it(
      "builds a deterministic initial observable snapshot",
      () => {
        expect(
          initialChallengeSnapshot(
            practiceSpec(),
          ),
        ).toEqual({
          power:
            false,

          latch:
            false,

          vaultOpen:
            false,

          context:
            "practice-context",
        });
      },
    );

    it(
      "rejects malformed action-role permutations",
      () => {
        expect(
          () =>
            validateChallengeSpec({
              ...practiceSpec(),

              actionRoleOrder: [
                0,
                0,
                2,
              ],
            }),
        ).toThrow(
          "permutation",
        );
      },
    );

    it(
      "fingerprints task content rather than id or partition labels",
      () => {
        const practice =
          practiceSpec();

        const relabeled:
          GatedSequenceChallengeSpec = {
          ...practice,

          id:
            "evaluation-copy",

          family:
            "renamed-family-label",

          partition:
            "evaluation",

          difficulty:
            0.95,

          context:
            "renamed-context",
        };

        expect(
          challengeFingerprint(
            relabeled,
          ),
        ).toBe(
          challengeFingerprint(
            practice,
          ),
        );
      },
    );

    it(
      "rejects an evaluation task that exactly duplicates practiced content",
      () => {
        const guard =
          new EvaluationIsolationGuard();

        const practice =
          practiceSpec();

        guard.registerPractice(
          practice,
        );

        expect(
          () =>
            guard.assertHeldOut({
              ...practice,

              id:
                "evaluation-copy",

              family:
                "renamed-family-label",

              partition:
                "evaluation",

              difficulty:
                0.95,

              context:
                "renamed-context",
            }),
        ).toThrow(
          "duplicates a practice challenge",
        );
      },
    );

    it(
      "accepts a genuinely held-out renamed evaluation instance",
      () => {
        const guard =
          new EvaluationIsolationGuard();

        guard.registerPractice(
          practiceSpec(),
        );

        const evaluation:
          GatedSequenceChallengeSpec = {
          id:
            "held-out-renamed",

          family:
            "gated-sequence",

          kind:
            "gated-sequence",

          partition:
            "evaluation",

          difficulty:
            0.8,

          context:
            "held-out-context",

          actionLabels: [
            "Y",
            "Z",
            "X",
          ],

          stateKeys: [
            "engineReady",
            "sealReleased",
            "gateOpen",
          ],

          actionRoleOrder: [
            2,
            1,
            0,
          ],
        };

        expect(
          () =>
            guard.assertHeldOut(
              evaluation,
            ),
        ).not.toThrow();

        expect(
          guard.getPracticeCount(),
        ).toBe(1);
      },
    );
  },
);

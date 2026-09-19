import {
  describe,
  expect,
  it,
} from "vitest";

import {
  type GatedSequenceChallengeBlueprint,
} from "./autonomous-challenge-generator";

import {
  CompetenceModel,
} from "./competence-model";

import {
  MultiFamilyChallengeGenerator,
  type ThresholdChallengeBlueprint,
} from "./multi-family-challenge-generator";

import {
  MultiFamilyEvaluationIsolationGuard,
} from "./multi-family-challenge";

const GATED:
  GatedSequenceChallengeBlueprint = {
  family:
    "gated-family",

  kind:
    "gated-sequence",

  minDifficulty:
    0.3,

  maxDifficulty:
    0.8,

  estimatedCost:
    1,

  practiceActionLabels: [
    "A",
    "B",
    "C",
  ],

  practiceStateKeys: [
    "power",
    "latch",
    "open",
  ],

  practiceActionRoleOrder: [
    0,
    2,
    1,
  ],
};

const THRESHOLD:
  ThresholdChallengeBlueprint = {
  family:
    "threshold-family",

  kind:
    "threshold-accumulation",

  minDifficulty:
    0.3,

  maxDifficulty:
    0.8,

  estimatedCost:
    1,

  practiceActionLabels: [
    "INC",
    "FINISH",
  ],

  practiceStateKeys: [
    "progress",
    "done",
  ],

  practiceActionRoleOrder: [
    0,
    1,
  ],

  target:
    2,
};

function competenceWithKnownGatedFamily():
  CompetenceModel {
  const competence =
    new CompetenceModel();

  for (
    let index = 0;
    index <
      6;
    index +=
      1
  ) {
    competence.record({
      taskId:
        "gated-known-" +
        index,

      family:
        GATED.family,

      difficulty:
        0.8,

      success:
        true,

      cycles:
        3,

      observedAt:
        "2026-09-19T1" +
        String(
          index + 2,
        ) +
        ":00:00.000Z",
    });
  }

  return competence;
}

describe(
  "Mabojolu G multi-family autonomous challenge generation",
  () => {
    it(
      "selects the weaker unfamiliar family instead of over-practicing an already supported family",
      () => {
        const generator =
          new MultiFamilyChallengeGenerator(
            competenceWithKnownGatedFamily(),
            new MultiFamilyEvaluationIsolationGuard(),
            [
              GATED,
              THRESHOLD,
            ],
          );

        const generated =
          generator.generateNextPractice();

        expect(
          generated
            ?.spec
            .family,
        ).toBe(
          THRESHOLD.family,
        );

        expect(
          generated
            ?.spec
            .kind,
        ).toBe(
          "threshold-accumulation",
        );
      },
    );

    it(
      "keeps competence evidence separate across challenge families",
      () => {
        const competence =
          competenceWithKnownGatedFamily();

        const generator =
          new MultiFamilyChallengeGenerator(
            competence,
            new MultiFamilyEvaluationIsolationGuard(),
            [
              GATED,
              THRESHOLD,
            ],
          );

        const generated =
          generator.generateNextPractice();

        expect(
          generated,
        ).toBeDefined();

        if (
          !generated
        ) {
          return;
        }

        const gatedBefore =
          competence.snapshot(
            GATED.family,
          );

        generator.recordPracticeOutcome({
          challenge:
            generated.spec,

          success:
            true,

          cycles:
            4,

          observedAt:
            "2026-09-19T20:00:00.000Z",
        });

        const gatedAfter =
          competence.snapshot(
            GATED.family,
          );

        const thresholdAfter =
          competence.snapshot(
            THRESHOLD.family,
          );

        expect(
          gatedAfter.attempts,
        ).toBe(
          gatedBefore.attempts,
        );

        expect(
          thresholdAfter.attempts,
        ).toBe(1);
      },
    );

    it(
      "uses family-specific challenge mechanics while sharing one isolation boundary",
      () => {
        const competence =
          new CompetenceModel();

        const isolation =
          new MultiFamilyEvaluationIsolationGuard();

        const generator =
          new MultiFamilyChallengeGenerator(
            competence,
            isolation,
            [
              GATED,
              THRESHOLD,
            ],
          );

        const first =
          generator.generateNextPractice();

        expect(
          first,
        ).toBeDefined();

        if (
          !first
        ) {
          return;
        }

        generator.recordPracticeOutcome({
          challenge:
            first.spec,

          success:
            true,

          cycles:
            4,

          observedAt:
            "2026-09-19T20:00:00.000Z",
        });

        expect(
          isolation.getPracticeCount(),
        ).toBe(1);

        expect(
          [
            "gated-sequence",
            "threshold-accumulation",
          ],
        ).toContain(
          first.spec.kind,
        );
      },
    );

    it(
      "rejects duplicate and mutated outcomes in the unified training stream",
      () => {
        const generator =
          new MultiFamilyChallengeGenerator(
            new CompetenceModel(),
            new MultiFamilyEvaluationIsolationGuard(),
            [
              THRESHOLD,
            ],
          );

        const generated =
          generator.generateNextPractice();

        expect(
          generated,
        ).toBeDefined();

        if (
          !generated
        ) {
          return;
        }

        expect(
          () =>
            generator.recordPracticeOutcome({
              challenge: {
                ...generated.spec,

                context:
                  "tampered",
              },

              success:
                true,

              cycles:
                3,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "does not match",
        );

        generator.recordPracticeOutcome({
          challenge:
            generated.spec,

          success:
            true,

          cycles:
            3,

          observedAt:
            "2026-09-19T20:00:00.000Z",
        });

        expect(
          () =>
            generator.recordPracticeOutcome({
              challenge:
                generated.spec,

              success:
                true,

              cycles:
                3,

              observedAt:
                "2026-09-19T21:00:00.000Z",
            }),
        ).toThrow(
          "already been recorded",
        );
      },
    );
  },
);

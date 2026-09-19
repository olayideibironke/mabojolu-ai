import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousChallengeGenerator,
  type GatedSequenceChallengeBlueprint,
} from "./autonomous-challenge-generator";

import {
  CompetenceModel,
} from "./competence-model";

import {
  EvaluationIsolationGuard,
} from "./synthetic-challenge";

const WEAK_BLUEPRINT:
  GatedSequenceChallengeBlueprint = {
  family:
    "weak-family",

  kind:
    "gated-sequence",

  minDifficulty:
    0.25,

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
    "done",
  ],

  practiceActionRoleOrder: [
    0,
    2,
    1,
  ],
};

const KNOWN_BLUEPRINT:
  GatedSequenceChallengeBlueprint = {
  family:
    "known-family",

  kind:
    "gated-sequence",

  minDifficulty:
    0.25,

  maxDifficulty:
    0.9,

  estimatedCost:
    1,

  practiceActionLabels: [
    "D",
    "E",
    "F",
  ],

  practiceStateKeys: [
    "ready",
    "armed",
    "complete",
  ],

  practiceActionRoleOrder: [
    0,
    2,
    1,
  ],
};

function trainedCompetence():
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
        "known-" +
        index,

      family:
        "known-family",

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
  "Mabojolu G autonomous challenge generator",
  () => {
    it(
      "generates practice for the weaker and more uncertain capability family",
      () => {
        const isolation =
          new EvaluationIsolationGuard();

        const generator =
          new AutonomousChallengeGenerator(
            trainedCompetence(),
            isolation,
            [
              KNOWN_BLUEPRINT,
              WEAK_BLUEPRINT,
            ],
          );

        const generated =
          generator.generateNextPractice();

        expect(
          generated
            ?.spec
            .family,
        ).toBe(
          "weak-family",
        );

        expect(
          generated
            ?.spec
            .partition,
        ).toBe(
          "practice",
        );

        expect(
          isolation
            .getPracticeCount(),
        ).toBe(1);
      },
    );

    it(
      "generates fresh practice instances without changing the safe hidden causal template",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
            ],
          );

        const first =
          generator.generateNextPractice();

        const second =
          generator.generateNextPractice();

        expect(
          first?.spec.id,
        ).not.toBe(
          second?.spec.id,
        );

        expect(
          first
            ?.spec
            .context,
        ).not.toBe(
          second
            ?.spec
            .context,
        );

        expect(
          first
            ?.spec
            .actionRoleOrder,
        ).toEqual(
          second
            ?.spec
            .actionRoleOrder,
        );

        expect(
          generator
            .getGenerationCount(
              "weak-family",
            ),
        ).toBe(2);
      },
    );

    it(
      "raises generated challenge difficulty as successful competence evidence accumulates",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
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

        const second =
          generator.generateNextPractice();

        expect(
          second,
        ).toBeDefined();

        expect(
          second
            ?.spec
            .difficulty,
        ).toBeGreaterThan(
          first
            .spec
            .difficulty,
        );

        expect(
          first
            .spec
            .actionPresentationOrder,
        ).toEqual([
          0,
          2,
          1,
        ]);

        expect(
          second
            ?.spec
            .actionPresentationOrder,
        ).toEqual([
          0,
          1,
          2,
        ]);

        expect(
          second
            ?.spec
            .actionRoleOrder,
        ).toEqual(
          first
            .spec
            .actionRoleOrder,
        );
      },
    );

    it(
      "rejects evaluation-partition outcomes from the training competence model",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
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

                partition:
                  "evaluation",
              },

              success:
                true,

              cycles:
                3,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "Only practice challenge outcomes",
        );
      },
    );

    it(
      "rejects an outcome for a practice task that it did not generate",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
            ],
          );

        expect(
          () =>
            generator.recordPracticeOutcome({
              challenge: {
                id:
                  "manual-practice",

                family:
                  "weak-family",

                kind:
                  "gated-sequence",

                partition:
                  "practice",

                difficulty:
                  0.3,

                context:
                  "manual",

                actionLabels: [
                  "A",
                  "B",
                  "C",
                ],

                stateKeys: [
                  "power",
                  "latch",
                  "done",
                ],

                actionRoleOrder: [
                  0,
                  2,
                  1,
                ],
              },

              success:
                true,

              cycles:
                3,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "does not match an autonomously generated challenge",
        );
      },
    );

    it(
      "rejects a mutated generated task before it can poison competence evidence",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
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
                  "tampered-context",
              },

              success:
                true,

              cycles:
                3,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "does not match an autonomously generated challenge",
        );
      },
    );

    it(
      "records each generated practice outcome only once",
      () => {
        const generator =
          new AutonomousChallengeGenerator(
            new CompetenceModel(),
            new EvaluationIsolationGuard(),
            [
              WEAK_BLUEPRINT,
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

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

import {
  CognitiveRuntime,
} from "./runtime";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

import {
  ThresholdAccumulationEnvironment,
} from "./threshold-challenge-environment";

import type {
  ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

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

function trainGatedSkill(
  library:
    AutonomousSkillLibrary,
):
  void {
  for (
    const [
      index,
      context,
    ] of [
      [
        0,
        "alpha",
      ],
      [
        1,
        "beta",
      ],
    ] as const
  ) {
    library.learnFromEpisode({
      episodeId:
        "gated-episode-" +
        index,

      environmentId:
        "gated-world-" +
        index,

      solved:
        true,

      goalConditions: {
        open:
          true,
      },

      transitions: [
        {
          action:
            "A",

          before: {
            power:
              false,

            latch:
              false,

            open:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              false,

            open:
              false,

            context,
          },

          changedKeys: [
            "power",
          ],

          accepted:
            true,
        },

        {
          action:
            "C",

          before: {
            power:
              true,

            latch:
              false,

            open:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              true,

            open:
              false,

            context,
          },

          changedKeys: [
            "latch",
          ],

          accepted:
            true,
        },

        {
          action:
            "B",

          before: {
            power:
              true,

            latch:
              true,

            open:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              true,

            open:
              true,

            context,
          },

          changedKeys: [
            "open",
          ],

          accepted:
            true,
        },
      ],

      observedAt:
        index ===
          0
          ? "2026-09-19T18:00:00.000Z"
          : "2026-09-19T19:00:00.000Z",
    });
  }
}

function recordKnownGatedCompetence(
  competence:
    CompetenceModel,
):
  void {
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
          index + 1,
        ) +
        ":00:00.000Z",
    });
  }
}

const HELD_OUT_THRESHOLD:
  ThresholdAccumulationChallengeSpec = {
  id:
    "threshold-held-out-hostile",

  family:
    THRESHOLD.family,

  kind:
    "threshold-accumulation",

  partition:
    "evaluation",

  difficulty:
    0.9,

  context:
    "held-out-threshold",

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
    1,
    0,
  ],
};

describe(
  "Mabojolu G multi-family learning and transfer boundary",
  () => {
    it(
      "does not misapply a learned Boolean-gating skill to numeric threshold reasoning",
      () => {
        const skills =
          new AutonomousSkillLibrary();

        trainGatedSkill(
          skills,
        );

        const probe:
          ThresholdAccumulationChallengeSpec = {
          ...HELD_OUT_THRESHOLD,

          id:
            "threshold-probe",

          partition:
            "practice",

          actionPresentationOrder: [
            0,
            1,
          ],
        };

        const result =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              probe,
            ),
            {
              skillLibrary:
                skills,

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
          result.recalledSkill,
        ).toBeUndefined();

        expect(
          result.skillComposition,
        ).toBeUndefined();

        expect(
          result
            .structuralSkillTransfer,
        ).toBeUndefined();
      },
    );

    it(
      "autonomously allocates practice to the weak second family and improves its held-out performance",
      () => {
        const competence =
          new CompetenceModel();

        recordKnownGatedCompetence(
          competence,
        );

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

        const skills =
          new AutonomousSkillLibrary();

        trainGatedSkill(
          skills,
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

        expect(
          first.spec.kind,
        ).toBe(
          "threshold-accumulation",
        );

        if (
          first.spec.kind !==
          "threshold-accumulation"
        ) {
          throw new Error(
            "Expected threshold practice.",
          );
        }

        const firstRun =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              first.spec,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          firstRun.solved,
        ).toBe(true);

        expect(
          firstRun.recalledSkill,
        ).toBeUndefined();

        generator.recordPracticeOutcome({
          challenge:
            first.spec,

          success:
            firstRun.solved,

          cycles:
            firstRun.cycles,

          observedAt:
            "2026-09-19T21:30:00.000Z",
        });

        const second =
          generator.generateNextPractice();

        expect(
          second,
        ).toBeDefined();

        if (
          !second
        ) {
          return;
        }

        expect(
          second.spec.kind,
        ).toBe(
          "threshold-accumulation",
        );

        if (
          second.spec.kind !==
          "threshold-accumulation"
        ) {
          throw new Error(
            "Expected second threshold practice.",
          );
        }

        const secondRun =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              second.spec,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        expect(
          secondRun.solved,
        ).toBe(true);

        generator.recordPracticeOutcome({
          challenge:
            second.spec,

          success:
            secondRun.solved,

          cycles:
            secondRun.cycles,

          observedAt:
            "2026-09-19T22:30:00.000Z",
        });

        const thresholdSkills =
          skills
            .getSkills()
            .filter(
              (skill) =>
                skill.status ===
                  "active" &&
                skill.steps
                  .some(
                    (step) =>
                      step.action ===
                      "INC",
                  ),
            );

        expect(
          thresholdSkills,
        ).toHaveLength(1);

        expect(
          competence
            .snapshot(
              THRESHOLD.family,
            )
            .attempts,
        ).toBe(2);

        expect(
          competence
            .snapshot(
              GATED.family,
            )
            .attempts,
        ).toBe(6);

        expect(
          () =>
            isolation.assertHeldOut(
              HELD_OUT_THRESHOLD,
            ),
        ).not.toThrow();

        const baseline =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              HELD_OUT_THRESHOLD,
            ),
            {
              maxCycles:
                8,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        const learned =
          new CognitiveRuntime(
            new ThresholdAccumulationEnvironment(
              HELD_OUT_THRESHOLD,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  24,
                ),
            },
          ).run();

        expect(
          baseline.solved,
        ).toBe(true);

        expect(
          learned.solved,
        ).toBe(true);

        expect(
          baseline.cycles,
        ).toBe(5);

        expect(
          learned.cycles,
        ).toBe(3);

        expect(
          learned.cycles,
        ).toBeLessThan(
          baseline.cycles,
        );

        expect(
          learned
            .recalledSkill
            ?.actions,
        ).toEqual([
          "INC",
          "INC",
          "FINISH",
        ]);
      },
    );
  },
);

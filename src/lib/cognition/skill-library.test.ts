import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

import type {
  EpisodeTransition,
} from "./memory";

function successfulEpisode(
  context:
    string,
): EpisodeTransition[] {
  return [
    {
      action:
        "A",

      before: {
        power:
          false,

        latch:
          false,

        vaultOpen:
          false,

        context,
      },

      after: {
        power:
          true,

        latch:
          false,

        vaultOpen:
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

        vaultOpen:
          false,

        context,
      },

      after: {
        power:
          true,

        latch:
          true,

        vaultOpen:
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

        vaultOpen:
          false,

        context,
      },

      after: {
        power:
          true,

        latch:
          true,

        vaultOpen:
          true,

        context,
      },

      changedKeys: [
        "vaultOpen",
      ],

      accepted:
        true,
    },
  ];
}

const goalConditions = {
  vaultOpen:
    true,
};

describe(
  "Mabojolu G autonomous skill library",
  () => {
    it(
      "requires repeated successful evidence before activating a reusable skill",
      () => {
        const library =
          new AutonomousSkillLibrary();

        const first =
          library.learnFromEpisode({
            episodeId:
              "episode-a",

            environmentId:
              "world-a",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "alpha",
              ),

            observedAt:
              "2026-09-19T16:00:00.000Z",
          });

        expect(
          first?.status,
        ).toBe(
          "candidate",
        );

        const second =
          library.learnFromEpisode({
            episodeId:
              "episode-b",

            environmentId:
              "world-b",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "beta",
              ),

            observedAt:
              "2026-09-19T17:00:00.000Z",
          });

        expect(
          second?.status,
        ).toBe(
          "active",
        );

        expect(
          second?.supportCount,
        ).toBe(2);

        expect(
          second
            ?.sourceEnvironmentIds,
        ).toEqual([
          "world-a",
          "world-b",
        ]);
      },
    );

    it(
      "does not form reusable competence from an unsolved episode",
      () => {
        const library =
          new AutonomousSkillLibrary();

        const learned =
          library.learnFromEpisode({
            episodeId:
              "failed-episode",

            environmentId:
              "failed-world",

            solved:
              false,

            goalConditions,

            transitions:
              successfulEpisode(
                "alpha",
              ),

            observedAt:
              "2026-09-19T16:00:00.000Z",
          });

        expect(
          learned,
        ).toBeUndefined();

        expect(
          library.getSkills(),
        ).toHaveLength(0);
      },
    );

    it(
      "generalizes away an observable context value that varied across supporting episodes",
      () => {
        const library =
          new AutonomousSkillLibrary();

        library.learnFromEpisode({
          episodeId:
            "episode-a",

          environmentId:
            "world-a",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "alpha",
            ),

          observedAt:
            "2026-09-19T16:00:00.000Z",
        });

        const skill =
          library.learnFromEpisode({
            episodeId:
              "episode-b",

            environmentId:
              "world-b",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "beta",
              ),

            observedAt:
              "2026-09-19T17:00:00.000Z",
          });

        expect(
          skill
            ?.preconditions,
        ).toEqual({
          power:
            false,

          latch:
            false,

          vaultOpen:
            false,
        });

        expect(
          skill
            ?.goalEffects,
        ).toEqual({
          vaultOpen:
            true,
        });
      },
    );

    it(
      "retrieves the learned skill for a new environment based on observable state and goal rather than environment identity",
      () => {
        const library =
          new AutonomousSkillLibrary();

        const contexts = [
          "alpha",
          "beta",
        ];

        for (
          let index = 0;
          index <
            contexts.length;
          index +=
            1
        ) {
          library.learnFromEpisode({
            episodeId:
              "episode-" +
              index,

            environmentId:
              "training-world-" +
              index,

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                contexts[index],
              ),

            observedAt:
              "2026-09-19T1" +
              String(
                index + 6,
              ) +
              ":00:00.000Z",
          });
        }

        const recommendation =
          library.recommendSkill({
            currentState: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,

              context:
                "never-seen-before",
            },

            goalConditions,

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          recommendation
            ?.actions,
        ).toEqual([
          "A",
          "C",
          "B",
        ]);

        expect(
          recommendation
            ?.skill
            .sourceEnvironmentIds,
        ).not.toContain(
          "never-seen-before",
        );
      },
    );

    it(
      "does not apply a skill when its learned preconditions, goal effect, or action interface do not fit",
      () => {
        const library =
          new AutonomousSkillLibrary();

        library.learnFromEpisode({
          episodeId:
            "episode-a",

          environmentId:
            "world-a",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "alpha",
            ),

          observedAt:
            "2026-09-19T16:00:00.000Z",
        });

        library.learnFromEpisode({
          episodeId:
            "episode-b",

          environmentId:
            "world-b",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "beta",
            ),

          observedAt:
            "2026-09-19T17:00:00.000Z",
        });

        expect(
          library.recommendSkill({
            currentState: {
              power:
                true,

              latch:
                false,

              vaultOpen:
                false,
            },

            goalConditions,

            availableActions: [
              "A",
              "B",
              "C",
            ],
          }),
        ).toBeUndefined();

        expect(
          library.recommendSkill({
            currentState: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            goalConditions: {
              escaped:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          }),
        ).toBeUndefined();

        expect(
          library.recommendSkill({
            currentState: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            goalConditions,

            availableActions: [
              "A",
              "B",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "revises overly specific preconditions when later successful evidence varies",
      () => {
        const library =
          new AutonomousSkillLibrary();

        library.learnFromEpisode({
          episodeId:
            "episode-a",

          environmentId:
            "world-a",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "same",
            ),

          observedAt:
            "2026-09-19T16:00:00.000Z",
        });

        const second =
          library.learnFromEpisode({
            episodeId:
              "episode-b",

            environmentId:
              "world-b",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "same",
              ),

            observedAt:
              "2026-09-19T17:00:00.000Z",
          });

        expect(
          second
            ?.preconditions
            .context,
        ).toBe(
          "same",
        );

        const revised =
          library.learnFromEpisode({
            episodeId:
              "episode-c",

            environmentId:
              "world-c",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "different",
              ),

            observedAt:
              "2026-09-19T18:00:00.000Z",
          });

        expect(
          revised
            ?.preconditions,
        ).not.toHaveProperty(
          "context",
        );

        expect(
          revised
            ?.supportCount,
        ).toBe(3);
      },
    );

    it(
      "reduces confidence on contradictory execution evidence and retires a repeatedly contradicted skill",
      () => {
        const library =
          new AutonomousSkillLibrary();

        library.learnFromEpisode({
          episodeId:
            "episode-a",

          environmentId:
            "world-a",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "alpha",
            ),

          observedAt:
            "2026-09-19T16:00:00.000Z",
        });

        const learned =
          library.learnFromEpisode({
            episodeId:
              "episode-b",

            environmentId:
              "world-b",

            solved:
              true,

            goalConditions,

            transitions:
              successfulEpisode(
                "beta",
              ),

            observedAt:
              "2026-09-19T17:00:00.000Z",
          });

        expect(
          learned,
        ).toBeDefined();

        if (
          !learned
        ) {
          return;
        }

        const first =
          library.observeExecution({
            skillId:
              learned.id,

            stepIndex:
              0,

            before: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            after: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            evidenceId:
              "contradiction-1",

            observedAt:
              "2026-09-19T18:00:00.000Z",
          });

        expect(
          first?.matched,
        ).toBe(false);

        expect(
          first?.status,
        ).toBe(
          "active",
        );

        expect(
          first
            ?.confidence,
        ).toBeLessThan(
          learned.confidence,
        );

        const second =
          library.observeExecution({
            skillId:
              learned.id,

            stepIndex:
              0,

            before: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            after: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            evidenceId:
              "contradiction-2",

            observedAt:
              "2026-09-19T19:00:00.000Z",
          });

        expect(
          second?.status,
        ).toBe(
          "retired",
        );

        expect(
          library.recommendSkill({
            currentState: {
              power:
                false,

              latch:
                false,

              vaultOpen:
                false,
            },

            goalConditions,

            availableActions: [
              "A",
              "B",
              "C",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "returns defensive copies of learned skills",
      () => {
        const library =
          new AutonomousSkillLibrary();

        library.learnFromEpisode({
          episodeId:
            "episode-a",

          environmentId:
            "world-a",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "alpha",
            ),

          observedAt:
            "2026-09-19T16:00:00.000Z",
        });

        library.learnFromEpisode({
          episodeId:
            "episode-b",

          environmentId:
            "world-b",

          solved:
            true,

          goalConditions,

          transitions:
            successfulEpisode(
              "beta",
            ),

          observedAt:
            "2026-09-19T17:00:00.000Z",
        });

        const first =
          library.getSkills();

        first[0]
          .steps[0]
          .effects[0]
          .key =
          "tampered";

        const second =
          library.getSkills();

        expect(
          second[0]
            .steps[0]
            .effects[0]
            .key,
        ).toBe(
          "power",
        );
      },
    );
  },
);

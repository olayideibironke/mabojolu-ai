import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SkillComposer,
} from "./skill-composer";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

function trainOneStepSkill(input: {
  library:
    AutonomousSkillLibrary;

  action:
    string;

  before:
    Record<
      string,
      string |
      number |
      boolean |
      null
    >;

  after:
    Record<
      string,
      string |
      number |
      boolean |
      null
    >;

  goalConditions:
    Record<
      string,
      string |
      number |
      boolean |
      null
    >;

  prefix:
    string;
}):
  void {
  for (
    let index = 0;
    index <
      2;
    index +=
      1
  ) {
    input.library
      .learnFromEpisode({
        episodeId:
          input.prefix +
          "-episode-" +
          index,

        environmentId:
          input.prefix +
          "-world-" +
          index,

        solved:
          true,

        goalConditions:
          input
            .goalConditions,

        transitions: [
          {
            action:
              input.action,

            before: {
              ...input.before,
            },

            after: {
              ...input.after,
            },

            changedKeys:
              Object.keys(
                input.after,
              ).filter(
                (key) =>
                  !Object.is(
                    input
                      .before[
                        key
                      ],
                    input
                      .after[
                        key
                      ],
                  ),
              ),

            accepted:
              true,
          },
        ],

        observedAt:
          "2026-09-19T20:0" +
          String(index) +
          ":00.000Z",
      });
  }
}

describe(
  "Mabojolu G skill composition",
  () => {
    it(
      "composes separately learned skills into a novel two-skill solution",
      () => {
        const library =
          new AutonomousSkillLibrary();

        trainOneStepSkill({
          library,

          action:
            "P",

          before: {
            prepared:
              false,
          },

          after: {
            prepared:
              true,
          },

          goalConditions: {
            prepared:
              true,
          },

          prefix:
            "prepare",
        });

        trainOneStepSkill({
          library,

          action:
            "Q",

          before: {
            prepared:
              true,

            complete:
              false,
          },

          after: {
            prepared:
              true,

            complete:
              true,
          },

          goalConditions: {
            complete:
              true,
          },

          prefix:
            "complete",
        });

        const plan =
          new SkillComposer(
            library,
          ).compose({
            currentState: {
              prepared:
                false,

              complete:
                false,
            },

            goalConditions: {
              complete:
                true,
            },

            availableActions: [
              "P",
              "Q",
            ],
          });

        expect(
          plan
            ?.actions
            .map(
              (step) =>
                step.action,
            ),
        ).toEqual([
          "P",
          "Q",
        ]);

        expect(
          plan?.skillIds,
        ).toHaveLength(2);

        expect(
          plan
            ?.projectedFinalState,
        ).toMatchObject({
          prepared:
            true,

          complete:
            true,
        });
      },
    );

    it(
      "prefers a shorter direct learned skill over a longer composition",
      () => {
        const library =
          new AutonomousSkillLibrary();

        trainOneStepSkill({
          library,

          action:
            "P",

          before: {
            prepared:
              false,
          },

          after: {
            prepared:
              true,
          },

          goalConditions: {
            prepared:
              true,
          },

          prefix:
            "prepare",
        });

        trainOneStepSkill({
          library,

          action:
            "Q",

          before: {
            prepared:
              true,

            complete:
              false,
          },

          after: {
            prepared:
              true,

            complete:
              true,
          },

          goalConditions: {
            complete:
              true,
          },

          prefix:
            "complete",
        });

        trainOneStepSkill({
          library,

          action:
            "R",

          before: {
            prepared:
              false,

            complete:
              false,
          },

          after: {
            prepared:
              false,

            complete:
              true,
          },

          goalConditions: {
            complete:
              true,
          },

          prefix:
            "direct",
        });

        const plan =
          new SkillComposer(
            library,
          ).compose({
            currentState: {
              prepared:
                false,

              complete:
                false,
            },

            goalConditions: {
              complete:
                true,
            },

            availableActions: [
              "P",
              "Q",
              "R",
            ],
          });

        expect(
          plan
            ?.actions
            .map(
              (step) =>
                step.action,
            ),
        ).toEqual([
          "R",
        ]);

        expect(
          plan?.skillIds,
        ).toHaveLength(1);
      },
    );

    it(
      "refuses to compose through unavailable concrete actions",
      () => {
        const library =
          new AutonomousSkillLibrary();

        trainOneStepSkill({
          library,

          action:
            "P",

          before: {
            prepared:
              false,
          },

          after: {
            prepared:
              true,
          },

          goalConditions: {
            prepared:
              true,
          },

          prefix:
            "prepare",
        });

        trainOneStepSkill({
          library,

          action:
            "Q",

          before: {
            prepared:
              true,

            complete:
              false,
          },

          after: {
            prepared:
              true,

            complete:
              true,
          },

          goalConditions: {
            complete:
              true,
          },

          prefix:
            "complete",
        });

        expect(
          new SkillComposer(
            library,
          ).compose({
            currentState: {
              prepared:
                false,

              complete:
                false,
            },

            goalConditions: {
              complete:
                true,
            },

            availableActions: [
              "P",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "does not invent a composition when learned effects cannot reach the requested goal",
      () => {
        const library =
          new AutonomousSkillLibrary();

        trainOneStepSkill({
          library,

          action:
            "P",

          before: {
            prepared:
              false,
          },

          after: {
            prepared:
              true,
          },

          goalConditions: {
            prepared:
              true,
          },

          prefix:
            "prepare",
        });

        expect(
          new SkillComposer(
            library,
          ).compose({
            currentState: {
              prepared:
                false,

              escaped:
                false,
            },

            goalConditions: {
              escaped:
                true,
            },

            availableActions: [
              "P",
            ],
          }),
        ).toBeUndefined();
      },
    );
  },
);

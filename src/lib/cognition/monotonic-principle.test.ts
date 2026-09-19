import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MonotonicProgressPrincipleController,
  MonotonicProgressPrincipleLibrary,
} from "./monotonic-principle";

import type {
  MonotonicPrincipleEpisode,
} from "./monotonic-principle";

function thresholdEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  action:
    string;

  progressKey:
    string;

  goalAction:
    string;

  goalKey:
    string;
}):
  MonotonicPrincipleEpisode {
  const {
    episodeId,
    family,
    familyKind,
    action,
    progressKey,
    goalAction,
    goalKey,
  } = input;

  return {
    episodeId,
    family,
    familyKind,

    solved:
      true,

    goalConditions: {
      [goalKey]:
        true,
    },

    transitions: [
      {
        action,

        before: {
          [progressKey]:
            0,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            1,

          [goalKey]:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action,

        before: {
          [progressKey]:
            1,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            2,

          [goalKey]:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          goalAction,

        before: {
          [progressKey]:
            2,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            2,

          [goalKey]:
            true,
        },

        changedKeys: [
          goalKey,
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      episodeId.includes(
        "one",
      )
        ? "2026-09-19T20:00:00.000Z"
        : "2026-09-19T21:00:00.000Z",
  };
}

describe(
  "Mabojolu G monotonic progress abstraction",
  () => {
    it(
      "remains a candidate after support from only one structural family kind",
      () => {
        const library =
          new MonotonicProgressPrincipleLibrary();

        const principle =
          library.learnFromEpisode(
            thresholdEpisode({
              episodeId:
                "one",

              family:
                "threshold-family",

              familyKind:
                "threshold-accumulation",

              action:
                "INC",

              progressKey:
                "progress",

              goalAction:
                "FINISH",

              goalKey:
                "done",
            }),
          );

        expect(
          principle?.status,
        ).toBe(
          "candidate",
        );
      },
    );

    it(
      "activates after the same policy pattern appears in a second structural family kind",
      () => {
        const library =
          new MonotonicProgressPrincipleLibrary();

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "one",

            family:
              "threshold-family",

            familyKind:
              "threshold-accumulation",

            action:
              "INC",

            progressKey:
              "progress",

            goalAction:
              "FINISH",

            goalKey:
              "done",
          }),
        );

        const principle =
          library.learnFromEpisode(
            thresholdEpisode({
              episodeId:
                "two",

            family:
              "charge-family",

            familyKind:
              "resource-charge",

            action:
              "CHARGE",

            progressKey:
              "energy",

            goalAction:
              "RELEASE",

            goalKey:
              "released",
          }),
        );

        expect(
          principle?.status,
        ).toBe(
          "active",
        );

        expect(
          principle
            ?.supportFamilyKinds,
        ).toEqual([
          "resource-charge",
          "threshold-accumulation",
        ]);
      },
    );

    it(
      "stores no source action labels or source state-variable names",
      () => {
        const library =
          new MonotonicProgressPrincipleLibrary();

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "one",

            family:
              "threshold-family",

            familyKind:
              "threshold-accumulation",

            action:
              "INC",

            progressKey:
              "counter",

            goalAction:
              "FINISH",

            goalKey:
              "done",
          }),
        );

        const principle =
          library.learnFromEpisode(
            thresholdEpisode({
              episodeId:
                "two",

            family:
              "charge-family",

            familyKind:
              "resource-charge",

            action:
              "CHARGE",

            progressKey:
              "energy",

            goalAction:
              "RELEASE",

            goalKey:
              "released",
          }),
        );

        const serialized =
          JSON.stringify(
            principle,
          );

        for (
          const symbol of [
            "INC",
            "FINISH",
            "CHARGE",
            "RELEASE",
            "counter",
            "energy",
            "done",
            "released",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            symbol,
          );
        }
      },
    );

    it(
      "recognizes numeric progress even when the same action also changes auxiliary state",
      () => {
        const library =
          new MonotonicProgressPrincipleLibrary();

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "one",

            family:
              "threshold-family",

            familyKind:
              "threshold-accumulation",

            action:
              "INC",

            progressKey:
              "progress",

            goalAction:
              "FINISH",

            goalKey:
              "done",
          }),
        );

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "two",

            family:
              "charge-family",

            familyKind:
              "resource-charge",

            action:
              "CHARGE",

            progressKey:
              "energy",

            goalAction:
              "RELEASE",

            goalKey:
              "released",
          }),
        );

        const controller =
          new MonotonicProgressPrincipleController(
            library,
          );

        controller.observeTransition({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            level:
              0,

            armed:
              false,
          },

          after: {
            level:
              1,

            armed:
              true,
          },

          changedKeys: [
            "level",
            "armed",
          ],
        });

        expect(
          controller.recommend([
            "ADVANCE",
          ]),
        ).toMatchObject({
          action:
            "ADVANCE",

          applicability:
            0.95,
        });
      },
    );

    it(
      "only becomes applicable after direct target-world numeric progress evidence",
      () => {
        const library =
          new MonotonicProgressPrincipleLibrary();

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "one",

            family:
              "threshold-family",

            familyKind:
              "threshold-accumulation",

            action:
              "INC",

            progressKey:
              "progress",

            goalAction:
              "FINISH",

            goalKey:
              "done",
          }),
        );

        library.learnFromEpisode(
          thresholdEpisode({
            episodeId:
              "two",

            family:
              "charge-family",

            familyKind:
              "resource-charge",

            action:
              "CHARGE",

            progressKey:
              "energy",

            goalAction:
              "RELEASE",

            goalKey:
              "released",
          }),
        );

        const controller =
          new MonotonicProgressPrincipleController(
            library,
          );

        controller.observeTransition({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            stage:
              "cold",
          },

          after: {
            stage:
              "ready",
          },

          changedKeys: [
            "stage",
          ],
        });

        expect(
          controller.recommend([
            "ADVANCE",
          ]),
        ).toBeUndefined();

        controller.observeTransition({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            level:
              0,
          },

          after: {
            level:
              1,
          },

          changedKeys: [
            "level",
          ],
        });

        expect(
          controller.recommend([
            "ADVANCE",
          ]),
        ).toMatchObject({
          action:
            "ADVANCE",

          applicability:
            0.95,
        });
      },
    );
  },
);

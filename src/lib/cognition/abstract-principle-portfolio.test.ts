import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AbstractPrinciplePortfolio,
} from "./abstract-principle-portfolio";

import type {
  AbstractPrincipleEpisode,
} from "./abstract-principle";

function deferredSupportEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  progressKey:
    string;

  goalKey:
    string;

  prepAction:
    string;

  goalAction:
    string;
}):
  AbstractPrincipleEpisode {
  const {
    episodeId,
    family,
    familyKind,
    progressKey,
    goalKey,
    prepAction,
    goalAction,
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
        action:
          goalAction,

        before: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          prepAction,

        before: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            true,

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
            true,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            true,

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
        ? "2026-09-19T18:00:00.000Z"
        : "2026-09-19T19:00:00.000Z",
  };
}

function monotonicSupportEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  progressKey:
    string;

  goalKey:
    string;

  progressAction:
    string;

  goalAction:
    string;
}):
  AbstractPrincipleEpisode {
  const {
    episodeId,
    family,
    familyKind,
    progressKey,
    goalKey,
    progressAction,
    goalAction,
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
        action:
          progressAction,

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
        action:
          progressAction,

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
        "three",
      )
        ? "2026-09-19T20:00:00.000Z"
        : "2026-09-19T21:00:00.000Z",
  };
}

function trainedPortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredSupportEpisode({
      episodeId:
        "deferred-one",

      family:
        "gated-family",

      familyKind:
        "gated-sequence",

      progressKey:
        "ready",

      goalKey:
        "open",

      prepAction:
        "PREP",

      goalAction:
        "OPEN",
    }),
  );

  portfolio.learnFromEpisode(
    deferredSupportEpisode({
      episodeId:
        "deferred-two",

      family:
        "mode-family",

      familyKind:
        "categorical-mode",

      progressKey:
        "prepared",

      goalKey:
        "complete",

      prepAction:
        "ARM",

      goalAction:
        "COMMIT",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicSupportEpisode({
      episodeId:
        "monotonic-three",

      family:
        "threshold-family",

      familyKind:
        "threshold-accumulation",

      progressKey:
        "counter",

      goalKey:
        "done",

      progressAction:
        "INC",

      goalAction:
        "FINISH",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicSupportEpisode({
      episodeId:
        "monotonic-four",

      family:
        "charge-family",

      familyKind:
        "resource-charge",

      progressKey:
        "energy",

      goalKey:
        "released",

      progressAction:
        "CHARGE",

      goalAction:
        "RELEASE",
    }),
  );

  return portfolio;
}

describe(
  "Mabojolu G competing abstract principle portfolio",
  () => {
    it(
      "holds multiple active abstractions with independent provenance",
      () => {
        const principles =
          trainedPortfolio()
            .getPrinciples();

        expect(
          principles,
        ).toHaveLength(2);

        expect(
          principles
            .every(
              (principle) =>
                principle.status ===
                  "active",
            ),
        ).toBe(true);

        expect(
          principles
            .map(
              (principle) =>
                principle.kind,
            ),
        ).toEqual([
          "deferred-goal-retry-after-progress",
          "repeat-monotonic-progress-once",
        ]);
      },
    );

    it(
      "selects the more context-specific numeric abstraction when two principles compete",
      () => {
        const portfolio =
          trainedPortfolio();

        const controller =
          portfolio.createController();

        controller.observeTransition({
          action:
            "TRY-GOAL",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              0,

            done:
              false,
          },

          changedKeys: [],
        });

        controller.observeTransition({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              1,

            done:
              false,
          },

          changedKeys: [
            "level",
          ],
        });

        const selected =
          controller.recommend([
            "TRY-GOAL",
            "ADVANCE",
          ]);

        expect(
          selected,
        ).toMatchObject({
          action:
            "ADVANCE",

          principleKind:
            "repeat-monotonic-progress-once",

          applicability:
            0.95,
        });

        expect(
          selected?.score,
        ).toBeGreaterThan(
          0.6,
        );
      },
    );

    it(
      "falls back to the broad deferred-action abstraction when target progress is nonnumeric",
      () => {
        const portfolio =
          trainedPortfolio();

        const controller =
          portfolio.createController();

        controller.observeTransition({
          action:
            "TRY-GOAL",

          accepted:
            true,

          before: {
            mode:
              "cold",

            done:
              false,
          },

          after: {
            mode:
              "cold",

            done:
              false,
          },

          changedKeys: [],
        });

        controller.observeTransition({
          action:
            "PREPARE",

          accepted:
            true,

          before: {
            mode:
              "cold",

            done:
              false,
          },

          after: {
            mode:
              "ready",

            done:
              false,
          },

          changedKeys: [
            "mode",
          ],
        });

        expect(
          controller.recommend([
            "TRY-GOAL",
            "PREPARE",
          ]),
        ).toMatchObject({
          action:
            "TRY-GOAL",

          principleKind:
            "deferred-goal-retry-after-progress",

          applicability:
            0.7,
        });
      },
    );

    it(
      "records an auditable selection history without mutating principle evidence",
      () => {
        const portfolio =
          trainedPortfolio();

        const controller =
          portfolio.createController();

        const before =
          portfolio.getPrinciples();

        controller.observeTransition({
          action:
            "TRY",

          accepted:
            true,

          before: {
            level:
              0,
          },

          after: {
            level:
              0,
          },

          changedKeys: [],
        });

        controller.observeTransition({
          action:
            "STEP",

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

        controller.recommend([
          "TRY",
          "STEP",
        ]);

        const after =
          controller.getSnapshot();

        expect(
          after.selections,
        ).toHaveLength(1);

        expect(
          after.principles,
        ).toEqual(
          before,
        );
      },
    );
  },
);

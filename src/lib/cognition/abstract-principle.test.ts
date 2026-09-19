import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AbstractPrincipleController,
  CrossFamilyPrincipleLibrary,
} from "./abstract-principle";

import type {
  AbstractPrincipleEpisode,
} from "./abstract-principle";

function gatedEpisode(
  family:
    string,

  episodeId:
    string,
):
  AbstractPrincipleEpisode {
  return {
    episodeId,

    family,

    familyKind:
      "gated-sequence",

    solved:
      true,

    goalConditions: {
      open:
        true,
    },

    transitions: [
      {
        action:
          "POWER",

        before: {
          ready:
            false,

          open:
            false,
        },

        after: {
          ready:
            true,

          open:
            false,
        },

        changedKeys: [
          "ready",
        ],

        accepted:
          true,
      },

      {
        action:
          "OPEN",

        before: {
          ready:
            true,

          open:
            false,
        },

        after: {
          ready:
            true,

          open:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          "LATCH",

        before: {
          ready:
            true,

          latched:
            false,

          open:
            false,
        },

        after: {
          ready:
            true,

          latched:
            true,

          open:
            false,
        },

        changedKeys: [
          "latched",
        ],

        accepted:
          true,
      },

      {
        action:
          "OPEN",

        before: {
          ready:
            true,

          latched:
            true,

          open:
            false,
        },

        after: {
          ready:
            true,

          latched:
            true,

          open:
            true,
        },

        changedKeys: [
          "open",
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T20:00:00.000Z",
  };
}

function thresholdEpisode():
  AbstractPrincipleEpisode {
  return {
    episodeId:
      "threshold-episode",

    family:
      "threshold-family",

    familyKind:
      "threshold-accumulation",

    solved:
      true,

    goalConditions: {
      done:
        true,
    },

    transitions: [
      {
        action:
          "FINISH",

        before: {
          counter:
            0,

          done:
            false,
        },

        after: {
          counter:
            0,

          done:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          "INC",

        before: {
          counter:
            0,

          done:
            false,
        },

        after: {
          counter:
            1,

          done:
            false,
        },

        changedKeys: [
          "counter",
        ],

        accepted:
          true,
      },

      {
        action:
          "FINISH",

        before: {
          counter:
            1,

          done:
            false,
        },

        after: {
          counter:
            1,

          done:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          "INC",

        before: {
          counter:
            1,

          done:
            false,
        },

        after: {
          counter:
            2,

          done:
            false,
        },

        changedKeys: [
          "counter",
        ],

        accepted:
          true,
      },

      {
        action:
          "FINISH",

        before: {
          counter:
            2,

          done:
            false,
        },

        after: {
          counter:
            2,

          done:
            true,
        },

        changedKeys: [
          "done",
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T21:00:00.000Z",
  };
}

describe(
  "Mabojolu G cross-family abstract principle induction",
  () => {
    it(
      "keeps a principle candidate after evidence from only one family",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        const principle =
          library.learnFromEpisode(
            gatedEpisode(
              "gated-family",
              "gated-one",
            ),
          );

        expect(
          principle?.status,
        ).toBe(
          "candidate",
        );

        expect(
          principle
            ?.supportFamilies,
        ).toEqual([
          "gated-family",
        ]);
      },
    );

    it(
      "does not activate when different family labels describe the same structural kind",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family-a",
            "gated-one",
          ),
        );

        const principle =
          library.learnFromEpisode(
            gatedEpisode(
              "gated-family-b",
              "gated-two",
            ),
          );

        expect(
          principle?.status,
        ).toBe(
          "candidate",
        );

        expect(
          principle
            ?.supportFamilies,
        ).toEqual([
          "gated-family-a",
          "gated-family-b",
        ]);

        expect(
          principle
            ?.supportFamilyKinds,
        ).toEqual([
          "gated-sequence",
        ]);
      },
    );

    it(
      "does not activate from repeated evidence inside the same family",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family",
            "gated-one",
          ),
        );

        const principle =
          library.learnFromEpisode(
            gatedEpisode(
              "gated-family",
              "gated-two",
            ),
          );

        expect(
          principle?.status,
        ).toBe(
          "candidate",
        );

        expect(
          principle
            ?.supportCount,
        ).toBe(2);

        expect(
          principle
            ?.supportFamilies,
        ).toEqual([
          "gated-family",
        ]);
      },
    );

    it(
      "activates only after the same higher-order pattern is supported by two distinct families",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family",
            "gated-one",
          ),
        );

        const principle =
          library.learnFromEpisode(
            thresholdEpisode(),
          );

        expect(
          principle?.status,
        ).toBe(
          "active",
        );

        expect(
          principle
            ?.supportFamilies,
        ).toEqual([
          "gated-family",
          "threshold-family",
        ]);

        expect(
          principle
            ?.supportFamilyKinds,
        ).toEqual([
          "gated-sequence",
          "threshold-accumulation",
        ]);

        expect(
          principle
            ?.confidence,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );

    it(
      "stores the abstraction without source action or source state names",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family",
            "gated-one",
          ),
        );

        const principle =
          library.learnFromEpisode(
            thresholdEpisode(),
          );

        expect(
          principle,
        ).toBeDefined();

        const serialized =
          JSON.stringify(
            principle,
          );

        for (
          const sourceSymbol of [
            "POWER",
            "OPEN",
            "LATCH",
            "FINISH",
            "INC",
            "ready",
            "latched",
            "counter",
            "done",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            sourceSymbol,
          );
        }
      },
    );

    it(
      "recommends a target-world deferred action only after new progress evidence",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family",
            "gated-one",
          ),
        );

        library.learnFromEpisode(
          thresholdEpisode(),
        );

        const controller =
          new AbstractPrincipleController(
            library,
          );

        controller.observeTransition({
          action:
            "TARGET",

          accepted:
            true,

          changedKeys: [],
        });

        expect(
          controller.recommend([
            "TARGET",
            "PREPARE",
            "DISTRACT",
          ]),
        ).toBeUndefined();

        controller.observeTransition({
          action:
            "PREPARE",

          accepted:
            true,

          changedKeys: [
            "mode",
          ],
        });

        expect(
          controller.recommend([
            "TARGET",
            "PREPARE",
            "DISTRACT",
          ]),
        ).toMatchObject({
          action:
            "TARGET",

          principleId:
            "principle-deferred-goal-retry-after-progress",
        });
      },
    );

    it(
      "can retire the learned principle after repeated contradiction evidence",
      () => {
        const library =
          new CrossFamilyPrincipleLibrary();

        library.learnFromEpisode(
          gatedEpisode(
            "gated-family",
            "gated-one",
          ),
        );

        library.learnFromEpisode(
          thresholdEpisode(),
        );

        library.recordContradiction(
          "2026-09-19T22:00:00.000Z",
        );

        const retired =
          library.recordContradiction(
            "2026-09-19T23:00:00.000Z",
          );

        expect(
          retired?.status,
        ).toBe(
          "retired",
        );
      },
    );
  },
);

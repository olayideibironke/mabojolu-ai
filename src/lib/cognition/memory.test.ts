import {
  describe,
  expect,
  it,
} from "vitest";

import {
  InMemoryCognitiveMemory,
} from "./memory";

describe(
  "Mabojolu G cognitive memory",
  () => {
    it(
      "consolidates a successful exploratory episode into an effective action plan",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        memory.recordEpisode({
          environmentId:
            "vault-world-v0.1",

          goalDescription:
            "Open the vault.",

          solved: true,

          cycles: 4,

          transitions: [
            {
              action: "A",

              before: {
                power: false,
              },

              after: {
                power: true,
              },

              changedKeys: [
                "power",
              ],

              accepted:
                true,
            },

            {
              action: "B",

              before: {
                power: true,
              },

              after: {
                power: true,
              },

              changedKeys: [],

              accepted:
                true,
            },

            {
              action: "C",

              before: {
                latch: false,
              },

              after: {
                latch: true,
              },

              changedKeys: [
                "latch",
              ],

              accepted:
                true,
            },

            {
              action: "B",

              before: {
                vaultOpen:
                  false,
              },

              after: {
                vaultOpen:
                  true,
              },

              changedKeys: [
                "vaultOpen",
              ],

              accepted:
                true,
            },
          ],

          completedAt:
            "2026-09-19T05:00:00.000Z",
        });

        const plan =
          memory.recallPlan({
            environmentId:
              "vault-world-v0.1",

            goalDescription:
              "Open the vault.",

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          plan?.actions,
        ).toEqual([
          "A",
          "C",
          "B",
        ]);
      },
    );

    it(
      "does not treat an unsolved episode as reusable knowledge",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        memory.recordEpisode({
          environmentId:
            "world-1",

          goalDescription:
            "Solve it.",

          solved: false,

          cycles: 3,

          transitions: [
            {
              action: "A",

              before: {
                solved: false,
              },

              after: {
                solved: false,
              },

              changedKeys: [],

              accepted:
                true,
            },
          ],

          completedAt:
            "2026-09-19T05:00:00.000Z",
        });

        expect(
          memory.recallPlan({
            environmentId:
              "world-1",

            goalDescription:
              "Solve it.",

            availableActions: [
              "A",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "prefers newer successful knowledge after experience changes",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        memory.recordEpisode({
          environmentId:
            "world-1",

          goalDescription:
            "Solve it.",

          solved: true,

          cycles: 2,

          transitions: [
            {
              action: "A",

              before: {
                stage: 0,
              },

              after: {
                stage: 1,
              },

              changedKeys: [
                "stage",
              ],

              accepted:
                true,
            },

            {
              action: "B",

              before: {
                stage: 1,
              },

              after: {
                stage: 2,
              },

              changedKeys: [
                "stage",
              ],

              accepted:
                true,
            },
          ],

          completedAt:
            "2026-09-19T05:00:00.000Z",
        });

        memory.recordEpisode({
          environmentId:
            "world-1",

          goalDescription:
            "Solve it.",

          solved: true,

          cycles: 2,

          transitions: [
            {
              action: "B",

              before: {
                stage: 0,
              },

              after: {
                stage: 1,
              },

              changedKeys: [
                "stage",
              ],

              accepted:
                true,
            },

            {
              action: "A",

              before: {
                stage: 1,
              },

              after: {
                stage: 2,
              },

              changedKeys: [
                "stage",
              ],

              accepted:
                true,
            },
          ],

          completedAt:
            "2026-09-19T06:00:00.000Z",
        });

        const plan =
          memory.recallPlan({
            environmentId:
              "world-1",

            goalDescription:
              "Solve it.",

            availableActions: [
              "A",
              "B",
            ],
          });

        expect(
          plan?.actions,
        ).toEqual([
          "B",
          "A",
        ]);

        expect(
          plan
            ?.sourceEpisodeId,
        ).toBe(
          "episode-2",
        );
      },
    );

    it(
      "returns defensive copies instead of exposing mutable stored memory",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        memory.recordEpisode({
          environmentId:
            "world-1",

          goalDescription:
            "Solve it.",

          solved: true,

          cycles: 1,

          transitions: [
            {
              action: "A",

              before: {
                solved: false,
              },

              after: {
                solved: true,
              },

              changedKeys: [
                "solved",
              ],

              accepted:
                true,
            },
          ],

          completedAt:
            "2026-09-19T05:00:00.000Z",
        });

        const first =
          memory.getEpisodes();

        first[0]
          .transitions[0]
          .changedKeys.push(
            "tampered",
          );

        const second =
          memory.getEpisodes();

        expect(
          second[0]
            .transitions[0]
            .changedKeys,
        ).toEqual([
          "solved",
        ]);
      },
    );
  },
);
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  CompetenceModel,
} from "./competence-model";

describe(
  "Mabojolu G competence model",
  () => {
    it(
      "starts uncertain and does not treat an unseen family as mastered",
      () => {
        const model =
          new CompetenceModel();

        const snapshot =
          model.snapshot(
            "causal-transfer",
          );

        expect(
          snapshot.attempts,
        ).toBe(0);

        expect(
          snapshot.successRate,
        ).toBe(0.5);

        expect(
          snapshot.uncertainty,
        ).toBe(1);

        expect(
          snapshot.mastery,
        ).toBeLessThan(
          0.2,
        );
      },
    );

    it(
      "raises competence only from observed successful evidence",
      () => {
        const model =
          new CompetenceModel();

        const first =
          model.record({
            taskId:
              "task-1",

            family:
              "gated-sequence",

            difficulty:
              0.4,

            success:
              true,

            cycles:
              4,

            observedAt:
              "2026-09-19T20:00:00.000Z",
          });

        const second =
          model.record({
            taskId:
              "task-2",

            family:
              "gated-sequence",

            difficulty:
              0.4,

            success:
              true,

            cycles:
              3,

            observedAt:
              "2026-09-19T21:00:00.000Z",
          });

        expect(
          second.mastery,
        ).toBeGreaterThan(
          first.mastery,
        );

        expect(
          second.uncertainty,
        ).toBeLessThan(
          first.uncertainty,
        );

        expect(
          second.bestCycles,
        ).toBe(3);

        expect(
          second.averageCycles,
        ).toBe(3.5);
      },
    );

    it(
      "records failure as reduced reliability rather than rewriting history",
      () => {
        const model =
          new CompetenceModel();

        model.record({
          taskId:
            "task-1",

          family:
            "transfer",

          difficulty:
            0.5,

          success:
            true,

          cycles:
            5,

          observedAt:
            "2026-09-19T20:00:00.000Z",
        });

        const before =
          model.snapshot(
            "transfer",
          );

        const after =
          model.record({
            taskId:
              "task-2",

          family:
            "transfer",

          difficulty:
            0.6,

          success:
            false,

          cycles:
            8,

          observedAt:
            "2026-09-19T21:00:00.000Z",
        });

        expect(
          after.successRate,
        ).toBeLessThan(
          before.successRate,
        );

        expect(
          after.failures,
        ).toBe(1);

        expect(
          after.hardestSuccessfulDifficulty,
        ).toBe(0.5);
      },
    );

    it(
      "deduplicates the same task observation",
      () => {
        const model =
          new CompetenceModel();

        const observation = {
          taskId:
            "task-1",

          family:
            "memory",

          difficulty:
            0.3,

          success:
            true,

          cycles:
            2,

          observedAt:
            "2026-09-19T20:00:00.000Z",
        };

        model.record(
          observation,
        );

        model.record(
          observation,
        );

        expect(
          model.snapshot(
            "memory",
          ).attempts,
        ).toBe(1);
      },
    );

    it(
      "rejects invalid difficulty and cycle evidence",
      () => {
        const model =
          new CompetenceModel();

        expect(
          () =>
            model.record({
              taskId:
                "bad-difficulty",

              family:
                "test",

              difficulty:
                1.2,

              success:
                true,

              cycles:
                1,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "Task difficulty",
        );

        expect(
          () =>
            model.record({
              taskId:
                "bad-cycles",

              family:
                "test",

              difficulty:
                0.5,

              success:
                true,

              cycles:
                -1,

              observedAt:
                "2026-09-19T20:00:00.000Z",
            }),
        ).toThrow(
          "Task cycles",
        );
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousCurriculumPlanner,
  type CurriculumTask,
} from "./autonomous-curriculum";

import {
  CompetenceModel,
} from "./competence-model";

function recordSuccess(
  planner:
    AutonomousCurriculumPlanner,

  taskId:
    string,

  family:
    string,

  difficulty:
    number,

  observedAt:
    string,
): void {
  planner.recordOutcome({
    taskId,
    family,
    difficulty,
    success:
      true,
    cycles:
      4,
    observedAt,
  });
}

describe(
  "Mabojolu G autonomous curriculum planner",
  () => {
    it(
      "prefers a novel challenge near the current learning zone over a trivial familiar task",
      () => {
        const planner =
          new AutonomousCurriculumPlanner(
            new CompetenceModel(),
          );

        const recommendation =
          planner.chooseNext([
            {
              id:
                "trivial",

              family:
                "basic-reasoning",

              difficulty:
                0.1,

              novelty:
                0.1,

              estimatedCost:
                1,
            },

            {
              id:
                "useful-challenge",

              family:
                "basic-reasoning",

              difficulty:
                0.35,

              novelty:
                0.8,

              estimatedCost:
                2,
            },
          ]);

        expect(
          recommendation
            ?.task
            .id,
        ).toBe(
          "useful-challenge",
        );

        expect(
          recommendation
            ?.reasons
            .some(
              (reason) =>
                reason.startsWith(
                  "uncertainty=",
                ),
            ),
        ).toBe(true);
      },
    );

    it(
      "keeps an advanced challenge locked until prerequisite competence has repeated support",
      () => {
        const planner =
          new AutonomousCurriculumPlanner(
            new CompetenceModel(),
          );

        const tasks:
          CurriculumTask[] = [
          {
            id:
              "basic-practice",

            family:
              "gated-sequence",

            difficulty:
              0.4,

            novelty:
              0.3,

            estimatedCost:
              1,
          },

          {
            id:
              "advanced-transfer",

            family:
              "cross-domain-transfer",

            difficulty:
              0.8,

            novelty:
              1,

            estimatedCost:
              1,

            prerequisiteFamilies: [
              "gated-sequence",
            ],
          },
        ];

        expect(
          planner
            .chooseNext(
              tasks,
            )
            ?.task
            .id,
        ).toBe(
          "basic-practice",
        );

        recordSuccess(
          planner,
          "basic-1",
          "gated-sequence",
          0.4,
          "2026-09-19T20:00:00.000Z",
        );

        expect(
          planner
            .chooseNext(
              tasks,
            )
            ?.task
            .id,
        ).toBe(
          "basic-practice",
        );

        recordSuccess(
          planner,
          "basic-2",
          "gated-sequence",
          0.4,
          "2026-09-19T21:00:00.000Z",
        );

        expect(
          planner
            .chooseNext(
              tasks,
            )
            ?.task
            .id,
        ).toBe(
          "advanced-transfer",
        );
      },
    );

    it(
      "moves toward uncertain capability families after another family accumulates strong evidence",
      () => {
        const planner =
          new AutonomousCurriculumPlanner(
            new CompetenceModel(),
          );

        for (
          let index = 0;
          index <
            8;
          index +=
            1
        ) {
          recordSuccess(
            planner,
            "known-" +
              index,

            "known-family",

            0.8,

            "2026-09-19T" +
              String(
                10 + index,
              ) +
              ":00:00.000Z",
          );
        }

        const recommendation =
          planner.chooseNext([
            {
              id:
                "more-known",

              family:
                "known-family",

              difficulty:
                0.75,

              novelty:
                0.2,

              estimatedCost:
                1,
            },

            {
              id:
                "uncertain-family",

              family:
                "new-family",

              difficulty:
                0.35,

              novelty:
                0.9,

              estimatedCost:
                1,
            },
          ]);

        expect(
          recommendation
            ?.task
            .id,
        ).toBe(
          "uncertain-family",
        );
      },
    );

    it(
      "uses lower estimated cost as a deterministic tie break",
      () => {
        const planner =
          new AutonomousCurriculumPlanner(
            new CompetenceModel(),
          );

        const recommendation =
          planner.chooseNext([
            {
              id:
                "expensive",

              family:
                "same",

              difficulty:
                0.3,

              novelty:
                0.5,

              estimatedCost:
                10,
            },

            {
              id:
                "cheap",

              family:
                "same",

              difficulty:
                0.3,

              novelty:
                0.5,

              estimatedCost:
                1,
            },
          ]);

        expect(
          recommendation
            ?.task
            .id,
        ).toBe(
          "cheap",
        );
      },
    );

    it(
      "rejects malformed task metadata instead of scoring invented values",
      () => {
        const planner =
          new AutonomousCurriculumPlanner(
            new CompetenceModel(),
          );

        expect(
          () =>
            planner.chooseNext([
              {
                id:
                  "bad",

                family:
                  "test",

                difficulty:
                  -0.1,

                novelty:
                  0.5,

                estimatedCost:
                  1,
              },
            ]),
        ).toThrow(
          "Task difficulty",
        );
      },
    );
  },
);

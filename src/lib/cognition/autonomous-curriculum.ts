import {
  CompetenceModel,
  type CompetenceObservation,
  type CompetenceSnapshot,
} from "./competence-model";

export interface CurriculumTask {
  id:
    string;

  family:
    string;

  difficulty:
    number;

  novelty:
    number;

  estimatedCost:
    number;

  prerequisiteFamilies?:
    string[];
}

export interface CurriculumRecommendation {
  task:
    CurriculumTask;

  score:
    number;

  reasons:
    string[];

  familyCompetence:
    CompetenceSnapshot;
}

function clamp01(
  value:
    number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

function validateTask(
  task:
    CurriculumTask,
): void {
  for (
    const [
      label,
      value,
    ] of [
      [
        "difficulty",
        task.difficulty,
      ],
      [
        "novelty",
        task.novelty,
      ],
    ] as const
  ) {
    if (
      !Number.isFinite(
        value,
      ) ||
      value <
        0 ||
      value >
        1
    ) {
      throw new Error(
        `Task ${label} must be between 0 and 1.`,
      );
    }
  }

  if (
    !Number.isFinite(
      task.estimatedCost,
    ) ||
    task.estimatedCost <
      0
  ) {
    throw new Error(
      "Task estimatedCost must be non-negative.",
    );
  }
}

function prerequisiteReadiness(
  model:
    CompetenceModel,

  families:
    readonly string[],
):
  number {
  if (
    families.length ===
      0
  ) {
    return 1;
  }

  return Math.min(
    ...families.map(
      (family) =>
        model.snapshot(
          family,
        ).mastery,
    ),
  );
}

/**
 * Mabojolu G autonomous curriculum planner v0.1.
 *
 * The planner favors tasks in a useful learning zone:
 *
 * - prerequisites are supported by prior evidence;
 * - the task is challenging without being wildly beyond current competence;
 * - uncertainty and novelty are still meaningful;
 * - recent learning progress indicates the family can still benefit from work;
 * - cost is considered so expensive tasks do not dominate without added value.
 */
export class AutonomousCurriculumPlanner {
  constructor(
    private readonly competence:
      CompetenceModel,
  ) {}

  recordOutcome(
    observation:
      CompetenceObservation,
  ):
    CompetenceSnapshot {
    return this.competence
      .record(
        observation,
      );
  }

  chooseNext(
    tasks:
      readonly CurriculumTask[],
  ):
    CurriculumRecommendation |
    undefined {
    const candidates =
      tasks
        .map(
          (task) => {
            validateTask(
              task,
            );

            const familyCompetence =
              this.competence
                .snapshot(
                  task.family,
                );

            const prerequisites =
              task.prerequisiteFamilies ??
              [];

            const readiness =
              prerequisiteReadiness(
                this.competence,
                prerequisites,
              );

            /*
             * Hard gate: do not choose advanced work when prerequisite
             * competence has essentially no supporting evidence.
             */
            if (
              readiness <
                0.35
            ) {
              return undefined;
            }

            const targetDifficulty =
              clamp01(
                familyCompetence
                  .mastery +
                0.2,
              );

            const challengeFit =
              1 -
              Math.abs(
                task.difficulty -
                  targetDifficulty,
              );

            const uncertaintyValue =
              familyCompetence
                .uncertainty;

            const progressValue =
              familyCompetence
                .learningProgress;

            const masteryNeed =
              1 -
              familyCompetence
                .mastery;

            const costPenalty =
              clamp01(
                task.estimatedCost /
                  20,
              );

            const score =
              0.28 *
                challengeFit +
              0.24 *
                uncertaintyValue +
              0.2 *
                task.novelty +
              0.16 *
                masteryNeed +
              0.12 *
                progressValue -
              0.12 *
                costPenalty;

            const reasons = [
              `challenge-fit=${challengeFit.toFixed(
                3,
              )}`,
              `uncertainty=${uncertaintyValue.toFixed(
                3,
              )}`,
              `novelty=${task.novelty.toFixed(
                3,
              )}`,
              `mastery-need=${masteryNeed.toFixed(
                3,
              )}`,
              `learning-progress=${progressValue.toFixed(
                3,
              )}`,
              `prerequisite-readiness=${readiness.toFixed(
                3,
              )}`,
            ];

            return {
              task: {
                ...task,

                ...(task
                    .prerequisiteFamilies
                  ? {
                      prerequisiteFamilies: [
                        ...task
                          .prerequisiteFamilies,
                      ],
                    }
                  : {}),
              },

              score,

              reasons,

              familyCompetence,
            };
          },
        )
        .filter(
          (
            candidate,
          ): candidate is
            CurriculumRecommendation =>
            Boolean(
              candidate,
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
            if (
              right.score !==
              left.score
            ) {
              return (
                right.score -
                left.score
              );
            }

            if (
              left
                .task
                .estimatedCost !==
              right
                .task
                .estimatedCost
            ) {
              return (
                left
                  .task
                  .estimatedCost -
                right
                  .task
                  .estimatedCost
              );
            }

            return left
              .task
              .id
              .localeCompare(
                right
                  .task
                  .id,
              );
          },
        );

    return candidates[0];
  }
}

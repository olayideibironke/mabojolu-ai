import {
  describe,
  expect,
  it,
} from "vitest";

import {
  VaultWorld,
} from "./environments/vault-world";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  WorldModel,
} from "./world-model";

function makeClock():
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
          17,
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

describe(
  "Mabojolu G runtime hierarchical goal reasoning",
  () => {
    it(
      "turns a learned multi-step plan into dependency-ordered subgoals and completes the hierarchy",
      () => {
        const model =
          new WorldModel();

        const learningRun =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          learningRun.solved,
        ).toBe(true);

        const result =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(3);

        const hierarchy =
          result.goalHierarchy;

        expect(
          hierarchy.goals,
        ).toHaveLength(4);

        const root =
          hierarchy.goals.find(
            (goal) =>
              !goal.parentGoalId,
          );

        expect(
          root?.status,
        ).toBe(
          "completed",
        );

        const subgoals =
          hierarchy.goals
            .filter(
              (goal) =>
                goal.parentGoalId ===
                root?.id,
            )
            .sort(
              (left, right) =>
                left.id.localeCompare(
                  right.id,
                ),
            );

        expect(
          subgoals.map(
            (goal) =>
              goal.status,
          ),
        ).toEqual([
          "completed",
          "completed",
          "completed",
        ]);

        expect(
          subgoals[0]
            ?.dependsOnGoalIds,
        ).toEqual([]);

        expect(
          subgoals[1]
            ?.dependsOnGoalIds,
        ).toEqual([
          "hierarchy-step-1",
        ]);

        expect(
          subgoals[2]
            ?.dependsOnGoalIds,
        ).toEqual([
          "hierarchy-step-2",
        ]);

        expect(
          subgoals.map(
            (goal) =>
              goal.description,
          ),
        ).toEqual([
          "Reach modeled state after action A.",
          "Reach modeled state after action C.",
          "Reach modeled state after action B.",
        ]);
      },
    );

    it(
      "mirrors hierarchical subgoals into auditable cognitive state",
      () => {
        const model =
          new WorldModel();

        new CognitiveRuntime(
          new VaultWorld(),
          {
            worldModel:
              model,

            maxCycles: 8,

            now:
              makeClock(),
          },
        ).run();

        const result =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              worldModel:
                model,

              maxCycles: 8,

              now:
                makeClock(),
            },
          ).run();

        const cognitiveSubgoals =
          result.state
            .goals
            .filter(
              (goal) =>
                goal.parentGoalId,
            );

        expect(
          cognitiveSubgoals,
        ).toHaveLength(3);

        expect(
          cognitiveSubgoals
            .every(
              (goal) =>
                goal.status ===
                "completed",
            ),
        ).toBe(true);

        expect(
          cognitiveSubgoals[1]
            ?.dependsOnGoalIds,
        ).toEqual([
          "hierarchy-step-1",
        ]);
      },
    );
  },
);

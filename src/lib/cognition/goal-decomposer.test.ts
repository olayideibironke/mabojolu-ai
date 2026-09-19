import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  EnvironmentSnapshot,
} from "./environment";

import {
  AutonomousGoalDecomposer,
} from "./goal-decomposer";

import {
  WorldModel,
} from "./world-model";

const INITIAL:
  EnvironmentSnapshot = {
  power: false,
  latch: false,
  vaultOpen: false,
};

const POWERED:
  EnvironmentSnapshot = {
  power: true,
  latch: false,
  vaultOpen: false,
};

const READY:
  EnvironmentSnapshot = {
  power: true,
  latch: true,
  vaultOpen: false,
};

const OPEN:
  EnvironmentSnapshot = {
  power: true,
  latch: true,
  vaultOpen: true,
};

function learn(
  model:
    WorldModel,

  action:
    string,

  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,

  observedAt:
    string,
): string {
  const rule =
    model.observeTransition({
      action,
      before,
      after,
      accepted:
        true,
      observedAt,
    });

  expect(
    rule,
  ).toBeDefined();

  return rule?.id ??
    "";
}

function seedVaultModel():
  WorldModel {
  const model =
    new WorldModel();

  learn(
    model,
    "A",
    INITIAL,
    POWERED,
    "2026-09-19T18:00:00.000Z",
  );

  learn(
    model,
    "C",
    POWERED,
    READY,
    "2026-09-19T18:01:00.000Z",
  );

  learn(
    model,
    "B",
    READY,
    OPEN,
    "2026-09-19T18:02:00.000Z",
  );

  return model;
}

describe(
  "Mabojolu G autonomous goal decomposition",
  () => {
    it(
      "works backward from a high-level goal and invents prerequisite subgoals from causal knowledge",
      () => {
        const decomposer =
          new AutonomousGoalDecomposer(
            seedVaultModel(),
          );

        const result =
          decomposer.decompose({
            currentState:
              INITIAL,

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          result,
        ).toBeDefined();

        expect(
          result
            ?.goals
            .map(
              (goal) => ({
                conditions:
                  goal.conditions,

                action:
                  goal.action,
              }),
            ),
        ).toEqual([
          {
            conditions: {
              power: true,
            },

            action: "A",
          },
          {
            conditions: {
              latch: true,
            },

            action: "C",
          },
          {
            conditions: {
              vaultOpen:
                true,
            },

            action: "B",
          },
        ]);

        expect(
          result
            ?.goals[0]
            ?.dependsOnGoalIds,
        ).toEqual([]);

        expect(
          result
            ?.goals[1]
            ?.dependsOnGoalIds,
        ).toEqual([
          "autonomous-subgoal-1",
        ]);

        expect(
          result
            ?.goals[2]
            ?.dependsOnGoalIds
            .sort(),
        ).toEqual([
          "autonomous-subgoal-1",
          "autonomous-subgoal-2",
        ]);
      },
    );

    it(
      "chooses the lowest-cost evidence-backed decomposition when multiple causal routes exist",
      () => {
        const model =
          seedVaultModel();

        learn(
          model,
          "D",
          INITIAL,
          {
            ...INITIAL,
            vaultOpen:
              true,
          },
          "2026-09-19T18:03:00.000Z",
        );

        const result =
          new AutonomousGoalDecomposer(
            model,
          ).decompose({
            currentState:
              INITIAL,

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
              "D",
            ],
          });

        expect(
          result
            ?.goals,
        ).toHaveLength(1);

        expect(
          result
            ?.goals[0]
            ?.action,
        ).toBe("D");
      },
    );

    it(
      "generates an alternate decomposition when a previously preferred causal rule is excluded",
      () => {
        const model =
          seedVaultModel();

        const directRuleId =
          learn(
            model,
            "D",
            INITIAL,
            {
              ...INITIAL,
              vaultOpen:
                true,
            },
            "2026-09-19T18:03:00.000Z",
          );

        const decomposer =
          new AutonomousGoalDecomposer(
            model,
          );

        const original =
          decomposer.decompose({
            currentState:
              INITIAL,

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
              "D",
            ],
          });

        expect(
          original
            ?.goals
            .map(
              (goal) =>
                goal.action,
            ),
        ).toEqual([
          "D",
        ]);

        const replanned =
          decomposer.decompose({
            currentState:
              INITIAL,

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
              "D",
            ],

            excludedRuleIds: [
              directRuleId,
            ],
          });

        expect(
          replanned
            ?.goals
            .map(
              (goal) =>
                goal.action,
            ),
        ).toEqual([
          "A",
          "C",
          "B",
        ]);
      },
    );

    it(
      "returns an empty hierarchy when the high-level goal is already satisfied",
      () => {
        const result =
          new AutonomousGoalDecomposer(
            seedVaultModel(),
          ).decompose({
            currentState:
              OPEN,

            goalConditions: {
              vaultOpen:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          result,
        ).toBeDefined();

        expect(
          result
            ?.goals,
        ).toEqual([]);

        expect(
          result
            ?.confidence,
        ).toBe(1);
      },
    );

    it(
      "fails cleanly when the world model cannot explain how to achieve the requested condition",
      () => {
        const result =
          new AutonomousGoalDecomposer(
            seedVaultModel(),
          ).decompose({
            currentState:
              INITIAL,

            goalConditions: {
              unknownSuccess:
                true,
            },

            availableActions: [
              "A",
              "B",
              "C",
            ],
          });

        expect(
          result,
        ).toBeUndefined();
      },
    );

    it(
      "detects cyclic prerequisite explanations instead of recursively inventing progress",
      () => {
        const model =
          new WorldModel();

        learn(
          model,
          "X",
          {
            a: false,
            b: true,
          },
          {
            a: true,
            b: true,
          },
          "2026-09-19T18:10:00.000Z",
        );

        learn(
          model,
          "Y",
          {
            a: true,
            b: false,
          },
          {
            a: true,
            b: true,
          },
          "2026-09-19T18:11:00.000Z",
        );

        const result =
          new AutonomousGoalDecomposer(
            model,
          ).decompose({
            currentState: {
              a: false,
              b: false,
            },

            goalConditions: {
              a: true,
            },

            availableActions: [
              "X",
              "Y",
            ],
          });

        expect(
          result,
        ).toBeUndefined();
      },
    );
  },
);

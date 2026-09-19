import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCognitiveState,
  reduceCognitiveState,
} from "./state";

describe(
  "Mabojolu G cognitive state",
  () => {
    it(
      "starts with an empty deterministic state",
      () => {
        const state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        expect(
          state,
        ).toEqual({
          version: 1,
          cycle: 0,
          observations: [],
          beliefs: [],
          hypotheses: [],
          goals: [],
          actions: [],
          outcomes: [],
          learnings: [],
          createdAt:
            "2026-09-19T03:00:00.000Z",
          updatedAt:
            "2026-09-19T03:00:00.000Z",
        });
      },
    );

    it(
      "records direct observations without converting them into beliefs",
      () => {
        const initial =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        const next =
          reduceCognitiveState(
            initial,
            {
              type:
                "observation.recorded",

              observation: {
                id:
                  "observation-1",

                source:
                  "environment",

                content:
                  "Action A caused the indicator to turn green.",

                observedAt:
                  "2026-09-19T03:00:01.000Z",
              },
            },
          );

        expect(
          next.observations,
        ).toHaveLength(1);

        expect(
          next.beliefs,
        ).toEqual([]);

        expect(
          next.observations[0]
            .content,
        ).toBe(
          "Action A caused the indicator to turn green.",
        );
      },
    );

    it(
      "can create and revise a belief while preserving its identity",
      () => {
        let state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "belief.updated",

              belief: {
                id: "belief-1",

                proposition:
                  "Action A activates power.",

                confidence:
                  0.55,

                status:
                  "active",

                evidenceIds: [
                  "observation-1",
                ],

                updatedAt:
                  "2026-09-19T03:00:02.000Z",
              },
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "belief.updated",

              belief: {
                id: "belief-1",

                proposition:
                  "Action A activates power.",

                confidence:
                  0.9,

                status:
                  "active",

                evidenceIds: [
                  "observation-1",
                  "observation-2",
                ],

                updatedAt:
                  "2026-09-19T03:00:03.000Z",
              },
            },
          );

        expect(
          state.beliefs,
        ).toHaveLength(1);

        expect(
          state.beliefs[0]
            .confidence,
        ).toBe(0.9);

        expect(
          state.beliefs[0]
            .evidenceIds,
        ).toEqual([
          "observation-1",
          "observation-2",
        ]);
      },
    );

    it(
      "rejects invalid confidence values instead of silently normalizing them",
      () => {
        const state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        expect(() =>
          reduceCognitiveState(
            state,
            {
              type:
                "hypothesis.updated",

              hypothesis: {
                id:
                  "hypothesis-1",

                statement:
                  "Action B opens the vault.",

                confidence:
                  1.5,

                status:
                  "candidate",

                evidenceFor: [],

                evidenceAgainst:
                  [],

                createdAt:
                  "2026-09-19T03:00:01.000Z",

                updatedAt:
                  "2026-09-19T03:00:01.000Z",
              },
            },
          ),
        ).toThrow(
          "Hypothesis confidence must be between 0 and 1.",
        );
      },
    );

    it(
      "activates one goal while returning a previous active goal to pending",
      () => {
        let state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        for (
          const goal of [
            {
              id: "goal-1",

              description:
                "Determine what Action A does.",

              priority: 90,

              status:
                "pending" as const,

              successCriteria: [
                "The effect of Action A is known.",
              ],

              constraints: [],

              createdAt:
                "2026-09-19T03:00:01.000Z",

              updatedAt:
                "2026-09-19T03:00:01.000Z",
            },

            {
              id: "goal-2",

              description:
                "Open the vault.",

              priority: 100,

              status:
                "pending" as const,

              successCriteria: [
                "The vault reports an open state.",
              ],

              constraints: [
                "Do not reset the environment unless necessary.",
              ],

              createdAt:
                "2026-09-19T03:00:01.000Z",

              updatedAt:
                "2026-09-19T03:00:01.000Z",
            },
          ]
        ) {
          state =
            reduceCognitiveState(
              state,
              {
                type:
                  "goal.updated",
                goal,
              },
            );
        }

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "goal.activated",

              goalId:
                "goal-1",

              occurredAt:
                "2026-09-19T03:00:02.000Z",
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "goal.activated",

              goalId:
                "goal-2",

              occurredAt:
                "2026-09-19T03:00:03.000Z",
            },
          );

        expect(
          state.activeGoalId,
        ).toBe(
          "goal-2",
        );

        expect(
          state.goals.find(
            (goal) =>
              goal.id ===
              "goal-1",
          )?.status,
        ).toBe(
          "pending",
        );

        expect(
          state.goals.find(
            (goal) =>
              goal.id ===
              "goal-2",
          )?.status,
        ).toBe(
          "active",
        );
      },
    );


    it(
      "clears the active-goal pointer when the active goal becomes terminal or blocked",
      () => {
        let state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "goal.updated",

              goal: {
                id: "goal-1",

                description:
                  "Complete the subgoal.",

                priority: 100,

                status:
                  "pending",

                successCriteria: [
                  "Subgoal complete.",
                ],

                constraints: [],

                createdAt:
                  "2026-09-19T03:00:01.000Z",

                updatedAt:
                  "2026-09-19T03:00:01.000Z",
              },
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "goal.activated",

              goalId:
                "goal-1",

              occurredAt:
                "2026-09-19T03:00:02.000Z",
            },
          );

        expect(
          state.activeGoalId,
        ).toBe(
          "goal-1",
        );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "goal.updated",

              goal: {
                ...state.goals[0],

                status:
                  "completed",

                updatedAt:
                  "2026-09-19T03:00:03.000Z",
              },
            },
          );

        expect(
          state.activeGoalId,
        ).toBeUndefined();
      },
    );

    it(
      "requires outcomes to reference a known action",
      () => {
        const state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        expect(() =>
          reduceCognitiveState(
            state,
            {
              type:
                "outcome.recorded",

              outcome: {
                id:
                  "outcome-1",

                actionId:
                  "missing-action",

                success: true,

                observationIds:
                  [],

                summary:
                  "Something happened.",

                recordedAt:
                  "2026-09-19T03:00:01.000Z",
              },
            },
          ),
        ).toThrow(
          'Outcome references unknown action "missing-action".',
        );
      },
    );

    it(
      "records an action, its outcome, and generalized learning",
      () => {
        let state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "action.updated",

              action: {
                id:
                  "action-1",

                proposal: {
                  id:
                    "proposal-1",

                  kind:
                    "experiment",

                  description:
                    "Execute Action A and observe the environment.",

                  expectedEffects: [
                    "A visible state change may occur.",
                  ],

                  risk:
                    0.1,

                  reversible:
                    true,

                  requiresApproval:
                    false,

                  createdAt:
                    "2026-09-19T03:00:01.000Z",
                },

                status:
                  "completed",

                selectedAt:
                  "2026-09-19T03:00:02.000Z",

                completedAt:
                  "2026-09-19T03:00:03.000Z",
              },
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "outcome.recorded",

              outcome: {
                id:
                  "outcome-1",

                actionId:
                  "action-1",

                success: true,

                observationIds: [
                  "observation-1",
                ],

                summary:
                  "The power indicator became green.",

                recordedAt:
                  "2026-09-19T03:00:04.000Z",
              },
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "learning.recorded",

              learning: {
                id:
                  "learning-1",

                kind:
                  "rule",

                statement:
                  "Action A appears to activate power.",

                confidence:
                  0.75,

                derivedFromIds: [
                  "action-1",
                  "outcome-1",
                  "observation-1",
                ],

                createdAt:
                  "2026-09-19T03:00:05.000Z",
              },
            },
          );

        expect(
          state.actions,
        ).toHaveLength(1);

        expect(
          state.outcomes,
        ).toHaveLength(1);

        expect(
          state.learnings,
        ).toHaveLength(1);

        expect(
          state.learnings[0]
            .statement,
        ).toBe(
          "Action A appears to activate power.",
        );
      },
    );

    it(
      "advances cognitive cycles independently of recorded events",
      () => {
        let state =
          createCognitiveState(
            "2026-09-19T03:00:00.000Z",
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "cycle.advanced",

              occurredAt:
                "2026-09-19T03:01:00.000Z",
            },
          );

        state =
          reduceCognitiveState(
            state,
            {
              type:
                "cycle.advanced",

              occurredAt:
                "2026-09-19T03:02:00.000Z",
            },
          );

        expect(
          state.cycle,
        ).toBe(2);
      },
    );
  },
);
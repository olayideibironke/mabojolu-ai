import {
  describe,
  expect,
  it,
} from "vitest";

import {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

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
          16,
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

function rootGoal() {
  return {
    id: "root",

    description:
      "Open the protected system.",

    priority: 100,

    status:
      "active" as const,

    successCriteria: [
      "The protected system reports open.",
    ],

    constraints: [
      "Do not violate the safety condition.",
    ],

    createdAt:
      "2026-09-19T16:00:00.000Z",

    updatedAt:
      "2026-09-19T16:00:00.000Z",
  };
}

describe(
  "Mabojolu G hierarchical goal reasoning",
  () => {
    it(
      "decomposes a high-level goal into dependency-ordered subgoals",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        reasoner.decompose(
          "root",
          [
            {
              id:
                "establish-power",

              description:
                "Establish power.",

              priority: 90,

              successCriteria: [
                "Power is established.",
              ],
            },

            {
              id:
                "release-latch",

              description:
                "Release the latch.",

              priority: 95,

              successCriteria: [
                "Latch is released.",
              ],

              dependsOnGoalIds: [
                "establish-power",
              ],
            },
          ],
        );

        const next =
          reasoner
            .nextActionableGoal();

        expect(
          next?.id,
        ).toBe(
          "establish-power",
        );

        expect(
          next?.constraints,
        ).toContain(
          "Do not violate the safety condition.",
        );
      },
    );

    it(
      "advances through dependencies and completes the parent automatically",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        reasoner.decompose(
          "root",
          [
            {
              id: "first",
              description:
                "Complete first prerequisite.",
              successCriteria: [
                "First prerequisite complete.",
              ],
            },
            {
              id: "second",
              description:
                "Complete second prerequisite.",
              successCriteria: [
                "Second prerequisite complete.",
              ],
              dependsOnGoalIds: [
                "first",
              ],
            },
          ],
        );

        reasoner.activate(
          "first",
        );

        reasoner.complete(
          "first",
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "second",
        );

        reasoner.activate(
          "second",
        );

        reasoner.complete(
          "second",
        );

        const snapshot =
          reasoner
            .getSnapshot();

        expect(
          snapshot.goals
            .find(
              (goal) =>
                goal.id ===
                "root",
            )
            ?.status,
        ).toBe(
          "completed",
        );
      },
    );

    it(
      "uses priority to choose among independent actionable subgoals",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        reasoner.decompose(
          "root",
          [
            {
              id: "low",
              description:
                "Low-priority branch.",
              priority: 20,
              successCriteria: [
                "Low branch complete.",
              ],
            },
            {
              id: "high",
              description:
                "High-priority branch.",
              priority: 80,
              successCriteria: [
                "High branch complete.",
              ],
            },
          ],
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "high",
        );

        reasoner.reprioritize(
          "low",
          90,
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "low",
        );
      },
    );

    it(
      "blocks a failed branch and rewires dependents to a replacement plan",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        reasoner.decompose(
          "root",
          [
            {
              id:
                "old-route",

              description:
                "Use the original route.",

              priority: 90,

              successCriteria: [
                "Original route succeeds.",
              ],
            },

            {
              id:
                "finish",

              description:
                "Finish after the route.",

              priority: 80,

              successCriteria: [
                "Final step complete.",
              ],

              dependsOnGoalIds: [
                "old-route",
              ],
            },
          ],
        );

        reasoner.block(
          "old-route",
          "Observed evidence shows the route cannot work.",
        );

        const replacement =
          reasoner
            .replaceBlockedGoal(
              "old-route",
              {
                id:
                  "new-route",

                description:
                  "Use the revised route.",

                priority:
                  95,

                successCriteria: [
                  "Revised route succeeds.",
                ],
              },
            );

        expect(
          replacement
            .replacementForGoalId,
        ).toBe(
          "old-route",
        );

        const finish =
          reasoner
            .getSnapshot()
            .goals
            .find(
              (goal) =>
                goal.id ===
                "finish",
            );

        expect(
          finish
            ?.dependsOnGoalIds,
        ).toEqual([
          "new-route",
        ]);

        reasoner.complete(
          "new-route",
        );

        expect(
          reasoner
            .nextActionableGoal()
            ?.id,
        ).toBe(
          "finish",
        );

        reasoner.complete(
          "finish",
        );

        expect(
          reasoner
            .getSnapshot()
            .goals
            .find(
              (goal) =>
                goal.id ===
                "root",
            )
            ?.status,
        ).toBe(
          "completed",
        );
      },
    );

    it(
      "propagates a block to descendants without falsely completing the parent",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        reasoner.decompose(
          "root",
          [
            {
              id: "branch",
              description:
                "Pursue branch.",
              successCriteria: [
                "Branch complete.",
              ],
            },
          ],
        );

        reasoner.decompose(
          "branch",
          [
            {
              id: "leaf",
              description:
                "Complete leaf.",
              successCriteria: [
                "Leaf complete.",
              ],
            },
          ],
        );

        reasoner.block(
          "branch",
          "Required resource is unavailable.",
        );

        const snapshot =
          reasoner
            .getSnapshot();

        expect(
          snapshot.goals
            .find(
              (goal) =>
                goal.id ===
                "leaf",
            )
            ?.status,
        ).toBe(
          "blocked",
        );

        expect(
          snapshot.goals
            .find(
              (goal) =>
                goal.id ===
                "root",
            )
            ?.status,
        ).not.toBe(
          "completed",
        );
      },
    );

    it(
      "rejects unknown dependencies instead of inventing missing goals",
      () => {
        const reasoner =
          new HierarchicalGoalReasoner(
            makeClock(),
          );

        reasoner.registerRoot(
          rootGoal(),
        );

        expect(
          () =>
            reasoner.decompose(
              "root",
              [
                {
                  id: "child",
                  description:
                    "Child goal.",
                  successCriteria: [
                    "Child complete.",
                  ],
                  dependsOnGoalIds: [
                    "missing",
                  ],
                },
              ],
            ),
        ).toThrow(
          'Unknown goal dependency "missing".',
        );
      },
    );
  },
);

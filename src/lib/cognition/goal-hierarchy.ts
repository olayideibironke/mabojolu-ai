import type {
  Goal,
  GoalStatus,
} from "./types";

export interface GoalSpecification {
  id?: string;

  description: string;

  priority?: number;

  successCriteria:
    string[];

  constraints?:
    string[];

  dependsOnGoalIds?:
    string[];
}

export interface GoalHierarchySnapshot {
  goals:
    Goal[];

  activeGoalId?:
    string;
}

function cloneGoal(
  goal:
    Goal,
): Goal {
  return {
    ...goal,

    successCriteria: [
      ...goal
        .successCriteria,
    ],

    constraints: [
      ...goal.constraints,
    ],

    ...(goal
        .dependsOnGoalIds
      ? {
          dependsOnGoalIds: [
            ...goal
              .dependsOnGoalIds,
          ],
        }
      : {}),
  };
}

function uniqueStrings(
  values:
    readonly string[],
): string[] {
  return Array.from(
    new Set(
      values,
    ),
  );
}

function assertPriority(
  priority:
    number,
): void {
  if (
    !Number.isFinite(
      priority,
    ) ||
    priority < 0 ||
    priority > 100
  ) {
    throw new Error(
      "Goal priority must be between 0 and 100.",
    );
  }
}

function isTerminal(
  status:
    GoalStatus,
): boolean {
  return (
    status ===
      "completed" ||
    status ===
      "abandoned"
  );
}

/**
 * Mabojolu G Hierarchical Goal Reasoner v0.1.
 *
 * This class manages a dependency-aware goal tree without relying on an LLM.
 *
 * Capabilities:
 * - root and child goals
 * - explicit dependencies
 * - inherited constraints
 * - priority-based next-goal selection
 * - blocking and branch replacement
 * - dependency rewiring after replanning
 * - ancestor completion only after required branches are satisfied
 */
export class HierarchicalGoalReasoner {
  private readonly goals =
    new Map<
      string,
      Goal
    >();

  private sequence =
    0;

  private activeGoalId:
    string |
    undefined;

  constructor(
    private readonly now:
      () => string,
  ) {}

  registerRoot(
    goal:
      Goal,
  ): Goal {
    if (
      goal.parentGoalId
    ) {
      throw new Error(
        "A root goal cannot have a parent.",
      );
    }

    if (
      this.goals.size >
      0
    ) {
      throw new Error(
        "The hierarchy already has a root goal.",
      );
    }

    this.assertGoalIdAvailable(
      goal.id,
    );

    const stored =
      cloneGoal({
        ...goal,

        dependsOnGoalIds:
          uniqueStrings(
            goal
              .dependsOnGoalIds ??
              [],
          ),
      });

    this.goals.set(
      stored.id,
      stored,
    );

    if (
      stored.status ===
      "active"
    ) {
      this.activeGoalId =
        stored.id;
    }

    return cloneGoal(
      stored,
    );
  }

  decompose(
    parentGoalId:
      string,

    specifications:
      readonly GoalSpecification[],
  ): Goal[] {
    const parent =
      this.requireGoal(
        parentGoalId,
      );

    if (
      isTerminal(
        parent.status,
      )
    ) {
      throw new Error(
        "Cannot decompose a completed or abandoned goal.",
      );
    }

    const created:
      Goal[] = [];

    for (
      const specification of
        specifications
    ) {
      const id =
        specification.id ??
        this.nextId();

      this.assertGoalIdAvailable(
        id,
      );

      const dependencies =
        uniqueStrings(
          specification
            .dependsOnGoalIds ??
            [],
        );

      if (
        dependencies.includes(
          id,
        )
      ) {
        throw new Error(
          "A goal cannot depend on itself.",
        );
      }

      for (
        const dependencyId of
          dependencies
      ) {
        if (
          !this.goals.has(
            dependencyId,
          ) &&
          !specifications.some(
            (candidate) =>
              candidate.id ===
              dependencyId,
          )
        ) {
          throw new Error(
            `Unknown goal dependency "${dependencyId}".`,
          );
        }
      }

      const priority =
        specification
          .priority ??
        parent.priority;

      assertPriority(
        priority,
      );

      const timestamp =
        this.now();

      const child:
        Goal = {
        id,

        description:
          specification
            .description,

        priority,

        status:
          "pending",

        successCriteria: [
          ...specification
            .successCriteria,
        ],

        constraints:
          uniqueStrings([
            ...parent
              .constraints,
            ...(
              specification
                .constraints ??
              []
            ),
          ]),

        parentGoalId,

        dependsOnGoalIds:
          dependencies,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,
      };

      this.goals.set(
        id,
        child,
      );

      created.push(
        cloneGoal(
          child,
        ),
      );
    }

    if (
      parent.status ===
      "active"
    ) {
      this.updateGoal(
        parent.id,
        {
          status:
            "pending",
        },
      );

      if (
        this.activeGoalId ===
        parent.id
      ) {
        this.activeGoalId =
          undefined;
      }
    }

    return created;
  }

  nextActionableGoal():
    Goal |
    undefined {
    const active =
      this.activeGoalId
        ? this.goals.get(
            this.activeGoalId,
          )
        : undefined;

    if (
      active &&
      active.status ===
        "active" &&
      this.isActionable(
        active,
      )
    ) {
      return cloneGoal(
        active,
      );
    }

    const candidates =
      Array.from(
        this.goals.values(),
      )
        .filter(
          (goal) =>
            goal.status ===
              "pending" &&
            this.isActionable(
              goal,
            ),
        )
        .sort(
          (
            left,
            right,
          ) => {
            if (
              right.priority !==
              left.priority
            ) {
              return (
                right.priority -
                left.priority
              );
            }

            const depthDifference =
              this.depthOf(
                right.id,
              ) -
              this.depthOf(
                left.id,
              );

            if (
              depthDifference !==
              0
            ) {
              return (
                depthDifference
              );
            }

            return left.id.localeCompare(
              right.id,
            );
          },
        );

    const selected =
      candidates[0];

    return selected
      ? cloneGoal(
          selected,
        )
      : undefined;
  }

  activate(
    goalId:
      string,
  ): Goal {
    const goal =
      this.requireGoal(
        goalId,
      );

    if (
      !this.isActionable(
        goal,
      )
    ) {
      throw new Error(
        `Goal "${goalId}" is not currently actionable.`,
      );
    }

    if (
      this.activeGoalId &&
      this.activeGoalId !==
        goalId
    ) {
      const previous =
        this.goals.get(
          this.activeGoalId,
        );

      if (
        previous?.status ===
        "active"
      ) {
        this.updateGoal(
          previous.id,
          {
            status:
              "pending",
          },
        );
      }
    }

    const updated =
      this.updateGoal(
        goalId,
        {
          status:
            "active",
        },
      );

    this.activeGoalId =
      goalId;

    return cloneGoal(
      updated,
    );
  }

  complete(
    goalId:
      string,
  ): Goal {
    this.requireGoal(
      goalId,
    );

    const completed =
      this.updateGoal(
        goalId,
        {
          status:
            "completed",

          blockedReason:
            undefined,
        },
      );

    if (
      this.activeGoalId ===
      goalId
    ) {
      this.activeGoalId =
        undefined;
    }

    this.reconcileAncestors(
      completed.parentGoalId,
    );

    return cloneGoal(
      completed,
    );
  }

  block(
    goalId:
      string,

    reason:
      string,
  ): Goal {
    if (
      reason.trim()
        .length ===
      0
    ) {
      throw new Error(
        "Blocked goals require a reason.",
      );
    }

    this.requireGoal(
      goalId,
    );

    const affected =
      new Set<string>([
        goalId,
        ...this.descendantIds(
          goalId,
        ),
      ]);

    for (
      const id of
        affected
    ) {
      const goal =
        this.requireGoal(
          id,
        );

      if (
        isTerminal(
          goal.status,
        )
      ) {
        continue;
      }

      this.updateGoal(
        id,
        {
          status:
            "blocked",

          blockedReason:
            id === goalId
              ? reason
              : `Ancestor goal "${goalId}" is blocked: ${reason}`,
        },
      );
    }

    if (
      this.activeGoalId &&
      affected.has(
        this.activeGoalId,
      )
    ) {
      this.activeGoalId =
        undefined;
    }

    return cloneGoal(
      this.requireGoal(
        goalId,
      ),
    );
  }

  replaceBlockedGoal(
    blockedGoalId:
      string,

    specification:
      GoalSpecification,
  ): Goal {
    const blocked =
      this.requireGoal(
        blockedGoalId,
      );

    if (
      blocked.status !==
      "blocked"
    ) {
      throw new Error(
        "Only a blocked goal can be replaced.",
      );
    }

    const parentGoalId =
      blocked.parentGoalId;

    if (
      !parentGoalId
    ) {
      throw new Error(
        "The root goal cannot be replaced as a branch.",
      );
    }

    const replacementId =
      specification.id ??
      this.nextId();

    this.assertGoalIdAvailable(
      replacementId,
    );

    const timestamp =
      this.now();

    const replacement:
      Goal = {
      id:
        replacementId,

      description:
        specification
          .description,

      priority:
        specification
          .priority ??
        blocked.priority,

      status:
        "pending",

      successCriteria: [
        ...specification
          .successCriteria,
      ],

      constraints:
        uniqueStrings([
          ...blocked.constraints,
          ...(
            specification
              .constraints ??
            []
          ),
        ]),

      parentGoalId,

      dependsOnGoalIds:
        uniqueStrings(
          specification
            .dependsOnGoalIds ??
          blocked
            .dependsOnGoalIds ??
          [],
        ),

      replacementForGoalId:
        blockedGoalId,

      createdAt:
        timestamp,

      updatedAt:
        timestamp,
    };

    assertPriority(
      replacement.priority,
    );

    this.goals.set(
      replacement.id,
      replacement,
    );

    this.updateGoal(
      blockedGoalId,
      {
        status:
          "abandoned",
      },
    );

    for (
      const goal of
        this.goals.values()
    ) {
      const dependencies =
        goal
          .dependsOnGoalIds ??
        [];

      if (
        dependencies.includes(
          blockedGoalId,
        )
      ) {
        this.updateGoal(
          goal.id,
          {
            dependsOnGoalIds:
              uniqueStrings(
                dependencies.map(
                  (dependencyId) =>
                    dependencyId ===
                    blockedGoalId
                      ? replacement.id
                      : dependencyId,
                ),
              ),
          },
        );
      }
    }

    return cloneGoal(
      replacement,
    );
  }

  reprioritize(
    goalId:
      string,

    priority:
      number,
  ): Goal {
    assertPriority(
      priority,
    );

    return cloneGoal(
      this.updateGoal(
        goalId,
        {
          priority,
        },
      ),
    );
  }

  getSnapshot():
    GoalHierarchySnapshot {
    return {
      goals:
        Array.from(
          this.goals
            .values(),
        ).map(
          cloneGoal,
        ),

      ...(this.activeGoalId
        ? {
            activeGoalId:
              this.activeGoalId,
          }
        : {}),
    };
  }

  private isActionable(
    goal:
      Goal,
  ): boolean {
    if (
      goal.status !==
        "pending" &&
      goal.status !==
        "active"
    ) {
      return false;
    }

    const parent =
      goal.parentGoalId
        ? this.goals.get(
            goal.parentGoalId,
          )
        : undefined;

    if (
      parent &&
      (
        parent.status ===
          "blocked" ||
        parent.status ===
          "abandoned" ||
        parent.status ===
          "completed"
      )
    ) {
      return false;
    }

    const children =
      this.childrenOf(
        goal.id,
      );

    if (
      children.some(
        (child) =>
          !this.goalSatisfied(
            child.id,
          ),
      )
    ) {
      return false;
    }

    const dependencies =
      goal
        .dependsOnGoalIds ??
      [];

    return dependencies.every(
      (dependencyId) =>
        this.goalSatisfied(
          dependencyId,
        ),
    );
  }

  private goalSatisfied(
    goalId:
      string,
  ): boolean {
    const goal =
      this.goals.get(
        goalId,
      );

    if (
      !goal
    ) {
      return false;
    }

    if (
      goal.status ===
      "completed"
    ) {
      return true;
    }

    if (
      goal.status !==
      "abandoned"
    ) {
      return false;
    }

    const replacements =
      Array.from(
        this.goals.values(),
      ).filter(
        (candidate) =>
          candidate
            .replacementForGoalId ===
          goalId,
      );

    return (
      replacements.length >
        0 &&
      replacements.some(
        (replacement) =>
          this.goalSatisfied(
            replacement.id,
          ),
      )
    );
  }

  private reconcileAncestors(
    parentGoalId:
      string |
      undefined,
  ): void {
    if (
      !parentGoalId
    ) {
      return;
    }

    const children =
      this.childrenOf(
        parentGoalId,
      );

    if (
      children.length ===
        0 ||
      !children.every(
        (child) =>
          this.goalSatisfied(
            child.id,
          ),
      )
    ) {
      return;
    }

    const parent =
      this.requireGoal(
        parentGoalId,
      );

    if (
      parent.status !==
        "completed"
    ) {
      this.updateGoal(
        parentGoalId,
        {
          status:
            "completed",

          blockedReason:
            undefined,
        },
      );
    }

    if (
      this.activeGoalId ===
      parentGoalId
    ) {
      this.activeGoalId =
        undefined;
    }

    this.reconcileAncestors(
      parent.parentGoalId,
    );
  }

  private childrenOf(
    parentGoalId:
      string,
  ): Goal[] {
    return Array.from(
      this.goals.values(),
    ).filter(
      (goal) =>
        goal.parentGoalId ===
        parentGoalId,
    );
  }

  private descendantIds(
    goalId:
      string,
  ): string[] {
    const direct =
      this.childrenOf(
        goalId,
      );

    return direct.flatMap(
      (child) => [
        child.id,
        ...this.descendantIds(
          child.id,
        ),
      ],
    );
  }

  private depthOf(
    goalId:
      string,
  ): number {
    let depth =
      0;

    let current =
      this.goals.get(
        goalId,
      );

    while (
      current
        ?.parentGoalId
    ) {
      depth +=
        1;

      current =
        this.goals.get(
          current
            .parentGoalId,
        );
    }

    return depth;
  }

  private updateGoal(
    goalId:
      string,

    patch:
      Partial<Goal>,
  ): Goal {
    const existing =
      this.requireGoal(
        goalId,
      );

    const updated:
      Goal = {
      ...existing,
      ...patch,

      successCriteria:
        patch.successCriteria
          ? [
              ...patch
                .successCriteria,
            ]
          : [
              ...existing
                .successCriteria,
            ],

      constraints:
        patch.constraints
          ? [
              ...patch.constraints,
            ]
          : [
              ...existing
                .constraints,
            ],

      ...(patch
          .dependsOnGoalIds
        ? {
            dependsOnGoalIds: [
              ...patch
                .dependsOnGoalIds,
            ],
          }
        : existing
            .dependsOnGoalIds
          ? {
              dependsOnGoalIds: [
                ...existing
                  .dependsOnGoalIds,
              ],
            }
          : {}),

      updatedAt:
        this.now(),
    };

    this.goals.set(
      goalId,
      updated,
    );

    return updated;
  }

  private requireGoal(
    goalId:
      string,
  ): Goal {
    const goal =
      this.goals.get(
        goalId,
      );

    if (
      !goal
    ) {
      throw new Error(
        `Unknown goal "${goalId}".`,
      );
    }

    return goal;
  }

  private assertGoalIdAvailable(
    goalId:
      string,
  ): void {
    if (
      this.goals.has(
        goalId,
      )
    ) {
      throw new Error(
        `Goal "${goalId}" already exists.`,
      );
    }
  }

  private nextId():
    string {
    this.sequence +=
      1;

    return (
      "hierarchy-goal-" +
      this.sequence
    );
  }
}

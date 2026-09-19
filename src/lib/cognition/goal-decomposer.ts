import type {
  EnvironmentScalar,
  EnvironmentSnapshot,
} from "./environment";

import type {
  CausalRule,
  WorldModel,
} from "./world-model";

export interface DecomposedGoal {
  id: string;

  conditions:
    EnvironmentSnapshot;

  description: string;

  action: string;

  basisRuleId: string;

  confidence: number;

  dependsOnGoalIds:
    string[];
}

export interface AutonomousGoalDecomposition {
  goals:
    DecomposedGoal[];

  goalConditions:
    EnvironmentSnapshot;

  confidence:
    number;
}

export interface AutonomousGoalDecomposerOptions {
  minConfidence?:
    number;

  maxDepth?:
    number;
}

interface ProtoGoal {
  signature: string;

  key: string;

  value:
    EnvironmentScalar;

  action: string;

  basisRuleId: string;

  confidence: number;

  dependencySignatures:
    string[];
}

interface Resolution {
  goals:
    Map<
      string,
      ProtoGoal
    >;

  targetSignature?:
    string;

  confidence:
    number;
}

interface CandidateResolution
  extends Resolution {
  action: string;

  basisRuleId: string;

  cost: number;
}

function conditionSignature(
  key:
    string,

  value:
    EnvironmentScalar,
): string {
  return JSON.stringify([
    key,
    value,
  ]);
}

function conditionSatisfied(
  state:
    EnvironmentSnapshot,

  key:
    string,

  value:
    EnvironmentScalar,
): boolean {
  return Object.is(
    state[key],
    value,
  );
}

function ruleEstablishes(
  rule:
    CausalRule,

  key:
    string,

  value:
    EnvironmentScalar,
): boolean {
  return rule.effects.some(
    (effect) =>
      effect.key ===
        key &&
      Object.is(
        effect.after,
        value,
      ),
  );
}

function uniqueEntries(
  entries:
    Array<
      [
        string,
        EnvironmentScalar
      ]
    >,
): Array<
  [
    string,
    EnvironmentScalar
  ]
> {
  const seen =
    new Set<string>();

  const result:
    Array<
      [
        string,
        EnvironmentScalar
      ]
    > = [];

  for (
    const [
      key,
      value,
    ] of entries
  ) {
    const signature =
      conditionSignature(
        key,
        value,
      );

    if (
      seen.has(
        signature,
      )
    ) {
      continue;
    }

    seen.add(
      signature,
    );

    result.push([
      key,
      value,
    ]);
  }

  return result;
}

function cloneGoals(
  goals:
    Map<
      string,
      ProtoGoal
    >,
): Map<
  string,
  ProtoGoal
> {
  return new Map(
    Array.from(
      goals.entries(),
    ).map(
      ([
        signature,
        goal,
      ]) => [
        signature,
        {
          ...goal,

          dependencySignatures: [
            ...goal
              .dependencySignatures,
          ],
        },
      ],
    ),
  );
}

function mergeGoals(
  target:
    Map<
      string,
      ProtoGoal
    >,

  source:
    Map<
      string,
      ProtoGoal
    >,
): void {
  for (
    const [
      signature,
      goal,
    ] of source
  ) {
    const existing =
      target.get(
        signature,
      );

    if (
      !existing ||
      goal.confidence >
        existing.confidence
    ) {
      target.set(
        signature,
        {
          ...goal,

          dependencySignatures: [
            ...goal
              .dependencySignatures,
          ],
        },
      );
    }
  }
}

function sortedRules(
  rules:
    readonly CausalRule[],
): CausalRule[] {
  return [
    ...rules,
  ].sort(
    (
      left,
      right,
    ) => {
      if (
        right.confidence !==
        left.confidence
      ) {
        return (
          right.confidence -
          left.confidence
        );
      }

      if (
        right.supportCount !==
        left.supportCount
      ) {
        return (
          right.supportCount -
          left.supportCount
        );
      }

      if (
        left.scope !==
        right.scope
      ) {
        return left.scope ===
          "exact"
          ? -1
          : 1;
      }

      if (
        left.action !==
        right.action
      ) {
        return left.action.localeCompare(
          right.action,
        );
      }

      return left.id.localeCompare(
        right.id,
      );
    },
  );
}

function describeCondition(
  key:
    string,

  value:
    EnvironmentScalar,
): string {
  return (
    "Make " +
    key +
    " equal " +
    String(
      value,
    ) +
    "."
  );
}

/**
 * Mabojolu G Autonomous Goal Decomposer v0.2.
 *
 * This module works backward from desired observable conditions through the
 * learned causal world model. It is deliberately independent of the forward
 * action planner.
 *
 * For every desired condition it asks:
 *
 * 1. Is the condition already true?
 * 2. Which learned causal rules can establish it?
 * 3. What observable conditions must be true before that rule can work?
 * 4. Which of those prerequisite conditions are themselves unmet?
 * 5. Can those prerequisites be established recursively?
 *
 * The result is an explicit dependency graph of subgoals with evidence-backed
 * actions. No language model and no hidden environment implementation are used.
 */
export class AutonomousGoalDecomposer {
  private readonly minConfidence:
    number;

  private readonly maxDepth:
    number;

  constructor(
    private readonly worldModel:
      WorldModel,

    options:
      AutonomousGoalDecomposerOptions =
        {},
  ) {
    this.minConfidence =
      options.minConfidence ??
      0.5;

    this.maxDepth =
      options.maxDepth ??
      8;
  }

  decompose(input: {
    currentState:
      EnvironmentSnapshot;

    goalConditions:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];

    excludedRuleIds?:
      readonly string[];
  }):
    AutonomousGoalDecomposition |
    undefined {
    const available =
      new Set(
        input.availableActions,
      );

    const excluded =
      new Set(
        input.excludedRuleIds ??
        [],
      );

    const rules =
      sortedRules(
        this.worldModel
          .getRules()
          .filter(
            (rule) =>
              rule.confidence >=
                this.minConfidence &&
              available.has(
                rule.action,
              ) &&
              !excluded.has(
                rule.id,
              ),
          ),
      );

    const mergedGoals =
      new Map<
        string,
        ProtoGoal
      >();

    let confidence =
      1;

    for (
      const [
        key,
        value,
      ] of Object.entries(
        input.goalConditions,
      )
    ) {
      if (
        conditionSatisfied(
          input.currentState,
          key,
          value,
        )
      ) {
        continue;
      }

      const resolution =
        this.resolveCondition({
          key,
          value,
          currentState:
            input.currentState,
          rules,
          depth:
            0,
          path:
            new Set(),
        });

      if (
        !resolution
      ) {
        return undefined;
      }

      mergeGoals(
        mergedGoals,
        resolution.goals,
      );

      confidence =
        Math.min(
          confidence,
          resolution
            .confidence,
        );
    }

    const ordered =
      this.topologicalOrder(
        mergedGoals,
      );

    if (
      !ordered
    ) {
      return undefined;
    }

    const idBySignature =
      new Map<
        string,
        string
      >();

    ordered.forEach(
      (
        goal,
        index,
      ) => {
        idBySignature.set(
          goal.signature,
          "autonomous-subgoal-" +
            (index + 1),
        );
      },
    );

    const goals:
      DecomposedGoal[] =
        ordered.map(
          (goal) => ({
            id:
              idBySignature.get(
                goal.signature,
              ) ??
              goal.signature,

            conditions: {
              [goal.key]:
                goal.value,
            },

            description:
              describeCondition(
                goal.key,
                goal.value,
              ),

            action:
              goal.action,

            basisRuleId:
              goal.basisRuleId,

            confidence:
              goal.confidence,

            dependsOnGoalIds:
              goal
                .dependencySignatures
                .map(
                  (signature) =>
                    idBySignature.get(
                      signature,
                    ),
                )
                .filter(
                  (
                    id,
                  ): id is string =>
                    Boolean(id),
                ),
          }),
        );

    return {
      goals,

      goalConditions: {
        ...input
          .goalConditions,
      },

      confidence,
    };
  }

  private resolveCondition(input: {
    key: string;

    value:
      EnvironmentScalar;

    currentState:
      EnvironmentSnapshot;

    rules:
      readonly CausalRule[];

    depth:
      number;

    path:
      Set<string>;
  }):
    Resolution |
    undefined {
    const signature =
      conditionSignature(
        input.key,
        input.value,
      );

    if (
      conditionSatisfied(
        input.currentState,
        input.key,
        input.value,
      )
    ) {
      return {
        goals:
          new Map(),

        confidence:
          1,
      };
    }

    if (
      input.depth >=
        this.maxDepth ||
      input.path.has(
        signature,
      )
    ) {
      return undefined;
    }

    const nextPath =
      new Set(
        input.path,
      );

    nextPath.add(
      signature,
    );

    const candidates =
      input.rules.filter(
        (rule) =>
          ruleEstablishes(
            rule,
            input.key,
            input.value,
          ),
      );

    let best:
      CandidateResolution |
      undefined;

    for (
      const rule of
        candidates
    ) {
      const modifiedKeys =
        new Set(
          rule.effects.map(
            (effect) =>
              effect.key,
          ),
        );

      const prerequisites:
        Array<
          [
            string,
            EnvironmentScalar
          ]
        > =
          Object.entries(
            rule.conditions,
          )
            .filter(
              ([key]) =>
                !modifiedKeys.has(
                  key,
                ),
            );

      const targetEffect =
        rule.effects.find(
          (effect) =>
            effect.key ===
              input.key &&
            Object.is(
              effect.after,
              input.value,
            ),
        );

      if (
        targetEffect
          ?.before !==
        undefined &&
        !conditionSatisfied(
          input.currentState,
          input.key,
          targetEffect.before,
        )
      ) {
        prerequisites.push([
          input.key,
          targetEffect.before,
        ]);
      }

      const uniquePrerequisites =
        uniqueEntries(
          prerequisites,
        );

      const branchGoals =
        new Map<
          string,
          ProtoGoal
        >();

      const dependencySignatures:
        string[] = [];

      let branchConfidence =
        rule.confidence;

      let failed =
        false;

      for (
        const [
          prerequisiteKey,
          prerequisiteValue,
        ] of uniquePrerequisites
      ) {
        if (
          conditionSatisfied(
            input.currentState,
            prerequisiteKey,
            prerequisiteValue,
          )
        ) {
          continue;
        }

        const prerequisite =
          this.resolveCondition({
            key:
              prerequisiteKey,

            value:
              prerequisiteValue,

            currentState:
              input.currentState,

            rules:
              input.rules,

            depth:
              input.depth +
              1,

            path:
              nextPath,
          });

        if (
          !prerequisite
        ) {
          failed =
            true;
          break;
        }

        mergeGoals(
          branchGoals,
          prerequisite.goals,
        );

        if (
          prerequisite
            .targetSignature
        ) {
          dependencySignatures.push(
            prerequisite
              .targetSignature,
          );
        }

        branchConfidence =
          Math.min(
            branchConfidence,
            prerequisite
              .confidence,
          );
      }

      if (
        failed
      ) {
        continue;
      }

      branchGoals.set(
        signature,
        {
          signature,

          key:
            input.key,

          value:
            input.value,

          action:
            rule.action,

          basisRuleId:
            rule.id,

          confidence:
            rule.confidence,

          dependencySignatures:
            Array.from(
              new Set(
                dependencySignatures,
              ),
            ),
        },
      );

      const candidate:
        CandidateResolution = {
        goals:
          branchGoals,

        targetSignature:
          signature,

        confidence:
          branchConfidence,

        action:
          rule.action,

        basisRuleId:
          rule.id,

        cost:
          branchGoals.size,
      };

      if (
        !best ||
        candidate.cost <
          best.cost ||
        (
          candidate.cost ===
            best.cost &&
          candidate.confidence >
            best.confidence
        ) ||
        (
          candidate.cost ===
            best.cost &&
          candidate.confidence ===
            best.confidence &&
          candidate.action <
            best.action
        ) ||
        (
          candidate.cost ===
            best.cost &&
          candidate.confidence ===
            best.confidence &&
          candidate.action ===
            best.action &&
          candidate.basisRuleId <
            best.basisRuleId
        )
      ) {
        best =
          candidate;
      }
    }

    if (
      !best
    ) {
      return undefined;
    }

    return {
      goals:
        cloneGoals(
          best.goals,
        ),

      targetSignature:
        best.targetSignature,

      confidence:
        best.confidence,
    };
  }

  private topologicalOrder(
    goals:
      Map<
        string,
        ProtoGoal
      >,
  ):
    ProtoGoal[] |
    undefined {
    const remaining =
      cloneGoals(
        goals,
      );

    const emitted =
      new Set<string>();

    const ordered:
      ProtoGoal[] = [];

    while (
      remaining.size >
      0
    ) {
      const ready =
        Array.from(
          remaining.values(),
        )
          .filter(
            (goal) =>
              goal
                .dependencySignatures
                .every(
                  (dependency) =>
                    emitted.has(
                      dependency,
                    ) ||
                    !remaining.has(
                      dependency,
                    ),
                ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.signature
                .localeCompare(
                  right.signature,
                ),
          );

      const next =
        ready[0];

      if (
        !next
      ) {
        return undefined;
      }

      ordered.push(
        next,
      );

      emitted.add(
        next.signature,
      );

      remaining.delete(
        next.signature,
      );
    }

    return ordered;
  }
}

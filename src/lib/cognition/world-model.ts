import {
  diffSnapshots,
  snapshotSignature,
  type EnvironmentScalar,
  type EnvironmentSnapshot,
  type SnapshotChange,
} from "./environment";

export interface WorldModelObservation {
  action: string;

  before:
    EnvironmentSnapshot;

  after:
    EnvironmentSnapshot;

  accepted: boolean;

  observedAt: string;
}

export interface CausalEffect {
  key: string;

  before:
    EnvironmentScalar |
    undefined;

  after:
    EnvironmentScalar |
    undefined;
}

export interface CausalRule {
  id: string;

  action: string;

  /**
   * Observable state under which this rule was learned.
   *
   * World Model v0.1 intentionally keeps the complete observed state rather
   * than pretending it already knows which variables are true prerequisites.
   */
  conditions:
    EnvironmentSnapshot;

  /**
   * Observable changes produced by the action.
   *
   * An empty array represents a learned no-effect rule.
   */
  effects:
    CausalEffect[];

  supportCount:
    number;

  contradictionCount:
    number;

  confidence:
    number;

  firstObservedAt:
    string;

  lastObservedAt:
    string;
}

export interface WorldModelPrediction {
  action: string;

  conditions:
    EnvironmentSnapshot;

  effects:
    CausalEffect[];

  confidence:
    number;

  basisRuleId:
    string;
}

function cloneSnapshot(
  snapshot:
    EnvironmentSnapshot,
): EnvironmentSnapshot {
  return {
    ...snapshot,
  };
}

function cloneEffect(
  effect:
    CausalEffect,
): CausalEffect {
  return {
    ...effect,
  };
}

function cloneRule(
  rule:
    CausalRule,
): CausalRule {
  return {
    ...rule,

    conditions:
      cloneSnapshot(
        rule.conditions,
      ),

    effects:
      rule.effects.map(
        cloneEffect,
      ),
  };
}

function effectsFromChanges(
  changes:
    SnapshotChange[],
): CausalEffect[] {
  return changes.map(
    (change) => ({
      key:
        change.key,

      before:
        change.before,

      after:
        change.after,
    }),
  );
}

function effectSignature(
  effects:
    CausalEffect[],
): string {
  return JSON.stringify(
    effects.map(
      (effect) => [
        effect.key,
        effect.before,
        effect.after,
      ],
    ),
  );
}

function sameEffects(
  left:
    CausalEffect[],

  right:
    CausalEffect[],
): boolean {
  return (
    effectSignature(
      left,
    ) ===
    effectSignature(
      right,
    )
  );
}

function confidenceFor(
  supportCount:
    number,

  contradictionCount:
    number,
): number {
  /*
   * Laplace-style smoothing prevents one observation from becoming certainty.
   *
   * 1 support, 0 contradictions -> 0.667
   * 2 support, 0 contradictions -> 0.75
   */
  return (
    supportCount + 1
  ) / (
    supportCount +
    contradictionCount +
    2
  );
}

/**
 * Mabojolu G World Model v0.1.
 *
 * The model learns explicit:
 *
 * observable state + action -> observable consequence
 *
 * relationships.
 *
 * It does not store hidden reasoning and does not infer unobserved causal
 * structure. Generalization across partially matching states belongs to a
 * later world-model version after we have evidence that such generalization is
 * justified.
 */
export class WorldModel {
  private readonly rules:
    CausalRule[] = [];

  private sequence = 0;

  observeTransition(
    observation:
      WorldModelObservation,
  ): CausalRule | undefined {
    if (
      !observation.accepted
    ) {
      return undefined;
    }

    const conditions =
      cloneSnapshot(
        observation.before,
      );

    const effects =
      effectsFromChanges(
        diffSnapshots(
          observation.before,
          observation.after,
        ),
      );

    const conditionSignature =
      snapshotSignature(
        conditions,
      );

    const matchingConditionRules =
      this.rules.filter(
        (rule) =>
          rule.action ===
            observation.action &&
          snapshotSignature(
            rule.conditions,
          ) ===
            conditionSignature,
      );

    const existing =
      matchingConditionRules.find(
        (rule) =>
          sameEffects(
            rule.effects,
            effects,
          ),
      );

    /*
     * Any different observed consequence under exactly the same observable
     * state contradicts previously learned alternatives.
     */
    for (
      const rule of
        matchingConditionRules
    ) {
      if (
        existing &&
        rule.id ===
          existing.id
      ) {
        continue;
      }

      if (
        sameEffects(
          rule.effects,
          effects,
        )
      ) {
        continue;
      }

      rule.contradictionCount +=
        1;

      rule.confidence =
        confidenceFor(
          rule.supportCount,
          rule.contradictionCount,
        );

      rule.lastObservedAt =
        observation.observedAt;
    }

    if (existing) {
      existing.supportCount +=
        1;

      existing.confidence =
        confidenceFor(
          existing.supportCount,
          existing
            .contradictionCount,
        );

      existing.lastObservedAt =
        observation.observedAt;

      return cloneRule(
        existing,
      );
    }

    this.sequence += 1;

    const rule:
      CausalRule = {
      id:
        `causal-rule-${this.sequence}`,

      action:
        observation.action,

      conditions,

      effects,

      supportCount: 1,

      contradictionCount:
        0,

      confidence:
        confidenceFor(
          1,
          0,
        ),

      firstObservedAt:
        observation.observedAt,

      lastObservedAt:
        observation.observedAt,
    };

    this.rules.push(
      rule,
    );

    return cloneRule(
      rule,
    );
  }

  predict(
    action: string,

    currentState:
      EnvironmentSnapshot,
  ):
    WorldModelPrediction |
    undefined {
    const signature =
      snapshotSignature(
        currentState,
      );

    const candidates =
      this.rules
        .filter(
          (rule) =>
            rule.action ===
              action &&
            snapshotSignature(
              rule.conditions,
            ) ===
              signature,
        )
        .sort(
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

            return (
              right.id.localeCompare(
                left.id,
              )
            );
          },
        );

    const best =
      candidates[0];

    if (!best) {
      return undefined;
    }

    return {
      action:
        best.action,

      conditions:
        cloneSnapshot(
          best.conditions,
        ),

      effects:
        best.effects.map(
          cloneEffect,
        ),

      confidence:
        best.confidence,

      basisRuleId:
        best.id,
    };
  }

  getRules():
    readonly CausalRule[] {
    return this.rules.map(
      cloneRule,
    );
  }
}
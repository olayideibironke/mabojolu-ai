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

export type CausalRuleScope =
  | "exact"
  | "generalized";

export interface CausalVariation {
  /**
   * State variable observed to vary while the same causal effect remained
   * stable.
   */
  key: string;

  /**
   * World Model v0.2 does not extrapolate beyond values actually observed.
   */
  observedValues:
    EnvironmentScalar[];
}

export interface CausalRule {
  id: string;

  action: string;

  scope:
    CausalRuleScope;

  /**
   * Conditions that remained stable across the evidence supporting this rule.
   *
   * Exact rules contain the complete observed state.
   *
   * Generalized rules retain only conditions that have not yet been shown to
   * be irrelevant.
   */
  conditions:
    EnvironmentSnapshot;

  /**
   * Variables demonstrated to vary while preserving the same effect.
   */
  variations:
    CausalVariation[];

  effects:
    CausalEffect[];

  supportCount:
    number;

  contradictionCount:
    number;

  confidence:
    number;

  /**
   * Exact evidence from which this rule was derived.
   */
  sourceRuleIds:
    string[];

  firstObservedAt:
    string;

  lastObservedAt:
    string;
}

export interface WorldModelPrediction {
  action: string;

  scope:
    CausalRuleScope;

  conditions:
    EnvironmentSnapshot;

  variations:
    CausalVariation[];

  effects:
    CausalEffect[];

  confidence:
    number;

  basisRuleId:
    string;
}

const MIN_GENERALIZATION_STATES =
  3;

const GENERALIZATION_CONFIDENCE_FACTOR =
  0.9;

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

function cloneVariation(
  variation:
    CausalVariation,
): CausalVariation {
  return {
    key:
      variation.key,

    observedValues: [
      ...variation
        .observedValues,
    ],
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

    variations:
      rule.variations.map(
        cloneVariation,
      ),

    effects:
      rule.effects.map(
        cloneEffect,
      ),

    sourceRuleIds: [
      ...rule
        .sourceRuleIds,
    ],
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

function encodeEffectValue(
  value:
    EnvironmentScalar |
    undefined,
): string {
  if (
    value === undefined
  ) {
    return "undefined";
  }

  return JSON.stringify([
    "value",
    value,
  ]);
}

function effectSignature(
  effects:
    CausalEffect[],
): string {
  return JSON.stringify(
    effects.map(
      (effect) => [
        effect.key,
        encodeEffectValue(
          effect.before,
        ),
        encodeEffectValue(
          effect.after,
        ),
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
   */
  return (
    supportCount + 1
  ) / (
    supportCount +
    contradictionCount +
    2
  );
}

function generalizedConfidenceFor(
  supportCount:
    number,

  contradictionCount:
    number,
): number {
  /*
   * Generalized claims remain less certain than equally supported exact
   * observations because abstraction introduces additional inference.
   */
  return (
    confidenceFor(
      supportCount,
      contradictionCount,
    ) *
    GENERALIZATION_CONFIDENCE_FACTOR
  );
}

function scalarIncluded(
  values:
    readonly EnvironmentScalar[],

  candidate:
    EnvironmentScalar |
    undefined,
): boolean {
  if (
    candidate === undefined
  ) {
    return false;
  }

  return values.some(
    (value) =>
      Object.is(
        value,
        candidate,
      ),
  );
}

function uniqueScalars(
  values:
    EnvironmentScalar[],
): EnvironmentScalar[] {
  const unique:
    EnvironmentScalar[] = [];

  for (
    const value of values
  ) {
    if (
      !scalarIncluded(
        unique,
        value,
      )
    ) {
      unique.push(
        value,
      );
    }
  }

  return unique;
}

function sortedKeys(
  snapshot:
    EnvironmentSnapshot,
): string[] {
  return Object.keys(
    snapshot,
  ).sort();
}

function sameStateShape(
  snapshots:
    EnvironmentSnapshot[],
): boolean {
  if (
    snapshots.length === 0
  ) {
    return false;
  }

  const first =
    JSON.stringify(
      sortedKeys(
        snapshots[0],
      ),
    );

  return snapshots.every(
    (snapshot) =>
      JSON.stringify(
        sortedKeys(
          snapshot,
        ),
      ) === first,
  );
}

function deriveCommonConditions(
  snapshots:
    EnvironmentSnapshot[],
): EnvironmentSnapshot {
  const first =
    snapshots[0];

  if (
    !first
  ) {
    return {};
  }

  const conditions:
    EnvironmentSnapshot = {};

  for (
    const key of
      sortedKeys(
        first,
      )
  ) {
    const value =
      first[key];

    const remainsConstant =
      snapshots.every(
        (snapshot) =>
          Object.is(
            snapshot[key],
            value,
          ),
      );

    if (
      remainsConstant
    ) {
      conditions[key] =
        value;
    }
  }

  return conditions;
}

function deriveVariations(
  snapshots:
    EnvironmentSnapshot[],

  conditions:
    EnvironmentSnapshot,
): CausalVariation[] {
  const first =
    snapshots[0];

  if (
    !first
  ) {
    return [];
  }

  return sortedKeys(
    first,
  )
    .filter(
      (key) =>
        !(key in
          conditions),
    )
    .map(
      (key) => ({
        key,

        observedValues:
          uniqueScalars(
            snapshots.map(
              (snapshot) =>
                snapshot[key],
            ),
          ),
      }),
    );
}

function conditionsMatch(
  conditions:
    EnvironmentSnapshot,

  state:
    EnvironmentSnapshot,
): boolean {
  return Object.entries(
    conditions,
  ).every(
    ([key, value]) =>
      Object.is(
        state[key],
        value,
      ),
  );
}

function effectsCanApply(
  effects:
    CausalEffect[],

  state:
    EnvironmentSnapshot,
): boolean {
  return effects.every(
    (effect) =>
      Object.is(
        state[
          effect.key
        ],
        effect.before,
      ),
  );
}

function generalizedStateMatches(
  rule:
    CausalRule,

  state:
    EnvironmentSnapshot,
): boolean {
  if (
    rule.scope !==
    "generalized"
  ) {
    return false;
  }

  const modeledKeys =
    [
      ...Object.keys(
        rule.conditions,
      ),

      ...rule.variations.map(
        (variation) =>
          variation.key,
      ),
    ].sort();

  /*
   * Unknown state variables are not silently treated as irrelevant.
   */
  if (
    JSON.stringify(
      modeledKeys,
    ) !==
    JSON.stringify(
      sortedKeys(
        state,
      ),
    )
  ) {
    return false;
  }

  if (
    !conditionsMatch(
      rule.conditions,
      state,
    )
  ) {
    return false;
  }

  for (
    const variation of
      rule.variations
  ) {
    if (
      !scalarIncluded(
        variation
          .observedValues,
        state[
          variation.key
        ],
      )
    ) {
      return false;
    }
  }

  return effectsCanApply(
    rule.effects,
    state,
  );
}

function ruleSort(
  left:
    CausalRule,

  right:
    CausalRule,
): number {
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
}

/**
 * Mabojolu G World Model v0.2.
 *
 * Exact causal knowledge:
 *
 * complete observed state + action -> observed consequence
 *
 * Generalized causal knowledge:
 *
 * stable conditions + demonstrated variations + action -> observed consequence
 *
 * Generalization is deliberately conservative:
 *
 * - at least three distinct states must support the same effect;
 * - only variables actually observed to vary are relaxed;
 * - only observed values of relaxed variables are accepted;
 * - unseen state variables invalidate the generalization;
 * - exact evidence always outranks generalized inference;
 * - contradictory observations reduce generalized confidence.
 */
export class WorldModel {
  private readonly exactRules:
    CausalRule[] = [];

  private generalizedRules:
    CausalRule[] = [];

  private exactSequence = 0;

  private generalizationSequence =
    0;

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
      this.exactRules.filter(
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

    if (
      existing
    ) {
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

      this.rebuildGeneralizations();

      return cloneRule(
        existing,
      );
    }

    this.exactSequence +=
      1;

    const id =
      "causal-rule-" +
      this.exactSequence;

    const rule:
      CausalRule = {
      id,

      action:
        observation.action,

      scope:
        "exact",

      conditions,

      variations: [],

      effects,

      supportCount: 1,

      contradictionCount:
        0,

      confidence:
        confidenceFor(
          1,
          0,
        ),

      sourceRuleIds: [
        id,
      ],

      firstObservedAt:
        observation.observedAt,

      lastObservedAt:
        observation.observedAt,
    };

    this.exactRules.push(
      rule,
    );

    this.rebuildGeneralizations();

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

    /*
     * Direct evidence always outranks abstraction.
     */
    const exactCandidates =
      this.exactRules
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
          ruleSort,
        );

    const exact =
      exactCandidates[0];

    if (
      exact
    ) {
      return this.toPrediction(
        exact,
      );
    }

    const generalized =
      this.generalizedRules
        .filter(
          (rule) =>
            rule.action ===
              action &&
            generalizedStateMatches(
              rule,
              currentState,
            ),
        )
        .sort(
          ruleSort,
        )[0];

    if (
      !generalized
    ) {
      return undefined;
    }

    return this.toPrediction(
      generalized,
    );
  }

  getRules():
    readonly CausalRule[] {
    return [
      ...this.exactRules,
      ...this.generalizedRules,
    ].map(
      cloneRule,
    );
  }

  private toPrediction(
    rule:
      CausalRule,
  ): WorldModelPrediction {
    return {
      action:
        rule.action,

      scope:
        rule.scope,

      conditions:
        cloneSnapshot(
          rule.conditions,
        ),

      variations:
        rule.variations.map(
          cloneVariation,
        ),

      effects:
        rule.effects.map(
          cloneEffect,
        ),

      confidence:
        rule.confidence,

      basisRuleId:
        rule.id,
    };
  }

  private rebuildGeneralizations():
    void {
    this.generalizedRules =
      [];

    const groups =
      new Map<
        string,
        CausalRule[]
      >();

    for (
      const rule of
        this.exactRules
    ) {
      const key =
        JSON.stringify([
          rule.action,
          effectSignature(
            rule.effects,
          ),
        ]);

      const existing =
        groups.get(
          key,
        ) ?? [];

      existing.push(
        rule,
      );

      groups.set(
        key,
        existing,
      );
    }

    for (
      const sourceRules of
        groups.values()
    ) {
      if (
        sourceRules.length <
        MIN_GENERALIZATION_STATES
      ) {
        continue;
      }

      const snapshots =
        sourceRules.map(
          (rule) =>
            rule.conditions,
        );

      if (
        !sameStateShape(
          snapshots,
        )
      ) {
        continue;
      }

      const conditions =
        deriveCommonConditions(
          snapshots,
        );

      const variations =
        deriveVariations(
          snapshots,
          conditions,
        );

      if (
        variations.length ===
        0
      ) {
        continue;
      }

      const representative =
        sourceRules[0];

      if (
        !representative
      ) {
        continue;
      }

      const supportCount =
        sourceRules.reduce(
          (
            total,
            rule,
          ) =>
            total +
            rule.supportCount,
          0,
        );

      const provisional:
        CausalRule = {
        id:
          "provisional",

        action:
          representative
            .action,

        scope:
          "generalized",

        conditions,

        variations,

        effects:
          representative
            .effects.map(
              cloneEffect,
            ),

        supportCount,

        contradictionCount:
          0,

        confidence:
          0,

        sourceRuleIds:
          sourceRules.map(
            (rule) =>
              rule.id,
          ),

        firstObservedAt:
          sourceRules
            .map(
              (rule) =>
                rule
                  .firstObservedAt,
            )
            .sort()[0],

        lastObservedAt:
          sourceRules
            .map(
              (rule) =>
                rule
                  .lastObservedAt,
            )
            .sort()
            .reverse()[0],
      };

      const contradictionCount =
        this.exactRules
          .filter(
            (rule) =>
              rule.action ===
                provisional.action &&
              !sameEffects(
                rule.effects,
                provisional
                  .effects,
              ) &&
              generalizedStateMatches(
                provisional,
                rule.conditions,
              ),
          )
          .reduce(
            (
              total,
              rule,
            ) =>
              total +
              rule.supportCount,
            0,
          );

      this.generalizationSequence +=
        1;

      const generalized:
        CausalRule = {
        ...provisional,

        id:
          "causal-generalization-" +
          this.generalizationSequence,

        contradictionCount,

        confidence:
          generalizedConfidenceFor(
            supportCount,
            contradictionCount,
          ),
      };

      this.generalizedRules.push(
        generalized,
      );
    }
  }
}

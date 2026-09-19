import {
  ActiveExperimentDesigner,
  type ExperimentHypothesis,
} from "./active-experiment";

import {
  diffSnapshots,
  snapshotSignature,
  type EnvironmentSnapshot,
} from "./environment";

import type {
  CausalEffect,
} from "./world-model";

export type AutonomousHypothesisStatus =
  | "candidate"
  | "supported"
  | "rejected";

export interface AutonomousHypothesisObservation {
  observationId: string;

  action: string;

  before:
    EnvironmentSnapshot;

  after:
    EnvironmentSnapshot;

  accepted: boolean;

  observedAt: string;
}

export interface AutonomousCausalHypothesis {
  id: string;

  action: string;

  /**
   * Candidate prerequisite conditions inferred from contrastive observations.
   */
  conditions:
    EnvironmentSnapshot;

  /**
   * Observable effect the conditions are hypothesized to enable.
   */
  effects:
    CausalEffect[];

  statement: string;

  supportCount:
    number;

  contradictionCount:
    number;

  confidence:
    number;

  status:
    AutonomousHypothesisStatus;

  evidenceForIds:
    string[];

  evidenceAgainstIds:
    string[];

  createdAt: string;

  updatedAt: string;
}

export interface AutonomousExperimentRecommendation {
  action: string;

  informationGain:
    number;

  hypothesisIds:
    string[];

  predictedOutcomes:
    string[];
}

interface StoredObservation
  extends AutonomousHypothesisObservation {
  before:
    EnvironmentSnapshot;

  after:
    EnvironmentSnapshot;
}

interface CandidateDefinition {
  action: string;

  conditions:
    EnvironmentSnapshot;

  effects:
    CausalEffect[];

  createdAt: string;
}

const EPSILON =
  1e-12;

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

function cloneObservation(
  observation:
    AutonomousHypothesisObservation,
): StoredObservation {
  return {
    ...observation,

    before:
      cloneSnapshot(
        observation.before,
      ),

    after:
      cloneSnapshot(
        observation.after,
      ),
  };
}

function cloneHypothesis(
  hypothesis:
    AutonomousCausalHypothesis,
): AutonomousCausalHypothesis {
  return {
    ...hypothesis,

    conditions:
      cloneSnapshot(
        hypothesis.conditions,
      ),

    effects:
      hypothesis.effects.map(
        cloneEffect,
      ),

    evidenceForIds: [
      ...hypothesis
        .evidenceForIds,
    ],

    evidenceAgainstIds: [
      ...hypothesis
        .evidenceAgainstIds,
    ],
  };
}

function effectsFromObservation(
  observation:
    StoredObservation,
): CausalEffect[] {
  return diffSnapshots(
    observation.before,
    observation.after,
  ).map(
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

function encodeValue(
  value:
    unknown,
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
    readonly CausalEffect[],
): string {
  return JSON.stringify(
    effects.map(
      (effect) => [
        effect.key,
        encodeValue(
          effect.before,
        ),
        encodeValue(
          effect.after,
        ),
      ],
    ),
  );
}

function sameEffects(
  left:
    readonly CausalEffect[],

  right:
    readonly CausalEffect[],
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

function conditionSignature(
  conditions:
    EnvironmentSnapshot,
): string {
  return snapshotSignature(
    conditions,
  );
}

function candidateSignature(
  candidate:
    Pick<
      CandidateDefinition,
      | "action"
      | "conditions"
      | "effects"
    >,
): string {
  return JSON.stringify([
    candidate.action,
    conditionSignature(
      candidate.conditions,
    ),
    effectSignature(
      candidate.effects,
    ),
  ]);
}

function confidenceFor(
  supportCount:
    number,

  contradictionCount:
    number,
): number {
  return (
    supportCount + 1
  ) / (
    supportCount +
    contradictionCount +
    2
  );
}

function statusFor(
  supportCount:
    number,

  contradictionCount:
    number,
): AutonomousHypothesisStatus {
  if (
    contradictionCount >
    supportCount
  ) {
    return "rejected";
  }

  if (
    supportCount >= 3 &&
    contradictionCount ===
      0
  ) {
    return "supported";
  }

  return "candidate";
}

function describeConditions(
  conditions:
    EnvironmentSnapshot,
): string {
  return Object.entries(
    conditions,
  )
    .sort(
      ([left], [right]) =>
        left.localeCompare(
          right,
        ),
    )
    .map(
      ([key, value]) =>
        key +
        "=" +
        String(
          value,
        ),
    )
    .join(" AND ");
}

function describeEffects(
  effects:
    readonly CausalEffect[],
): string {
  return effects
    .map(
      (effect) =>
        effect.key +
        ": " +
        String(
          effect.before,
        ) +
        " -> " +
        String(
          effect.after,
        ),
    )
    .join(", ");
}

function uniqueCandidateConditionSets(
  positiveState:
    EnvironmentSnapshot,

  negativeStates:
    readonly EnvironmentSnapshot[],

  effectKeys:
    ReadonlySet<string>,
): EnvironmentSnapshot[] {
  const relevantKeys =
    Object.keys(
      positiveState,
    )
      .filter(
        (key) =>
          !effectKeys.has(
            key,
          ),
      )
      .filter(
        (key) =>
          negativeStates.some(
            (state) =>
              !Object.is(
                state[key],
                positiveState[
                  key
                ],
              ),
          ),
      )
      .sort();

  if (
    relevantKeys.length ===
    0
  ) {
    return [];
  }

  const conditionSets:
    EnvironmentSnapshot[] =
      relevantKeys.map(
        (key) => ({
          [key]:
            positiveState[
              key
            ],
        }),
      );

  if (
    relevantKeys.length >
    1
  ) {
    const conjunction:
      EnvironmentSnapshot = {};

    for (
      const key of
        relevantKeys
    ) {
      conjunction[key] =
        positiveState[
          key
        ];
    }

    conditionSets.push(
      conjunction,
    );
  }

  const seen =
    new Set<string>();

  return conditionSets.filter(
    (conditions) => {
      const signature =
        conditionSignature(
          conditions,
        );

      if (
        seen.has(
          signature,
        )
      ) {
        return false;
      }

      seen.add(
        signature,
      );

      return true;
    },
  );
}

/**
 * Mabojolu G Autonomous Causal Hypothesis Engine v0.1.
 *
 * The engine generates testable prerequisite explanations from contrastive
 * experience:
 *
 * same action + no effect in one state
 * same action + effect in another state
 * -> candidate conditions that may explain the difference.
 *
 * It does not infer hypotheses from one isolated success. It requires
 * contrastive evidence, scores every candidate against all observations for
 * that action, and exposes disagreements to ActiveExperimentDesigner.
 */
export class AutonomousCausalHypothesisEngine {
  private readonly observations:
    StoredObservation[] = [];

  private hypotheses:
    AutonomousCausalHypothesis[] =
      [];

  private readonly idBySignature =
    new Map<
      string,
      string
    >();

  private sequence =
    0;

  private readonly experimentDesigner =
    new ActiveExperimentDesigner();

  observeTransition(
    observation:
      AutonomousHypothesisObservation,
  ):
    readonly AutonomousCausalHypothesis[] {
    this.observations.push(
      cloneObservation(
        observation,
      ),
    );

    this.rebuildHypotheses();

    return this.getHypotheses();
  }

  getHypotheses():
    readonly AutonomousCausalHypothesis[] {
    return this.hypotheses.map(
      cloneHypothesis,
    );
  }

  recommendExperiment(input: {
    currentState:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];
  }):
    AutonomousExperimentRecommendation |
    undefined {
    let best:
      AutonomousExperimentRecommendation |
      undefined;

    const available =
      new Set(
        input.availableActions,
      );

    const actionGroups =
      new Map<
        string,
        AutonomousCausalHypothesis[]
      >();

    for (
      const hypothesis of
        this.hypotheses
    ) {
      if (
        hypothesis.status ===
          "rejected" ||
        !available.has(
          hypothesis.action,
        )
      ) {
        continue;
      }

      const priorObservation =
        this.observations.some(
          (observation) =>
            observation.action ===
              hypothesis.action &&
            snapshotSignature(
              observation.before,
            ) ===
              snapshotSignature(
                input.currentState,
              ),
        );

      if (
        priorObservation
      ) {
        continue;
      }

      const key =
        JSON.stringify([
          hypothesis.action,
          effectSignature(
            hypothesis.effects,
          ),
        ]);

      const group =
        actionGroups.get(
          key,
        ) ?? [];

      group.push(
        hypothesis,
      );

      actionGroups.set(
        key,
        group,
      );
    }

    for (
      const group of
        actionGroups.values()
    ) {
      if (
        group.length <
        2
      ) {
        continue;
      }

      const action =
        group[0]?.action;

      if (
        !action
      ) {
        continue;
      }

      const effectKey =
        "effect:" +
        effectSignature(
          group[0]
            .effects,
        );

      const experimentHypotheses:
        ExperimentHypothesis[] =
          group.map(
            (hypothesis) => ({
              id:
                hypothesis.id,

              confidence:
                hypothesis
                  .confidence,

              predictions: {
                [action]:
                  conditionsMatch(
                    hypothesis
                      .conditions,
                    input
                      .currentState,
                  )
                    ? effectKey
                    : "no-effect",
              },
            }),
          );

      const choice =
        this.experimentDesigner
          .selectExperiment({
            hypotheses:
              experimentHypotheses,

            availableActions: [
              action,
            ],
          });

      if (
        !choice
      ) {
        continue;
      }

      const recommendation:
        AutonomousExperimentRecommendation = {
        action,

        informationGain:
          choice
            .informationGain,

        hypothesisIds:
          group.map(
            (hypothesis) =>
              hypothesis.id,
          ),

        predictedOutcomes: [
          ...choice
            .predictedOutcomes,
        ],
      };

      if (
        !best ||
        recommendation
          .informationGain >
          best.informationGain +
            EPSILON ||
        (
          Math.abs(
            recommendation
              .informationGain -
            best.informationGain,
          ) <=
            EPSILON &&
          recommendation.action <
            best.action
        )
      ) {
        best =
          recommendation;
      }
    }

    return best;
  }

  private rebuildHypotheses():
    void {
    const definitions =
      new Map<
        string,
        CandidateDefinition
      >();

    const accepted =
      this.observations.filter(
        (observation) =>
          observation.accepted,
      );

    const actions =
      Array.from(
        new Set(
          accepted.map(
            (observation) =>
              observation.action,
          ),
        ),
      );

    for (
      const action of actions
    ) {
      const actionObservations =
        accepted.filter(
          (observation) =>
            observation.action ===
            action,
        );

      const negatives =
        actionObservations.filter(
          (observation) =>
            effectsFromObservation(
              observation,
            ).length ===
            0,
        );

      if (
        negatives.length ===
        0
      ) {
        continue;
      }

      const positives =
        actionObservations.filter(
          (observation) =>
            effectsFromObservation(
              observation,
            ).length >
            0,
        );

      for (
        const positive of
          positives
      ) {
        const effects =
          effectsFromObservation(
            positive,
          );

        const effectKeys =
          new Set(
            effects.map(
              (effect) =>
                effect.key,
            ),
          );

        const conditionSets =
          uniqueCandidateConditionSets(
            positive.before,
            negatives.map(
              (negative) =>
                negative.before,
            ),
            effectKeys,
          );

        for (
          const conditions of
            conditionSets
        ) {
          const candidate:
            CandidateDefinition = {
            action,

            conditions,

            effects,

            createdAt:
              positive
                .observedAt,
          };

          definitions.set(
            candidateSignature(
              candidate,
            ),
            candidate,
          );
        }
      }
    }

    const rebuilt:
      AutonomousCausalHypothesis[] =
        [];

    for (
      const [
        signature,
        definition,
      ] of definitions
    ) {
      let id =
        this.idBySignature.get(
          signature,
        );

      if (
        !id
      ) {
        this.sequence +=
          1;

        id =
          "autonomous-hypothesis-" +
          this.sequence;

        this.idBySignature.set(
          signature,
          id,
        );
      }

      const relevant =
        accepted.filter(
          (observation) =>
            observation.action ===
            definition.action,
        );

      const evidenceForIds:
        string[] = [];

      const evidenceAgainstIds:
        string[] = [];

      for (
        const observation of
          relevant
      ) {
        const actualEffects =
          effectsFromObservation(
            observation,
          );

        const actualPositive =
          sameEffects(
            actualEffects,
            definition.effects,
          );

        const predictedPositive =
          conditionsMatch(
            definition
              .conditions,
            observation.before,
          );

        if (
          actualPositive ===
          predictedPositive
        ) {
          evidenceForIds.push(
            observation
              .observationId,
          );
        } else {
          evidenceAgainstIds.push(
            observation
              .observationId,
          );
        }
      }

      const supportCount =
        evidenceForIds.length;

      const contradictionCount =
        evidenceAgainstIds
          .length;

      const previous =
        this.hypotheses.find(
          (hypothesis) =>
            hypothesis.id ===
            id,
        );

      const statement =
        "If " +
        describeConditions(
          definition.conditions,
        ) +
        ", action " +
        definition.action +
        " may produce " +
        describeEffects(
          definition.effects,
        ) +
        ".";

      rebuilt.push({
        id,

        action:
          definition.action,

        conditions:
          cloneSnapshot(
            definition.conditions,
          ),

        effects:
          definition.effects.map(
            cloneEffect,
          ),

        statement,

        supportCount,

        contradictionCount,

        confidence:
          confidenceFor(
            supportCount,
            contradictionCount,
          ),

        status:
          statusFor(
            supportCount,
            contradictionCount,
          ),

        evidenceForIds,

        evidenceAgainstIds,

        createdAt:
          previous
            ?.createdAt ??
          definition
            .createdAt,

        updatedAt:
          relevant
            .map(
              (observation) =>
                observation
                  .observedAt,
            )
            .sort()
            .reverse()[0] ??
          definition
            .createdAt,
      });
    }

    this.hypotheses =
      rebuilt.sort(
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

          return left.id.localeCompare(
            right.id,
          );
        },
      );
  }
}

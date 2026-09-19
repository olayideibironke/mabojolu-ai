import {
  snapshotSignature,
  type EnvironmentSnapshot,
} from "./environment";

import type {
  CausalEffect,
  WorldModel,
} from "./world-model";

export interface PlannedAction {
  action: string;

  effects:
    CausalEffect[];

  confidence:
    number;

  basisRuleId:
    string;

  predictedState:
    EnvironmentSnapshot;
}

export interface WorldModelPlan {
  steps:
    PlannedAction[];

  predictedFinalState:
    EnvironmentSnapshot;

  confidence:
    number;

  exploredStates:
    number;
}

export interface WorldModelPlannerOptions {
  /**
   * Maximum number of hypothetical actions explored in one plan.
   */
  maxDepth?: number;

  /**
   * Rules below this confidence are ignored during planning.
   */
  minConfidence?: number;
}

interface SearchNode {
  state:
    EnvironmentSnapshot;

  steps:
    PlannedAction[];

  confidence:
    number;
}

function cloneSnapshot(
  snapshot:
    EnvironmentSnapshot,
): EnvironmentSnapshot {
  return {
    ...snapshot,
  };
}

function goalSatisfied(
  state:
    EnvironmentSnapshot,

  goalConditions:
    EnvironmentSnapshot,
): boolean {
  return Object.entries(
    goalConditions,
  ).every(
    ([key, value]) =>
      Object.is(
        state[key],
        value,
      ),
  );
}

function applyEffects(
  state:
    EnvironmentSnapshot,

  effects:
    CausalEffect[],
): EnvironmentSnapshot | undefined {
  const next = {
    ...state,
  };

  for (
    const effect of effects
  ) {
    /*
     * Refuse to simulate an effect if the modeled pre-effect value no longer
     * matches the hypothetical state.
     */
    if (
      !Object.is(
        next[
          effect.key
        ],
        effect.before,
      )
    ) {
      return undefined;
    }

    if (
      effect.after ===
      undefined
    ) {
      delete next[
        effect.key
      ];
    } else {
      next[
        effect.key
      ] =
        effect.after;
    }
  }

  return next;
}

/**
 * World-Model-Guided Planner v0.1.
 *
 * The planner performs deterministic breadth-first search through consequences
 * already represented by the learned world model.
 *
 * It does not invent missing rules.
 * It does not call an LLM.
 * It does not inspect hidden environment implementation.
 *
 * If the world model lacks enough causal knowledge to reach the goal, planning
 * fails cleanly and the cognitive runtime returns to experimentation.
 */
export class WorldModelPlanner {
  private readonly maxDepth:
    number;

  private readonly minConfidence:
    number;

  constructor(
    private readonly model:
      WorldModel,

    options:
      WorldModelPlannerOptions =
        {},
  ) {
    this.maxDepth =
      options.maxDepth ??
      8;

    this.minConfidence =
      options.minConfidence ??
      0.5;
  }

  plan(input: {
    currentState:
      EnvironmentSnapshot;

    goalConditions:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];
  }):
    WorldModelPlan |
    undefined {
    const {
      currentState,
      goalConditions,
      availableActions,
    } = input;

    if (
      goalSatisfied(
        currentState,
        goalConditions,
      )
    ) {
      return {
        steps: [],

        predictedFinalState:
          cloneSnapshot(
            currentState,
          ),

        confidence:
          1,

        exploredStates:
          1,
      };
    }

    const initial:
      SearchNode = {
      state:
        cloneSnapshot(
          currentState,
        ),

      steps: [],

      confidence:
        1,
    };

    const queue:
      SearchNode[] = [
      initial,
    ];

    const visited =
      new Set<string>([
        snapshotSignature(
          initial.state,
        ),
      ]);

    let exploredStates =
      0;

    while (
      queue.length > 0
    ) {
      const node =
        queue.shift();

      if (!node) {
        break;
      }

      exploredStates +=
        1;

      if (
        node.steps.length >=
        this.maxDepth
      ) {
        continue;
      }

      for (
        const action of
          availableActions
      ) {
        const prediction =
          this.model.predict(
            action,
            node.state,
          );

        if (
          !prediction ||
          prediction.confidence <
            this.minConfidence
        ) {
          continue;
        }

        /*
         * A learned no-effect rule is useful knowledge, but it cannot advance
         * a causal plan toward a new state.
         */
        if (
          prediction
            .effects
            .length === 0
        ) {
          continue;
        }

        const predictedState =
          applyEffects(
            node.state,
            prediction.effects,
          );

        if (
          !predictedState
        ) {
          continue;
        }

        const currentSignature =
          snapshotSignature(
            node.state,
          );

        const predictedSignature =
          snapshotSignature(
            predictedState,
          );

        if (
          currentSignature ===
          predictedSignature
        ) {
          continue;
        }

        const step:
          PlannedAction = {
          action,

          effects:
            prediction.effects.map(
              (effect) => ({
                ...effect,
              }),
            ),

          confidence:
            prediction.confidence,

          basisRuleId:
            prediction
              .basisRuleId,

          predictedState:
            cloneSnapshot(
              predictedState,
            ),
        };

        const steps = [
          ...node.steps,
          step,
        ];

        const confidence =
          Math.min(
            node.confidence,
            prediction.confidence,
          );

        if (
          goalSatisfied(
            predictedState,
            goalConditions,
          )
        ) {
          return {
            steps,

            predictedFinalState:
              cloneSnapshot(
                predictedState,
              ),

            confidence,

            exploredStates,
          };
        }

        if (
          visited.has(
            predictedSignature,
          )
        ) {
          continue;
        }

        visited.add(
          predictedSignature,
        );

        queue.push({
          state:
            predictedState,

          steps,

          confidence,
        });
      }
    }

    return undefined;
  }
}
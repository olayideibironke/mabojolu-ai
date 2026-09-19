import type {
  AutonomousCausalHypothesis,
  AutonomousCausalHypothesisEngine,
} from "./autonomous-hypothesis";

import {
  snapshotSignature,
  type EnvironmentScalar,
  type EnvironmentSnapshot,
} from "./environment";

import {
  WorldModelPlanner,
  type PlannedAction,
} from "./planner";

import type {
  WorldModel,
} from "./world-model";

export interface ScientificDiscoveryPlan {
  targetState:
    EnvironmentSnapshot;

  setupSteps:
    PlannedAction[];

  probeAction:
    string;

  informationGain:
    number;

  hypothesisIds:
    string[];

  predictedOutcomes:
    string[];

  confidence:
    number;
}

export interface ScientificDiscoveryPlannerOptions {
  maxCandidateStates?: number;

  maxSetupDepth?: number;

  minModelConfidence?: number;
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

function activeHypotheses(
  hypotheses:
    readonly AutonomousCausalHypothesis[],
): AutonomousCausalHypothesis[] {
  return hypotheses.filter(
    (hypothesis) =>
      hypothesis.status !==
      "rejected",
  );
}

function relevantConditionKeys(
  hypotheses:
    readonly AutonomousCausalHypothesis[],
): string[] {
  return Array.from(
    new Set(
      hypotheses.flatMap(
        (hypothesis) =>
          Object.keys(
            hypothesis.conditions,
          ),
      ),
    ),
  ).sort();
}

function valueIncluded(
  values:
    readonly EnvironmentScalar[],

  candidate:
    EnvironmentScalar,
): boolean {
  return values.some(
    (value) =>
      Object.is(
        value,
        candidate,
      ),
  );
}

function candidateDomains(
  keys:
    readonly string[],

  observedValues:
    Readonly<
      Record<
        string,
        EnvironmentScalar[]
      >
    >,

  currentState:
    EnvironmentSnapshot,
): Map<
  string,
  EnvironmentScalar[]
> {
  const domains =
    new Map<
      string,
      EnvironmentScalar[]
    >();

  for (
    const key of keys
  ) {
    const values = [
      ...(
        observedValues[
          key
        ] ??
        []
      ),
    ];

    const current =
      currentState[
        key
      ];

    if (
      current !==
        undefined &&
      !valueIncluded(
        values,
        current,
      )
    ) {
      values.push(
        current,
      );
    }

    domains.set(
      key,
      values,
    );
  }

  return domains;
}

function enumerateCandidateStates(
  currentState:
    EnvironmentSnapshot,

  keys:
    readonly string[],

  domains:
    ReadonlyMap<
      string,
      readonly EnvironmentScalar[]
    >,

  maxCandidateStates:
    number,
): EnvironmentSnapshot[] {
  const results:
    EnvironmentSnapshot[] = [];

  const build = (
    index:
      number,

    state:
      EnvironmentSnapshot,
  ): void => {
    if (
      results.length >=
      maxCandidateStates
    ) {
      return;
    }

    if (
      index >=
      keys.length
    ) {
      results.push(
        cloneSnapshot(
          state,
        ),
      );

      return;
    }

    const key =
      keys[
        index
      ];

    const values =
      domains.get(
        key,
      ) ??
      [];

    for (
      const value of values
    ) {
      build(
        index + 1,
        {
          ...state,

          [key]:
            value,
        },
      );

      if (
        results.length >=
        maxCandidateStates
      ) {
        return;
      }
    }
  };

  build(
    0,
    cloneSnapshot(
      currentState,
    ),
  );

  return results;
}

/**
 * Mabojolu G Multi-Step Scientific Discovery Planner v0.1.
 *
 * The planner asks:
 *
 * 1. Which autonomously generated hypotheses are still plausible?
 * 2. Which already-observed state values can be recombined into a state where
 *    those hypotheses predict different outcomes?
 * 3. Can the learned world model reach that state?
 * 4. What setup sequence reaches it with the fewest modeled actions?
 * 5. Which probe should be executed once there?
 *
 * No arbitrary state values are invented. Candidate experiment states are
 * composed only from values Mabojolu has already observed.
 */
export class ScientificDiscoveryPlanner {
  private readonly planner:
    WorldModelPlanner;

  private readonly maxCandidateStates:
    number;

  constructor(
    worldModel:
      WorldModel,

    private readonly hypothesisEngine:
      AutonomousCausalHypothesisEngine,

    options:
      ScientificDiscoveryPlannerOptions =
        {},
  ) {
    this.maxCandidateStates =
      options.maxCandidateStates ??
      64;

    this.planner =
      new WorldModelPlanner(
        worldModel,
        {
          maxDepth:
            options.maxSetupDepth ??
            8,

          minConfidence:
            options.minModelConfidence ??
            0.5,
        },
      );
  }

  plan(input: {
    currentState:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];
  }):
    ScientificDiscoveryPlan |
    undefined {
    const hypotheses =
      activeHypotheses(
        this.hypothesisEngine
          .getHypotheses(),
      );

    if (
      hypotheses.length <
      2
    ) {
      return undefined;
    }

    const keys =
      relevantConditionKeys(
        hypotheses,
      );

    if (
      keys.length ===
      0
    ) {
      return undefined;
    }

    const domains =
      candidateDomains(
        keys,
        this.hypothesisEngine
          .getObservedValues(),
        input.currentState,
      );

    if (
      keys.some(
        (key) =>
          (
            domains.get(
              key,
            ) ??
            []
          ).length ===
            0,
      )
    ) {
      return undefined;
    }

    const candidates =
      enumerateCandidateStates(
        input.currentState,
        keys,
        domains,
        this.maxCandidateStates,
      );

    let best:
      ScientificDiscoveryPlan |
      undefined;

    for (
      const targetState of
        candidates
    ) {
      const experiment =
        this.hypothesisEngine
          .recommendExperiment({
            currentState:
              targetState,

            availableActions:
              input.availableActions,
          });

      if (
        !experiment
      ) {
        continue;
      }

      const navigation =
        this.planner.plan({
          currentState:
            input.currentState,

          goalConditions:
            targetState,

          availableActions:
            input.availableActions,
        });

      if (
        !navigation
      ) {
        continue;
      }

      const candidate:
        ScientificDiscoveryPlan = {
        targetState:
          cloneSnapshot(
            targetState,
          ),

        setupSteps:
          navigation
            .steps
            .map(
              (step) => ({
                ...step,

                effects:
                  step.effects.map(
                    (effect) => ({
                      ...effect,
                    }),
                  ),

                predictedState:
                  cloneSnapshot(
                    step
                      .predictedState,
                  ),
              }),
            ),

        probeAction:
          experiment.action,

        informationGain:
          experiment
            .informationGain,

        hypothesisIds: [
          ...experiment
            .hypothesisIds,
        ],

        predictedOutcomes: [
          ...experiment
            .predictedOutcomes,
        ],

        confidence:
          navigation
            .confidence,
      };

      if (
        !best ||
        candidate
          .informationGain >
          best.informationGain +
            EPSILON ||
        (
          Math.abs(
            candidate
              .informationGain -
            best.informationGain,
          ) <=
            EPSILON &&
          candidate
            .setupSteps
            .length <
          best.setupSteps
            .length
        ) ||
        (
          Math.abs(
            candidate
              .informationGain -
            best.informationGain,
          ) <=
            EPSILON &&
          candidate
            .setupSteps
            .length ===
          best.setupSteps
            .length &&
          candidate.confidence >
            best.confidence +
              EPSILON
        ) ||
        (
          Math.abs(
            candidate
              .informationGain -
            best.informationGain,
          ) <=
            EPSILON &&
          candidate
            .setupSteps
            .length ===
          best.setupSteps
            .length &&
          Math.abs(
            candidate.confidence -
            best.confidence,
          ) <=
            EPSILON &&
          snapshotSignature(
            candidate
              .targetState,
          ) <
          snapshotSignature(
            best.targetState,
          )
        )
      ) {
        best =
          candidate;
      }
    }

    return best;
  }
}

import {
  diffSnapshots,
  snapshotSignature,
  type CognitiveEnvironment,
  type EnvironmentSnapshot,
  type SnapshotChange,
} from "./environment";

import {
  createCognitiveState,
  reduceCognitiveState,
} from "./state";

import type {
  ActionRecord,
  CognitiveEvent,
  CognitiveState,
  Goal,
  Hypothesis,
  Observation,
} from "./types";

interface ActionAttempt {
  stateSignature: string;

  changedKeys: string[];
}

export interface CognitiveRuntimeOptions {
  /**
   * Maximum number of actions before the experiment stops.
   */
  maxCycles?: number;

  /**
   * Injectable clock keeps experiments reproducible.
   */
  now?: () => string;
}

export interface CognitiveRunResult {
  solved: boolean;

  cycles: number;

  actionHistory: string[];

  state: CognitiveState;
}

/**
 * First active Mabojolu G cognition loop.
 *
 * This version deliberately does not depend on an LLM.
 *
 * The objective is to prove that the surrounding cognitive architecture can:
 *
 * observe
 * experiment
 * detect consequences
 * notice conditional behavior
 * update hypotheses
 * retain learning
 * change future behavior
 */
export class CognitiveRuntime {
  private state:
    CognitiveState;

  private sequence = 0;

  private hasRun = false;

  private readonly attempts =
    new Map<
      string,
      ActionAttempt[]
    >();

  private readonly noEffectHypothesisByAction =
    new Map<
      string,
      string
    >();

  private readonly maxCycles:
    number;

  private readonly clock:
    () => string;

  constructor(
    private readonly environment:
      CognitiveEnvironment,

    options:
      CognitiveRuntimeOptions =
        {},
  ) {
    this.maxCycles =
      options.maxCycles ??
      12;

    this.clock =
      options.now ??
      (() =>
        new Date()
          .toISOString());

    const createdAt =
      this.now();

    this.state =
      createCognitiveState(
        createdAt,
      );

    const goal:
      Goal = {
      id:
        this.nextId(
          "goal",
        ),

      description:
        environment
          .goalDescription,

      priority: 100,

      status:
        "pending",

      successCriteria: [
        environment
          .goalDescription,
      ],

      constraints: [],

      createdAt,

      updatedAt:
        createdAt,
    };

    this.apply({
      type:
        "goal.updated",
      goal,
    });

    this.apply({
      type:
        "goal.activated",

      goalId:
        goal.id,

      occurredAt:
        this.now(),
    });
  }

  run():
    CognitiveRunResult {
    if (this.hasRun) {
      throw new Error(
        "A CognitiveRuntime instance can only be run once.",
      );
    }

    this.hasRun = true;

    let snapshot =
      this.environment
        .observe();

    this.recordObservation(
      snapshot,
      "Initial environment observation.",
    );

    if (
      this.environment
        .isGoalSatisfied()
    ) {
      this.completeGoal();

      return this.result(
        true,
      );
    }

    while (
      this.state.cycle <
      this.maxCycles
    ) {
      const actions =
        this.environment
          .getAvailableActions();

      const action =
        this.chooseAction(
          actions,
          snapshot,
        );

      if (!action) {
        break;
      }

      const before =
        snapshot;

      const beforeSignature =
        snapshotSignature(
          before,
        );

      const actionId =
        this.nextId(
          "action",
        );

      const proposalCreatedAt =
        this.now();

      const selectedAt =
        this.now();

      const proposed:
        ActionRecord = {
        id:
          actionId,

        proposal: {
          id:
            this.nextId(
              "proposal",
            ),

          kind:
            "experiment",

          description:
            `Execute action ${action} and observe the environment.`,

          expectedEffects: [
            "The action may reveal information about the environment.",
          ],

          risk: 0,

          reversible:
            true,

          requiresApproval:
            false,

          createdAt:
            proposalCreatedAt,
        },

        status:
          "selected",

        selectedAt,
      };

      this.apply({
        type:
          "action.updated",

        action:
          proposed,
      });

      const environmentResult =
        this.environment.act(
          action,
        );

      const completedAt =
        this.now();

      const completed:
        ActionRecord = {
        ...proposed,

        status:
          environmentResult
            .accepted
            ? "completed"
            : "failed",

        completedAt,
      };

      this.apply({
        type:
          "action.updated",

        action:
          completed,
      });

      const after =
        this.environment
          .observe();

      const changes =
        diffSnapshots(
          before,
          after,
        );

      const observation =
        this.recordObservation(
          after,
          environmentResult
            .summary,
        );

      this.apply({
        type:
          "outcome.recorded",

        outcome: {
          id:
            this.nextId(
              "outcome",
            ),

          actionId,

          success:
            environmentResult
              .accepted,

          observationIds: [
            observation.id,
          ],

          summary:
            this.describeOutcome(
              action,
              changes,
            ),

          recordedAt:
            this.now(),
        },
      });

      this.learnFromTransition(
        action,
        before,
        after,
        changes,
        observation,
      );

      const attempts =
        this.attempts.get(
          action,
        ) ?? [];

      attempts.push({
        stateSignature:
          beforeSignature,

        changedKeys:
          changes.map(
            (change) =>
              change.key,
          ),
      });

      this.attempts.set(
        action,
        attempts,
      );

      this.apply({
        type:
          "cycle.advanced",

        occurredAt:
          this.now(),
      });

      snapshot =
        after;

      if (
        this.environment
          .isGoalSatisfied()
      ) {
        this.completeGoal();

        return this.result(
          true,
        );
      }
    }

    return this.result(
      this.environment
        .isGoalSatisfied(),
    );
  }

  private chooseAction(
    availableActions:
      readonly string[],

    snapshot:
      EnvironmentSnapshot,
  ): string | undefined {
    const signature =
      snapshotSignature(
        snapshot,
      );

    /*
     * Stage 1:
     *
     * Explore every completely unknown action before repeating actions.
     */
    const neverAttempted =
      availableActions.find(
        (action) =>
          !this.attempts.has(
            action,
          ),
      );

    if (neverAttempted) {
      return neverAttempted;
    }

    /*
     * Stage 2:
     *
     * An action that previously produced no observable effect may depend on
     * hidden preconditions.
     *
     * If the environment has changed since that unsuccessful experiment,
     * retrying it is informative.
     *
     * This is the first primitive form of hypothesis-driven experimentation in
     * Mabojolu G.
     */
    const conditionalCandidate =
      availableActions.find(
        (action) => {
          const attempts =
            this.attempts.get(
              action,
            ) ?? [];

          const hadNoEffect =
            attempts.some(
              (attempt) =>
                attempt
                  .changedKeys
                  .length === 0,
            );

          const triedInCurrentState =
            attempts.some(
              (attempt) =>
                attempt
                  .stateSignature ===
                signature,
            );

          return (
            hadNoEffect &&
            !triedInCurrentState
          );
        },
      );

    if (
      conditionalCandidate
    ) {
      return (
        conditionalCandidate
      );
    }

    /*
     * Stage 3:
     *
     * Continue gathering information by trying actions in observable states in
     * which they have not previously been tested.
     */
    return availableActions.find(
      (action) => {
        const attempts =
          this.attempts.get(
            action,
          ) ?? [];

        return !attempts.some(
          (attempt) =>
            attempt
              .stateSignature ===
            signature,
        );
      },
    );
  }

  private learnFromTransition(
    action: string,

    before:
      EnvironmentSnapshot,

    after:
      EnvironmentSnapshot,

    changes:
      SnapshotChange[],

    observation:
      Observation,
  ): void {
    if (
      changes.length === 0
    ) {
      this.recordNoEffectHypothesis(
        action,
        observation,
      );

      return;
    }

    for (
      const change of changes
    ) {
      this.recordChangeBelief(
        action,
        change,
        observation,
      );

      this.apply({
        type:
          "learning.recorded",

        learning: {
          id:
            this.nextId(
              "learning",
            ),

          kind:
            "rule",

          statement:
            `Action ${action} changed ${change.key} from ${String(
              change.before,
            )} to ${String(
              change.after,
            )}.`,

          confidence:
            0.85,

          derivedFromIds: [
            observation.id,
          ],

          createdAt:
            this.now(),
        },
      });
    }

    const hypothesisId =
      this.noEffectHypothesisByAction
        .get(
          action,
        );

    if (!hypothesisId) {
      return;
    }

    const existing =
      this.state
        .hypotheses
        .find(
          (hypothesis) =>
            hypothesis.id ===
            hypothesisId,
        );

    if (!existing) {
      return;
    }

    const updated:
      Hypothesis = {
      ...existing,

      confidence:
        0.9,

      status:
        "supported",

      evidenceFor: [
        ...existing
          .evidenceFor,

        observation.id,
      ],

      updatedAt:
        this.now(),
    };

    this.apply({
      type:
        "hypothesis.updated",

      hypothesis:
        updated,
    });

    const alreadyLearned =
      this.state
        .learnings
        .some(
          (learning) =>
            learning.statement ===
            `Action ${action} has state-dependent effects.`,
        );

    if (
      !alreadyLearned
    ) {
      this.apply({
        type:
          "learning.recorded",

        learning: {
          id:
            this.nextId(
              "learning",
            ),

          kind:
            "strategy",

          statement:
            `Action ${action} has state-dependent effects.`,

          confidence:
            0.9,

          derivedFromIds: [
            hypothesisId,
            observation.id,
          ],

          createdAt:
            this.now(),
        },
      });
    }

    /*
     * The parameters are intentionally retained here even though the first
     * learning implementation currently derives its statements from `changes`.
     *
     * Future versions will compare full before/after state to infer explicit
     * preconditions.
     */
    void before;
    void after;
  }

  private recordNoEffectHypothesis(
    action: string,

    observation:
      Observation,
  ): void {
    const existingId =
      this.noEffectHypothesisByAction
        .get(
          action,
        );

    if (existingId) {
      const existing =
        this.state
          .hypotheses
          .find(
            (hypothesis) =>
              hypothesis.id ===
              existingId,
          );

      if (!existing) {
        return;
      }

      this.apply({
        type:
          "hypothesis.updated",

        hypothesis: {
          ...existing,

          evidenceFor: [
            ...existing
              .evidenceFor,

            observation.id,
          ],

          updatedAt:
            this.now(),
        },
      });

      return;
    }

    const hypothesis:
      Hypothesis = {
      id:
        this.nextId(
          "hypothesis",
        ),

      statement:
        `Action ${action} may require a different environment state to produce an observable effect.`,

      confidence:
        0.35,

      status:
        "candidate",

      evidenceFor: [
        observation.id,
      ],

      evidenceAgainst:
        [],

      createdAt:
        this.now(),

      updatedAt:
        this.now(),
    };

    this.noEffectHypothesisByAction
      .set(
        action,
        hypothesis.id,
      );

    this.apply({
      type:
        "hypothesis.updated",

      hypothesis,
    });
  }

  private recordChangeBelief(
    action: string,

    change:
      SnapshotChange,

    observation:
      Observation,
  ): void {
    this.apply({
      type:
        "belief.updated",

      belief: {
        id:
          this.nextId(
            "belief",
          ),

        proposition:
          `Action ${action} changed ${change.key} from ${String(
            change.before,
          )} to ${String(
            change.after,
          )}.`,

        confidence:
          0.9,

        status:
          "active",

        evidenceIds: [
          observation.id,
        ],

        updatedAt:
          this.now(),
      },
    });
  }

  private recordObservation(
    snapshot:
      EnvironmentSnapshot,

    context:
      string,
  ): Observation {
    const content =
      `${context} ${this.describeSnapshot(
        snapshot,
      )}`;

    const observation:
      Observation = {
      id:
        this.nextId(
          "observation",
        ),

      source:
        "environment",

      content,

      observedAt:
        this.now(),

      metadata:
        this.snapshotMetadata(
          snapshot,
        ),
    };

    this.apply({
      type:
        "observation.recorded",

      observation,
    });

    return observation;
  }

  private snapshotMetadata(
    snapshot:
      EnvironmentSnapshot,
  ): Record<
    string,
    string | number | boolean | null
  > {
    return {
      ...snapshot,
    };
  }

  private describeSnapshot(
    snapshot:
      EnvironmentSnapshot,
  ): string {
    const state =
      Object.entries(
        snapshot,
      )
        .sort(
          ([left], [right]) =>
            left.localeCompare(
              right,
            ),
        )
        .map(
          ([key, value]) =>
            `${key}=${String(
              value,
            )}`,
        )
        .join(", ");

    return `Observable state: ${state}.`;
  }

  private describeOutcome(
    action: string,

    changes:
      SnapshotChange[],
  ): string {
    if (
      changes.length === 0
    ) {
      return (
        `Action ${action} produced no observable state change.`
      );
    }

    const description =
      changes
        .map(
          (change) =>
            `${change.key}: ${String(
              change.before,
            )} -> ${String(
              change.after,
            )}`,
        )
        .join(", ");

    return (
      `Action ${action} produced observable changes: ${description}.`
    );
  }

  private completeGoal():
    void {
    const activeGoalId =
      this.state
        .activeGoalId;

    if (!activeGoalId) {
      return;
    }

    const goal =
      this.state
        .goals
        .find(
          (candidate) =>
            candidate.id ===
            activeGoalId,
        );

    if (!goal) {
      return;
    }

    this.apply({
      type:
        "goal.updated",

      goal: {
        ...goal,

        status:
          "completed",

        updatedAt:
          this.now(),
      },
    });
  }

  private result(
    solved: boolean,
  ): CognitiveRunResult {
    return {
      solved,

      cycles:
        this.state.cycle,

      actionHistory:
        this.state.actions.map(
          (action) =>
            action.proposal
              .description,
        ),

      state:
        this.state,
    };
  }

  private apply(
    event:
      CognitiveEvent,
  ): void {
    this.state =
      reduceCognitiveState(
        this.state,
        event,
      );
  }

  private nextId(
    prefix: string,
  ): string {
    this.sequence += 1;

    return (
      `${prefix}-${this.sequence}`
    );
  }

  private now():
    string {
    return this.clock();
  }
}
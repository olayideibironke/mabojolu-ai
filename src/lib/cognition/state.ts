import type {
  ActionRecord,
  Belief,
  CognitiveEvent,
  CognitiveState,
  Confidence,
  Goal,
  Hypothesis,
  LearningRecord,
  Observation,
  Outcome,
} from "./types";

/**
 * Mabojolu G cognitive state reducer.
 *
 * State transitions are pure and deterministic:
 *
 * same state + same event = same next state
 *
 * That property is important because cognition experiments must be replayable.
 */

function assertConfidence(
  value: Confidence,
  label: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${label} confidence must be between 0 and 1.`,
    );
  }
}

function assertPriority(
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(
      "Goal priority must be between 0 and 100.",
    );
  }
}

function assertRisk(
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      "Action risk must be between 0 and 1.",
    );
  }
}

function ensureUniqueId<T extends {
  id: string;
}>(
  records: T[],
  id: string,
  label: string,
): void {
  if (
    records.some(
      (record) =>
        record.id === id,
    )
  ) {
    throw new Error(
      `${label} with id "${id}" already exists.`,
    );
  }
}

function replaceById<T extends {
  id: string;
}>(
  records: T[],
  record: T,
): T[] {
  const index =
    records.findIndex(
      (candidate) =>
        candidate.id ===
        record.id,
    );

  if (index === -1) {
    return [
      ...records,
      record,
    ];
  }

  return records.map(
    (candidate) =>
      candidate.id ===
      record.id
        ? record
        : candidate,
  );
}

function validateObservation(
  observation: Observation,
): void {
  if (
    observation.content.trim()
      .length === 0
  ) {
    throw new Error(
      "Observation content cannot be empty.",
    );
  }
}

function validateBelief(
  belief: Belief,
): void {
  if (
    belief.proposition.trim()
      .length === 0
  ) {
    throw new Error(
      "Belief proposition cannot be empty.",
    );
  }

  assertConfidence(
    belief.confidence,
    "Belief",
  );
}

function validateHypothesis(
  hypothesis: Hypothesis,
): void {
  if (
    hypothesis.statement.trim()
      .length === 0
  ) {
    throw new Error(
      "Hypothesis statement cannot be empty.",
    );
  }

  assertConfidence(
    hypothesis.confidence,
    "Hypothesis",
  );
}

function validateGoal(
  goal: Goal,
): void {
  if (
    goal.description.trim()
      .length === 0
  ) {
    throw new Error(
      "Goal description cannot be empty.",
    );
  }

  assertPriority(
    goal.priority,
  );
}

function validateAction(
  action: ActionRecord,
): void {
  if (
    action.proposal.kind.trim()
      .length === 0
  ) {
    throw new Error(
      "Action kind cannot be empty.",
    );
  }

  if (
    action.proposal.description
      .trim().length === 0
  ) {
    throw new Error(
      "Action description cannot be empty.",
    );
  }

  assertRisk(
    action.proposal.risk,
  );
}

function validateOutcome(
  outcome: Outcome,
): void {
  if (
    outcome.summary.trim()
      .length === 0
  ) {
    throw new Error(
      "Outcome summary cannot be empty.",
    );
  }
}

function validateLearning(
  learning: LearningRecord,
): void {
  if (
    learning.statement.trim()
      .length === 0
  ) {
    throw new Error(
      "Learning statement cannot be empty.",
    );
  }

  assertConfidence(
    learning.confidence,
    "Learning",
  );
}

export function createCognitiveState(
  createdAt: string,
): CognitiveState {
  return {
    version: 1,

    cycle: 0,

    observations: [],

    beliefs: [],

    hypotheses: [],

    goals: [],

    actions: [],

    outcomes: [],

    learnings: [],

    createdAt,

    updatedAt:
      createdAt,
  };
}

export function reduceCognitiveState(
  state: CognitiveState,
  event: CognitiveEvent,
): CognitiveState {
  switch (event.type) {
    case "observation.recorded": {
      validateObservation(
        event.observation,
      );

      ensureUniqueId(
        state.observations,
        event.observation.id,
        "Observation",
      );

      return {
        ...state,

        observations: [
          ...state.observations,
          event.observation,
        ],

        updatedAt:
          event.observation
            .observedAt,
      };
    }

    case "belief.updated": {
      validateBelief(
        event.belief,
      );

      return {
        ...state,

        beliefs:
          replaceById(
            state.beliefs,
            event.belief,
          ),

        updatedAt:
          event.belief.updatedAt,
      };
    }

    case "hypothesis.updated": {
      validateHypothesis(
        event.hypothesis,
      );

      return {
        ...state,

        hypotheses:
          replaceById(
            state.hypotheses,
            event.hypothesis,
          ),

        updatedAt:
          event.hypothesis
            .updatedAt,
      };
    }

    case "goal.updated": {
      validateGoal(
        event.goal,
      );

      return {
        ...state,

        goals:
          replaceById(
            state.goals,
            event.goal,
          ),

        updatedAt:
          event.goal.updatedAt,
      };
    }

    case "goal.activated": {
      const goal =
        state.goals.find(
          (candidate) =>
            candidate.id ===
            event.goalId,
        );

      if (!goal) {
        throw new Error(
          `Cannot activate unknown goal "${event.goalId}".`,
        );
      }

      if (
        goal.status ===
          "completed" ||
        goal.status ===
          "abandoned"
      ) {
        throw new Error(
          `Cannot activate goal "${event.goalId}" with status "${goal.status}".`,
        );
      }

      const updatedGoals =
        state.goals.map(
          (candidate) => {
            if (
              candidate.id ===
              event.goalId
            ) {
              return {
                ...candidate,
                status:
                  "active" as const,
                updatedAt:
                  event.occurredAt,
              };
            }

            if (
              candidate.status ===
              "active"
            ) {
              return {
                ...candidate,
                status:
                  "pending" as const,
                updatedAt:
                  event.occurredAt,
              };
            }

            return candidate;
          },
        );

      return {
        ...state,

        goals:
          updatedGoals,

        activeGoalId:
          event.goalId,

        updatedAt:
          event.occurredAt,
      };
    }

    case "action.updated": {
      validateAction(
        event.action,
      );

      return {
        ...state,

        actions:
          replaceById(
            state.actions,
            event.action,
          ),

        updatedAt:
          event.action
            .completedAt ??
          event.action
            .selectedAt ??
          event.action
            .proposal.createdAt,
      };
    }

    case "outcome.recorded": {
      validateOutcome(
        event.outcome,
      );

      ensureUniqueId(
        state.outcomes,
        event.outcome.id,
        "Outcome",
      );

      const actionExists =
        state.actions.some(
          (action) =>
            action.id ===
            event.outcome.actionId,
        );

      if (!actionExists) {
        throw new Error(
          `Outcome references unknown action "${event.outcome.actionId}".`,
        );
      }

      return {
        ...state,

        outcomes: [
          ...state.outcomes,
          event.outcome,
        ],

        updatedAt:
          event.outcome
            .recordedAt,
      };
    }

    case "learning.recorded": {
      validateLearning(
        event.learning,
      );

      ensureUniqueId(
        state.learnings,
        event.learning.id,
        "Learning",
      );

      return {
        ...state,

        learnings: [
          ...state.learnings,
          event.learning,
        ],

        updatedAt:
          event.learning
            .createdAt,
      };
    }

    case "cycle.advanced": {
      return {
        ...state,

        cycle:
          state.cycle + 1,

        updatedAt:
          event.occurredAt,
      };
    }
  }
}
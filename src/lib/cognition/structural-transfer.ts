import {
  ActiveExperimentDesigner,
  type ExperimentHypothesis,
} from "./active-experiment";

import {
  diffSnapshots,
  type EnvironmentSnapshot,
} from "./environment";

import type {
  EpisodeTransition,
} from "./memory";

export interface StructuralTemplate {
  id: string;

  sourceEnvironmentId:
    string;

  /**
   * Number of independent non-goal setup transitions required before the
   * goal-producing action can succeed.
   */
  prerequisiteCount:
    number;

  /**
   * Total action-role cardinality observed in the source environment.
   */
  actionCount:
    number;

  /**
   * Structural transfer begins as a hypothesis, not a fact.
   */
  confidence:
    number;
}

export interface StructuralEpisodeInput {
  environmentId:
    string;

  solved: boolean;

  goalConditions:
    EnvironmentSnapshot;

  availableActions:
    readonly string[];

  transitions:
    readonly EpisodeTransition[];
}

export interface StructuralSessionInput {
  environmentId:
    string;

  initialState:
    EnvironmentSnapshot;

  goalConditions:
    EnvironmentSnapshot;

  availableActions:
    readonly string[];
}

export interface StructuralTransferRecommendation {
  action: string;

  expectedRole:
    | "probe"
    | "setup"
    | "goal";

  sourceTemplateId:
    string;

  confidence:
    number;

  informationGain?:
    number;
}

export interface StructuralTransferUpdate {
  invalidated: boolean;

  reason?:
    string;
}

export interface StructuralTransferSessionState {
  active: boolean;

  sourceTemplateId:
    string;

  setupActionCount:
    number;

  hypothesisCount:
    number;

  goalCandidate?:
    string;

  invalidationReason?:
    string;
}

function cloneTemplate(
  template:
    StructuralTemplate,
): StructuralTemplate {
  return {
    ...template,
  };
}

function singleBooleanGoal(
  goalConditions:
    EnvironmentSnapshot,
): {
  key: string;
  value: true;
} | undefined {
  const entries =
    Object.entries(
      goalConditions,
    );

  if (
    entries.length !==
    1
  ) {
    return undefined;
  }

  const [
    key,
    value,
  ] = entries[0];

  if (
    value !== true
  ) {
    return undefined;
  }

  return {
    key,
    value: true,
  };
}

function falseBooleanNonGoalKeys(
  state:
    EnvironmentSnapshot,

  goalKey:
    string,
): string[] {
  return Object.entries(
    state,
  )
    .filter(
      ([key, value]) =>
        key !==
          goalKey &&
        value ===
          false,
    )
    .map(
      ([key]) =>
        key,
    )
    .sort();
}

function changedExactlyOneSetupVariable(
  transition:
    EpisodeTransition,

  goalKey:
    string,
): string | undefined {
  const changes =
    diffSnapshots(
      transition.before,
      transition.after,
    );

  if (
    changes.length !==
    1
  ) {
    return undefined;
  }

  const change =
    changes[0];

  if (
    change.key ===
      goalKey ||
    change.before !==
      false ||
    change.after !==
      true
  ) {
    return undefined;
  }

  return change.key;
}

function transitionSetsGoal(
  transition:
    EpisodeTransition,

  goalKey:
    string,
): boolean {
  const changes =
    diffSnapshots(
      transition.before,
      transition.after,
    );

  return changes.some(
    (change) =>
      change.key ===
        goalKey &&
      change.before ===
        false &&
      change.after ===
        true,
  );
}

function createRoleHypotheses(
  availableActions:
    readonly string[],
): ExperimentHypothesis[] {
  if (
    availableActions.length ===
    0
  ) {
    return [];
  }

  const confidence =
    1 /
    availableActions.length;

  return availableActions.map(
    (goalAction) => ({
      id:
        "goal-role:" +
        goalAction,

      confidence,

      predictions:
        Object.fromEntries(
          availableActions.map(
            (action) => [
              action,
              action ===
                goalAction
                ? "no-effect"
                : "setup-change",
            ],
          ),
        ),
    }),
  );
}

function goalActionFromHypothesis(
  hypothesis:
    ExperimentHypothesis,
): string | undefined {
  const candidate =
    Object.entries(
      hypothesis.predictions,
    ).find(
      ([, outcome]) =>
        outcome ===
        "no-effect",
    );

  return candidate?.[0];
}

function structuralOutcome(
  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,

  goalKey:
    string,
): string {
  const changes =
    diffSnapshots(
      before,
      after,
    );

  if (
    changes.length ===
    0
  ) {
    return "no-effect";
  }

  const goalChanged =
    changes.some(
      (change) =>
        change.key ===
          goalKey &&
        change.before ===
          false &&
        change.after ===
          true,
    );

  if (
    goalChanged
  ) {
    return "goal-change";
  }

  if (
    changes.length ===
    1
  ) {
    const change =
      changes[0];

    if (
      change.key !==
        goalKey &&
      change.before ===
        false &&
      change.after ===
        true
    ) {
      return "setup-change";
    }
  }

  return "other";
}

/**
 * A live analogy between one learned structural template and a target world.
 *
 * It intentionally does not know the source world's variable names or action
 * labels. It can only infer target roles from target observations.
 *
 * Before a goal role is known, the session maintains explicit competing role
 * hypotheses and asks ActiveExperimentDesigner which target action is expected
 * to reduce uncertainty the most.
 */
export class StructuralTransferSession {
  private readonly setupActionToKey =
    new Map<
      string,
      string
    >();

  private readonly experimentDesigner =
    new ActiveExperimentDesigner();

  private roleHypotheses:
    ExperimentHypothesis[];

  private goalCandidate:
    string |
    undefined;

  private active =
    true;

  private invalidationReason:
    string |
    undefined;

  constructor(
    private readonly template:
      StructuralTemplate,

    private readonly goalKey:
      string,

    availableActions:
      readonly string[],
  ) {
    this.roleHypotheses =
      createRoleHypotheses(
        availableActions,
      );
  }

  recommend(
    availableActions:
      readonly string[],
  ):
    StructuralTransferRecommendation |
    undefined {
    if (
      !this.active
    ) {
      return undefined;
    }

    if (
      !this.goalCandidate
    ) {
      const candidateActions =
        availableActions.filter(
          (action) =>
            !this.setupActionToKey
              .has(
                action,
              ),
        );

      const experiment =
        this.experimentDesigner
          .selectExperiment({
            hypotheses:
              this.roleHypotheses,

            availableActions:
              candidateActions,
          });

      if (
        experiment
      ) {
        return {
          action:
            experiment.action,

          expectedRole:
            "probe",

          sourceTemplateId:
            this.template.id,

          confidence:
            this.template
              .confidence,

          informationGain:
            experiment
              .informationGain,
        };
      }

      if (
        this.roleHypotheses
          .length ===
        1
      ) {
        this.goalCandidate =
          goalActionFromHypothesis(
            this.roleHypotheses[
              0
            ],
          );
      }

      if (
        !this.goalCandidate
      ) {
        return undefined;
      }
    }

    if (
      this.setupActionToKey.size <
      this.template
        .prerequisiteCount
    ) {
      const candidate =
        availableActions.find(
          (action) =>
            action !==
              this.goalCandidate &&
            !this.setupActionToKey
              .has(
                action,
              ),
        );

      if (
        !candidate
      ) {
        return undefined;
      }

      return {
        action:
          candidate,

        expectedRole:
          "setup",

        sourceTemplateId:
          this.template.id,

        confidence:
          this.template
            .confidence,
      };
    }

    if (
      !availableActions.includes(
        this.goalCandidate,
      )
    ) {
      return undefined;
    }

    return {
      action:
        this.goalCandidate,

      expectedRole:
        "goal",

      sourceTemplateId:
        this.template.id,

      confidence:
        this.template
          .confidence,
    };
  }

  observeTransition(input: {
    action: string;

    before:
      EnvironmentSnapshot;

    after:
      EnvironmentSnapshot;

    accepted: boolean;
  }):
    StructuralTransferUpdate {
    if (
      !this.active
    ) {
      return {
        invalidated:
          true,

        reason:
          this.invalidationReason,
      };
    }

    if (
      !input.accepted
    ) {
      return this.invalidate(
        "A transferred structural role produced a rejected action.",
      );
    }

    const changes =
      diffSnapshots(
        input.before,
        input.after,
      );

    if (
      !this.goalCandidate &&
      this.roleHypotheses
        .length >
        1
    ) {
      const update =
        this.experimentDesigner
          .updateHypotheses({
            hypotheses:
              this.roleHypotheses,

            action:
              input.action,

            observedOutcome:
              structuralOutcome(
                input.before,
                input.after,
                this.goalKey,
              ),
          });

      if (
        update.contradiction
      ) {
        return this.invalidate(
          "Target evidence matched none of the active structural-role hypotheses.",
        );
      }

      this.roleHypotheses =
        update.hypotheses;

      if (
        this.roleHypotheses
          .length ===
        1
      ) {
        this.goalCandidate =
          goalActionFromHypothesis(
            this.roleHypotheses[
              0
            ],
          );
      }
    }

    if (
      changes.length ===
      0
    ) {
      if (
        this.goalCandidate ===
          input.action &&
        this.setupActionToKey
          .size >=
          this.template
            .prerequisiteCount
      ) {
        return this.invalidate(
          "The hypothesized goal action still had no effect after all predicted setup roles were satisfied.",
        );
      }

      if (
        this.goalCandidate &&
        this.goalCandidate !==
          input.action
      ) {
        return this.invalidate(
          "More than one target action behaved like the template's single gated goal role.",
        );
      }

      if (
        this.setupActionToKey
          .has(
            input.action,
          )
      ) {
        return this.invalidate(
          "An action previously classified as a setup role later produced no observable effect.",
        );
      }

      this.goalCandidate =
        input.action;

      return {
        invalidated:
          false,
      };
    }

    const goalChanged =
      changes.some(
        (change) =>
          change.key ===
            this.goalKey &&
          change.before ===
            false &&
          change.after ===
            true,
      );

    if (
      goalChanged
    ) {
      if (
        this.goalCandidate &&
        this.goalCandidate !==
          input.action
      ) {
        return this.invalidate(
          "The target goal was achieved by an action different from the hypothesized goal role.",
        );
      }

      this.goalCandidate =
        input.action;

      return {
        invalidated:
          false,
      };
    }

    if (
      changes.length !==
      1
    ) {
      return this.invalidate(
        "The target produced a multi-variable transition not represented by the source structural template.",
      );
    }

    const change =
      changes[0];

    if (
      change.key ===
        this.goalKey ||
      change.before !==
        false ||
      change.after !==
        true
    ) {
      return this.invalidate(
        "The target produced a transition outside the template's boolean setup pattern.",
      );
    }

    if (
      this.goalCandidate ===
        input.action
    ) {
      return this.invalidate(
        "The hypothesized goal action behaved like a setup action.",
      );
    }

    const existingActionForKey =
      Array.from(
        this.setupActionToKey
          .entries(),
      ).find(
        ([, key]) =>
          key ===
          change.key,
      )?.[0];

    if (
      existingActionForKey &&
      existingActionForKey !==
        input.action
    ) {
      return this.invalidate(
        "Multiple actions mapped to the same structural setup variable.",
      );
    }

    const previousKey =
      this.setupActionToKey
        .get(
          input.action,
        );

    if (
      previousKey &&
      previousKey !==
        change.key
    ) {
      return this.invalidate(
        "One target action mapped to multiple structural setup variables.",
      );
    }

    this.setupActionToKey
      .set(
        input.action,
        change.key,
      );

    if (
      this.setupActionToKey
        .size >
      this.template
        .prerequisiteCount
    ) {
      return this.invalidate(
        "The target contains more setup roles than the source structural template.",
      );
    }

    return {
      invalidated:
        false,
    };
  }

  getState():
    StructuralTransferSessionState {
    return {
      active:
        this.active,

      sourceTemplateId:
        this.template.id,

      setupActionCount:
        this.setupActionToKey
          .size,

      hypothesisCount:
        this.roleHypotheses
          .length,

      ...(this.goalCandidate
        ? {
            goalCandidate:
              this.goalCandidate,
          }
        : {}),

      ...(this.invalidationReason
        ? {
            invalidationReason:
              this.invalidationReason,
          }
        : {}),
    };
  }

  private invalidate(
    reason:
      string,
  ):
    StructuralTransferUpdate {
    this.active =
      false;

    this.invalidationReason =
      reason;

    return {
      invalidated:
        true,

      reason,
    };
  }
}

/**
 * Mabojolu G Structural Transfer Library v0.2.
 *
 * This library stores role structure rather than source symbols. A template
 * learned from "power/latch/vaultOpen + A/B/C" can therefore be tested against
 * a target world with different variable names, action labels, environment ID,
 * and goal description.
 *
 * v0.1 deliberately supports one narrow but falsifiable family:
 *
 * N independent boolean setup actions
 * -> one state-gated boolean goal action.
 *
 * Unsupported structures are rejected rather than forced into the analogy.
 */
export class StructuralTransferLibrary {
  private readonly templates:
    StructuralTemplate[] = [];

  private sequence =
    0;

  learnFromEpisode(
    input:
      StructuralEpisodeInput,
  ):
    StructuralTemplate |
    undefined {
    if (
      !input.solved ||
      input.transitions.length ===
        0
    ) {
      return undefined;
    }

    const goal =
      singleBooleanGoal(
        input.goalConditions,
      );

    if (
      !goal
    ) {
      return undefined;
    }

    const initialState =
      input.transitions[0]
        ?.before;

    if (
      !initialState ||
      initialState[
        goal.key
      ] !== false
    ) {
      return undefined;
    }

    let goalTransitionIndex =
      -1;

    for (
      let index =
        input.transitions.length -
        1;
      index >= 0;
      index -= 1
    ) {
      const transition =
        input.transitions[
          index
        ];

      if (
        transition.accepted &&
        transitionSetsGoal(
          transition,
          goal.key,
        )
      ) {
        goalTransitionIndex =
          index;
        break;
      }
    }

    if (
      goalTransitionIndex <
      0
    ) {
      return undefined;
    }

    const goalTransition =
      input.transitions[
        goalTransitionIndex
      ];

    const goalAction =
      goalTransition.action;

    const gatedEvidence =
      input.transitions
        .slice(
          0,
          goalTransitionIndex,
        )
        .some(
          (transition) =>
            transition.accepted &&
            transition.action ===
              goalAction &&
            diffSnapshots(
              transition.before,
              transition.after,
            ).length === 0,
        );

    if (
      !gatedEvidence
    ) {
      return undefined;
    }

    const setupActionToKey =
      new Map<
        string,
        string
      >();

    for (
      const transition of
        input.transitions.slice(
          0,
          goalTransitionIndex,
        )
    ) {
      if (
        !transition.accepted ||
        transition.action ===
          goalAction
      ) {
        continue;
      }

      const setupKey =
        changedExactlyOneSetupVariable(
          transition,
          goal.key,
        );

      if (
        !setupKey
      ) {
        continue;
      }

      const existing =
        setupActionToKey.get(
          transition.action,
        );

      if (
        existing &&
        existing !==
          setupKey
      ) {
        return undefined;
      }

      setupActionToKey.set(
        transition.action,
        setupKey,
      );
    }

    const prerequisiteCount =
      setupActionToKey.size;

    if (
      prerequisiteCount ===
      0
    ) {
      return undefined;
    }

    const setupKeys =
      new Set(
        setupActionToKey
          .values(),
      );

    if (
      setupKeys.size !==
      prerequisiteCount
    ) {
      return undefined;
    }

    const sourcePrerequisiteKeys =
      falseBooleanNonGoalKeys(
        initialState,
        goal.key,
      );

    if (
      sourcePrerequisiteKeys
        .length !==
      prerequisiteCount
    ) {
      return undefined;
    }

    if (
      input.availableActions
        .length !==
      prerequisiteCount +
        1
    ) {
      return undefined;
    }

    if (
      !input.availableActions
        .includes(
          goalAction,
        )
    ) {
      return undefined;
    }

    for (
      const action of
        setupActionToKey.keys()
    ) {
      if (
        !input.availableActions
          .includes(
            action,
          )
      ) {
        return undefined;
      }
    }

    this.sequence +=
      1;

    const template:
      StructuralTemplate = {
      id:
        "structural-template-" +
        this.sequence,

      sourceEnvironmentId:
        input.environmentId,

      prerequisiteCount,

      actionCount:
        input.availableActions
          .length,

      confidence:
        0.65,
    };

    this.templates.push(
      template,
    );

    return cloneTemplate(
      template,
    );
  }

  createSession(
    input:
      StructuralSessionInput,
  ):
    StructuralTransferSession |
    undefined {
    const goal =
      singleBooleanGoal(
        input.goalConditions,
      );

    if (
      !goal ||
      input.initialState[
        goal.key
      ] !== false
    ) {
      return undefined;
    }

    for (
      let index =
        this.templates.length -
        1;
      index >= 0;
      index -= 1
    ) {
      const template =
        this.templates[
          index
        ];

      if (
        template
          .sourceEnvironmentId ===
        input.environmentId
      ) {
        continue;
      }

      if (
        input.availableActions
          .length !==
        template.actionCount
      ) {
        continue;
      }

      const targetPrerequisites =
        falseBooleanNonGoalKeys(
          input.initialState,
          goal.key,
        );

      if (
        targetPrerequisites
          .length !==
        template
          .prerequisiteCount
      ) {
        continue;
      }

      return new StructuralTransferSession(
        template,
        goal.key,
        input.availableActions,
      );
    }

    return undefined;
  }

  getTemplates():
    readonly StructuralTemplate[] {
    return this.templates.map(
      cloneTemplate,
    );
  }
}

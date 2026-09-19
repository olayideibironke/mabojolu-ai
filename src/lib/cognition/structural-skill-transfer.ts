import {
  diffSnapshots,
  type EnvironmentSnapshot,
} from "./environment";

import type {
  AutonomousSkillLibrary,
  CognitiveSkill,
} from "./skill-library";

export type StructuralSkillRole =
  | "setup"
  | "goal";

export interface StructuralSkillRecommendation {
  action:
    string;

  expectedRole:
    StructuralSkillRole;

  sourceSkillId:
    string;

  sourceStepIndex:
    number;

  confidence:
    number;
}

export interface StructuralSkillRoleMapping {
  sourceStepIndex:
    number;

  targetAction:
    string;

  targetEffectKey:
    string;
}

export interface StructuralSkillTransferState {
  active:
    boolean;

  sourceSkillId:
    string;

  stageIndex:
    number;

  mappedRoles:
    StructuralSkillRoleMapping[];

  invalidationReason?:
    string;
}

export interface StructuralSkillTransferUpdate {
  advanced:
    boolean;

  completed:
    boolean;

  invalidated:
    boolean;

  reason?:
    string;
}

interface StructuralSkillCandidate {
  skill:
    CognitiveSkill;

  setupCount:
    number;
}

function singleTrueGoal(
  goalConditions:
    EnvironmentSnapshot,
): string |
  undefined {
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
  ] =
    entries[0];

  return value ===
    true
    ? key
    : undefined;
}

function falseBooleanNonGoalKeys(
  snapshot:
    EnvironmentSnapshot,

  goalKey:
    string,
): string[] {
  return Object.entries(
    snapshot,
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

function structuralCandidate(
  skill:
    CognitiveSkill,
):
  StructuralSkillCandidate |
  undefined {
  if (
    skill.status !==
      "active" ||
    skill.steps.length <
      2
  ) {
    return undefined;
  }

  const goalEntries =
    Object.entries(
      skill.goalEffects,
    );

  if (
    goalEntries.length !==
      1
  ) {
    return undefined;
  }

  const [
    goalKey,
    goalValue,
  ] =
    goalEntries[0];

  if (
    goalValue !==
      true
  ) {
    return undefined;
  }

  const seenEffectKeys:
    string[] = [];

  for (
    let index = 0;
    index <
      skill.steps.length;
    index +=
      1
  ) {
    const step =
      skill.steps[
        index
      ];

    if (
      step.effects.length !==
        1
    ) {
      return undefined;
    }

    const effect =
      step.effects[0];

    if (
      effect.before !==
        false ||
      effect.after !==
        true
    ) {
      return undefined;
    }

    const isLast =
      index ===
      skill.steps.length -
        1;

    if (
      isLast
    ) {
      if (
        effect.key !==
        goalKey
      ) {
        return undefined;
      }
    } else if (
      effect.key ===
        goalKey
    ) {
      return undefined;
    }

    for (
      const priorKey of
        seenEffectKeys
    ) {
      if (
        step.preconditions[
          priorKey
        ] !==
        true
      ) {
        return undefined;
      }
    }

    seenEffectKeys.push(
      effect.key,
    );
  }

  return {
    skill,

    setupCount:
      skill.steps.length -
      1,
  };
}

/**
 * Online structural transfer of an already learned skill.
 *
 * Source action names and source state-variable names are never consulted when
 * selecting target actions. Only the source skill's dependency pattern is used:
 *
 * staged false->true setup effects -> final false->true goal effect.
 *
 * Target evidence discovers which renamed action and renamed state key occupy
 * each role. No-effect probes are stage-local and may become useful at a later
 * prerequisite stage.
 */
export class StructuralSkillTransferSession {
  private active =
    true;

  private stageIndex =
    0;

  private pendingAction:
    string |
    undefined;

  private invalidationReason:
    string |
    undefined;

  private readonly mappedRoles:
    StructuralSkillRoleMapping[] =
      [];

  private readonly rejectedByStage =
    new Map<
      number,
      Set<string>
    >();

  constructor(
    private readonly sourceSkill:
      CognitiveSkill,

    private readonly goalKey:
      string,
  ) {}

  recommend(
    availableActions:
      readonly string[],
  ):
    StructuralSkillRecommendation |
    undefined {
    if (
      !this.active ||
      this.stageIndex >=
        this.sourceSkill
          .steps
          .length
    ) {
      return undefined;
    }

    const mapped =
      new Set(
        this.mappedRoles.map(
          (mapping) =>
            mapping
              .targetAction,
        ),
      );

    const rejected =
      this.rejectedByStage
        .get(
          this.stageIndex,
        ) ??
      new Set<string>();

    const candidates =
      [...availableActions]
        .filter(
          (action) =>
            !mapped.has(
              action,
            ) &&
            !rejected.has(
              action,
            ),
        )
        .sort();

    const candidate =
      candidates[0];

    if (
      !candidate
    ) {
      this.invalidate(
        "No target action remains compatible with the learned skill stage.",
      );

      return undefined;
    }

    this.pendingAction =
      candidate;

    const expectedRole:
      StructuralSkillRole =
        this.stageIndex ===
        this.sourceSkill
          .steps
          .length -
          1
          ? "goal"
          : "setup";

    return {
      action:
        candidate,

      expectedRole,

      sourceSkillId:
        this.sourceSkill.id,

      sourceStepIndex:
        this.stageIndex,

      confidence:
        this.sourceSkill
          .confidence *
        0.85,
    };
  }

  observeTransition(input: {
    action:
      string;

    before:
      EnvironmentSnapshot;

    after:
      EnvironmentSnapshot;

    accepted:
      boolean;
  }):
    StructuralSkillTransferUpdate {
    if (
      !this.active
    ) {
      return {
        advanced:
          false,

        completed:
          false,

        invalidated:
          true,

        reason:
          this.invalidationReason,
      };
    }

    if (
      this.pendingAction &&
      input.action !==
        this.pendingAction
    ) {
      return this.invalidate(
        "The observed target action did not match the structural skill probe.",
      );
    }

    this.pendingAction =
      undefined;

    if (
      !input.accepted
    ) {
      return this.invalidate(
        "A structural skill probe was rejected by the target environment.",
      );
    }

    const changes =
      diffSnapshots(
        input.before,
        input.after,
      );

    const isGoalStage =
      this.stageIndex ===
      this.sourceSkill
        .steps
        .length -
        1;

    if (
      changes.length ===
        0
    ) {
      const rejected =
        this.rejectedByStage
          .get(
            this.stageIndex,
          ) ??
        new Set<string>();

      rejected.add(
        input.action,
      );

      this.rejectedByStage
        .set(
          this.stageIndex,
          rejected,
        );

      return {
        advanced:
          false,

        completed:
          false,

        invalidated:
          false,
      };
    }

    if (
      changes.length !==
        1
    ) {
      return this.invalidate(
        "The target transition changed multiple variables and no longer matches the learned skill structure.",
      );
    }

    const change =
      changes[0];

    if (
      change.before !==
        false ||
      change.after !==
        true
    ) {
      return this.invalidate(
        "The target transition did not match the learned staged false-to-true skill effect.",
      );
    }

    if (
      isGoalStage
    ) {
      if (
        change.key !==
          this.goalKey
      ) {
        return this.invalidate(
          "The final structural skill stage changed a non-goal variable.",
        );
      }
    } else if (
      change.key ===
        this.goalKey
    ) {
      return this.invalidate(
        "The target reached the goal before the learned skill's prerequisite structure was satisfied.",
      );
    }

    this.mappedRoles.push({
      sourceStepIndex:
        this.stageIndex,

      targetAction:
        input.action,

      targetEffectKey:
        change.key,
    });

    this.stageIndex +=
      1;

    const completed =
      this.stageIndex >=
      this.sourceSkill
        .steps
        .length;

    if (
      completed
    ) {
      this.active =
        false;
    }

    return {
      advanced:
        true,

      completed,

      invalidated:
        false,
    };
  }

  getState():
    StructuralSkillTransferState {
    return {
      active:
        this.active,

      sourceSkillId:
        this.sourceSkill.id,

      stageIndex:
        this.stageIndex,

      mappedRoles:
        this.mappedRoles.map(
          (mapping) => ({
            ...mapping,
          }),
        ),

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
    StructuralSkillTransferUpdate {
    this.active =
      false;

    this.invalidationReason =
      reason;

    return {
      advanced:
        false,

      completed:
        false,

      invalidated:
        true,

      reason,
    };
  }
}

export class StructuralSkillTransferEngine {
  constructor(
    private readonly library:
      AutonomousSkillLibrary,
  ) {}

  createSession(input: {
    initialState:
      EnvironmentSnapshot;

    goalConditions:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];
  }):
    StructuralSkillTransferSession |
    undefined {
    const goalKey =
      singleTrueGoal(
        input.goalConditions,
      );

    if (
      !goalKey ||
      input.initialState[
        goalKey
      ] !==
        false
    ) {
      return undefined;
    }

    const candidates =
      this.library
        .getSkills()
        .map(
          structuralCandidate,
        )
        .filter(
          (
            candidate,
          ): candidate is
            StructuralSkillCandidate =>
            Boolean(
              candidate,
            ),
        )
        .filter(
          (candidate) =>
            candidate
              .skill
              .steps
              .length ===
              input
                .availableActions
                .length &&
            candidate
              .setupCount ===
              falseBooleanNonGoalKeys(
                input.initialState,
                goalKey,
              ).length,
        )
        .sort(
          (left, right) => {
            if (
              right
                .skill
                .confidence !==
              left
                .skill
                .confidence
            ) {
              return (
                right
                  .skill
                  .confidence -
                left
                  .skill
                  .confidence
              );
            }

            return left
              .skill
              .id
              .localeCompare(
                right
                  .skill
                  .id,
              );
          },
        );

    const selected =
      candidates[0];

    if (
      !selected
    ) {
      return undefined;
    }

    return new StructuralSkillTransferSession(
      selected.skill,
      goalKey,
    );
  }
}

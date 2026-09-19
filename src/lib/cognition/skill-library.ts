import {
  diffSnapshots,
  type EnvironmentScalar,
  type EnvironmentSnapshot,
} from "./environment";

import type {
  EpisodeTransition,
} from "./memory";

export type SkillStatus =
  | "candidate"
  | "active"
  | "retired";

export interface SkillEffect {
  key:
    string;

  before:
    EnvironmentScalar |
    undefined;

  after:
    EnvironmentScalar |
    undefined;
}

export interface SkillStep {
  action:
    string;

  preconditions:
    EnvironmentSnapshot;

  effects:
    SkillEffect[];
}

export interface CognitiveSkill {
  id:
    string;

  signature:
    string;

  description:
    string;

  preconditions:
    EnvironmentSnapshot;

  goalEffects:
    EnvironmentSnapshot;

  steps:
    SkillStep[];

  supportCount:
    number;

  contradictionCount:
    number;

  confidence:
    number;

  status:
    SkillStatus;

  sourceEpisodeIds:
    string[];

  sourceEnvironmentIds:
    string[];

  contradictionEvidenceIds:
    string[];

  createdAt:
    string;

  updatedAt:
    string;
}

export interface SkillEpisodeEvidence {
  episodeId:
    string;

  environmentId:
    string;

  solved:
    boolean;

  goalConditions:
    EnvironmentSnapshot;

  transitions:
    EpisodeTransition[];

  observedAt:
    string;
}

export interface SkillRecommendation {
  skill:
    CognitiveSkill;

  actions:
    string[];

  confidence:
    number;
}

export interface SkillExecutionUpdate {
  matched:
    boolean;

  confidence:
    number;

  status:
    SkillStatus;
}

interface SkillEvidence {
  episodeId:
    string;

  environmentId:
    string;

  initialState:
    EnvironmentSnapshot;

  finalState:
    EnvironmentSnapshot;

  transitions:
    EpisodeTransition[];

  goalConditions:
    EnvironmentSnapshot;

  observedAt:
    string;
}

interface StoredSkill {
  skill:
    CognitiveSkill;

  evidence:
    SkillEvidence[];
}

const MIN_SUPPORT_FOR_ACTIVE_SKILL =
  2;

function cloneSnapshot(
  snapshot:
    EnvironmentSnapshot,
):
  EnvironmentSnapshot {
  return {
    ...snapshot,
  };
}

function cloneEffect(
  effect:
    SkillEffect,
):
  SkillEffect {
  return {
    ...effect,
  };
}

function cloneStep(
  step:
    SkillStep,
):
  SkillStep {
  return {
    action:
      step.action,

    preconditions:
      cloneSnapshot(
        step.preconditions,
      ),

    effects:
      step.effects.map(
        cloneEffect,
      ),
  };
}

function cloneSkill(
  skill:
    CognitiveSkill,
):
  CognitiveSkill {
  return {
    ...skill,

    preconditions:
      cloneSnapshot(
        skill.preconditions,
      ),

    goalEffects:
      cloneSnapshot(
        skill.goalEffects,
      ),

    steps:
      skill.steps.map(
        cloneStep,
      ),

    sourceEpisodeIds: [
      ...skill
        .sourceEpisodeIds,
    ],

    sourceEnvironmentIds: [
      ...skill
        .sourceEnvironmentIds,
    ],

    contradictionEvidenceIds: [
      ...skill
        .contradictionEvidenceIds,
    ],
  };
}

function sameScalar(
  left:
    EnvironmentScalar |
    undefined,

  right:
    EnvironmentScalar |
    undefined,
): boolean {
  return Object.is(
    left,
    right,
  );
}

function sortedKeys(
  snapshot:
    EnvironmentSnapshot,
): string[] {
  return Object.keys(
    snapshot,
  ).sort();
}

function commonSnapshot(
  snapshots:
    EnvironmentSnapshot[],
):
  EnvironmentSnapshot {
  const first =
    snapshots[0];

  if (
    !first
  ) {
    return {};
  }

  const result:
    EnvironmentSnapshot = {};

  for (
    const key of
      sortedKeys(
        first,
      )
  ) {
    const value =
      first[key];

    if (
      snapshots.every(
        (snapshot) =>
          key in snapshot &&
          sameScalar(
            snapshot[key],
            value,
          ),
      )
    ) {
      result[key] =
        value;
    }
  }

  return result;
}

function effectiveTransitions(
  transitions:
    EpisodeTransition[],
):
  EpisodeTransition[] {
  return transitions.filter(
    (transition) =>
      transition.accepted &&
      transition
        .changedKeys
        .length >
        0,
  );
}

function transitionEffects(
  transition:
    EpisodeTransition,
):
  SkillEffect[] {
  return diffSnapshots(
    transition.before,
    transition.after,
  )
    .map(
      (change) => ({
        key:
          change.key,

        before:
          change.before,

        after:
          change.after,
      }),
    )
    .sort(
      (left, right) =>
        left.key.localeCompare(
          right.key,
        ),
    );
}

function effectPattern(
  transition:
    EpisodeTransition,
) {
  return transitionEffects(
    transition,
  ).map(
    (effect) => [
      effect.key,
      effect.after,
    ],
  );
}

function skillSignature(
  transitions:
    EpisodeTransition[],

  goalConditions:
    EnvironmentSnapshot,
): string {
  return JSON.stringify({
    steps:
      transitions.map(
        (transition) => ({
          action:
            transition.action,

          effects:
            effectPattern(
              transition,
            ),
        }),
      ),

    goal:
      Object.entries(
        goalConditions,
      ).sort(
        ([left], [right]) =>
          left.localeCompare(
            right,
          ),
      ),
  });
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
):
  SkillStatus {
  if (
    contradictionCount >=
      Math.max(
        2,
        supportCount,
      )
  ) {
    return "retired";
  }

  if (
    supportCount >=
      MIN_SUPPORT_FOR_ACTIVE_SKILL
  ) {
    return "active";
  }

  return "candidate";
}

function uniqueStrings(
  values:
    string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ];
}

function netGoalEffects(
  initial:
    EnvironmentSnapshot,

  final:
    EnvironmentSnapshot,

  goalConditions:
    EnvironmentSnapshot,
):
  EnvironmentSnapshot {
  const effects:
    EnvironmentSnapshot = {};

  for (
    const [
      key,
      target,
    ] of Object.entries(
      goalConditions,
    )
  ) {
    if (
      !sameScalar(
        initial[key],
        target,
      ) &&
      sameScalar(
        final[key],
        target,
      )
    ) {
      effects[key] =
        target;
    }
  }

  return effects;
}

function skillAppliesToGoal(
  skill:
    CognitiveSkill,

  currentState:
    EnvironmentSnapshot,

  goalConditions:
    EnvironmentSnapshot,
): boolean {
  const projected = {
    ...currentState,
    ...skill.goalEffects,
  };

  return Object.entries(
    goalConditions,
  ).every(
    ([key, value]) =>
      sameScalar(
        projected[key],
        value,
      ),
  );
}

function preconditionsMatch(
  preconditions:
    EnvironmentSnapshot,

  state:
    EnvironmentSnapshot,
): boolean {
  return Object.entries(
    preconditions,
  ).every(
    ([key, value]) =>
      sameScalar(
        state[key],
        value,
      ),
  );
}

function effectMatches(
  effect:
    SkillEffect,

  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,
): boolean {
  return (
    sameScalar(
      before[
        effect.key
      ],
      effect.before,
    ) &&
    sameScalar(
      after[
        effect.key
      ],
      effect.after,
    )
  );
}

/**
 * Mabojolu G autonomous skill library v0.1.
 *
 * Skills are not stored after a single lucky trajectory. A candidate must be
 * supported by repeated solved episodes before it becomes active.
 *
 * The library deliberately separates:
 *
 * - episode memory: "what happened in one environment";
 * - skill knowledge: "what reusable action structure has repeated evidence".
 *
 * v0.1 generalizes across environment identity and goal wording when observable
 * state variables, actions, and effects remain compatible. Later versions can
 * add role-level renaming and richer hierarchical skill composition.
 */
export class AutonomousSkillLibrary {
  private readonly skills:
    StoredSkill[] = [];

  private sequence = 0;

  learnFromEpisode(
    input:
      SkillEpisodeEvidence,
  ):
    CognitiveSkill |
    undefined {
    if (
      !input.solved
    ) {
      return undefined;
    }

    const transitions =
      effectiveTransitions(
        input.transitions,
      );

    if (
      transitions.length ===
        0
    ) {
      return undefined;
    }

    const initialState =
      cloneSnapshot(
        transitions[0]
          .before,
      );

    const finalState =
      cloneSnapshot(
        transitions[
          transitions.length -
          1
        ].after,
      );

    const signature =
      skillSignature(
        transitions,
        input.goalConditions,
      );

    const evidence:
      SkillEvidence = {
      episodeId:
        input.episodeId,

      environmentId:
        input.environmentId,

      initialState,

      finalState,

      transitions:
        transitions.map(
          (transition) => ({
            ...transition,

            before:
              cloneSnapshot(
                transition.before,
              ),

            after:
              cloneSnapshot(
                transition.after,
              ),

            changedKeys: [
              ...transition
                .changedKeys,
            ],
          }),
        ),

      goalConditions:
        cloneSnapshot(
          input.goalConditions,
        ),

      observedAt:
        input.observedAt,
    };

    const existing =
      this.skills.find(
        (stored) =>
          stored
            .skill
            .signature ===
          signature,
      );

    if (
      existing
    ) {
      if (
        existing
          .evidence
          .some(
            (candidate) =>
              candidate
                .episodeId ===
              input.episodeId,
          )
      ) {
        return cloneSkill(
          existing.skill,
        );
      }

      existing
        .evidence
        .push(
          evidence,
        );

      this.rebuildSkill(
        existing,
        input.observedAt,
      );

      return cloneSkill(
        existing.skill,
      );
    }

    this.sequence +=
      1;

    const skill:
      CognitiveSkill = {
      id:
        "skill-" +
        this.sequence,

      signature,

      description:
        "Reusable skill: " +
        transitions
          .map(
            (transition) =>
              transition.action,
          )
          .join(
            " -> ",
          ),

      preconditions:
        cloneSnapshot(
          initialState,
        ),

      goalEffects:
        netGoalEffects(
          initialState,
          finalState,
          input.goalConditions,
        ),

      steps:
        transitions.map(
          (transition) => ({
            action:
              transition.action,

            preconditions:
              cloneSnapshot(
                transition.before,
              ),

            effects:
              transitionEffects(
                transition,
              ),
          }),
        ),

      supportCount: 1,

      contradictionCount:
        0,

      confidence:
        confidenceFor(
          1,
          0,
        ),

      status:
        "candidate",

      sourceEpisodeIds: [
        input.episodeId,
      ],

      sourceEnvironmentIds: [
        input.environmentId,
      ],

      contradictionEvidenceIds:
        [],

      createdAt:
        input.observedAt,

      updatedAt:
        input.observedAt,
    };

    this.skills.push({
      skill,
      evidence: [
        evidence,
      ],
    });

    return cloneSkill(
      skill,
    );
  }

  recommendSkill(input: {
    currentState:
      EnvironmentSnapshot;

    goalConditions:
      EnvironmentSnapshot;

    availableActions:
      readonly string[];
  }):
    SkillRecommendation |
    undefined {
    const available =
      new Set(
        input.availableActions,
      );

    const candidates =
      this.skills
        .map(
          (stored) =>
            stored.skill,
        )
        .filter(
          (skill) =>
            skill.status ===
              "active" &&
            preconditionsMatch(
              skill.preconditions,
              input.currentState,
            ) &&
            skillAppliesToGoal(
              skill,
              input.currentState,
              input.goalConditions,
            ) &&
            skill.steps.every(
              (step) =>
                available.has(
                  step.action,
                ),
            ),
        )
        .sort(
          (left, right) => {
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
              left.steps.length !==
              right.steps.length
            ) {
              return (
                left.steps.length -
                right.steps.length
              );
            }

            return left.id.localeCompare(
              right.id,
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

    return {
      skill:
        cloneSkill(
          selected,
        ),

      actions:
        selected.steps.map(
          (step) =>
            step.action,
        ),

      confidence:
        selected.confidence,
    };
  }

  observeExecution(input: {
    skillId:
      string;

    stepIndex:
      number;

    before:
      EnvironmentSnapshot;

    after:
      EnvironmentSnapshot;

    evidenceId:
      string;

    observedAt:
      string;
  }):
    SkillExecutionUpdate |
    undefined {
    const stored =
      this.skills.find(
        (candidate) =>
          candidate
            .skill
            .id ===
          input.skillId,
      );

    if (
      !stored
    ) {
      return undefined;
    }

    const step =
      stored
        .skill
        .steps[
          input.stepIndex
        ];

    if (
      !step
    ) {
      return undefined;
    }

    const matched =
      preconditionsMatch(
        step.preconditions,
        input.before,
      ) &&
      step.effects.every(
        (effect) =>
          effectMatches(
            effect,
            input.before,
            input.after,
          ),
      );

    if (
      !matched &&
      !stored
        .skill
        .contradictionEvidenceIds
        .includes(
          input.evidenceId,
        )
    ) {
      stored
        .skill
        .contradictionEvidenceIds
        .push(
          input.evidenceId,
        );

      stored
        .skill
        .contradictionCount +=
        1;

      stored
        .skill
        .confidence =
        confidenceFor(
          stored
            .skill
            .supportCount,
          stored
            .skill
            .contradictionCount,
        );

      stored
        .skill
        .status =
        statusFor(
          stored
            .skill
            .supportCount,
          stored
            .skill
            .contradictionCount,
        );

      stored
        .skill
        .updatedAt =
        input.observedAt;
    }

    return {
      matched,

      confidence:
        stored
          .skill
          .confidence,

      status:
        stored
          .skill
          .status,
    };
  }

  getSkills():
    readonly CognitiveSkill[] {
    return this.skills.map(
      (stored) =>
        cloneSkill(
          stored.skill,
        ),
    );
  }

  private rebuildSkill(
    stored:
      StoredSkill,

    updatedAt:
      string,
  ): void {
    const skill =
      stored.skill;

    skill.supportCount =
      stored
        .evidence
        .length;

    skill.confidence =
      confidenceFor(
        skill.supportCount,
        skill.contradictionCount,
      );

    skill.status =
      statusFor(
        skill.supportCount,
        skill.contradictionCount,
      );

    skill.sourceEpisodeIds =
      stored.evidence.map(
        (evidence) =>
          evidence.episodeId,
      );

    skill.sourceEnvironmentIds =
      uniqueStrings(
        stored.evidence.map(
          (evidence) =>
            evidence
              .environmentId,
        ),
      );

    skill.preconditions =
      commonSnapshot(
        stored.evidence.map(
          (evidence) =>
            evidence
              .initialState,
        ),
      );

    skill.goalEffects =
      commonSnapshot(
        stored.evidence.map(
          (evidence) =>
            netGoalEffects(
              evidence
                .initialState,
              evidence
                .finalState,
              evidence
                .goalConditions,
            ),
        ),
      );

    skill.steps =
      skill.steps.map(
        (
          step,
          index,
        ) => ({
          ...step,

          preconditions:
            commonSnapshot(
              stored.evidence.map(
                (evidence) =>
                  evidence
                    .transitions[
                      index
                    ].before,
              ),
            ),

          effects:
            step.effects.map(
              cloneEffect,
            ),
        }),
      );

    skill.updatedAt =
      updatedAt;
  }
}

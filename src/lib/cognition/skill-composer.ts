import type {
  EnvironmentSnapshot,
} from "./environment";

import type {
  AutonomousSkillLibrary,
  CognitiveSkill,
  SkillStep,
} from "./skill-library";

export interface ComposedSkillAction {
  skillId:
    string;

  stepIndex:
    number;

  action:
    string;
}

export interface SkillCompositionPlan {
  skillIds:
    string[];

  actions:
    ComposedSkillAction[];

  confidence:
    number;

  projectedFinalState:
    EnvironmentSnapshot;
}

export interface SkillCompositionInput {
  currentState:
    EnvironmentSnapshot;

  goalConditions:
    EnvironmentSnapshot;

  availableActions:
    readonly string[];

  maxSkills?:
    number;
}

interface SearchNode {
  state:
    EnvironmentSnapshot;

  skills:
    CognitiveSkill[];

  usedSkillIds:
    Set<string>;

  confidence:
    number;
}

function stateMatches(
  state:
    EnvironmentSnapshot,

  conditions:
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

function applySkill(
  state:
    EnvironmentSnapshot,

  skill:
    CognitiveSkill,
):
  EnvironmentSnapshot {
  return {
    ...state,
    ...skill.goalEffects,
  };
}

function stateChanged(
  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,
): boolean {
  const keys =
    new Set([
      ...Object.keys(
        before,
      ),
      ...Object.keys(
        after,
      ),
    ]);

  for (
    const key of keys
  ) {
    if (
      !Object.is(
        before[key],
        after[key],
      )
    ) {
      return true;
    }
  }

  return false;
}

function skillAvailable(
  skill:
    CognitiveSkill,

  availableActions:
    Set<string>,
): boolean {
  return skill.steps.every(
    (
      step:
        SkillStep,
    ) =>
      availableActions.has(
        step.action,
      ),
  );
}

function flattenActions(
  skills:
    CognitiveSkill[],
):
  ComposedSkillAction[] {
  return skills.flatMap(
    (skill) =>
      skill.steps.map(
        (
          step,
          stepIndex,
        ) => ({
          skillId:
            skill.id,

          stepIndex,

          action:
            step.action,
        }),
      ),
  );
}

function stateSignature(
  state:
    EnvironmentSnapshot,
): string {
  return JSON.stringify(
    Object.entries(
      state,
    ).sort(
      ([left], [right]) =>
        left.localeCompare(
          right,
        ),
    ),
  );
}

/**
 * Mabojolu G skill composer v0.1.
 *
 * Active learned skills are treated as macro-actions:
 *
 * learned preconditions + learned goal effects -> projected next state
 *
 * Breadth-first search finds the shortest skill-level chain that reaches the
 * requested observable goal. The composer never invents effects outside the
 * skill library and never uses a skill whose concrete actions are unavailable.
 */
export class SkillComposer {
  constructor(
    private readonly library:
      AutonomousSkillLibrary,
  ) {}

  compose(
    input:
      SkillCompositionInput,
  ):
    SkillCompositionPlan |
    undefined {
    if (
      stateMatches(
        input.currentState,
        input.goalConditions,
      )
    ) {
      return {
        skillIds: [],

        actions: [],

        confidence: 1,

        projectedFinalState: {
          ...input.currentState,
        },
      };
    }

    const maxSkills =
      Math.max(
        1,
        input.maxSkills ??
          4,
      );

    const availableActions =
      new Set(
        input.availableActions,
      );

    const activeSkills =
      this.library
        .getSkills()
        .filter(
          (skill) =>
            skill.status ===
              "active" &&
            skillAvailable(
              skill,
              availableActions,
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

            return left.id.localeCompare(
              right.id,
            );
          },
        );

    if (
      activeSkills.length ===
      0
    ) {
      return undefined;
    }

    const queue:
      SearchNode[] = [
      {
        state: {
          ...input.currentState,
        },

        skills: [],

        usedSkillIds:
          new Set(),

        confidence: 1,
      },
    ];

    const bestDepthByState =
      new Map<
        string,
        number
      >([
        [
          stateSignature(
            input.currentState,
          ),
          0,
        ],
      ]);

    while (
      queue.length >
      0
    ) {
      const node =
        queue.shift();

      if (
        !node
      ) {
        break;
      }

      if (
        node.skills.length >=
        maxSkills
      ) {
        continue;
      }

      for (
        const skill of
          activeSkills
      ) {
        if (
          node.usedSkillIds
            .has(
              skill.id,
            ) ||
          !stateMatches(
            node.state,
            skill.preconditions,
          )
        ) {
          continue;
        }

        const nextState =
          applySkill(
            node.state,
            skill,
          );

        if (
          !stateChanged(
            node.state,
            nextState,
          )
        ) {
          continue;
        }

        const nextSkills = [
          ...node.skills,
          skill,
        ];

        const confidence =
          node.confidence *
          skill.confidence;

        if (
          stateMatches(
            nextState,
            input.goalConditions,
          )
        ) {
          return {
            skillIds:
              nextSkills.map(
                (candidate) =>
                  candidate.id,
              ),

            actions:
              flattenActions(
                nextSkills,
              ),

            confidence,

            projectedFinalState:
              nextState,
          };
        }

        const signature =
          stateSignature(
            nextState,
          );

        const depth =
          nextSkills.length;

        const previousDepth =
          bestDepthByState
            .get(
              signature,
            );

        if (
          previousDepth !==
            undefined &&
          previousDepth <=
            depth
        ) {
          continue;
        }

        bestDepthByState
          .set(
            signature,
            depth,
          );

        queue.push({
          state:
            nextState,

          skills:
            nextSkills,

          usedSkillIds:
            new Set([
              ...node
                .usedSkillIds,
              skill.id,
            ]),

          confidence,
        });
      }
    }

    return undefined;
  }
}

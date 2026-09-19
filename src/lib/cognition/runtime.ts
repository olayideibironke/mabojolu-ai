import {
  AbstractPrincipleController,
  CrossFamilyPrincipleLibrary,
  type AbstractPrinciple,
} from "./abstract-principle";

import {
  AbstractPrinciplePortfolio,
  AbstractPrinciplePortfolioController,
  type AbstractPrinciplePortfolioSnapshot,
} from "./abstract-principle-portfolio";

import {
  AutonomousCausalHypothesisEngine,
  type AutonomousCausalHypothesis,
} from "./autonomous-hypothesis";

import {
  diffSnapshots,
  snapshotSignature,
  type CognitiveEnvironment,
  type EnvironmentSnapshot,
  type SnapshotChange,
} from "./environment";

import {
  AutonomousGoalDecomposer,
  type AutonomousGoalDecomposition,
  type DecomposedGoal,
} from "./goal-decomposer";

import {
  HierarchicalGoalReasoner,
  type GoalHierarchySnapshot,
} from "./goal-hierarchy";

import type {
  CognitiveMemory,
  EpisodeTransition,
  RecalledPlan,
} from "./memory";

import {
  WorldModelPlanner,
} from "./planner";

import {
  ScientificDiscoveryPlanner,
} from "./scientific-discovery";

import {
  SkillComposer,
  type SkillCompositionPlan,
} from "./skill-composer";

import {
  AutonomousSkillLibrary,
  type SkillRecommendation,
} from "./skill-library";

import {
  StructuralSkillTransferEngine,
  type StructuralSkillTransferSession,
  type StructuralSkillTransferState,
} from "./structural-skill-transfer";

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

import {
  StructuralTransferLibrary,
  StructuralTransferSession,
  type StructuralTransferUpdate,
} from "./structural-transfer";

import {
  WorldModel,
} from "./world-model";

interface ActionAttempt {
  stateSignature: string;

  changedKeys: string[];
}

type ActionChoiceStrategy =
  | "world-model-plan"
  | "skill"
  | "skill-composition"
  | "structural-skill"
  | "structural-transfer"
  | "transfer"
  | "abstract-principle"
  | "scientific-discovery-setup"
  | "hypothesis-experiment"
  | "exploration"
  | "conditional"
  | "state-exploration";

interface ActionChoice {
  action: string;

  strategy:
    ActionChoiceStrategy;

  expectedEffects?:
    string[];

  skillId?:
    string;

  skillStepIndex?:
    number;
}

export interface CognitiveRuntimeOptions {
  maxCycles?: number;

  now?: () => string;

  /**
   * Cross-episode experience store.
   */
  memory?: CognitiveMemory;

  /**
   * Explicit causal world model.
   *
   * Supplying the same model to multiple runtime instances allows causal
   * knowledge to persist across episodes independently of sequence memory.
   */
  worldModel?: WorldModel;

  /**
   * Cross-environment structural analogy store.
   *
   * Templates contain relational role structure rather than source action or
   * state-variable names.
   */
  structuralTransfer?:
    StructuralTransferLibrary;

  /**
   * Optional persistent hypothesis engine.
   *
   * Reusing the same engine across runtime instances allows scientific
   * hypotheses and their evidence to survive episode boundaries.
   */
  hypothesisEngine?:
    AutonomousCausalHypothesisEngine;

  /**
   * Cross-environment reusable skill store.
   *
   * A skill is activated only after repeated successful evidence.
   */
  skillLibrary?:
    AutonomousSkillLibrary;

  /**
   * Explicit task-family identity used only for cross-family abstraction
   * evidence. Episodes without a family label do not contribute.
   */
  taskFamily?:
    string;

  /**
   * Structural family-kind identity. Abstraction activation requires evidence
   * from more than one distinct family kind, not merely renamed family labels.
   */
  taskFamilyKind?:
    string;

  /**
   * Cross-family higher-order principle store.
   */
  abstractPrincipleLibrary?:
    CrossFamilyPrincipleLibrary;

  /**
   * Multi-principle abstraction store and contextual selector.
   *
   * When supplied, this takes precedence over abstractPrincipleLibrary for
   * episode learning and target-world abstraction selection.
   */
  abstractPrinciplePortfolio?:
    AbstractPrinciplePortfolio;
}

export interface CognitiveRunResult {
  solved: boolean;

  cycles: number;

  actionHistory:
    string[];

  recalledPlan?:
    RecalledPlan;

  recalledSkill?:
    SkillRecommendation;

  skillComposition?:
    SkillCompositionPlan;

  structuralSkillTransfer?:
    StructuralSkillTransferState;

  abstractPrinciple?:
    AbstractPrinciple;

  abstractPrinciplePortfolio?:
    AbstractPrinciplePortfolioSnapshot;

  generatedHypotheses:
    AutonomousCausalHypothesis[];

  autonomousDecomposition?:
    AutonomousGoalDecomposition;

  goalHierarchy:
    GoalHierarchySnapshot;

  state:
    CognitiveState;
}

/**
 * Mabojolu G active cognitive runtime.
 *
 * Action-selection priority:
 *
 * 1. Run an information-seeking scientific-discovery setup when needed.
 * 2. Use a causal world-model plan when enough knowledge exists.
 * 3. Use a directly applicable repeatedly supported skill.
 * 4. Compose multiple learned skills when no single skill reaches the goal.
 * 5. Test a learned skill's relational structure under renamed target symbols.
 * 6. Use broader structural transfer or same-environment episodic transfer.
 * 7. Score and select among active higher-order principles using target evidence.
 * 8. Run causal-hypothesis experiments and evidence-driven exploration.
 *
 * Every real transition is fed back into the world model, so incorrect
 * predictions become contradiction evidence rather than permanent assumptions.
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

  private readonly episodeTransitions:
    EpisodeTransition[] = [];

  private recalledPlan:
    RecalledPlan |
    undefined;

  private transferIndex = 0;

  private recalledSkill:
    SkillRecommendation |
    undefined;

  private skillIndex = 0;

  private skillAbandoned =
    false;

  private skillComposition:
    SkillCompositionPlan |
    undefined;

  private skillCompositionIndex =
    0;

  private skillCompositionAbandoned =
    false;

  private structuralSkillSession:
    StructuralSkillTransferSession |
    undefined;

  private structuralSkillCorrectionRecorded =
    false;

  private readonly maxCycles:
    number;

  private readonly clock:
    () => string;

  private readonly goalHierarchy:
    HierarchicalGoalReasoner;

  private readonly rootGoalId:
    string;

  private readonly goalDecomposer:
    AutonomousGoalDecomposer |
    undefined;

  private autonomousDecomposition:
    AutonomousGoalDecomposition |
    undefined;

  private readonly decomposedGoalById =
    new Map<
      string,
      DecomposedGoal
    >();

  private readonly memory:
    CognitiveMemory |
    undefined;

  private readonly worldModel:
    WorldModel |
    undefined;

  private readonly planner:
    WorldModelPlanner |
    undefined;

  private readonly hypothesisEngine:
    AutonomousCausalHypothesisEngine;

  private readonly scientificDiscoveryPlanner:
    ScientificDiscoveryPlanner |
    undefined;

  private readonly structuralTransfer:
    StructuralTransferLibrary |
    undefined;

  private readonly skillLibrary:
    AutonomousSkillLibrary |
    undefined;

  private readonly skillComposer:
    SkillComposer |
    undefined;

  private readonly structuralSkillEngine:
    StructuralSkillTransferEngine |
    undefined;

  private readonly taskFamily:
    string |
    undefined;

  private readonly taskFamilyKind:
    string |
    undefined;

  private readonly abstractPrincipleLibrary:
    CrossFamilyPrincipleLibrary |
    undefined;

  private readonly abstractPrinciplePortfolio:
    AbstractPrinciplePortfolio |
    undefined;

  private readonly abstractPrinciplePortfolioController:
    AbstractPrinciplePortfolioController |
    undefined;

  private readonly abstractPrincipleController:
    AbstractPrincipleController |
    undefined;

  private structuralSession:
    StructuralTransferSession |
    undefined;

  private structuralCorrectionRecorded =
    false;

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

    this.goalHierarchy =
      new HierarchicalGoalReasoner(
        this.clock,
      );

    this.memory =
      options.memory;

    this.worldModel =
      options.worldModel;

    this.goalDecomposer =
      this.worldModel
        ? new AutonomousGoalDecomposer(
            this.worldModel,
          )
        : undefined;

    this.hypothesisEngine =
      options.hypothesisEngine ??
      new AutonomousCausalHypothesisEngine();

    this.structuralTransfer =
      options.structuralTransfer;

    this.skillLibrary =
      options.skillLibrary;

    this.taskFamily =
      options.taskFamily;

    this.taskFamilyKind =
      options.taskFamilyKind;

    this.abstractPrincipleLibrary =
      options.abstractPrincipleLibrary;

    this.abstractPrinciplePortfolio =
      options.abstractPrinciplePortfolio;

    this.abstractPrinciplePortfolioController =
      this.abstractPrinciplePortfolio
        ?.createController();

    this.abstractPrincipleController =
      this.abstractPrincipleLibrary
        ? new AbstractPrincipleController(
            this.abstractPrincipleLibrary,
          )
        : undefined;

    this.skillComposer =
      this.skillLibrary
        ? new SkillComposer(
            this.skillLibrary,
          )
        : undefined;

    this.structuralSkillEngine =
      this.skillLibrary
        ? new StructuralSkillTransferEngine(
            this.skillLibrary,
          )
        : undefined;

    this.planner =
      this.worldModel
        ? new WorldModelPlanner(
            this.worldModel,
          )
        : undefined;

    this.scientificDiscoveryPlanner =
      this.worldModel
        ? new ScientificDiscoveryPlanner(
            this.worldModel,
            this.hypothesisEngine,
          )
        : undefined;

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

    this.rootGoalId =
      goal.id;

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

    this.goalHierarchy
      .registerRoot({
        ...goal,

        status:
          "active",

        updatedAt:
          this.now(),
      });
  }

  run():
    CognitiveRunResult {
    if (
      this.hasRun
    ) {
      throw new Error(
        "A CognitiveRuntime instance can only be run once.",
      );
    }

    this.hasRun =
      true;

    const initialActions =
      this.environment
        .getAvailableActions();

    this.recalledPlan =
      this.memory
        ?.recallPlan({
          environmentId:
            this.environment.id,

          goalDescription:
            this.environment
              .goalDescription,

          availableActions:
            initialActions,
        });

    let snapshot =
      this.environment
        .observe();

    this.initializeAutonomousGoalDecomposition(
      snapshot,
      initialActions,
    );

    this.initializeSkillTransfer(
      snapshot,
      initialActions,
    );

    this.initializeStructuralSkillTransfer(
      snapshot,
      initialActions,
    );

    this.initializeStructuralTransfer(
      snapshot,
      initialActions,
    );

    this.recordObservation(
      snapshot,
      "Initial environment observation.",
    );

    if (
      this.environment
        .isGoalSatisfied()
    ) {
      this.completeGoal();

      return this.finishRun(
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

      const choice =
        this.chooseAction(
          actions,
          snapshot,
        );

      if (
        !choice
      ) {
        break;
      }

      const action =
        choice.action;

      const before = {
        ...snapshot,
      };

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
            this.actionKind(
              choice.strategy,
            ),

          description:
            `Execute action ${action} and observe the environment.`,

          expectedEffects:
            choice
              .expectedEffects ??
            this.defaultExpectedEffects(
              choice.strategy,
            ),

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

      const after = {
        ...this.environment
          .observe(),
      };

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

      /*
       * Feed the real transition back into the causal model.
       *
       * A prediction that disagreed with reality becomes contradiction evidence
       * inside WorldModel rather than being silently retained.
       */
      this.worldModel
        ?.observeTransition({
          action,

          before,

          after,

          accepted:
            environmentResult
              .accepted,

          observedAt:
            this.now(),
        });

      if (
        this.abstractPrinciplePortfolioController
      ) {
        this.abstractPrinciplePortfolioController
          .observeTransition({
            action,

            accepted:
              environmentResult
                .accepted,

            before,

            after,

            changedKeys:
              changes.map(
                (change) =>
                  change.key,
              ),
          });
      } else {
        this.abstractPrincipleController
          ?.observeTransition({
            action,

            accepted:
              environmentResult
                .accepted,

            changedKeys:
              changes.map(
                (change) =>
                  change.key,
              ),
          });
      }

      this.advanceGoalHierarchyFromObservation(
        after,
      );

      const structuralSkillUpdate =
        choice.strategy ===
          "structural-skill"
          ? this.structuralSkillSession
              ?.observeTransition({
                action,

                before,

                after,

                accepted:
                  environmentResult
                    .accepted,
              })
          : undefined;

      const structuralUpdate =
        this.structuralSession
          ?.observeTransition({
            action,

            before,

            after,

            accepted:
              environmentResult
                .accepted,
          });

      this.hypothesisEngine
        .observeTransition({
          observationId:
            observation.id,

          action,

          before,

          after,

          accepted:
            environmentResult
              .accepted,

          observedAt:
            observation
              .observedAt,
        });

      this.syncAutonomousHypotheses();

      this.learnFromTransition(
        action,
        before,
        after,
        changes,
        observation,
      );

      this.recordTransferCorrection(
        choice,
        changes,
        observation,
      );

      this.recordWorldModelCorrection(
        choice,
        changes,
        observation,
      );

      this.recordStructuralSkillCorrection(
        choice,
        structuralSkillUpdate,
        observation,
      );

      this.recordStructuralTransferCorrection(
        choice,
        structuralUpdate,
        observation,
      );

      this.recordSkillExecutionOutcome(
        choice,
        before,
        after,
        observation,
      );

      this.episodeTransitions.push({
        action,

        before,

        after,

        changedKeys:
          changes.map(
            (change) =>
              change.key,
          ),

        accepted:
          environmentResult
            .accepted,
      });

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

        return this.finishRun(
          true,
        );
      }
    }

    return this.finishRun(
      this.environment
        .isGoalSatisfied(),
    );
  }

  private chooseAction(
    availableActions:
      readonly string[],

    snapshot:
      EnvironmentSnapshot,
  ): ActionChoice | undefined {
    const discovery =
      this.nextScientificDiscoveryAction(
        availableActions,
        snapshot,
      );

    if (
      discovery
    ) {
      return discovery;
    }

    const modeled =
      this.nextWorldModelAction(
        availableActions,
        snapshot,
      );

    if (
      modeled
    ) {
      return modeled;
    }

    const skill =
      this.nextSkillAction(
        availableActions,
      );

    if (
      skill
    ) {
      return skill;
    }

    const composedSkill =
      this.nextSkillCompositionAction(
        availableActions,
      );

    if (
      composedSkill
    ) {
      return composedSkill;
    }

    const structuralSkill =
      this.nextStructuralSkillAction(
        availableActions,
      );

    if (
      structuralSkill
    ) {
      return structuralSkill;
    }

    const structural =
      this.nextStructuralTransferAction(
        availableActions,
      );

    if (
      structural
    ) {
      return structural;
    }

    const transferred =
      this.nextTransferAction(
        availableActions,
      );

    if (
      transferred
    ) {
      return {
        action:
          transferred,

        strategy:
          "transfer",
      };
    }

    const abstractPrinciple =
      this.nextAbstractPrincipleAction(
        availableActions,
      );

    if (
      abstractPrinciple
    ) {
      return abstractPrinciple;
    }

    const hypothesisExperiment =
      this.nextAutonomousHypothesisAction(
        availableActions,
        snapshot,
      );

    if (
      hypothesisExperiment
    ) {
      return hypothesisExperiment;
    }

    const signature =
      snapshotSignature(
        snapshot,
      );

    const neverAttempted =
      availableActions.find(
        (action) =>
          !this.attempts.has(
            action,
          ),
      );

    if (
      neverAttempted
    ) {
      return {
        action:
          neverAttempted,

        strategy:
          "exploration",
      };
    }

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
      return {
        action:
          conditionalCandidate,

        strategy:
          "conditional",
      };
    }

    const stateCandidate =
      availableActions.find(
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

    if (
      !stateCandidate
    ) {
      return undefined;
    }

    return {
      action:
        stateCandidate,

      strategy:
        "state-exploration",
    };
  }

  private nextAbstractPrincipleAction(
    availableActions:
      readonly string[],
  ): ActionChoice | undefined {
    const portfolioRecommendation =
      this.abstractPrinciplePortfolioController
        ?.recommend(
          availableActions,
        );

    if (
      portfolioRecommendation
    ) {
      return {
        action:
          portfolioRecommendation
            .action,

        strategy:
          "abstract-principle",

        expectedEffects: [
          "Competing cross-family abstractions were scored against target-world evidence; selected " +
          portfolioRecommendation
            .principleKind +
          " with applicability " +
          portfolioRecommendation
            .applicability
            .toFixed(2) +
          " and evidence confidence " +
          portfolioRecommendation
            .confidence
            .toFixed(2) +
          ".",
        ],
      };
    }

    const recommendation =
      this.abstractPrincipleController
        ?.recommend(
          availableActions,
        );

    if (
      !recommendation
    ) {
      return undefined;
    }

    return {
      action:
        recommendation.action,

      strategy:
        "abstract-principle",

      expectedEffects: [
        "Cross-family evidence suggests retrying this deferred no-effect action after observed target-world progress before exhausting unrelated alternatives.",
      ],
    };
  }

  private nextScientificDiscoveryAction(
    availableActions:
      readonly string[],

    snapshot:
      EnvironmentSnapshot,
  ): ActionChoice | undefined {
    const plan =
      this.scientificDiscoveryPlanner
        ?.plan({
          currentState:
            snapshot,

          availableActions,
        });

    if (
      !plan
    ) {
      return undefined;
    }

    const setupStep =
      plan.setupSteps[0];

    if (
      setupStep
    ) {
      return {
        action:
          setupStep.action,

        strategy:
          "scientific-discovery-setup",

        expectedEffects: [
          "Move toward an evidence-bounded state where autonomous causal hypotheses make different predictions.",
          ...setupStep.effects.map(
            (effect) =>
              `${effect.key}: ${String(
                effect.before,
              )} -> ${String(
                effect.after,
              )}`,
          ),
        ],
      };
    }

    return {
      action:
        plan.probeAction,

      strategy:
        "hypothesis-experiment",

      expectedEffects: [
        "Execute the decisive probe after autonomously reaching a state where competing causal hypotheses disagree; expected information gain " +
        plan.informationGain
          .toFixed(3) +
        ".",
      ],
    };
  }

  private nextWorldModelAction(
    availableActions:
      readonly string[],

    snapshot:
      EnvironmentSnapshot,
  ): ActionChoice | undefined {
    if (
      !this.planner
    ) {
      return undefined;
    }

    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      !goalReader
    ) {
      return undefined;
    }

    const goalConditions =
      goalReader.call(
        this.environment,
      );

    const plan =
      this.planner.plan({
        currentState:
          snapshot,

        goalConditions,

        availableActions,
      });

    const firstStep =
      plan?.steps[0];

    if (
      !firstStep
    ) {
      return undefined;
    }

    return {
      action:
        firstStep.action,

      strategy:
        "world-model-plan",

      expectedEffects:
        firstStep.effects.map(
          (effect) =>
            `${effect.key}: ${String(
              effect.before,
            )} -> ${String(
              effect.after,
            )}`,
        ),
    };
  }

  private initializeAutonomousGoalDecomposition(
    snapshot:
      EnvironmentSnapshot,

    availableActions:
      readonly string[],
  ): void {
    if (
      this.autonomousDecomposition ||
      !this.goalDecomposer
    ) {
      return;
    }

    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      !goalReader
    ) {
      return;
    }

    const decomposition =
      this.goalDecomposer
        .decompose({
          currentState:
            snapshot,

          goalConditions:
            goalReader.call(
              this.environment,
            ),

          availableActions,
        });

    if (
      !decomposition ||
      decomposition
        .goals
        .length ===
        0
    ) {
      return;
    }

    this.autonomousDecomposition =
      decomposition;

    this.goalHierarchy
      .decompose(
        this.rootGoalId,
        decomposition.goals.map(
          (
            goal,
            index,
          ) => ({
            id:
              goal.id,

            description:
              goal.description,

            priority:
              Math.max(
                1,
                100 -
                  index,
              ),

            successCriteria:
              Object.entries(
                goal.conditions,
              ).map(
                ([key, value]) =>
                  `${key}=${String(
                    value,
                  )}`,
              ),

            dependsOnGoalIds: [
              ...goal
                .dependsOnGoalIds,
            ],
          }),
        ),
      );

    for (
      const goal of
        decomposition.goals
    ) {
      this.decomposedGoalById
        .set(
          goal.id,
          {
            ...goal,

            conditions: {
              ...goal.conditions,
            },

            dependsOnGoalIds: [
              ...goal
                .dependsOnGoalIds,
            ],
          },
        );
    }

    this.advanceGoalHierarchyFromObservation(
      snapshot,
    );
  }

  private advanceGoalHierarchyFromObservation(
    snapshot:
      EnvironmentSnapshot,
  ): void {
    if (
      !this.autonomousDecomposition
    ) {
      return;
    }

    let next =
      this.goalHierarchy
        .nextActionableGoal();

    while (
      next
    ) {
      const decomposed =
        this.decomposedGoalById
          .get(
            next.id,
          );

      if (
        !decomposed
      ) {
        break;
      }

      const satisfied =
        Object.entries(
          decomposed.conditions,
        ).every(
          ([key, value]) =>
            Object.is(
              snapshot[key],
              value,
            ),
        );

      if (
        !satisfied
      ) {
        this.goalHierarchy
          .activate(
            next.id,
          );

        break;
      }

      this.goalHierarchy
        .complete(
          next.id,
        );

      next =
        this.goalHierarchy
          .nextActionableGoal();
    }

    this.syncGoalHierarchyToState();
  }

  private syncGoalHierarchyToState():
    void {
    const snapshot =
      this.goalHierarchy
        .getSnapshot();

    for (
      const goal of
        snapshot.goals
    ) {
      this.apply({
        type:
          "goal.updated",

        goal,
      });
    }

    if (
      snapshot.activeGoalId
    ) {
      this.apply({
        type:
          "goal.activated",

        goalId:
          snapshot
            .activeGoalId,

        occurredAt:
          this.now(),
      });
    }
  }

  private nextAutonomousHypothesisAction(
    availableActions:
      readonly string[],

    snapshot:
      EnvironmentSnapshot,
  ): ActionChoice | undefined {
    const recommendation =
      this.hypothesisEngine
        .recommendExperiment({
          currentState:
            snapshot,

          availableActions,
        });

    if (
      !recommendation
    ) {
      return undefined;
    }

    return {
      action:
        recommendation.action,

      strategy:
        "hypothesis-experiment",

      expectedEffects: [
        "Autonomously generated causal hypotheses disagree in this state; this action was selected for information gain " +
        recommendation
          .informationGain
          .toFixed(3) +
        ".",
      ],
    };
  }

  private initializeSkillTransfer(
    initialState:
      EnvironmentSnapshot,

    availableActions:
      readonly string[],
  ): void {
    if (
      !this.skillLibrary
    ) {
      return;
    }

    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      !goalReader
    ) {
      return;
    }

    const goalConditions =
      goalReader.call(
        this.environment,
      );

    this.recalledSkill =
      this.skillLibrary
        .recommendSkill({
          currentState:
            initialState,

          goalConditions,

          availableActions,
        });

    if (
      !this.recalledSkill
    ) {
      this.skillComposition =
        this.skillComposer
          ?.compose({
            currentState:
              initialState,

            goalConditions,

            availableActions,
          });
    }
  }

  private initializeStructuralSkillTransfer(
    initialState:
      EnvironmentSnapshot,

    availableActions:
      readonly string[],
  ): void {
    if (
      this.recalledSkill ||
      (
        this.skillComposition &&
        this.skillComposition
          .actions
          .length >
          0
      ) ||
      !this.structuralSkillEngine
    ) {
      return;
    }

    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      !goalReader
    ) {
      return;
    }

    this.structuralSkillSession =
      this.structuralSkillEngine
        .createSession({
          initialState,

          goalConditions:
            goalReader.call(
              this.environment,
            ),

          availableActions,
        });
  }

  private nextSkillAction(
    availableActions:
      readonly string[],
  ): ActionChoice | undefined {
    if (
      !this.recalledSkill ||
      this.skillAbandoned
    ) {
      return undefined;
    }

    while (
      this.skillIndex <
      this.recalledSkill
        .skill
        .steps
        .length
    ) {
      const stepIndex =
        this.skillIndex;

      const step =
        this.recalledSkill
          .skill
          .steps[
            stepIndex
          ];

      this.skillIndex +=
        1;

      if (
        !availableActions.includes(
          step.action,
        )
      ) {
        this.skillAbandoned =
          true;

        return undefined;
      }

      return {
        action:
          step.action,

        strategy:
          "skill",

        skillId:
          this.recalledSkill
            .skill
            .id,

        skillStepIndex:
          stepIndex,

        expectedEffects:
          step.effects.map(
            (effect) =>
              `${effect.key}: ${String(
                effect.before,
              )} -> ${String(
                effect.after,
              )}`,
          ),
      };
    }

    return undefined;
  }

  private nextSkillCompositionAction(
    availableActions:
      readonly string[],
  ): ActionChoice | undefined {
    if (
      !this.skillComposition ||
      this.skillCompositionAbandoned
    ) {
      return undefined;
    }

    while (
      this.skillCompositionIndex <
      this.skillComposition
        .actions
        .length
    ) {
      const composed =
        this.skillComposition
          .actions[
            this.skillCompositionIndex
          ];

      this.skillCompositionIndex +=
        1;

      if (
        !availableActions.includes(
          composed.action,
        )
      ) {
        this.skillCompositionAbandoned =
          true;

        return undefined;
      }

      const skill =
        this.skillLibrary
          ?.getSkills()
          .find(
            (candidate) =>
              candidate.id ===
              composed.skillId,
          );

      const step =
        skill
          ?.steps[
            composed.stepIndex
          ];

      return {
        action:
          composed.action,

        strategy:
          "skill-composition",

        skillId:
          composed.skillId,

        skillStepIndex:
          composed.stepIndex,

        expectedEffects:
          step
            ? step.effects.map(
                (effect) =>
                  `${effect.key}: ${String(
                    effect.before,
                  )} -> ${String(
                    effect.after,
                  )}`,
              )
            : [
                "A composed reusable skill predicts this action advances the larger goal.",
              ],
      };
    }

    return undefined;
  }

  private nextStructuralSkillAction(
    availableActions:
      readonly string[],
  ): ActionChoice | undefined {
    const recommendation =
      this.structuralSkillSession
        ?.recommend(
          availableActions,
        );

    if (
      !recommendation
    ) {
      return undefined;
    }

    return {
      action:
        recommendation.action,

      strategy:
        "structural-skill",

      expectedEffects: [
        recommendation
            .expectedRole ===
          "goal"
          ? "A learned skill's relational structure predicts this renamed target action fills the final goal role."
          : "A learned skill's relational structure predicts this renamed target action fills the next prerequisite role.",
      ],
    };
  }

  private recordStructuralSkillCorrection(
    choice:
      ActionChoice,

    update:
      {
        invalidated:
          boolean;

        reason?:
          string;
      } |
      undefined,

    observation:
      Observation,
  ): void {
    if (
      choice.strategy !==
        "structural-skill" ||
      !update
        ?.invalidated ||
      this.structuralSkillCorrectionRecorded
    ) {
      return;
    }

    this.structuralSkillCorrectionRecorded =
      true;

    this.apply({
      type:
        "learning.recorded",

      learning: {
        id:
          this.nextId(
            "learning",
          ),

        kind:
          "correction",

        statement:
          "Target evidence contradicted the learned skill's relational structure, so Mabojolu abandoned structural skill transfer and returned to evidence-driven problem solving.",

        confidence:
          0.95,

        derivedFromIds: [
          observation.id,
        ],

        createdAt:
          this.now(),
      },
    });
  }

  private recordSkillExecutionOutcome(
    choice:
      ActionChoice,

    before:
      EnvironmentSnapshot,

    after:
      EnvironmentSnapshot,

    observation:
      Observation,
  ): void {
    if (
      (
        choice.strategy !==
          "skill" &&
        choice.strategy !==
          "skill-composition"
      ) ||
      !choice.skillId ||
      choice.skillStepIndex ===
        undefined ||
      !this.skillLibrary
    ) {
      return;
    }

    const update =
      this.skillLibrary
        .observeExecution({
          skillId:
            choice.skillId,

          stepIndex:
            choice.skillStepIndex,

          before,

          after,

          evidenceId:
            this.environment.id +
            "::" +
            observation.id,

          observedAt:
            observation
              .observedAt,
        });

    if (
      !update ||
      update.matched
    ) {
      return;
    }

    if (
      choice.strategy ===
      "skill"
    ) {
      this.skillAbandoned =
        true;
    } else {
      this.skillCompositionAbandoned =
        true;
    }

    this.apply({
      type:
        "learning.recorded",

      learning: {
        id:
          this.nextId(
            "learning",
          ),

        kind:
          "correction",

        statement:
          `Learned skill ${choice.skillId} failed at step ${choice.skillStepIndex + 1}, so Mabojolu abandoned the skill and returned to evidence-driven problem solving.`,

        confidence:
          0.95,

        derivedFromIds: [
          observation.id,
        ],

        createdAt:
          this.now(),
      },
    });
  }

  private initializeStructuralTransfer(
    initialState:
      EnvironmentSnapshot,

    availableActions:
      readonly string[],
  ): void {
    if (
      !this.structuralTransfer ||
      this.structuralSkillSession
    ) {
      return;
    }

    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      !goalReader
    ) {
      return;
    }

    this.structuralSession =
      this.structuralTransfer
        .createSession({
          environmentId:
            this.environment.id,

          initialState,

          goalConditions:
            goalReader.call(
              this.environment,
            ),

          availableActions,
        });
  }

  private nextStructuralTransferAction(
    availableActions:
      readonly string[],
  ): ActionChoice | undefined {
    const recommendation =
      this.structuralSession
        ?.recommend(
          availableActions,
        );

    if (
      !recommendation
    ) {
      return undefined;
    }

    return {
      action:
        recommendation.action,

      strategy:
        "structural-transfer",

      expectedEffects: [
        recommendation
            .expectedRole ===
          "goal"
          ? "A cross-environment structural analogy predicts this action fills the gated goal role."
          : recommendation
                .expectedRole ===
              "probe"
            ? "Competing structural hypotheses disagree about this action, so it was selected to reduce uncertainty."
            : "A cross-environment structural analogy predicts this action fills a remaining setup role.",
      ],
    };
  }

  private nextTransferAction(
    availableActions:
      readonly string[],
  ): string | undefined {
    if (
      !this.recalledPlan
    ) {
      return undefined;
    }

    while (
      this.transferIndex <
      this.recalledPlan
        .actions.length
    ) {
      const candidate =
        this.recalledPlan
          .actions[
            this.transferIndex
          ];

      this.transferIndex +=
        1;

      if (
        availableActions.includes(
          candidate,
        )
      ) {
        return candidate;
      }
    }

    return undefined;
  }

  private actionKind(
    strategy:
      ActionChoiceStrategy,
  ): string {
    switch (strategy) {
      case "world-model-plan":
        return "world-model-plan";

      case "skill":
        return "skill";

      case "skill-composition":
        return "skill-composition";

      case "structural-skill":
        return "structural-skill";

      case "structural-transfer":
        return "structural-transfer";

      case "transfer":
        return "transfer";

      case "abstract-principle":
        return "abstract-principle";

      case "scientific-discovery-setup":
        return "scientific-discovery-setup";

      case "hypothesis-experiment":
        return "hypothesis-experiment";

      default:
        return "experiment";
    }
  }

  private defaultExpectedEffects(
    strategy:
      ActionChoiceStrategy,
  ): string[] {
    switch (strategy) {
      case "world-model-plan":
        return [
          "The learned causal world model predicts this action advances the goal.",
        ];

      case "skill":
        return [
          "A repeatedly supported reusable skill predicts this action advances the goal.",
        ];

      case "skill-composition":
        return [
          "A sequence of separately learned reusable skills predicts this action advances a larger unfamiliar goal.",
        ];

      case "structural-skill":
        return [
          "A learned skill's relational structure predicts this action fills a corresponding role despite renamed target symbols.",
        ];

      case "structural-transfer":
        return [
          "A cross-environment structural analogy predicts this action contributes to the goal.",
        ];

      case "transfer":
        return [
          "Prior successful experience suggests this action contributes to the goal.",
        ];

      case "abstract-principle":
        return [
          "A higher-order principle induced across distinct task families suggests retrying a deferred action after observable progress.",
        ];

      case "scientific-discovery-setup":
        return [
          "This action moves the environment toward a state selected for a discriminating causal experiment.",
        ];

      case "hypothesis-experiment":
        return [
          "This action was selected to discriminate between autonomously generated causal hypotheses.",
        ];

      default:
        return [
          "The action may reveal information about the environment.",
        ];
    }
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

    if (
      !hypothesisId
    ) {
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

    if (
      !existing
    ) {
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

    void before;
    void after;
  }

  private syncAutonomousHypotheses():
    void {
    for (
      const hypothesis of
        this.hypothesisEngine
          .getHypotheses()
    ) {
      this.apply({
        type:
          "hypothesis.updated",

        hypothesis: {
          id:
            hypothesis.id,

          statement:
            hypothesis
              .statement,

          confidence:
            hypothesis
              .confidence,

          status:
            hypothesis
              .status,

          evidenceFor: [
            ...hypothesis
              .evidenceForIds,
          ],

          evidenceAgainst: [
            ...hypothesis
              .evidenceAgainstIds,
          ],

          createdAt:
            hypothesis
              .createdAt,

          updatedAt:
            hypothesis
              .updatedAt,
        },
      });
    }
  }

  private recordStructuralTransferCorrection(
    choice:
      ActionChoice,

    update:
      StructuralTransferUpdate |
      undefined,

    observation:
      Observation,
  ): void {
    if (
      !update
        ?.invalidated ||
      this.structuralCorrectionRecorded
    ) {
      return;
    }

    this.structuralCorrectionRecorded =
      true;

    this.apply({
      type:
        "learning.recorded",

      learning: {
        id:
          this.nextId(
            "learning",
          ),

        kind:
          "correction",

        statement:
          choice.strategy ===
            "structural-transfer"
            ? "A structurally transferred prediction failed, so the cross-environment analogy was abandoned."
            : "Target-world evidence contradicted the active cross-environment analogy, so the structural transfer hypothesis was abandoned.",

        confidence:
          0.95,

        derivedFromIds: [
          observation.id,
        ],

        createdAt:
          this.now(),
      },
    });
  }

  private recordTransferCorrection(
    choice:
      ActionChoice,

    changes:
      SnapshotChange[],

    observation:
      Observation,
  ): void {
    if (
      choice.strategy !==
        "transfer" ||
      changes.length > 0
    ) {
      return;
    }

    this.apply({
      type:
        "learning.recorded",

      learning: {
        id:
          this.nextId(
            "learning",
          ),

        kind:
          "correction",

        statement:
          `Transferred action ${choice.action} produced no observable effect in this episode, so prior knowledge must be re-tested.`,

        confidence:
          0.95,

        derivedFromIds: [
          observation.id,
        ],

        createdAt:
          this.now(),
      },
    });
  }

  private recordWorldModelCorrection(
    choice:
      ActionChoice,

    changes:
      SnapshotChange[],

    observation:
      Observation,
  ): void {
    if (
      choice.strategy !==
        "world-model-plan" ||
      changes.length > 0
    ) {
      return;
    }

    this.apply({
      type:
        "learning.recorded",

      learning: {
        id:
          this.nextId(
            "learning",
          ),

        kind:
          "correction",

        statement:
          `World-model-guided action ${choice.action} produced no observable effect, so the causal prediction must be revised.`,

        confidence:
          0.95,

        derivedFromIds: [
          observation.id,
        ],

        createdAt:
          this.now(),
      },
    });
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

    if (
      existingId
    ) {
      const existing =
        this.state
          .hypotheses
          .find(
            (hypothesis) =>
              hypothesis.id ===
              existingId,
          );

      if (
        !existing
      ) {
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

    return (
      `Observable state: ${state}.`
    );
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
    const goal =
      this.state
        .goals
        .find(
          (candidate) =>
            candidate.id ===
            this.rootGoalId,
        );

    if (
      !goal
    ) {
      return;
    }

    this.goalHierarchy
      .complete(
        this.rootGoalId,
      );

    this.syncGoalHierarchyToState();

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
  private finishRun(
    solved:
      boolean,
  ): CognitiveRunResult {
    const goalReader =
      this.environment
        .getGoalConditions;

    if (
      this.structuralTransfer &&
      goalReader
    ) {
      this.structuralTransfer
        .learnFromEpisode({
          environmentId:
            this.environment.id,

          solved,

          goalConditions:
            goalReader.call(
              this.environment,
            ),

          availableActions:
            this.environment
              .getAvailableActions(),

          transitions:
            this.episodeTransitions,
        });
    }

    let recordedEpisodeId:
      string |
      undefined;

    let completedAt:
      string |
      undefined;

    if (
      this.memory ||
      this.skillLibrary ||
      this.abstractPrincipleLibrary ||
      this.abstractPrinciplePortfolio
    ) {
      completedAt =
        this.now();
    }

    if (
      this.memory &&
      completedAt
    ) {
      recordedEpisodeId =
        this.memory
          .recordEpisode({
            environmentId:
              this.environment.id,

            goalDescription:
              this.environment
                .goalDescription,

            solved,

            cycles:
              this.state.cycle,

            transitions:
              this.episodeTransitions,

            completedAt,
          })
          .id;
    }

    const goalConditions =
      goalReader
        ? goalReader.call(
            this.environment,
          )
        : undefined;

    const episodeEvidenceId =
      completedAt
        ? recordedEpisodeId ??
          this.environment.id +
            "::" +
            completedAt
        : undefined;

    if (
      this.taskFamily &&
      this.taskFamilyKind &&
      goalConditions &&
      completedAt &&
      episodeEvidenceId
    ) {
      const principleEpisode = {
        episodeId:
          episodeEvidenceId,

        family:
          this.taskFamily,

        familyKind:
          this.taskFamilyKind,

        solved,

        goalConditions,

        transitions:
          this.episodeTransitions,

        observedAt:
          completedAt,
      };

      if (
        this.abstractPrinciplePortfolio
      ) {
        this.abstractPrinciplePortfolio
          .learnFromEpisode(
            principleEpisode,
          );
      } else {
        this.abstractPrincipleLibrary
          ?.learnFromEpisode(
            principleEpisode,
          );
      }
    }

    if (
      this.skillLibrary &&
      goalConditions &&
      completedAt
    ) {
      const skill =
        this.skillLibrary
          .learnFromEpisode({
            episodeId:
              episodeEvidenceId ??
              this.environment.id +
                "::" +
                completedAt,

            environmentId:
              this.environment.id,

            solved,

            goalConditions,

            transitions:
              this.episodeTransitions,

            observedAt:
              completedAt,
          });

      if (
        skill?.status ===
        "active"
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
              "skill",

            statement:
              `Repeated successful experience supports reusable skill ${skill.id}: ${skill.steps
                .map(
                  (step) =>
                    step.action,
                )
                .join(" -> ")}.`,

            confidence:
              skill.confidence,

            derivedFromIds: [
              ...skill
                .sourceEpisodeIds,
            ],

            createdAt:
              this.now(),
          },
        });
      }
    }

    return this.result(
      solved,
    );
  }

  private result(
    solved:
      boolean,
  ): CognitiveRunResult {
    const abstractPrinciple =
      this.abstractPrincipleLibrary
        ?.getPrinciple();

    const abstractPrinciplePortfolio =
      this.abstractPrinciplePortfolioController
        ?.getSnapshot();

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

      ...(this.recalledPlan
        ? {
            recalledPlan: {
              ...this.recalledPlan,

              actions: [
                ...this.recalledPlan
                  .actions,
              ],
            },
          }
        : {}),

      ...(this.skillComposition
        ? {
            skillComposition: {
              ...this.skillComposition,

              skillIds: [
                ...this.skillComposition
                  .skillIds,
              ],

              actions:
                this.skillComposition
                  .actions
                  .map(
                    (action) => ({
                      ...action,
                    }),
                  ),

              projectedFinalState: {
                ...this.skillComposition
                  .projectedFinalState,
              },
            },
          }
        : {}),

      ...(this.structuralSkillSession
        ? {
            structuralSkillTransfer:
              this.structuralSkillSession
                .getState(),
          }
        : {}),

      ...(abstractPrinciplePortfolio
        ? {
            abstractPrinciplePortfolio,
          }
        : {}),

      ...(abstractPrinciple
        ? {
            abstractPrinciple: {
              ...abstractPrinciple,

              supportFamilies: [
                ...abstractPrinciple
                  .supportFamilies,
              ],

              supportFamilyKinds: [
                ...abstractPrinciple
                  .supportFamilyKinds,
              ],

              supportEpisodeIds: [
                ...abstractPrinciple
                  .supportEpisodeIds,
              ],
            },
          }
        : {}),

      ...(this.recalledSkill
        ? {
            recalledSkill: {
              ...this.recalledSkill,

              actions: [
                ...this.recalledSkill
                  .actions,
              ],

              skill: {
                ...this.recalledSkill
                  .skill,

                preconditions: {
                  ...this.recalledSkill
                    .skill
                    .preconditions,
                },

                goalEffects: {
                  ...this.recalledSkill
                    .skill
                    .goalEffects,
                },

                steps:
                  this.recalledSkill
                    .skill
                    .steps
                    .map(
                      (step) => ({
                        ...step,

                        preconditions: {
                          ...step
                            .preconditions,
                        },

                        effects:
                          step.effects.map(
                            (effect) => ({
                              ...effect,
                            }),
                          ),
                      }),
                    ),

                sourceEpisodeIds: [
                  ...this.recalledSkill
                    .skill
                    .sourceEpisodeIds,
                ],

                sourceEnvironmentIds: [
                  ...this.recalledSkill
                    .skill
                    .sourceEnvironmentIds,
                ],

                contradictionEvidenceIds: [
                  ...this.recalledSkill
                    .skill
                    .contradictionEvidenceIds,
                ],
              },
            },
          }
        : {}),

      ...(this.autonomousDecomposition
        ? {
            autonomousDecomposition: {
              ...this.autonomousDecomposition,

              goalConditions: {
                ...this.autonomousDecomposition
                  .goalConditions,
              },

              goals:
                this.autonomousDecomposition
                  .goals
                  .map(
                    (goal) => ({
                      ...goal,

                      conditions: {
                        ...goal
                          .conditions,
                      },

                      dependsOnGoalIds: [
                        ...goal
                          .dependsOnGoalIds,
                      ],
                    }),
                  ),
            },
          }
        : {}),

      generatedHypotheses:
        this.hypothesisEngine
          .getHypotheses()
          .map(
            (hypothesis) => ({
              ...hypothesis,

              conditions: {
                ...hypothesis
                  .conditions,
              },

              effects:
                hypothesis
                  .effects
                  .map(
                    (effect) => ({
                      ...effect,
                    }),
                  ),

              evidenceForIds: [
                ...hypothesis
                  .evidenceForIds,
              ],

              evidenceAgainstIds: [
                ...hypothesis
                  .evidenceAgainstIds,
              ],
            }),
          ),

      goalHierarchy:
        this.goalHierarchy
          .getSnapshot(),

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
    prefix:
      string,
  ): string {
    this.sequence +=
      1;

    return (
      `${prefix}-${this.sequence}`
    );
  }

  private now():
    string {
    return this.clock();
  }
}
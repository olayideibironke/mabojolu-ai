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
  | "structural-transfer"
  | "transfer"
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

  hierarchyGoalId?:
    string;

  predictedState?:
    EnvironmentSnapshot;
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
}

export interface CognitiveRunResult {
  solved: boolean;

  cycles: number;

  actionHistory:
    string[];

  recalledPlan?:
    RecalledPlan;

  generatedHypotheses:
    AutonomousCausalHypothesis[];

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
 * 1. Use a causal world-model plan when enough knowledge exists.
 * 2. Use recalled successful episode knowledge when available.
 * 3. Experiment with never-tried actions.
 * 4. Re-test actions whose effect may depend on changed state.
 * 5. Continue state-specific exploration.
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

  private readonly maxCycles:
    number;

  private readonly clock:
    () => string;

  private readonly goalHierarchy:
    HierarchicalGoalReasoner;

  private readonly rootGoalId:
    string;

  private hierarchyPlanInitialized =
    false;

  private hierarchyPlanGoalIds:
    string[] = [];

  private hierarchyPlanIndex =
    0;

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

    this.hypothesisEngine =
      options.hypothesisEngine ??
      new AutonomousCausalHypothesisEngine();

    this.structuralTransfer =
      options.structuralTransfer;

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

      this.updateGoalHierarchyAfterAction(
        choice,
        after,
      );

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

      this.recordStructuralTransferCorrection(
        choice,
        structuralUpdate,
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

    this.initializeGoalHierarchyFromPlan(
      plan.steps,
    );

    const hierarchyGoalId =
      this.hierarchyPlanGoalIds[
        this.hierarchyPlanIndex
      ];

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

      ...(hierarchyGoalId
        ? {
            hierarchyGoalId,
          }
        : {}),

      predictedState: {
        ...firstStep
          .predictedState,
      },
    };
  }

  private initializeGoalHierarchyFromPlan(
    steps:
      readonly {
        action: string;
        predictedState:
          EnvironmentSnapshot;
      }[],
  ): void {
    if (
      this.hierarchyPlanInitialized ||
      steps.length ===
        0
    ) {
      return;
    }

    const specifications =
      steps.map(
        (
          step,
          index,
        ) => {
          const id =
            `hierarchy-step-${index + 1}`;

          const previousId =
            index > 0
              ? `hierarchy-step-${index}`
              : undefined;

          const stateDescription =
            Object.entries(
              step.predictedState,
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

          return {
            id,

            description:
              `Reach modeled state after action ${step.action}.`,

            priority:
              Math.max(
                1,
                100 -
                  index,
              ),

            successCriteria: [
              `Observable state matches: ${stateDescription}.`,
            ],

            ...(previousId
              ? {
                  dependsOnGoalIds: [
                    previousId,
                  ],
                }
              : {}),
          };
        },
      );

    this.goalHierarchy
      .decompose(
        this.rootGoalId,
        specifications,
      );

    this.hierarchyPlanGoalIds =
      specifications.map(
        (specification) =>
          specification.id,
      );

    this.hierarchyPlanInitialized =
      true;

    const next =
      this.goalHierarchy
        .nextActionableGoal();

    if (
      next
    ) {
      this.goalHierarchy
        .activate(
          next.id,
        );
    }

    this.syncGoalHierarchyToState();
  }

  private updateGoalHierarchyAfterAction(
    choice:
      ActionChoice,

    after:
      EnvironmentSnapshot,
  ): void {
    if (
      !choice.hierarchyGoalId ||
      !choice.predictedState
    ) {
      return;
    }

    const predictionMatched =
      snapshotSignature(
        choice.predictedState,
      ) ===
      snapshotSignature(
        after,
      );

    if (
      predictionMatched
    ) {
      this.goalHierarchy
        .complete(
          choice
            .hierarchyGoalId,
        );

      this.hierarchyPlanIndex +=
        1;

      const next =
        this.goalHierarchy
          .nextActionableGoal();

      if (
        next
      ) {
        this.goalHierarchy
          .activate(
            next.id,
          );
      }
    } else {
      this.goalHierarchy
        .block(
          choice
            .hierarchyGoalId,
          "The observed state did not match the modeled subgoal prediction.",
        );
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

  private initializeStructuralTransfer(
    initialState:
      EnvironmentSnapshot,

    availableActions:
      readonly string[],
  ): void {
    if (
      !this.structuralTransfer
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

      case "structural-transfer":
        return "structural-transfer";

      case "transfer":
        return "transfer";

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

      case "structural-transfer":
        return [
          "A cross-environment structural analogy predicts this action contributes to the goal.",
        ];

      case "transfer":
        return [
          "Prior successful experience suggests this action contributes to the goal.",
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

    this.memory
      ?.recordEpisode({
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

        completedAt:
          this.now(),
      });

    return this.result(
      solved,
    );
  }

  private result(
    solved:
      boolean,
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
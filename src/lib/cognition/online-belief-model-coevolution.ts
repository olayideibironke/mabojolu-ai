import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import {
  generatePrerequisiteAwarePlan,
  learnActionPrerequisite,
  revisePrerequisiteAwareGoalChain,
  synthesizeStructuralRepairCandidates,
  validateStructuralRepairCandidates,
  type ActionPrerequisiteObservation,
  type LearnedActionPrerequisite,
  type PrerequisiteAwarePlan,
  type PrerequisitePlanRevision,
  type StructuralRepairDecision,
} from "./structural-repair-prerequisite-planning";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  MultidimensionalCausalModel,
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

import type {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  RecedingVectorAction,
  RecedingVectorBelief,
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface OnlinePredictionMismatchRecord {
  id: string;
  predictedEffect: number;
  observedEffect: number;
  absoluteResidual: number;
  mismatch: boolean;
}

export interface OnlinePredictionMismatchStatus {
  records: OnlinePredictionMismatchRecord[];
  mismatchCount: number;
  consecutiveMismatchCount: number;
  meanAbsoluteResidual: number;
  triggered: boolean;
}

export interface OnlineHypothesisCatalogRevision {
  hypotheses: RecedingVectorHypothesis[];
  belief: RecedingVectorBelief;
  replacedHypothesisId: string;
  revisedHypothesisId: string;
}

export interface OnlineBeliefModelCoevolutionDecision {
  decision:
    | "revised"
    | "retained"
    | "abstained";
  mismatchStatus: OnlinePredictionMismatchStatus;
  repairDecision?: StructuralRepairDecision;
  learnedPrerequisite?: LearnedActionPrerequisite;
  revisedHypothesis?: RecedingVectorHypothesis;
  catalogRevision?: OnlineHypothesisCatalogRevision;
  revisedPlan?: PrerequisiteAwarePlan;
  goalRevision?: PrerequisitePlanRevision;
  reason:
    | "persistent-mismatch-repaired-and-replanned"
    | "mismatch-evidence-insufficient"
    | "protected-repair-not-earned"
    | "prerequisite-unresolved"
    | "revised-plan-unavailable";
}

function validateNonNegativeFinite(
  name: string,
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function normalizeProbabilityRecord(
  probabilities: Readonly<Record<string, number>>,
): Record<string, number> {
  const entries =
    Object.entries(probabilities);

  const total =
    entries.reduce(
      (sum, [, value]) =>
        sum + value,
      0,
    );

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(
      "Online hypothesis belief cannot be normalized.",
    );
  }

  return Object.fromEntries(
    entries.map(
      ([id, value]) => [
        id,
        value / total,
      ],
    ),
  );
}

function entropy(
  probabilities: readonly number[],
): number {
  let result = 0;

  for (const probability of probabilities) {
    if (probability > 0) {
      result -=
        probability *
        Math.log(probability);
    }
  }

  return result;
}

function summarizeBelief(
  probabilities: Readonly<Record<string, number>>,
): RecedingVectorBelief {
  const normalized =
    normalizeProbabilityRecord(
      probabilities,
    );

  const ranked =
    Object.entries(normalized)
      .sort(
        (left, right) =>
          right[1] -
            left[1] ||
          left[0].localeCompare(
            right[0],
          ),
      );

  const top =
    ranked[0];

  if (!top) {
    throw new Error(
      "Online hypothesis belief has no hypotheses.",
    );
  }

  return {
    probabilities:
      normalized,

    topHypothesisId:
      top[0],

    confidence:
      top[1],

    normalizedEntropy:
      ranked.length <= 1
        ? 0
        : entropy(
            ranked.map(
              ([, probability]) =>
                probability,
            ),
          ) /
          Math.log(
            ranked.length,
          ),
  };
}

function cloneHypothesis(
  hypothesis: RecedingVectorHypothesis,
): RecedingVectorHypothesis {
  return {
    ...hypothesis,

    dimensionEffects:
      Object.fromEntries(
        Object.entries(
          hypothesis.dimensionEffects,
        ).map(
          ([dimension, effects]) => [
            dimension,
            {
              ...effects,
            },
          ],
        ),
      ),

    actionPrerequisites:
      Object.fromEntries(
        Object.entries(
          hypothesis.actionPrerequisites,
        ).map(
          ([actionId, prerequisites]) => [
            actionId,
            {
              ...prerequisites,
            },
          ],
        ),
      ),
  };
}

export class OnlinePredictionMismatchTracker {
  private readonly records:
    OnlinePredictionMismatchRecord[] =
      [];

  private consecutiveMismatchCount =
    0;

  constructor(
    private readonly minimumConsecutiveMismatches =
      3,

    private readonly absoluteResidualThreshold =
      0.1,
  ) {
    if (
      !Number.isInteger(
        minimumConsecutiveMismatches,
      ) ||
      minimumConsecutiveMismatches <
        1
    ) {
      throw new Error(
        "minimumConsecutiveMismatches must be a positive integer.",
      );
    }

    validateNonNegativeFinite(
      "absoluteResidualThreshold",
      absoluteResidualThreshold,
    );
  }

  record(
    id: string,
    predictedEffect: number,
    observedEffect: number,
  ): OnlinePredictionMismatchStatus {
    if (
      id.trim().length ===
      0
    ) {
      throw new Error(
        "Mismatch records require an id.",
      );
    }

    if (
      !Number.isFinite(
        predictedEffect,
      ) ||
      !Number.isFinite(
        observedEffect,
      )
    ) {
      throw new Error(
        "Prediction mismatch values must be finite.",
      );
    }

    const absoluteResidual =
      Math.abs(
        observedEffect -
          predictedEffect,
      );

    const mismatch =
      absoluteResidual >=
      this.absoluteResidualThreshold;

    if (mismatch) {
      this.consecutiveMismatchCount +=
        1;
    } else {
      this.consecutiveMismatchCount =
        0;
    }

    this.records.push({
      id,

      predictedEffect,

      observedEffect,

      absoluteResidual,

      mismatch,
    });

    return this.getStatus();
  }

  getStatus():
    OnlinePredictionMismatchStatus {
    const mismatchCount =
      this.records.filter(
        (record) =>
          record.mismatch,
      ).length;

    const meanAbsoluteResidual =
      this.records.length ===
        0
        ? 0
        : this.records.reduce(
            (sum, record) =>
              sum +
              record.absoluteResidual,
            0,
          ) /
          this.records.length;

    return {
      records:
        this.records.map(
          (record) => ({
            ...record,
          }),
        ),

      mismatchCount,

      consecutiveMismatchCount:
        this.consecutiveMismatchCount,

      meanAbsoluteResidual,

      triggered:
        this.consecutiveMismatchCount >=
        this.minimumConsecutiveMismatches,
    };
  }
}

export function buildOnlineReliabilitySummary(
  fragmentId: string,
  mismatchStatus: OnlinePredictionMismatchStatus,
): FragmentReliabilitySummary {
  if (
    fragmentId.trim().length ===
    0
  ) {
    throw new Error(
      "Online reliability requires a fragment id.",
    );
  }

  const blameEpisodes =
    mismatchStatus
      .mismatchCount;

  const supportEpisodes =
    mismatchStatus
      .records
      .filter(
        (record) =>
          !record.mismatch,
      )
      .length;

  const posteriorReliability =
    (
      1 +
      supportEpisodes
    ) /
    (
      2 +
      supportEpisodes +
      blameEpisodes
    );

  const quarantined =
    mismatchStatus.triggered &&
    posteriorReliability <=
      0.4;

  return {
    fragments: [
      {
        fragmentId,

        episodes:
          mismatchStatus
            .records
            .length,

        supportEpisodes,

        blameEpisodes,

        neutralEpisodes:
          0,

        posteriorReliability,

        quarantined,
      },
    ],

    quarantinedFragmentIds:
      quarantined
        ? [
            fragmentId,
          ]
        : [],
  };
}

export function hypothesisToPlanningModel(
  hypothesis: RecedingVectorHypothesis,
): MultidimensionalCausalModel {
  const dimensionPrograms:
    Record<
      string,
      HierarchicalCausalProgram
    > = {};

  for (
    const [
      dimension,
      effects,
    ] of
      Object.entries(
        hypothesis.dimensionEffects,
      )
  ) {
    dimensionPrograms[
      dimension
    ] = {
      id:
        `${hypothesis.id}:${dimension}`,

      baseEffects: {
        ...effects,
      },

      fragments:
        [],

      observationStdDev:
        hypothesis
          .observationStdDev,

      depth:
        1,

      complexity:
        0,
    };
  }

  return {
    id:
      hypothesis.id,

    dimensionPrograms,
  };
}

export function recedingActionsToWorldModelActions(
  actions: readonly RecedingVectorAction[],
): WorldModelAction[] {
  return actions.map(
    (action) => ({
      id:
        action.id,

      interventions: {
        [
          action.id
        ]:
          1,
      },

      risk:
        action.risk,

      cost:
        action.cost,

      reversible:
        action.reversible,
    }),
  );
}

export function buildPlanForLiveHypothesis(
  hypothesis: RecedingVectorHypothesis,
  currentState: Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions: readonly RecedingVectorAction[],
  prerequisite: LearnedActionPrerequisite,
): PrerequisiteAwarePlan {
  return generatePrerequisiteAwarePlan(
    [
      hypothesisToPlanningModel(
        hypothesis,
      ),
    ],
    new Map([
      [
        hypothesis.id,
        1,
      ],
    ]),
    currentState,
    goal,
    recedingActionsToWorldModelActions(
      actions,
    ),
    [
      prerequisite,
    ],
  );
}

export function applyValidatedOnlineRevision(
  hypothesis: RecedingVectorHypothesis,
  repairDecision: StructuralRepairDecision,
  targetDimension: string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<
            string,
            number
          >
        >
      >
    >,
  prerequisite: LearnedActionPrerequisite,
  revisionNumber = 1,
): RecedingVectorHypothesis {
  if (
    repairDecision.decision !==
      "repaired" ||
    !repairDecision
      .synthesizedFragmentId
  ) {
    throw new Error(
      "Online hypothesis revision requires a protected validated repair.",
    );
  }

  if (
    targetDimension.trim().length ===
    0
  ) {
    throw new Error(
      "Online hypothesis revision requires a target dimension.",
    );
  }

  const revised =
    cloneHypothesis(
      hypothesis,
    );

  const targetEffects = {
    ...(
      revised
        .dimensionEffects[
          targetDimension
        ] ??
      {}
    ),
  };

  for (
    const [
      controlId,
      interventions,
    ] of
      Object.entries(
        controlInterventions,
      )
  ) {
    targetEffects[
      controlId
    ] =
      predictHierarchicalProgramEffect(
        repairDecision.program,
        interventions,
      );
  }

  revised.dimensionEffects[
    targetDimension
  ] =
    targetEffects;

  revised.actionPrerequisites[
    prerequisite.actionId
  ] = {
    ...(
      revised
        .actionPrerequisites[
          prerequisite.actionId
        ] ??
      {}
    ),

    [
      prerequisite
        .stateDimension
    ]:
      prerequisite.threshold,
  };

  revised.id =
    `${hypothesis.id}+online-revision-${revisionNumber}`;

  revised.repairCandidateId =
    repairDecision
      .synthesizedFragmentId;

  revised.prerequisiteHypothesisId =
    `${prerequisite.actionId}:${prerequisite.stateDimension}>=${prerequisite.threshold.toFixed(
      3,
    )}`;

  return revised;
}

export function replaceLiveHypothesisCatalog(
  hypotheses: readonly RecedingVectorHypothesis[],
  belief: RecedingVectorBelief,
  replacedHypothesisId: string,
  revisedHypothesis: RecedingVectorHypothesis,
): OnlineHypothesisCatalogRevision {
  if (
    !hypotheses.some(
      (hypothesis) =>
        hypothesis.id ===
        replacedHypothesisId,
    )
  ) {
    throw new Error(
      `Cannot replace unknown live hypothesis ${replacedHypothesisId}.`,
    );
  }

  const transferredProbability =
    belief.probabilities[
      replacedHypothesisId
    ] ??
    0;

  const probabilities = {
    ...belief.probabilities,
  };

  delete probabilities[
    replacedHypothesisId
  ];

  probabilities[
    revisedHypothesis.id
  ] =
    (
      probabilities[
        revisedHypothesis.id
      ] ??
      0
    ) +
    transferredProbability;

  const revisedBelief =
    summarizeBelief(
      probabilities,
    );

  const revisedHypotheses =
    hypotheses
      .filter(
        (hypothesis) =>
          hypothesis.id !==
          replacedHypothesisId,
      )
      .map(
        cloneHypothesis,
      );

  revisedHypotheses.push(
    cloneHypothesis(
      revisedHypothesis,
    ),
  );

  revisedHypotheses.sort(
    (left, right) =>
      left.id.localeCompare(
        right.id,
      ),
  );

  return {
    hypotheses:
      revisedHypotheses,

    belief:
      revisedBelief,

    replacedHypothesisId,

    revisedHypothesisId:
      revisedHypothesis.id,
  };
}

export function coevolveOnlineBeliefModelAndGoals(
  mismatchStatus: OnlinePredictionMismatchStatus,
  incumbentRepairProgram: HierarchicalCausalProgram,
  damagedFragmentId: string,
  repairEvidence:
    readonly StructuralMechanismObservation[],
  protectedRepairEvidence:
    readonly StructuralMechanismObservation[],
  repairVariables: readonly string[],
  liveHypotheses:
    readonly RecedingVectorHypothesis[],
  liveBelief: RecedingVectorBelief,
  liveHypothesisId: string,
  repairTargetDimension: string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<
            string,
            number
          >
        >
      >
    >,
  prerequisiteEvidence:
    readonly ActionPrerequisiteObservation[],
  prerequisiteActionId: string,
  prerequisiteTargetDimension: string,
  prerequisiteStateDimensions:
    readonly string[],
  currentPrerequisite: LearnedActionPrerequisite,
  currentState: Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions: readonly RecedingVectorAction[],
  currentPlan: PrerequisiteAwarePlan,
  reasoner: HierarchicalGoalReasoner,
  terminalGoalId: string,
  revisionNumber = 1,
): OnlineBeliefModelCoevolutionDecision {
  if (
    currentPrerequisite.actionId !==
      prerequisiteActionId ||
    currentPrerequisite.targetDimension !==
      prerequisiteTargetDimension
  ) {
    throw new Error(
      "Current prerequisite does not match the live plan revision target.",
    );
  }

  if (
    !mismatchStatus.triggered
  ) {
    return {
      decision:
        "retained",

      mismatchStatus,

      reason:
        "mismatch-evidence-insufficient",
    };
  }

  const reliability =
    buildOnlineReliabilitySummary(
      damagedFragmentId,
      mismatchStatus,
    );

  if (
    reliability
      .quarantinedFragmentIds
      .length !==
      1
  ) {
    return {
      decision:
        "retained",

      mismatchStatus,

      reason:
        "mismatch-evidence-insufficient",
    };
  }

  const candidates =
    synthesizeStructuralRepairCandidates(
      incumbentRepairProgram,
      reliability,
      repairEvidence,
      repairVariables,
    );

  const repairDecision =
    validateStructuralRepairCandidates(
      incumbentRepairProgram,
      reliability,
      candidates,
      protectedRepairEvidence,
    );

  if (
    repairDecision.decision !==
      "repaired"
  ) {
    return {
      decision:
        "retained",

      mismatchStatus,

      repairDecision,

      reason:
        "protected-repair-not-earned",
    };
  }

  const learnedPrerequisite =
    learnActionPrerequisite(
      prerequisiteEvidence,
      prerequisiteActionId,
      prerequisiteTargetDimension,
      prerequisiteStateDimensions,
    );

  if (
    !learnedPrerequisite
  ) {
    return {
      decision:
        "abstained",

      mismatchStatus,

      repairDecision,

      reason:
        "prerequisite-unresolved",
    };
  }

  const liveHypothesis =
    liveHypotheses.find(
      (hypothesis) =>
        hypothesis.id ===
        liveHypothesisId,
    );

  if (
    !liveHypothesis
  ) {
    throw new Error(
      `Unknown live hypothesis ${liveHypothesisId}.`,
    );
  }

  const revisedHypothesis =
    applyValidatedOnlineRevision(
      liveHypothesis,
      repairDecision,
      repairTargetDimension,
      controlInterventions,
      learnedPrerequisite,
      revisionNumber,
    );

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      liveHypotheses,
      liveBelief,
      liveHypothesisId,
      revisedHypothesis,
    );

  const revisedPlan =
    buildPlanForLiveHypothesis(
      revisedHypothesis,
      currentState,
      goal,
      actions,
      learnedPrerequisite,
    );

  if (
    revisedPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      mismatchStatus,

      repairDecision,

      learnedPrerequisite,

      revisedHypothesis,

      catalogRevision,

      revisedPlan,

      reason:
        "revised-plan-unavailable",
    };
  }

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      terminalGoalId,
      currentPlan,
      revisedPlan,
      revisionNumber,
    );

  if (
    goalRevision.decision !==
      "revised" &&
    goalRevision.decision !==
      "unchanged"
  ) {
    return {
      decision:
        "abstained",

      mismatchStatus,

      repairDecision,

      learnedPrerequisite,

      revisedHypothesis,

      catalogRevision,

      revisedPlan,

      goalRevision,

      reason:
        "revised-plan-unavailable",
    };
  }

  return {
    decision:
      "revised",

    mismatchStatus,

    repairDecision,

    learnedPrerequisite,

    revisedHypothesis,

    catalogRevision,

    revisedPlan,

    goalRevision,

    reason:
      "persistent-mismatch-repaired-and-replanned",
  };
}

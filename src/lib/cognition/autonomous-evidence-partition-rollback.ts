import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import {
  buildPlanForLiveHypothesis,
  coevolveOnlineBeliefModelAndGoals,
  replaceLiveHypothesisCatalog,
  type OnlineBeliefModelCoevolutionDecision,
  type OnlineHypothesisCatalogRevision,
  type OnlinePredictionMismatchStatus,
} from "./online-belief-model-coevolution";

import {
  revisePrerequisiteAwareGoalChain,
  type ActionPrerequisiteObservation,
  type LearnedActionPrerequisite,
  type PrerequisiteAwarePlan,
  type PrerequisiteAwareVectorSubgoal,
  type PrerequisitePlanRevision,
} from "./structural-repair-prerequisite-planning";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  RecedingVectorAction,
  RecedingVectorBelief,
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface LiveStructuralEvidence {
  sequence: number;
  observation: StructuralMechanismObservation;
}

export type AutonomousEvidenceRole =
  | "repair-fit"
  | "protected-validation";

export interface AutonomousEvidenceAssignment {
  sequence: number;
  observationId: string;
  role: AutonomousEvidenceRole;
  reason:
    | "deterministic-fit-slot"
    | "deterministic-protected-slot";
}

export interface AutonomousEvidencePartition {
  decision:
    | "ready"
    | "abstained";
  assignments: AutonomousEvidenceAssignment[];
  repairFitEvidence: StructuralMechanismObservation[];
  protectedEvidence: StructuralMechanismObservation[];
  repairFitEvidenceIds: string[];
  protectedEvidenceIds: string[];
  reason:
    | "outcome-blind-deterministic-partition"
    | "insufficient-partitioned-evidence";
}

export interface OnlineRevisionArchive {
  revisionId: string;
  previousProgram: HierarchicalCausalProgram;
  installedProgram: HierarchicalCausalProgram;
  previousHypothesis: RecedingVectorHypothesis;
  installedHypothesis: RecedingVectorHypothesis;
  previousPrerequisite: LearnedActionPrerequisite;
  installedPrerequisite: LearnedActionPrerequisite;
  installationProtectedEvidenceIds: string[];
}

export interface AutonomousCoevolutionResult {
  partition: AutonomousEvidencePartition;
  coevolution?: OnlineBeliefModelCoevolutionDecision;
  archive?: OnlineRevisionArchive;
}

export interface OnlineRollbackAssessment {
  decision:
    | "retained"
    | "rolled-back"
    | "reopen-search";
  installedMeanSquaredError: number;
  archivedMeanSquaredError: number;
  improvementFromRollback: number;
  freshProtectedEvidenceIds: string[];
  reason:
    | "installed-revision-still-protected"
    | "archived-model-wins-fresh-protected"
    | "installed-regressed-reopen-search";
}

export interface OnlineRollbackExecution {
  decision:
    | "rolled-back"
    | "abstained";
  catalogRevision?: OnlineHypothesisCatalogRevision;
  rollbackPlan?: PrerequisiteAwarePlan;
  goalRevision?: PrerequisitePlanRevision;
  reason:
    | "archived-model-restored"
    | "rollback-not-authorized"
    | "rollback-plan-unavailable";
}

function cloneObservation(
  observation: StructuralMechanismObservation,
): StructuralMechanismObservation {
  return {
    measuredEffect:
      observation.measuredEffect,

    experiment: {
      ...observation.experiment,

      interventions: {
        ...observation
          .experiment
          .interventions,
      },
    },
  };
}

function cloneProgram(
  program: HierarchicalCausalProgram,
): HierarchicalCausalProgram {
  return {
    ...program,

    baseEffects: {
      ...program.baseEffects,
    },

    fragments:
      program.fragments.map(
        (fragment) => ({
          ...fragment,

          terms:
            fragment.terms.map(
              (term) => ({
                ...term,

                variables: [
                  ...term.variables,
                ],
              }),
            ),
        }),
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

function clonePrerequisite(
  prerequisite: LearnedActionPrerequisite,
): LearnedActionPrerequisite {
  return {
    ...prerequisite,
  };
}

function validatePositiveInteger(
  name: string,
  value: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }
}

function validateNonNegativeFinite(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

export function partitionLiveStructuralEvidence(
  evidence: readonly LiveStructuralEvidence[],
  options?: {
    protectedStride?: number;
    protectedOffset?: number;
    minimumRepairFitEvidence?: number;
    minimumProtectedEvidence?: number;
  },
): AutonomousEvidencePartition {
  const protectedStride =
    options?.protectedStride ??
    2;

  const protectedOffset =
    options?.protectedOffset ??
    1;

  const minimumRepairFitEvidence =
    options?.minimumRepairFitEvidence ??
    2;

  const minimumProtectedEvidence =
    options?.minimumProtectedEvidence ??
    2;

  validatePositiveInteger(
    "protectedStride",
    protectedStride,
  );

  if (
    !Number.isInteger(
      protectedOffset,
    ) ||
    protectedOffset < 0 ||
    protectedOffset >=
      protectedStride
  ) {
    throw new Error(
      "protectedOffset must be an integer inside the protected stride.",
    );
  }

  validatePositiveInteger(
    "minimumRepairFitEvidence",
    minimumRepairFitEvidence,
  );

  validatePositiveInteger(
    "minimumProtectedEvidence",
    minimumProtectedEvidence,
  );

  const sorted =
    evidence
      .map(
        (entry) => ({
          sequence:
            entry.sequence,

          observation:
            cloneObservation(
              entry.observation,
            ),
        }),
      )
      .sort(
        (left, right) =>
          left.sequence -
            right.sequence ||
          left.observation
            .experiment
            .id
            .localeCompare(
              right.observation
                .experiment
                .id,
            ),
      );

  const seenSequences =
    new Set<number>();

  const seenIds =
    new Set<string>();

  for (const entry of sorted) {
    if (
      !Number.isInteger(
        entry.sequence,
      ) ||
      entry.sequence < 0
    ) {
      throw new Error(
        "Live evidence sequence numbers must be non-negative integers.",
      );
    }

    if (
      seenSequences.has(
        entry.sequence,
      )
    ) {
      throw new Error(
        `Duplicate live evidence sequence ${entry.sequence}.`,
      );
    }

    const id =
      entry.observation
        .experiment
        .id;

    if (
      seenIds.has(id)
    ) {
      throw new Error(
        `Duplicate live evidence id ${id}.`,
      );
    }

    seenSequences.add(
      entry.sequence,
    );

    seenIds.add(id);
  }

  const assignments:
    AutonomousEvidenceAssignment[] =
      [];

  const repairFitEvidence:
    StructuralMechanismObservation[] =
      [];

  const protectedEvidence:
    StructuralMechanismObservation[] =
      [];

  sorted.forEach(
    (entry, index) => {
      const protectedSlot =
        index %
          protectedStride ===
        protectedOffset;

      assignments.push({
        sequence:
          entry.sequence,

        observationId:
          entry.observation
            .experiment
            .id,

        role:
          protectedSlot
            ? "protected-validation"
            : "repair-fit",

        reason:
          protectedSlot
            ? "deterministic-protected-slot"
            : "deterministic-fit-slot",
      });

      (
        protectedSlot
          ? protectedEvidence
          : repairFitEvidence
      ).push(
        cloneObservation(
          entry.observation,
        ),
      );
    },
  );

  const ready =
    repairFitEvidence.length >=
      minimumRepairFitEvidence &&
    protectedEvidence.length >=
      minimumProtectedEvidence;

  return {
    decision:
      ready
        ? "ready"
        : "abstained",

    assignments,

    repairFitEvidence,

    protectedEvidence,

    repairFitEvidenceIds:
      repairFitEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    protectedEvidenceIds:
      protectedEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    reason:
      ready
        ? "outcome-blind-deterministic-partition"
        : "insufficient-partitioned-evidence",
  };
}

export function archiveInstalledOnlineRevision(
  revisionId: string,
  previousProgram: HierarchicalCausalProgram,
  coevolution: OnlineBeliefModelCoevolutionDecision,
  previousHypothesis: RecedingVectorHypothesis,
  previousPrerequisite: LearnedActionPrerequisite,
  installationProtectedEvidenceIds: readonly string[],
): OnlineRevisionArchive {
  if (
    revisionId.trim().length ===
    0
  ) {
    throw new Error(
      "Online revision archive requires a revision id.",
    );
  }

  if (
    coevolution.decision !==
      "revised" ||
    coevolution
      .repairDecision
      ?.decision !==
      "repaired" ||
    !coevolution
      .revisedHypothesis ||
    !coevolution
      .learnedPrerequisite
  ) {
    throw new Error(
      "Only a protected installed online revision can be archived.",
    );
  }

  return {
    revisionId,

    previousProgram:
      cloneProgram(
        previousProgram,
      ),

    installedProgram:
      cloneProgram(
        coevolution
          .repairDecision
          .program,
      ),

    previousHypothesis:
      cloneHypothesis(
        previousHypothesis,
      ),

    installedHypothesis:
      cloneHypothesis(
        coevolution
          .revisedHypothesis,
      ),

    previousPrerequisite:
      clonePrerequisite(
        previousPrerequisite,
      ),

    installedPrerequisite:
      clonePrerequisite(
        coevolution
          .learnedPrerequisite,
      ),

    installationProtectedEvidenceIds: [
      ...installationProtectedEvidenceIds,
    ].sort(),
  };
}

export function coevolveFromAutonomousEvidencePartition(
  liveEvidence: readonly LiveStructuralEvidence[],
  mismatchStatus: OnlinePredictionMismatchStatus,
  incumbentRepairProgram: HierarchicalCausalProgram,
  damagedFragmentId: string,
  repairVariables: readonly string[],
  liveHypotheses: readonly RecedingVectorHypothesis[],
  liveBelief: RecedingVectorBelief,
  liveHypothesisId: string,
  repairTargetDimension: string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<string, number>
        >
      >
    >,
  prerequisiteEvidence:
    readonly ActionPrerequisiteObservation[],
  prerequisiteActionId: string,
  prerequisiteTargetDimension: string,
  prerequisiteStateDimensions: readonly string[],
  currentPrerequisite: LearnedActionPrerequisite,
  currentState: Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions: readonly RecedingVectorAction[],
  currentPlan: PrerequisiteAwarePlan,
  reasoner: HierarchicalGoalReasoner,
  terminalGoalId: string,
  revisionNumber = 1,
  partitionOptions?: {
    protectedStride?: number;
    protectedOffset?: number;
    minimumRepairFitEvidence?: number;
    minimumProtectedEvidence?: number;
  },
): AutonomousCoevolutionResult {
  const partition =
    partitionLiveStructuralEvidence(
      liveEvidence,
      partitionOptions,
    );

  if (
    partition.decision !==
      "ready"
  ) {
    return {
      partition,
    };
  }

  const coevolution =
    coevolveOnlineBeliefModelAndGoals(
      mismatchStatus,
      incumbentRepairProgram,
      damagedFragmentId,
      partition
        .repairFitEvidence,
      partition
        .protectedEvidence,
      repairVariables,
      liveHypotheses,
      liveBelief,
      liveHypothesisId,
      repairTargetDimension,
      controlInterventions,
      prerequisiteEvidence,
      prerequisiteActionId,
      prerequisiteTargetDimension,
      prerequisiteStateDimensions,
      currentPrerequisite,
      currentState,
      goal,
      actions,
      currentPlan,
      reasoner,
      terminalGoalId,
      revisionNumber,
    );

  if (
    coevolution.decision !==
      "revised"
  ) {
    return {
      partition,

      coevolution,
    };
  }

  return {
    partition,

    coevolution,

    archive:
      archiveInstalledOnlineRevision(
        `online-revision-${revisionNumber}`,
        incumbentRepairProgram,
        coevolution,
        liveHypotheses.find(
          (hypothesis) =>
            hypothesis.id ===
            liveHypothesisId,
        )!,
        currentPrerequisite,
        partition
          .protectedEvidenceIds,
      ),
  };
}

function meanSquaredError(
  program: HierarchicalCausalProgram,
  observations: readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
    0
  ) {
    throw new Error(
      "Online rollback assessment requires fresh protected evidence.",
    );
  }

  return observations.reduce(
    (sum, observation) => {
      const error =
        observation.measuredEffect -
        predictHierarchicalProgramEffect(
          program,
          observation
            .experiment
            .interventions,
        );

      return sum +
        error *
          error;
    },
    0,
  ) /
    observations.length;
}

export function evaluateOnlineRevisionRollback(
  archive: OnlineRevisionArchive,
  freshProtectedEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumRollbackImprovement?: number;
    maximumInstalledMeanSquaredError?: number;
  },
): OnlineRollbackAssessment {
  const minimumRollbackImprovement =
    options
      ?.minimumRollbackImprovement ??
    0.02;

  const maximumInstalledMeanSquaredError =
    options
      ?.maximumInstalledMeanSquaredError ??
    0.05;

  validateNonNegativeFinite(
    "minimumRollbackImprovement",
    minimumRollbackImprovement,
  );

  validateNonNegativeFinite(
    "maximumInstalledMeanSquaredError",
    maximumInstalledMeanSquaredError,
  );

  const installationIds =
    new Set(
      archive
        .installationProtectedEvidenceIds,
    );

  const freshIds =
    freshProtectedEvidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  if (
    freshIds.some(
      (id) =>
        installationIds.has(id),
    )
  ) {
    throw new Error(
      "Fresh rollback evidence must remain disjoint from installation protected evidence.",
    );
  }

  const installedMeanSquaredError =
    meanSquaredError(
      archive.installedProgram,
      freshProtectedEvidence,
    );

  const archivedMeanSquaredError =
    meanSquaredError(
      archive.previousProgram,
      freshProtectedEvidence,
    );

  const improvementFromRollback =
    installedMeanSquaredError -
    archivedMeanSquaredError;

  if (
    improvementFromRollback >=
      minimumRollbackImprovement
  ) {
    return {
      decision:
        "rolled-back",

      installedMeanSquaredError,

      archivedMeanSquaredError,

      improvementFromRollback,

      freshProtectedEvidenceIds:
        freshIds,

      reason:
        "archived-model-wins-fresh-protected",
    };
  }

  if (
    installedMeanSquaredError >
      maximumInstalledMeanSquaredError
  ) {
    return {
      decision:
        "reopen-search",

      installedMeanSquaredError,

      archivedMeanSquaredError,

      improvementFromRollback,

      freshProtectedEvidenceIds:
        freshIds,

      reason:
        "installed-regressed-reopen-search",
    };
  }

  return {
    decision:
      "retained",

    installedMeanSquaredError,

    archivedMeanSquaredError,

    improvementFromRollback,

    freshProtectedEvidenceIds:
      freshIds,

    reason:
      "installed-revision-still-protected",
  };
}

function remapPlanToMaterializedRevision(
  plan: PrerequisiteAwarePlan,
  materializedRevisionNumber: number,
): PrerequisiteAwarePlan {
  if (
    plan.decision !==
      "planned"
  ) {
    return {
      ...plan,

      actionIds: [
        ...plan.actionIds,
      ],

      subgoals:
        [],
    };
  }

  const ids =
    plan.subgoals.map(
      (_subgoal, index) =>
        `prerequisite-revised-${materializedRevisionNumber}-${index + 1}`,
    );

  const subgoals:
    PrerequisiteAwareVectorSubgoal[] =
      plan.subgoals.map(
        (subgoal, index) => ({
          ...subgoal,

          id:
            ids[index]!,

          targetState: {
            ...subgoal
              .targetState,
          },

          prerequisiteDescriptions: [
            ...subgoal
              .prerequisiteDescriptions,
          ],

          dependsOnGoalIds:
            index ===
              0
              ? []
              : [
                  ids[
                    index -
                      1
                  ]!,
                ],
        }),
      );

  return {
    ...plan,

    actionIds: [
      ...plan.actionIds,
    ],

    subgoals,

    expectedFinalState: {
      ...plan
        .expectedFinalState,
    },
  };
}

export function rollbackInstalledRevisionAndGoals(
  archive: OnlineRevisionArchive,
  assessment: OnlineRollbackAssessment,
  liveHypotheses: readonly RecedingVectorHypothesis[],
  liveBelief: RecedingVectorBelief,
  currentState: Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions: readonly RecedingVectorAction[],
  currentInstalledPlan: PrerequisiteAwarePlan,
  currentMaterializedRevisionNumber: number,
  reasoner: HierarchicalGoalReasoner,
  terminalGoalId: string,
  rollbackRevisionNumber: number,
): OnlineRollbackExecution {
  if (
    assessment.decision !==
      "rolled-back"
  ) {
    return {
      decision:
        "abstained",

      reason:
        "rollback-not-authorized",
    };
  }

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      liveHypotheses,
      liveBelief,
      archive
        .installedHypothesis
        .id,
      archive
        .previousHypothesis,
    );

  const rollbackPlan =
    buildPlanForLiveHypothesis(
      archive.previousHypothesis,
      currentState,
      goal,
      actions,
      archive
        .previousPrerequisite,
    );

  if (
    rollbackPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      catalogRevision,

      rollbackPlan,

      reason:
        "rollback-plan-unavailable",
    };
  }

  const materializedCurrentPlan =
    remapPlanToMaterializedRevision(
      currentInstalledPlan,
      currentMaterializedRevisionNumber,
    );

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      terminalGoalId,
      materializedCurrentPlan,
      rollbackPlan,
      rollbackRevisionNumber,
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

      catalogRevision,

      rollbackPlan,

      goalRevision,

      reason:
        "rollback-plan-unavailable",
    };
  }

  return {
    decision:
      "rolled-back",

    catalogRevision,

    rollbackPlan,

    goalRevision,

    reason:
      "archived-model-restored",
  };
}

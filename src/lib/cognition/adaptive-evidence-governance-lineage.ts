import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import {
  buildPlanForLiveHypothesis,
  replaceLiveHypothesisCatalog,
  type OnlineHypothesisCatalogRevision,
} from "./online-belief-model-coevolution";

import {
  revisePrerequisiteAwareGoalChain,
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

export type RevisionLineageStatus =
  | "installed"
  | "archived";

export interface RevisionLineageNode {
  revisionId: string;
  parentRevisionId?: string;
  generation: number;
  program: HierarchicalCausalProgram;
  hypothesis: RecedingVectorHypothesis;
  prerequisite: LearnedActionPrerequisite;
  installationProtectedEvidenceIds: string[];
  complexity: number;
  uncertaintyAtInstall: number;
  status: RevisionLineageStatus;
}

export interface RevisionLineage {
  nodes: RevisionLineageNode[];
  activeRevisionId: string;
  maximumRevisions: number;
}

export interface AdaptiveEvidenceRequirement {
  minimumProtectedEvidence: number;
  minimumUniqueInterventionSignatures: number;
  complexityBand: number;
  uncertaintyBand: number;
  reason:
    "complexity-and-uncertainty-adaptive-budget";
}

export interface ProtectedEvidenceCoverageAssessment {
  decision:
    | "ready"
    | "abstained";
  requirement: AdaptiveEvidenceRequirement;
  protectedEvidenceIds: string[];
  uniqueInterventionSignatures: string[];
  reason:
    | "adaptive-protected-reserve-ready"
    | "adaptive-protected-reserve-insufficient";
}

export interface LineageRevisionScore {
  revisionId: string;
  generation: number;
  meanSquaredError: number;
  parentRevisionId?: string;
  isActive: boolean;
}

export interface RevisionLineageAssessment {
  decision:
    | "retain"
    | "rollback-parent"
    | "branch-ancestor"
    | "reopen-search"
    | "abstained";
  activeRevisionId: string;
  selectedRevisionId?: string;
  activeMeanSquaredError?: number;
  selectedMeanSquaredError?: number;
  improvement?: number;
  requirement: AdaptiveEvidenceRequirement;
  scores: LineageRevisionScore[];
  freshProtectedEvidenceIds: string[];
  reason:
    | "active-revision-still-best"
    | "direct-parent-materially-better"
    | "older-ancestor-materially-better"
    | "all-lineage-revisions-inadequate"
    | "adaptive-protected-evidence-insufficient";
}

export interface LineageActivationExecution {
  decision:
    | "activated"
    | "abstained";
  lineage?: RevisionLineage;
  catalogRevision?: OnlineHypothesisCatalogRevision;
  activatedPlan?: PrerequisiteAwarePlan;
  goalRevision?: PrerequisitePlanRevision;
  reason:
    | "lineage-revision-activated"
    | "lineage-activation-not-authorized"
    | "lineage-plan-unavailable";
}

function validateUnitInterval(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
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

function cloneNode(
  node: RevisionLineageNode,
): RevisionLineageNode {
  return {
    ...node,

    program:
      cloneProgram(
        node.program,
      ),

    hypothesis:
      cloneHypothesis(
        node.hypothesis,
      ),

    prerequisite:
      clonePrerequisite(
        node.prerequisite,
      ),

    installationProtectedEvidenceIds: [
      ...node
        .installationProtectedEvidenceIds,
    ],
  };
}

function interventionSignature(
  observation: StructuralMechanismObservation,
): string {
  return Object.entries(
    observation
      .experiment
      .interventions,
  )
    .filter(
      ([, value]) =>
        Math.abs(value) >
        Number.EPSILON,
    )
    .sort(
      (left, right) =>
        left[0].localeCompare(
          right[0],
        ),
    )
    .map(
      ([key, value]) =>
        `${key}=${value.toFixed(6)}`,
    )
    .join("|") ||
    "zero-intervention";
}

function programMeanSquaredError(
  program: HierarchicalCausalProgram,
  observations: readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Revision-lineage evaluation requires protected evidence.",
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

export function deriveAdaptiveEvidenceRequirement(
  program: HierarchicalCausalProgram,
  uncertainty: number,
  options?: {
    baseProtectedEvidence?: number;
    complexityStep?: number;
    uncertaintyStep?: number;
    uncertaintyBands?: number;
    maximumUniqueInterventionSignatures?: number;
  },
): AdaptiveEvidenceRequirement {
  validateUnitInterval(
    "uncertainty",
    uncertainty,
  );

  const baseProtectedEvidence =
    options
      ?.baseProtectedEvidence ??
    2;

  const complexityStep =
    options
      ?.complexityStep ??
    1;

  const uncertaintyStep =
    options
      ?.uncertaintyStep ??
    1;

  const uncertaintyBands =
    options
      ?.uncertaintyBands ??
    2;

  const maximumUniqueInterventionSignatures =
    options
      ?.maximumUniqueInterventionSignatures ??
    3;

  validatePositiveInteger(
    "baseProtectedEvidence",
    baseProtectedEvidence,
  );

  validatePositiveInteger(
    "complexityStep",
    complexityStep,
  );

  validatePositiveInteger(
    "uncertaintyStep",
    uncertaintyStep,
  );

  validatePositiveInteger(
    "uncertaintyBands",
    uncertaintyBands,
  );

  validatePositiveInteger(
    "maximumUniqueInterventionSignatures",
    maximumUniqueInterventionSignatures,
  );

  const complexity =
    Math.max(
      1,
      Math.ceil(
        program.complexity,
      ),
    );

  const complexityBand =
    Math.max(
      0,
      Math.ceil(
        Math.log2(
          complexity,
        ),
      ),
    );

  const uncertaintyBand =
    Math.ceil(
      uncertainty *
      uncertaintyBands,
    );

  const minimumProtectedEvidence =
    baseProtectedEvidence +
    complexityBand *
      complexityStep +
    uncertaintyBand *
      uncertaintyStep;

  const minimumUniqueInterventionSignatures =
    Math.min(
      maximumUniqueInterventionSignatures,
      Math.max(
        1,
        1 +
        complexityBand,
      ),
    );

  return {
    minimumProtectedEvidence,

    minimumUniqueInterventionSignatures,

    complexityBand,

    uncertaintyBand,

    reason:
      "complexity-and-uncertainty-adaptive-budget",
  };
}

export function assessAdaptiveProtectedEvidence(
  evidence: readonly StructuralMechanismObservation[],
  requirement: AdaptiveEvidenceRequirement,
  excludedEvidenceIds: readonly string[] = [],
): ProtectedEvidenceCoverageAssessment {
  const excluded =
    new Set(
      excludedEvidenceIds,
    );

  const protectedEvidenceIds =
    evidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  if (
    protectedEvidenceIds.some(
      (id) =>
        excluded.has(id),
    )
  ) {
    throw new Error(
      "Adaptive protected evidence overlaps an excluded validation reserve.",
    );
  }

  const uniqueInterventionSignatures =
    Array.from(
      new Set(
        evidence.map(
          interventionSignature,
        ),
      ),
    ).sort();

  const ready =
    evidence.length >=
      requirement
        .minimumProtectedEvidence &&
    uniqueInterventionSignatures
      .length >=
      requirement
        .minimumUniqueInterventionSignatures;

  return {
    decision:
      ready
        ? "ready"
        : "abstained",

    requirement,

    protectedEvidenceIds,

    uniqueInterventionSignatures,

    reason:
      ready
        ? "adaptive-protected-reserve-ready"
        : "adaptive-protected-reserve-insufficient",
  };
}

export function createRevisionLineage(
  rootRevisionId: string,
  program: HierarchicalCausalProgram,
  hypothesis: RecedingVectorHypothesis,
  prerequisite: LearnedActionPrerequisite,
  installationProtectedEvidenceIds:
    readonly string[] = [],
  uncertaintyAtInstall = 0,
  maximumRevisions = 4,
): RevisionLineage {
  if (
    rootRevisionId.trim().length ===
      0
  ) {
    throw new Error(
      "Revision lineage requires a root revision id.",
    );
  }

  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
  );

  if (
    !Number.isInteger(
      maximumRevisions,
    ) ||
    maximumRevisions < 2
  ) {
    throw new Error(
      "maximumRevisions must be an integer of at least 2.",
    );
  }

  return {
    nodes: [
      {
        revisionId:
          rootRevisionId,

        generation:
          0,

        program:
          cloneProgram(
            program,
          ),

        hypothesis:
          cloneHypothesis(
            hypothesis,
          ),

        prerequisite:
          clonePrerequisite(
            prerequisite,
          ),

        installationProtectedEvidenceIds: [
          ...installationProtectedEvidenceIds,
        ].sort(),

        complexity:
          program.complexity,

        uncertaintyAtInstall,

        status:
          "installed",
      },
    ],

    activeRevisionId:
      rootRevisionId,

    maximumRevisions,
  };
}

export function appendInstalledRevision(
  lineage: RevisionLineage,
  revisionId: string,
  program: HierarchicalCausalProgram,
  hypothesis: RecedingVectorHypothesis,
  prerequisite: LearnedActionPrerequisite,
  installationProtectedEvidenceIds: readonly string[],
  uncertaintyAtInstall: number,
): RevisionLineage {
  if (
    revisionId.trim().length ===
      0
  ) {
    throw new Error(
      "Installed lineage revision requires an id.",
    );
  }

  if (
    lineage.nodes.some(
      (node) =>
        node.revisionId ===
        revisionId,
    )
  ) {
    throw new Error(
      `Duplicate revision id ${revisionId}.`,
    );
  }

  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
  );

  const active =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage.activeRevisionId,
    );

  if (!active) {
    throw new Error(
      "Revision lineage active node is missing.",
    );
  }

  let nodes =
    lineage.nodes.map(
      (node) => ({
        ...cloneNode(
          node,
        ),

        status:
          node.revisionId ===
            lineage.activeRevisionId
            ? "archived"
            : node.status,
      }),
    );

  nodes.push({
    revisionId,

    parentRevisionId:
      active.revisionId,

    generation:
      active.generation +
      1,

    program:
      cloneProgram(
        program,
      ),

    hypothesis:
      cloneHypothesis(
        hypothesis,
      ),

    prerequisite:
      clonePrerequisite(
        prerequisite,
      ),

    installationProtectedEvidenceIds: [
      ...installationProtectedEvidenceIds,
    ].sort(),

    complexity:
      program.complexity,

    uncertaintyAtInstall,

    status:
      "installed",
  });

  while (
    nodes.length >
    lineage.maximumRevisions
  ) {
    const removable =
      nodes
        .filter(
          (node) =>
            node.revisionId !==
            revisionId &&
            node.status ===
            "archived",
        )
        .sort(
          (left, right) =>
            left.generation -
              right.generation ||
            left.revisionId.localeCompare(
              right.revisionId,
            ),
        )[0];

    if (!removable) {
      throw new Error(
        "Bounded revision lineage cannot prune a safe archived node.",
      );
    }

    nodes =
      nodes
        .filter(
          (node) =>
            node.revisionId !==
            removable.revisionId,
        )
        .map(
          (node) =>
            node.parentRevisionId ===
              removable.revisionId
              ? {
                  ...node,

                  parentRevisionId:
                    removable
                      .parentRevisionId,
                }
              : node,
        );
  }

  nodes.sort(
    (left, right) =>
      left.generation -
        right.generation ||
      left.revisionId.localeCompare(
        right.revisionId,
      ),
  );

  return {
    ...lineage,

    nodes,

    activeRevisionId:
      revisionId,
  };
}

function lineageExcludedEvidenceIds(
  lineage: RevisionLineage,
): string[] {
  return Array.from(
    new Set(
      lineage.nodes.flatMap(
        (node) =>
          node
            .installationProtectedEvidenceIds,
      ),
    ),
  ).sort();
}

export function evaluateRevisionLineage(
  lineage: RevisionLineage,
  freshProtectedEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumImprovement?: number;
    maximumAcceptableMeanSquaredError?: number;
    baseProtectedEvidence?: number;
    complexityStep?: number;
    uncertaintyStep?: number;
    uncertaintyBands?: number;
    maximumUniqueInterventionSignatures?: number;
  },
): RevisionLineageAssessment {
  const active =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage.activeRevisionId,
    );

  if (!active) {
    throw new Error(
      "Revision lineage active node is missing.",
    );
  }

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.02;

  const maximumAcceptableMeanSquaredError =
    options
      ?.maximumAcceptableMeanSquaredError ??
    0.05;

  validateNonNegativeFinite(
    "minimumImprovement",
    minimumImprovement,
  );

  validateNonNegativeFinite(
    "maximumAcceptableMeanSquaredError",
    maximumAcceptableMeanSquaredError,
  );

  const candidateRequirements =
    lineage.nodes.map(
      (node) =>
        deriveAdaptiveEvidenceRequirement(
          node.program,
          Math.max(
            node
              .uncertaintyAtInstall,
            node.revisionId ===
              active.revisionId
              ? active
                  .uncertaintyAtInstall
              : 0,
          ),
          {
            baseProtectedEvidence:
              options
                ?.baseProtectedEvidence,
            complexityStep:
              options
                ?.complexityStep,
            uncertaintyStep:
              options
                ?.uncertaintyStep,
            uncertaintyBands:
              options
                ?.uncertaintyBands,
            maximumUniqueInterventionSignatures:
              options
                ?.maximumUniqueInterventionSignatures,
          },
        ),
    );

  const requirement:
    AdaptiveEvidenceRequirement = {
    minimumProtectedEvidence:
      Math.max(
        ...candidateRequirements.map(
          (candidate) =>
            candidate
              .minimumProtectedEvidence,
        ),
      ),

    minimumUniqueInterventionSignatures:
      Math.max(
        ...candidateRequirements.map(
          (candidate) =>
            candidate
              .minimumUniqueInterventionSignatures,
        ),
      ),

    complexityBand:
      Math.max(
        ...candidateRequirements.map(
          (candidate) =>
            candidate
              .complexityBand,
        ),
      ),

    uncertaintyBand:
      Math.max(
        ...candidateRequirements.map(
          (candidate) =>
            candidate
              .uncertaintyBand,
        ),
      ),

    reason:
      "complexity-and-uncertainty-adaptive-budget",
  };

  const coverage =
    assessAdaptiveProtectedEvidence(
      freshProtectedEvidence,
      requirement,
      lineageExcludedEvidenceIds(
        lineage,
      ),
    );

  if (
    coverage.decision !==
      "ready"
  ) {
    return {
      decision:
        "abstained",

      activeRevisionId:
        active.revisionId,

      requirement,

      scores:
        [],

      freshProtectedEvidenceIds:
        coverage
          .protectedEvidenceIds,

      reason:
        "adaptive-protected-evidence-insufficient",
    };
  }

  const scores =
    lineage.nodes.map(
      (node) => ({
        revisionId:
          node.revisionId,

        generation:
          node.generation,

        meanSquaredError:
          programMeanSquaredError(
            node.program,
            freshProtectedEvidence,
          ),

        parentRevisionId:
          node.parentRevisionId,

        isActive:
          node.revisionId ===
          active.revisionId,
      }),
    )
    .sort(
      (left, right) =>
        left.meanSquaredError -
          right.meanSquaredError ||
        right.generation -
          left.generation ||
        left.revisionId.localeCompare(
          right.revisionId,
        ),
    );

  const activeScore =
    scores.find(
      (score) =>
        score.revisionId ===
        active.revisionId,
    );

  const selected =
    scores[0];

  if (
    !activeScore ||
    !selected
  ) {
    throw new Error(
      "Revision lineage scoring failed.",
    );
  }

  const improvement =
    activeScore.meanSquaredError -
    selected.meanSquaredError;

  if (
    selected.revisionId ===
      active.revisionId
  ) {
    if (
      activeScore.meanSquaredError >
      maximumAcceptableMeanSquaredError
    ) {
      return {
        decision:
          "reopen-search",

        activeRevisionId:
          active.revisionId,

        activeMeanSquaredError:
          activeScore
            .meanSquaredError,

        selectedMeanSquaredError:
          selected
            .meanSquaredError,

        improvement:
          0,

        requirement,

        scores,

        freshProtectedEvidenceIds:
          coverage
            .protectedEvidenceIds,

        reason:
          "all-lineage-revisions-inadequate",
      };
    }

    return {
      decision:
        "retain",

      activeRevisionId:
        active.revisionId,

      selectedRevisionId:
        active.revisionId,

      activeMeanSquaredError:
        activeScore
          .meanSquaredError,

      selectedMeanSquaredError:
        activeScore
          .meanSquaredError,

      improvement:
        0,

      requirement,

      scores,

      freshProtectedEvidenceIds:
        coverage
          .protectedEvidenceIds,

      reason:
        "active-revision-still-best",
    };
  }

  if (
    improvement <
      minimumImprovement
  ) {
    if (
      activeScore.meanSquaredError >
      maximumAcceptableMeanSquaredError
    ) {
      return {
        decision:
          "reopen-search",

        activeRevisionId:
          active.revisionId,

        activeMeanSquaredError:
          activeScore
            .meanSquaredError,

        selectedMeanSquaredError:
          selected
            .meanSquaredError,

        improvement,

        requirement,

        scores,

        freshProtectedEvidenceIds:
          coverage
            .protectedEvidenceIds,

        reason:
          "all-lineage-revisions-inadequate",
      };
    }

    return {
      decision:
        "retain",

      activeRevisionId:
        active.revisionId,

      selectedRevisionId:
        active.revisionId,

      activeMeanSquaredError:
        activeScore
          .meanSquaredError,

      selectedMeanSquaredError:
        selected
          .meanSquaredError,

      improvement,

      requirement,

      scores,

      freshProtectedEvidenceIds:
        coverage
          .protectedEvidenceIds,

      reason:
        "active-revision-still-best",
    };
  }

  const directParent =
    active.parentRevisionId;

  return {
    decision:
      selected.revisionId ===
        directParent
        ? "rollback-parent"
        : "branch-ancestor",

    activeRevisionId:
      active.revisionId,

    selectedRevisionId:
      selected.revisionId,

    activeMeanSquaredError:
      activeScore
        .meanSquaredError,

    selectedMeanSquaredError:
      selected
        .meanSquaredError,

    improvement,

    requirement,

    scores,

    freshProtectedEvidenceIds:
      coverage
        .protectedEvidenceIds,

    reason:
      selected.revisionId ===
        directParent
        ? "direct-parent-materially-better"
        : "older-ancestor-materially-better",
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

function activateLineageNode(
  lineage: RevisionLineage,
  selectedRevisionId: string,
): RevisionLineage {
  if (
    !lineage.nodes.some(
      (node) =>
        node.revisionId ===
        selectedRevisionId,
    )
  ) {
    throw new Error(
      `Unknown lineage revision ${selectedRevisionId}.`,
    );
  }

  return {
    ...lineage,

    activeRevisionId:
      selectedRevisionId,

    nodes:
      lineage.nodes.map(
        (node) => ({
          ...cloneNode(
            node,
          ),

          status:
            node.revisionId ===
              selectedRevisionId
              ? "installed"
              : "archived",
        }),
      ),
  };
}

export function activateRevisionLineageSelection(
  lineage: RevisionLineage,
  assessment: RevisionLineageAssessment,
  liveHypotheses: readonly RecedingVectorHypothesis[],
  liveBelief: RecedingVectorBelief,
  currentState: Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions: readonly RecedingVectorAction[],
  currentPlan: PrerequisiteAwarePlan,
  currentMaterializedRevisionNumber: number,
  reasoner: HierarchicalGoalReasoner,
  terminalGoalId: string,
  lineageGoalRevisionNumber: number,
): LineageActivationExecution {
  if (
    (
      assessment.decision !==
        "rollback-parent" &&
      assessment.decision !==
        "branch-ancestor"
    ) ||
    !assessment
      .selectedRevisionId
  ) {
    return {
      decision:
        "abstained",

      reason:
        "lineage-activation-not-authorized",
    };
  }

  const activeNode =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage.activeRevisionId,
    );

  const selectedNode =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        assessment
          .selectedRevisionId,
    );

  if (
    !activeNode ||
    !selectedNode
  ) {
    throw new Error(
      "Lineage activation nodes are missing.",
    );
  }

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      liveHypotheses,
      liveBelief,
      activeNode
        .hypothesis
        .id,
      selectedNode
        .hypothesis,
    );

  const activatedPlan =
    buildPlanForLiveHypothesis(
      selectedNode.hypothesis,
      currentState,
      goal,
      actions,
      selectedNode.prerequisite,
    );

  if (
    activatedPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      catalogRevision,

      activatedPlan,

      reason:
        "lineage-plan-unavailable",
    };
  }

  const materializedCurrentPlan =
    remapPlanToMaterializedRevision(
      currentPlan,
      currentMaterializedRevisionNumber,
    );

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      terminalGoalId,
      materializedCurrentPlan,
      activatedPlan,
      lineageGoalRevisionNumber,
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

      activatedPlan,

      goalRevision,

      reason:
        "lineage-plan-unavailable",
    };
  }

  return {
    decision:
      "activated",

    lineage:
      activateLineageNode(
        lineage,
        selectedNode
          .revisionId,
      ),

    catalogRevision,

    activatedPlan,

    goalRevision,

    reason:
      "lineage-revision-activated",
  };
}

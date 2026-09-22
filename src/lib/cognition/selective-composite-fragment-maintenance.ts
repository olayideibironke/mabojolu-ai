import {
  appendInstalledRevision,
  assessAdaptiveProtectedEvidence,
  deriveAdaptiveEvidenceRequirement,
  type AdaptiveEvidenceRequirement,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  buildPlanForLiveHypothesis,
  replaceLiveHypothesisCatalog,
  type OnlineHypothesisCatalogRevision,
} from "./online-belief-model-coevolution";

import {
  FragmentReliabilityTracker,
  reviseHierarchicalProgramFromReliability,
  type FragmentReliabilitySummary,
  type HierarchicalProgramRevision,
} from "./self-revising-hierarchical-program";

import {
  diagnoseHierarchicalFragmentFailure,
  type FragmentFailureDiagnosis,
} from "./uncertain-hierarchical-program";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import {
  revisePrerequisiteAwareGoalChain,
  type PrerequisiteAwarePlan,
  type PrerequisitePlanRevision,
} from "./structural-repair-prerequisite-planning";

import type {
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  RecedingVectorAction,
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface CompositeFragmentMonitoringStep {
  observationId: string;
  diagnosis: FragmentFailureDiagnosis;
  reliability: FragmentReliabilitySummary;
}

export interface SelectiveFragmentMaintenanceResult {
  decision:
    | "repaired"
    | "rolled-back-fragment"
    | "retained"
    | "abstained";
  reliability: FragmentReliabilitySummary;
  programRevision?: HierarchicalProgramRevision;
  requirement?: AdaptiveEvidenceRequirement;
  preservedFragmentIds: string[];
  retiredFragmentIds: string[];
  replacementFragmentIds: Record<string, string>;
  revisedHypothesis?: RecedingVectorHypothesis;
  lineage?: RevisionLineage;
  catalogRevision?: OnlineHypothesisCatalogRevision;
  revisedPlan?: PrerequisiteAwarePlan;
  goalRevision?: PrerequisitePlanRevision;
  reason:
    | "selective-fragment-repair-installed"
    | "selective-fragment-rollback-installed"
    | "composite-fragments-still-protected"
    | "multiple-fragment-failure-requires-broader-search"
    | "adaptive-protected-maintenance-reserve-insufficient"
    | "revised-composite-plan-unavailable";
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

function fragmentSignature(
  fragment: ValidatedCausalFragment,
): string {
  return JSON.stringify({
    terms:
      fragment.terms.map(
        (term) => ({
          kind:
            term.kind,

          variables: [
            ...term.variables,
          ].sort(),

          coefficient:
            term.coefficient,
        }),
      ),
  });
}

function lineageInstallationEvidenceIds(
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

export class CompositeFragmentMonitor {
  private readonly tracker:
    FragmentReliabilityTracker;

  private readonly observationIds =
    new Set<string>();

  constructor(
    private readonly program:
      HierarchicalCausalProgram,
    options?: {
      minimumBlameEpisodes?: number;
      quarantineReliabilityThreshold?: number;
      supportErrorIncreaseThreshold?: number;
      minimumErrorReduction?: number;
    },
  ) {
    if (
      program.fragments.length <
        2
    ) {
      throw new Error(
        "Composite fragment maintenance requires at least two fragments.",
      );
    }

    this.tracker =
      new FragmentReliabilityTracker(
        program.fragments.map(
          (fragment) =>
            fragment.id,
        ),
        options
          ?.minimumBlameEpisodes ??
          2,
        options
          ?.quarantineReliabilityThreshold ??
          0.4,
        options
          ?.supportErrorIncreaseThreshold ??
          0.01,
      );

    this.minimumErrorReduction =
      options
        ?.minimumErrorReduction ??
      0.01;
  }

  private readonly minimumErrorReduction:
    number;

  record(
    observation:
      StructuralMechanismObservation,
  ): CompositeFragmentMonitoringStep {
    const id =
      observation
        .experiment
        .id;

    if (
      this.observationIds.has(
        id,
      )
    ) {
      throw new Error(
        `Duplicate composite monitoring observation ${id}.`,
      );
    }

    const diagnosis =
      diagnoseHierarchicalFragmentFailure(
        this.program,
        observation,
        this.minimumErrorReduction,
      );

    this.tracker
      .recordDiagnosis(
        diagnosis,
      );

    this.observationIds.add(
      id,
    );

    return {
      observationId:
        id,

      diagnosis,

      reliability:
        this.tracker
          .getSummary(),
    };
  }

  getReliability():
    FragmentReliabilitySummary {
    return this.tracker
      .getSummary();
  }

  getMonitoringEvidenceIds():
    string[] {
    return Array.from(
      this.observationIds,
    ).sort();
  }
}

function preservedHealthyFragmentIds(
  incumbent:
    HierarchicalCausalProgram,
  revised:
    HierarchicalCausalProgram,
  retiredFragmentIds:
    readonly string[],
): string[] {
  const retired =
    new Set(
      retiredFragmentIds,
    );

  const revisedById =
    new Map(
      revised.fragments.map(
        (fragment) => [
          fragment.id,
          fragment,
        ],
      ),
    );

  const preserved:
    string[] =
      [];

  for (
    const fragment of
      incumbent.fragments
  ) {
    if (
      retired.has(
        fragment.id,
      )
    ) {
      continue;
    }

    const counterpart =
      revisedById.get(
        fragment.id,
      );

    if (
      !counterpart ||
      fragmentSignature(
        counterpart,
      ) !==
      fragmentSignature(
        fragment,
      )
    ) {
      throw new Error(
        `Selective composite maintenance changed healthy fragment ${fragment.id}.`,
      );
    }

    preserved.push(
      fragment.id,
    );
  }

  return preserved.sort();
}

function projectProgramIntoHypothesis(
  incumbent:
    RecedingVectorHypothesis,
  program:
    HierarchicalCausalProgram,
  targetDimension:
    string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<string, number>
        >
      >
    >,
  revisionId:
    string,
  retiredFragmentIds:
    readonly string[],
  replacementFragmentIds:
    Readonly<Record<string, string>>,
): RecedingVectorHypothesis {
  const revised =
    cloneHypothesis(
      incumbent,
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
        program,
        interventions,
      );
  }

  revised.dimensionEffects[
    targetDimension
  ] =
    targetEffects;

  revised.id =
    `hypothesis:${revisionId}`;

  revised.repairCandidateId =
    `${incumbent.repairCandidateId}+selective:${retiredFragmentIds.join(
      "+",
    ) || "none"}:${Object.values(
      replacementFragmentIds,
    ).join("+") || "rollback"}`;

  return revised;
}

export function maintainCompositeRevisionSelectively(
  lineage: RevisionLineage,
  monitor: CompositeFragmentMonitor,
  repairFragments:
    readonly ValidatedCausalFragment[],
  protectedEvidence:
    readonly StructuralMechanismObservation[],
  targetDimension: string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<string, number>
        >
      >
    >,
  currentState:
    Readonly<Record<string, number>>,
  goal: MultidimensionalGoal,
  actions:
    readonly RecedingVectorAction[],
  currentPlan:
    PrerequisiteAwarePlan,
  reasoner:
    HierarchicalGoalReasoner,
  terminalGoalId: string,
  revisionId: string,
  goalRevisionNumber: number,
  uncertaintyAtInstall = 0.2,
): SelectiveFragmentMaintenanceResult {
  const active =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage
          .activeRevisionId,
    );

  if (!active) {
    throw new Error(
      "Selective composite maintenance requires an active lineage revision.",
    );
  }

  const reliability =
    monitor.getReliability();

  if (
    reliability
      .quarantinedFragmentIds
      .length >
    1
  ) {
    return {
      decision:
        "abstained",

      reliability,

      preservedFragmentIds:
        [],

      retiredFragmentIds: [
        ...reliability
          .quarantinedFragmentIds,
      ],

      replacementFragmentIds:
        {},

      reason:
        "multiple-fragment-failure-requires-broader-search",
    };
  }

  const monitoringIds =
    new Set(
      monitor
        .getMonitoringEvidenceIds(),
    );

  const protectedIds =
    protectedEvidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  if (
    protectedIds.some(
      (id) =>
        monitoringIds.has(id),
    )
  ) {
    throw new Error(
      "Composite monitoring evidence must remain disjoint from protected maintenance evidence.",
    );
  }

  const programRevision =
    reviseHierarchicalProgramFromReliability(
      active.program,
      reliability,
      repairFragments,
      protectedEvidence,
    );

  if (
    programRevision.decision ===
      "retained"
  ) {
    return {
      decision:
        "retained",

      reliability,

      programRevision,

      preservedFragmentIds:
        active.program.fragments
          .map(
            (fragment) =>
              fragment.id,
          )
          .sort(),

      retiredFragmentIds:
        [],

      replacementFragmentIds:
        {},

      reason:
        "composite-fragments-still-protected",
    };
  }

  const requirement =
    deriveAdaptiveEvidenceRequirement(
      programRevision.program,
      uncertaintyAtInstall,
    );

  const excludedEvidenceIds = [
    ...lineageInstallationEvidenceIds(
      lineage,
    ),
    ...monitor
      .getMonitoringEvidenceIds(),
  ];

  const coverage =
    assessAdaptiveProtectedEvidence(
      protectedEvidence,
      requirement,
      excludedEvidenceIds,
    );

  if (
    coverage.decision !==
      "ready"
  ) {
    return {
      decision:
        "abstained",

      reliability,

      programRevision,

      requirement,

      preservedFragmentIds:
        [],

      retiredFragmentIds: [
        ...programRevision
          .retiredFragmentIds,
      ],

      replacementFragmentIds: {
        ...programRevision
          .replacementFragmentIds,
      },

      reason:
        "adaptive-protected-maintenance-reserve-insufficient",
    };
  }

  const preservedFragmentIds =
    preservedHealthyFragmentIds(
      active.program,
      programRevision.program,
      programRevision
        .retiredFragmentIds,
    );

  const revisedHypothesis =
    projectProgramIntoHypothesis(
      active.hypothesis,
      programRevision.program,
      targetDimension,
      controlInterventions,
      revisionId,
      programRevision
        .retiredFragmentIds,
      programRevision
        .replacementFragmentIds,
    );

  const revisedLineage =
    appendInstalledRevision(
      lineage,
      revisionId,
      programRevision.program,
      revisedHypothesis,
      active.prerequisite,
      coverage
        .protectedEvidenceIds,
      uncertaintyAtInstall,
    );

  const revisedPlan =
    buildPlanForLiveHypothesis(
      revisedHypothesis,
      currentState,
      goal,
      actions,
      active.prerequisite,
    );

  if (
    revisedPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      reliability,

      programRevision,

      requirement,

      preservedFragmentIds,

      retiredFragmentIds: [
        ...programRevision
          .retiredFragmentIds,
      ],

      replacementFragmentIds: {
        ...programRevision
          .replacementFragmentIds,
      },

      revisedHypothesis,

      lineage:
        revisedLineage,

      revisedPlan,

      reason:
        "revised-composite-plan-unavailable",
    };
  }

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      terminalGoalId,
      currentPlan,
      revisedPlan,
      goalRevisionNumber,
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

      reliability,

      programRevision,

      requirement,

      preservedFragmentIds,

      retiredFragmentIds: [
        ...programRevision
          .retiredFragmentIds,
      ],

      replacementFragmentIds: {
        ...programRevision
          .replacementFragmentIds,
      },

      revisedHypothesis,

      lineage:
        revisedLineage,

      revisedPlan,

      goalRevision,

      reason:
        "revised-composite-plan-unavailable",
    };
  }

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      [
        active.hypothesis,
      ],
      {
        probabilities: {
          [
            active
              .hypothesis
              .id
          ]:
            1,
        },

        topHypothesisId:
          active
            .hypothesis
            .id,

        confidence:
          1,

        normalizedEntropy:
          0,
      },
      active
        .hypothesis
        .id,
      revisedHypothesis,
    );

  return {
    decision:
      programRevision.decision ===
        "repaired"
        ? "repaired"
        : "rolled-back-fragment",

    reliability,

    programRevision,

    requirement,

    preservedFragmentIds,

    retiredFragmentIds: [
      ...programRevision
        .retiredFragmentIds,
    ],

    replacementFragmentIds: {
      ...programRevision
        .replacementFragmentIds,
    },

    revisedHypothesis,

    lineage:
      revisedLineage,

    catalogRevision,

    revisedPlan,

    goalRevision,

    reason:
      programRevision.decision ===
        "repaired"
        ? "selective-fragment-repair-installed"
        : "selective-fragment-rollback-installed",
  };
}

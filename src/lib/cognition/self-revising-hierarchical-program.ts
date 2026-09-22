import type {
  Goal,
} from "./types";

import {
  type HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

import {
  diagnoseHierarchicalFragmentFailure,
  generateAutonomousSubgoalPlan,
  type AutonomousSubgoalPlan,
  type FragmentFailureDiagnosis,
} from "./uncertain-hierarchical-program";

export interface FragmentReliabilityEvidence {
  fragmentId: string;
  episodes: number;
  supportEpisodes: number;
  blameEpisodes: number;
  neutralEpisodes: number;
  posteriorReliability: number;
  quarantined: boolean;
}

export interface FragmentReliabilitySummary {
  fragments: FragmentReliabilityEvidence[];
  quarantinedFragmentIds: string[];
}

export interface HierarchicalProgramRevision {
  decision:
    | "repaired"
    | "rolled-back"
    | "retained";
  program: HierarchicalCausalProgram;
  previousProgramId: string;
  retiredFragmentIds: string[];
  replacementFragmentIds: Record<
    string,
    string
  >;
  incumbentProtectedMeanSquaredError: number;
  revisedProtectedMeanSquaredError: number;
  improvement: number;
  reason:
    | "protected-repair"
    | "protected-rollback"
    | "incumbent-protected";
}

export interface AutonomousSubgoalRevision {
  decision:
    | "revised"
    | "unchanged"
    | "abstained";
  observedState: number;
  expectedState: number;
  divergence: number;
  staleGoalIds: string[];
  replacementGoalIds: string[];
  revisedPlan?: AutonomousSubgoalPlan;
  terminalGoalPreserved: boolean;
  terminalGoalId: string;
  reason:
    | "progress-within-tolerance"
    | "posterior-supported-revision"
    | "no-safe-revision"
    | "revision-shape-mismatch";
}

function validateUnitInterval(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0 ||
    value >
      1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validateNonNegativeFinite(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function cloneFragment(
  fragment:
    ValidatedCausalFragment,
): ValidatedCausalFragment {
  return {
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
  };
}

function cloneProgram(
  program:
    HierarchicalCausalProgram,
): HierarchicalCausalProgram {
  return {
    ...program,

    baseEffects: {
      ...program.baseEffects,
    },

    fragments:
      program.fragments.map(
        cloneFragment,
      ),
  };
}

function programMeanSquaredError(
  program:
    HierarchicalCausalProgram,

  observations:
    readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Self-revising program validation requires protected observations.",
    );
  }

  return observations.reduce(
    (
      total,
      observation,
    ) => {
      const error =
        observation.measuredEffect -
        predictHierarchicalProgramEffect(
          program,
          observation
            .experiment
            .interventions,
        );

      return total +
        error *
          error;
    },
    0,
  ) /
    observations.length;
}

function fragmentStructureSignature(
  fragment:
    ValidatedCausalFragment,
): string {
  return fragment.terms
    .map(
      (term) =>
        `${term.kind}:${[
          ...term.variables,
        ].sort().join("|")}`,
    )
    .sort()
    .join(";");
}

function sameGoalContract(
  left:
    Goal,

  right:
    Goal,
): boolean {
  return (
    left.id ===
      right.id &&
    left.description ===
      right.description &&
    left.priority ===
      right.priority &&
    JSON.stringify(
      left.successCriteria,
    ) ===
      JSON.stringify(
        right.successCriteria,
      ) &&
    JSON.stringify(
      left.constraints,
    ) ===
      JSON.stringify(
        right.constraints,
      )
  );
}

export class FragmentReliabilityTracker {
  private readonly evidence =
    new Map<
      string,
      {
        support:
          number;
        blame:
          number;
        neutral:
          number;
      }
    >();

  constructor(
    fragmentIds:
      readonly string[],

    private readonly minimumBlameEpisodes =
      2,

    private readonly quarantineReliabilityThreshold =
      0.4,

    private readonly supportErrorIncreaseThreshold =
      0.01,
  ) {
    if (
      !Number.isInteger(
        minimumBlameEpisodes,
      ) ||
      minimumBlameEpisodes <
        1
    ) {
      throw new Error(
        "minimumBlameEpisodes must be a positive integer.",
      );
    }

    validateUnitInterval(
      "quarantineReliabilityThreshold",
      quarantineReliabilityThreshold,
    );

    validateNonNegativeFinite(
      "supportErrorIncreaseThreshold",
      supportErrorIncreaseThreshold,
    );

    const distinct =
      Array.from(
        new Set(
          fragmentIds,
        ),
      );

    if (
      distinct.length ===
        0
    ) {
      throw new Error(
        "Fragment reliability tracking requires at least one fragment.",
      );
    }

    for (
      const fragmentId of
        distinct
    ) {
      if (
        !fragmentId.trim()
      ) {
        throw new Error(
          "Fragment reliability ids cannot be empty.",
        );
      }

      this.evidence.set(
        fragmentId,
        {
          support:
            0,

          blame:
            0,

          neutral:
            0,
        },
      );
    }
  }

  recordDiagnosis(
    diagnosis:
      FragmentFailureDiagnosis,
  ): void {
    for (
      const attribution of
        diagnosis.attributions
    ) {
      const evidence =
        this.evidence.get(
          attribution.fragmentId,
        );

      if (
        !evidence
      ) {
        throw new Error(
          `Fragment reliability tracker does not know ${attribution.fragmentId}.`,
        );
      }

      if (
        attribution.blamed
      ) {
        evidence.blame +=
          1;

        continue;
      }

      const errorIncreaseWhenRemoved =
        attribution
          .withoutFragmentSquaredError -
        attribution
          .fullProgramSquaredError;

      if (
        errorIncreaseWhenRemoved >=
          this.supportErrorIncreaseThreshold
      ) {
        evidence.support +=
          1;
      } else {
        evidence.neutral +=
          1;
      }
    }
  }

  getEvidence(
    fragmentId:
      string,
  ): FragmentReliabilityEvidence {
    const evidence =
      this.evidence.get(
        fragmentId,
      );

    if (
      !evidence
    ) {
      throw new Error(
        `Unknown fragment reliability id ${fragmentId}.`,
      );
    }

    const posteriorReliability =
      (
        1 +
        evidence.support
      ) /
      (
        2 +
        evidence.support +
        evidence.blame
      );

    const quarantined =
      evidence.blame >=
        this.minimumBlameEpisodes &&
      posteriorReliability <=
        this.quarantineReliabilityThreshold;

    return {
      fragmentId,

      episodes:
        evidence.support +
        evidence.blame +
        evidence.neutral,

      supportEpisodes:
        evidence.support,

      blameEpisodes:
        evidence.blame,

      neutralEpisodes:
        evidence.neutral,

      posteriorReliability,

      quarantined,
    };
  }

  getSummary():
    FragmentReliabilitySummary {
    const fragments =
      Array.from(
        this.evidence.keys(),
      )
        .map(
          (fragmentId) =>
            this.getEvidence(
              fragmentId,
            ),
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.fragmentId.localeCompare(
              right.fragmentId,
            ),
        );

    return {
      fragments,

      quarantinedFragmentIds:
        fragments
          .filter(
            (fragment) =>
              fragment.quarantined,
          )
          .map(
            (fragment) =>
              fragment.fragmentId,
          ),
    };
  }
}

export function reviseHierarchicalProgramFromReliability(
  incumbent:
    HierarchicalCausalProgram,

  reliability:
    FragmentReliabilitySummary,

  repairFragments:
    readonly ValidatedCausalFragment[],

  protectedObservations:
    readonly StructuralMechanismObservation[],

  options?: {
    minimumProtectedImprovement?: number;
    maximumRepairValidationMeanSquaredError?: number;
  },
): HierarchicalProgramRevision {
  const minimumProtectedImprovement =
    options
      ?.minimumProtectedImprovement ??
    0.01;

  const maximumRepairValidationMeanSquaredError =
    options
      ?.maximumRepairValidationMeanSquaredError ??
    0.01;

  validateNonNegativeFinite(
    "minimumProtectedImprovement",
    minimumProtectedImprovement,
  );

  validateNonNegativeFinite(
    "maximumRepairValidationMeanSquaredError",
    maximumRepairValidationMeanSquaredError,
  );

  const quarantined =
    new Set(
      reliability
        .quarantinedFragmentIds,
    );

  const incumbentError =
    programMeanSquaredError(
      incumbent,
      protectedObservations,
    );

  if (
    quarantined.size ===
      0
  ) {
    return {
      decision:
        "retained",

      program:
        cloneProgram(
          incumbent,
        ),

      previousProgramId:
        incumbent.id,

      retiredFragmentIds:
        [],

      replacementFragmentIds:
        {},

      incumbentProtectedMeanSquaredError:
        incumbentError,

      revisedProtectedMeanSquaredError:
        incumbentError,

      improvement:
        0,

      reason:
        "incumbent-protected",
    };
  }

  const incumbentById =
    new Map(
      incumbent.fragments.map(
        (fragment) => [
          fragment.id,
          fragment,
        ],
      ),
    );

  for (
    const fragmentId of
      quarantined
  ) {
    if (
      !incumbentById.has(
        fragmentId,
      )
    ) {
      throw new Error(
        `Reliability quarantine references fragment ${fragmentId} outside the incumbent program.`,
      );
    }
  }

  const rollbackProgram:
    HierarchicalCausalProgram = {
    ...cloneProgram(
      incumbent,
    ),

    id:
      `${incumbent.id}+rollback`,

    fragments:
      incumbent.fragments
        .filter(
          (fragment) =>
            !quarantined.has(
              fragment.id,
            ),
        )
        .map(
          cloneFragment,
        ),
  };

  rollbackProgram.depth =
    1 +
    rollbackProgram
      .fragments
      .length;

  rollbackProgram.complexity =
    rollbackProgram.fragments.reduce(
      (
        total,
        fragment,
      ) =>
        total +
        fragment.terms.length,
      0,
    );

  const candidates:
    {
      program:
        HierarchicalCausalProgram;
      replacements:
        Record<
          string,
          string
        >;
      kind:
        "repair" |
        "rollback";
      error:
        number;
    }[] = [
      {
        program:
          rollbackProgram,

        replacements:
          {},

        kind:
          "rollback",

        error:
          programMeanSquaredError(
            rollbackProgram,
            protectedObservations,
          ),
      },
    ];

  for (
    const quarantinedId of
      quarantined
  ) {
    const damaged =
      incumbentById.get(
        quarantinedId,
      )!;

    const signature =
      fragmentStructureSignature(
        damaged,
      );

    for (
      const repair of
        repairFragments
    ) {
      if (
        repair.id ===
          damaged.id ||
        repair.validationMeanSquaredError >
          maximumRepairValidationMeanSquaredError ||
        fragmentStructureSignature(
          repair,
        ) !==
          signature
      ) {
        continue;
      }

      const repairedFragments =
        incumbent.fragments.map(
          (fragment) =>
            fragment.id ===
              quarantinedId
              ? cloneFragment(
                  repair,
                )
              : cloneFragment(
                  fragment,
                ),
        );

      const repaired:
        HierarchicalCausalProgram = {
        ...cloneProgram(
          incumbent,
        ),

        id:
          `${incumbent.id}+repair:${quarantinedId}->${repair.id}`,

        fragments:
          repairedFragments,

        depth:
          1 +
          repairedFragments.length,

        complexity:
          repairedFragments.reduce(
            (
              total,
              fragment,
            ) =>
              total +
              fragment.terms.length,
            0,
          ),
      };

      candidates.push({
        program:
          repaired,

        replacements: {
          [
            quarantinedId
          ]:
            repair.id,
        },

        kind:
          "repair",

        error:
          programMeanSquaredError(
            repaired,
            protectedObservations,
          ),
      });
    }
  }

  candidates.sort(
    (
      left,
      right,
    ) => {
      const errorDifference =
        left.error -
        right.error;

      if (
        Math.abs(
          errorDifference,
        ) >
          Number.EPSILON
      ) {
        return errorDifference;
      }

      if (
        left.kind !==
          right.kind
      ) {
        return left.kind ===
          "repair"
          ? -1
          : 1;
      }

      return left.program.id.localeCompare(
        right.program.id,
      );
    },
  );

  const best =
    candidates[
      0
    ]!;

  const improvement =
    incumbentError -
    best.error;

  if (
    improvement <
      minimumProtectedImprovement
  ) {
    return {
      decision:
        "retained",

      program:
        cloneProgram(
          incumbent,
        ),

      previousProgramId:
        incumbent.id,

      retiredFragmentIds:
        [],

      replacementFragmentIds:
        {},

      incumbentProtectedMeanSquaredError:
        incumbentError,

      revisedProtectedMeanSquaredError:
        incumbentError,

      improvement,

      reason:
        "incumbent-protected",
    };
  }

  return {
    decision:
      best.kind ===
        "repair"
        ? "repaired"
        : "rolled-back",

    program:
      cloneProgram(
        best.program,
      ),

    previousProgramId:
      incumbent.id,

    retiredFragmentIds:
      Array.from(
        quarantined,
      ).sort(),

    replacementFragmentIds: {
      ...best.replacements,
    },

    incumbentProtectedMeanSquaredError:
      incumbentError,

    revisedProtectedMeanSquaredError:
      best.error,

    improvement,

    reason:
      best.kind ===
        "repair"
        ? "protected-repair"
        : "protected-rollback",
  };
}

function remapRevisionPlan(
  plan:
    AutonomousSubgoalPlan,

  revisionNumber:
    number,
): AutonomousSubgoalPlan {
  const ids =
    plan.subgoals.map(
      (
        _subgoal,
        index,
      ) =>
        `revised-subgoal-${revisionNumber}-${index + 1}`,
    );

  return {
    ...plan,

    actionIds: [
      ...plan.actionIds,
    ],

    subgoals:
      plan.subgoals.map(
        (
          subgoal,
          index,
        ) => ({
          ...subgoal,

          id:
            ids[
              index
            ]!,

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
      ),
  };
}

export function reviseAutonomousSubgoalsAfterDivergence(
  reasoner:
    HierarchicalGoalReasoner,

  terminalGoalId:
    string,

  currentPlan:
    AutonomousSubgoalPlan,

  executedActionCount:
    number,

  observedState:
    number,

  programs:
    readonly HierarchicalCausalProgram[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  remainingActions:
    readonly WorldModelAction[],

  options?: {
    divergenceTolerance?: number;
    revisionNumber?: number;
    maximumRisk?: number;
    minimumGoalSuccessProbability?: number;
  },
): AutonomousSubgoalRevision {
  if (
    currentPlan.decision !==
      "planned"
  ) {
    throw new Error(
      "Subgoal revision requires an existing planned subgoal chain.",
    );
  }

  if (
    !Number.isInteger(
      executedActionCount,
    ) ||
    executedActionCount <
      1 ||
    executedActionCount >
      currentPlan.subgoals.length
  ) {
    throw new Error(
      "executedActionCount must identify an executed action in the current subgoal plan.",
    );
  }

  validateNonNegativeFinite(
    "observedState",
    observedState,
  );

  const divergenceTolerance =
    options
      ?.divergenceTolerance ??
    0.1;

  validateNonNegativeFinite(
    "divergenceTolerance",
    divergenceTolerance,
  );

  const expectedState =
    currentPlan
      .subgoals[
        executedActionCount -
          1
      ]!
      .expectedStateAfterAction;

  const divergence =
    Math.abs(
      observedState -
      expectedState,
    );

  const before =
    reasoner.getSnapshot();

  const terminalBefore =
    before.goals.find(
      (goal) =>
        goal.id ===
        terminalGoalId,
    );

  if (
    !terminalBefore
  ) {
    throw new Error(
      `Unknown terminal goal ${terminalGoalId}.`,
    );
  }

  if (
    divergence <=
      divergenceTolerance
  ) {
    return {
      decision:
        "unchanged",

      observedState,
      expectedState,
      divergence,

      staleGoalIds:
        [],

      replacementGoalIds:
        [],

      terminalGoalPreserved:
        true,

      terminalGoalId,

      reason:
        "progress-within-tolerance",
    };
  }

  const staleSubgoals =
    currentPlan.subgoals.slice(
      executedActionCount -
        1,
    );

  const revised =
    generateAutonomousSubgoalPlan(
      programs,
      belief,
      observedState,
      currentPlan
        .terminalGoalState,
      remainingActions,
      {
        maximumActions:
          staleSubgoals.length,

        maximumRisk:
          options
            ?.maximumRisk ??
          0.3,

        minimumGoalSuccessProbability:
          options
            ?.minimumGoalSuccessProbability ??
          0.8,
      },
    );

  if (
    revised.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      observedState,
      expectedState,
      divergence,

      staleGoalIds:
        staleSubgoals.map(
          (subgoal) =>
            subgoal.id,
        ),

      replacementGoalIds:
        [],

      revisedPlan:
        revised,

      terminalGoalPreserved:
        true,

      terminalGoalId,

      reason:
        "no-safe-revision",
    };
  }

  if (
    revised.subgoals.length !==
      staleSubgoals.length
  ) {
    return {
      decision:
        "abstained",

      observedState,
      expectedState,
      divergence,

      staleGoalIds:
        staleSubgoals.map(
          (subgoal) =>
            subgoal.id,
        ),

      replacementGoalIds:
        [],

      revisedPlan:
        revised,

      terminalGoalPreserved:
        true,

      terminalGoalId,

      reason:
        "revision-shape-mismatch",
    };
  }

  const revisionNumber =
    options
      ?.revisionNumber ??
    1;

  if (
    !Number.isInteger(
      revisionNumber,
    ) ||
    revisionNumber <
      1
  ) {
    throw new Error(
      "revisionNumber must be a positive integer.",
    );
  }

  const remapped =
    remapRevisionPlan(
      revised,
      revisionNumber,
    );

  for (
    const stale of
      staleSubgoals
  ) {
    reasoner.block(
      stale.id,
      `Observed state ${observedState.toFixed(
        3,
      )} diverged from predicted state ${expectedState.toFixed(
        3,
      )}.`,
    );
  }

  for (
    let index =
      0;
    index <
      staleSubgoals.length;
    index +=
      1
  ) {
    const stale =
      staleSubgoals[
        index
      ]!;

    const replacement =
      remapped.subgoals[
        index
      ]!;

    const staleGoal =
      before.goals.find(
        (goal) =>
          goal.id ===
          stale.id,
      );

    if (
      !staleGoal
    ) {
      throw new Error(
        `Stale subgoal ${stale.id} is missing from the hierarchy snapshot.`,
      );
    }

    const dependencies =
      index ===
        0
        ? [
            ...(
              staleGoal
                .dependsOnGoalIds ??
              []
            ),
          ]
        : [
            remapped
              .subgoals[
                index -
                  1
              ]!
              .id,
          ];

    reasoner.replaceBlockedGoal(
      stale.id,
      {
        id:
          replacement.id,

        description:
          `Revised: reach state ${replacement.targetState.toFixed(
            3,
          )} using ${replacement.actionId}.`,

        successCriteria: [
          `Observed state is at least ${replacement.targetState.toFixed(
            3,
          )}.`,
        ],

        constraints: [
          "Preserve the terminal objective and inherited safety constraints during revision.",
        ],

        dependsOnGoalIds:
          dependencies,
      },
    );
  }

  const after =
    reasoner.getSnapshot();

  const terminalAfter =
    after.goals.find(
      (goal) =>
        goal.id ===
        terminalGoalId,
    );

  const terminalGoalPreserved =
    Boolean(
      terminalAfter &&
      sameGoalContract(
        terminalBefore,
        terminalAfter,
      ),
    );

  if (
    !terminalGoalPreserved
  ) {
    throw new Error(
      "Subgoal revision altered the protected terminal-goal contract.",
    );
  }

  return {
    decision:
      "revised",

    observedState,
    expectedState,
    divergence,

    staleGoalIds:
      staleSubgoals.map(
        (subgoal) =>
          subgoal.id,
      ),

    replacementGoalIds:
      remapped.subgoals.map(
        (subgoal) =>
          subgoal.id,
      ),

    revisedPlan:
      remapped,

    terminalGoalPreserved,

    terminalGoalId,

    reason:
      "posterior-supported-revision",
  };
}

export function accumulateFragmentReliability(
  program:
    HierarchicalCausalProgram,

  observations:
    readonly StructuralMechanismObservation[],

  options?: {
    minimumErrorReduction?: number;
    minimumBlameEpisodes?: number;
    quarantineReliabilityThreshold?: number;
    supportErrorIncreaseThreshold?: number;
  },
): {
  tracker:
    FragmentReliabilityTracker;
  diagnoses:
    FragmentFailureDiagnosis[];
  summary:
    FragmentReliabilitySummary;
} {
  const tracker =
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

  const diagnoses =
    observations.map(
      (observation) =>
        diagnoseHierarchicalFragmentFailure(
          program,
          observation,
          options
            ?.minimumErrorReduction ??
          0.01,
        ),
    );

  for (
    const diagnosis of
      diagnoses
  ) {
    tracker.recordDiagnosis(
      diagnosis,
    );
  }

  return {
    tracker,
    diagnoses,

    summary:
      tracker.getSummary(),
  };
}

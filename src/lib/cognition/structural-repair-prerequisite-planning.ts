import type {
  Goal,
} from "./types";

import type {
  GoalSpecification,
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

import type {
  MultidimensionalCausalModel,
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

export interface StructuralRepairTopologyCandidate {
  damagedFragmentId: string;
  fragment: ValidatedCausalFragment;
  topologyChanged: boolean;
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
  repairEvidenceIds: string[];
}

export interface StructuralRepairDecision {
  decision:
    | "repaired"
    | "rolled-back"
    | "retained";
  program: HierarchicalCausalProgram;
  damagedFragmentId: string;
  synthesizedFragmentId?: string;
  topologyChanged: boolean;
  incumbentProtectedMeanSquaredError: number;
  revisedProtectedMeanSquaredError: number;
  improvement: number;
  reason:
    | "protected-structural-repair"
    | "protected-rollback"
    | "incumbent-protected";
}

export interface ActionPrerequisiteObservation {
  actionId: string;
  beforeState: Record<
    string,
    number
  >;
  observedEffects: Record<
    string,
    number
  >;
}

export interface LearnedActionPrerequisite {
  actionId: string;
  targetDimension: string;
  stateDimension: string;
  threshold: number;
  inactiveMeanEffect: number;
  activeMeanEffect: number;
  effectGap: number;
  evidenceCount: number;
}

export interface PrerequisiteAwareVectorSubgoal {
  id: string;
  actionId: string;
  targetState: Record<
    string,
    number
  >;
  prerequisiteDescriptions: string[];
  dependsOnGoalIds: string[];
}

export interface PrerequisiteAwarePlan {
  decision:
    | "planned"
    | "abstained";
  actionIds: string[];
  subgoals: PrerequisiteAwareVectorSubgoal[];
  goalSuccessProbability: number;
  expectedFinalState: Record<
    string,
    number
  >;
  totalCost: number;
  maximumRisk: number;
  reason:
    | "prerequisite-aware-vector-plan"
    | "no-safe-prerequisite-plan";
}

export interface PrerequisitePlanRevision {
  decision:
    | "revised"
    | "unchanged"
    | "abstained";
  oldActionIds: string[];
  newActionIds: string[];
  retiredGoalIds: string[];
  replacementGoalIds: string[];
  terminalGoalPreserved: boolean;
  reason:
    | "prerequisites-changed-plan"
    | "plan-still-valid"
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

function programWithoutFragment(
  program:
    HierarchicalCausalProgram,

  fragmentId:
    string,
): HierarchicalCausalProgram {
  const fragments =
    program.fragments
      .filter(
        (fragment) =>
          fragment.id !==
          fragmentId,
      )
      .map(
        cloneFragment,
      );

  return {
    ...cloneProgram(
      program,
    ),

    id:
      `${program.id}+without:${fragmentId}`,

    fragments,

    depth:
      1 +
      fragments.length,

    complexity:
      fragments.reduce(
        (
          total,
          fragment,
        ) =>
          total +
          fragment.terms.length,
        0,
      ),
  };
}

function replaceFragment(
  program:
    HierarchicalCausalProgram,

  damagedFragmentId:
    string,

  replacement:
    ValidatedCausalFragment,
): HierarchicalCausalProgram {
  const fragments =
    program.fragments.map(
      (fragment) =>
        fragment.id ===
          damagedFragmentId
          ? cloneFragment(
              replacement,
            )
          : cloneFragment(
              fragment,
            ),
    );

  return {
    ...cloneProgram(
      program,
    ),

    id:
      `${program.id}+structural-repair:${damagedFragmentId}->${replacement.id}`,

    fragments,

    depth:
      1 +
      fragments.length,

    complexity:
      fragments.reduce(
        (
          total,
          fragment,
        ) =>
          total +
          fragment.terms.length,
        0,
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
      "Structural repair evaluation requires observations.",
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

function termFeature(
  term:
    StructuralMechanismTerm,

  interventions:
    Readonly<
      Record<
        string,
        number
      >
    >,
): number {
  switch (
    term.kind
  ) {
    case "linear":
      return interventions[
        term.variables[
          0
        ]!
      ] ??
        0;

    case "interaction":
      return term.variables.reduce(
        (
          product,
          variable,
        ) =>
          product *
          (
            interventions[
              variable
            ] ??
            0
          ),
        1,
      );

    case "latent-bias":
      return 1;
  }
}

function fitTermCoefficient(
  baseline:
    HierarchicalCausalProgram,

  term:
    StructuralMechanismTerm,

  observations:
    readonly StructuralMechanismObservation[],
): number {
  let numerator =
    0;

  let denominator =
    0;

  for (
    const observation of
      observations
  ) {
    const feature =
      termFeature(
        term,
        observation
          .experiment
          .interventions,
      );

    const residual =
      observation.measuredEffect -
      predictHierarchicalProgramEffect(
        baseline,
        observation
          .experiment
          .interventions,
      );

    numerator +=
      feature *
      residual;

    denominator +=
      feature *
      feature;
  }

  if (
    denominator <=
      Number.EPSILON
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      numerator /
        denominator,
    ),
  );
}

function termSignature(
  term:
    StructuralMechanismTerm,
): string {
  return `${term.kind}:${[
    ...term.variables,
  ].sort().join("|")}`;
}

function candidateTerms(
  variables:
    readonly string[],
): StructuralMechanismTerm[] {
  const distinct =
    Array.from(
      new Set(
        variables,
      ),
    ).sort();

  const terms:
    StructuralMechanismTerm[] =
      [];

  for (
    const variable of
      distinct
  ) {
    terms.push({
      id:
        `linear(${variable})`,

      kind:
        "linear",

      variables: [
        variable,
      ],

      coefficient:
        0,
    });
  }

  for (
    let leftIndex =
      0;
    leftIndex <
      distinct.length;
    leftIndex +=
      1
  ) {
    for (
      let rightIndex =
        leftIndex +
          1;
      rightIndex <
        distinct.length;
      rightIndex +=
        1
    ) {
      const left =
        distinct[
          leftIndex
        ];

      const right =
        distinct[
          rightIndex
        ];

      if (
        left ===
          undefined ||
        right ===
          undefined
      ) {
        continue;
      }

      terms.push({
        id:
          `interaction(${left},${right})`,

        kind:
          "interaction",

        variables: [
          left,
          right,
        ],

        coefficient:
          0,
      });
    }
  }

  terms.push({
    id:
      "latent-bias",

    kind:
      "latent-bias",

    variables:
      [],

    coefficient:
      0,
  });

  return terms;
}

export function synthesizeStructuralRepairCandidates(
  incumbent:
    HierarchicalCausalProgram,

  reliability:
    FragmentReliabilitySummary,

  repairEvidence:
    readonly StructuralMechanismObservation[],

  variables:
    readonly string[],

  options?: {
    complexityPenaltyPerVariable?: number;
    maximumCandidates?: number;
  },
): StructuralRepairTopologyCandidate[] {
  if (
    reliability
      .quarantinedFragmentIds
      .length !==
      1
  ) {
    throw new Error(
      "v1.18 structural repair synthesis requires exactly one quarantined fragment.",
    );
  }

  if (
    repairEvidence.length <
      2
  ) {
    throw new Error(
      "Structural repair synthesis requires at least two repair observations.",
    );
  }

  const damagedFragmentId =
    reliability
      .quarantinedFragmentIds[
        0
      ]!;

  const damaged =
    incumbent.fragments.find(
      (fragment) =>
        fragment.id ===
        damagedFragmentId,
    );

  if (
    !damaged
  ) {
    throw new Error(
      `Quarantined fragment ${damagedFragmentId} is not in the incumbent program.`,
    );
  }

  if (
    damaged.terms.length !==
      1
  ) {
    throw new Error(
      "v1.18 structural repair synthesis currently replaces one-term fragments.",
    );
  }

  const complexityPenaltyPerVariable =
    options
      ?.complexityPenaltyPerVariable ??
    0.005;

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    12;

  validateNonNegativeFinite(
    "complexityPenaltyPerVariable",
    complexityPenaltyPerVariable,
  );

  if (
    !Number.isInteger(
      maximumCandidates,
    ) ||
    maximumCandidates <
      1
  ) {
    throw new Error(
      "maximumCandidates must be a positive integer.",
    );
  }

  const baseline =
    programWithoutFragment(
      incumbent,
      damagedFragmentId,
    );

  const damagedSignature =
    termSignature(
      damaged.terms[
        0
      ]!,
    );

  const repairEvidenceIds =
    repairEvidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  return candidateTerms(
    variables,
  )
    .map(
      (template) => {
        const coefficient =
          fitTermCoefficient(
            baseline,
            template,
            repairEvidence,
          );

        const term:
          StructuralMechanismTerm = {
          ...template,

          coefficient,

          variables: [
            ...template.variables,
          ],
        };

        const fragment:
          ValidatedCausalFragment = {
          id:
            `${damagedFragmentId}+structure:${term.id}`,

          terms: [
            term,
          ],

          validationMeanSquaredError:
            0,

          sourceEvidenceCount:
            repairEvidence.length,
        };

        const repaired =
          replaceFragment(
            incumbent,
            damagedFragmentId,
            fragment,
          );

        const discoveryMeanSquaredError =
          programMeanSquaredError(
            repaired,
            repairEvidence,
          );

        fragment.validationMeanSquaredError =
          discoveryMeanSquaredError;

        const structuralArity =
          Math.max(
            1,
            term.variables.length,
          );

        const complexityPenalty =
          structuralArity *
          complexityPenaltyPerVariable;

        return {
          damagedFragmentId,

          fragment,

          topologyChanged:
            termSignature(
              term,
            ) !==
            damagedSignature,

          discoveryMeanSquaredError,

          complexityPenalty,

          objective:
            discoveryMeanSquaredError +
            complexityPenalty,

          repairEvidenceIds: [
            ...repairEvidenceIds,
          ],
        };
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.objective -
          right.objective ||
        left.fragment.id.localeCompare(
          right.fragment.id,
        ),
    )
    .slice(
      0,
      maximumCandidates,
    );
}

export function validateStructuralRepairCandidates(
  incumbent:
    HierarchicalCausalProgram,

  reliability:
    FragmentReliabilitySummary,

  candidates:
    readonly StructuralRepairTopologyCandidate[],

  protectedObservations:
    readonly StructuralMechanismObservation[],

  options?: {
    minimumProtectedImprovement?: number;
    protectedComplexityPenaltyPerVariable?: number;
  },
): StructuralRepairDecision {
  if (
    reliability
      .quarantinedFragmentIds
      .length !==
      1
  ) {
    throw new Error(
      "v1.18 structural repair validation requires exactly one quarantined fragment.",
    );
  }

  const damagedFragmentId =
    reliability
      .quarantinedFragmentIds[
        0
      ]!;

  const protectedIds =
    new Set(
      protectedObservations.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),
    );

  for (
    const candidate of
      candidates
  ) {
    if (
      candidate.repairEvidenceIds.some(
        (id) =>
          protectedIds.has(
            id,
          ),
      )
    ) {
      throw new Error(
        "Structural repair fitting evidence must remain disjoint from protected installation evidence.",
      );
    }
  }

  const minimumProtectedImprovement =
    options
      ?.minimumProtectedImprovement ??
    0.01;

  const protectedComplexityPenaltyPerVariable =
    options
      ?.protectedComplexityPenaltyPerVariable ??
    0.002;

  validateNonNegativeFinite(
    "minimumProtectedImprovement",
    minimumProtectedImprovement,
  );

  validateNonNegativeFinite(
    "protectedComplexityPenaltyPerVariable",
    protectedComplexityPenaltyPerVariable,
  );

  const incumbentError =
    programMeanSquaredError(
      incumbent,
      protectedObservations,
    );

  const rollback =
    programWithoutFragment(
      incumbent,
      damagedFragmentId,
    );

  let bestProgram =
    incumbent;

  let bestRawError =
    incumbentError;

  let bestObjective =
    incumbentError;

  let bestKind:
    "incumbent" |
    "rollback" |
    "repair" =
      "incumbent";

  let bestCandidate:
    StructuralRepairTopologyCandidate |
    undefined;

  const rollbackError =
    programMeanSquaredError(
      rollback,
      protectedObservations,
    );

  if (
    rollbackError <
      bestObjective -
        Number.EPSILON
  ) {
    bestProgram =
      rollback;

    bestRawError =
      rollbackError;

    bestObjective =
      rollbackError;

    bestKind =
      "rollback";
  }

  for (
    const candidate of
      candidates
  ) {
    if (
      candidate.damagedFragmentId !==
        damagedFragmentId
    ) {
      continue;
    }

    const repaired =
      replaceFragment(
        incumbent,
        damagedFragmentId,
        candidate.fragment,
      );

    const rawError =
      programMeanSquaredError(
        repaired,
        protectedObservations,
      );

    const term =
      candidate
        .fragment
        .terms[
          0
        ]!;

    const structuralArity =
      Math.max(
        1,
        term.variables.length,
      );

    const objective =
      rawError +
      structuralArity *
        protectedComplexityPenaltyPerVariable;

    if (
      objective <
        bestObjective -
          Number.EPSILON ||
      (
        Math.abs(
          objective -
            bestObjective,
        ) <=
          Number.EPSILON &&
        bestKind ===
          "rollback"
      )
    ) {
      bestProgram =
        repaired;

      bestRawError =
        rawError;

      bestObjective =
        objective;

      bestKind =
        "repair";

      bestCandidate =
        candidate;
    }
  }

  const improvement =
    incumbentError -
    bestObjective;

  if (
    bestKind ===
      "incumbent" ||
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

      damagedFragmentId,

      topologyChanged:
        false,

      incumbentProtectedMeanSquaredError:
        incumbentError,

      revisedProtectedMeanSquaredError:
        incumbentError,

      improvement,

      reason:
        "incumbent-protected",
    };
  }

  if (
    bestKind ===
      "rollback"
  ) {
    return {
      decision:
        "rolled-back",

      program:
        cloneProgram(
          bestProgram,
        ),

      damagedFragmentId,

      topologyChanged:
        false,

      incumbentProtectedMeanSquaredError:
        incumbentError,

      revisedProtectedMeanSquaredError:
        bestRawError,

      improvement,

      reason:
        "protected-rollback",
    };
  }

  return {
    decision:
      "repaired",

    program:
      cloneProgram(
        bestProgram,
      ),

    damagedFragmentId,

    synthesizedFragmentId:
      bestCandidate
        ?.fragment
        .id,

    topologyChanged:
      bestCandidate
        ?.topologyChanged ??
      false,

    incumbentProtectedMeanSquaredError:
      incumbentError,

    revisedProtectedMeanSquaredError:
      bestRawError,

    improvement,

    reason:
      "protected-structural-repair",
  };
}

function mean(
  values:
    readonly number[],
): number {
  return values.reduce(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  ) /
    values.length;
}

export function learnActionPrerequisite(
  observations:
    readonly ActionPrerequisiteObservation[],

  actionId:
    string,

  targetDimension:
    string,

  candidateStateDimensions:
    readonly string[],

  options?: {
    minimumSamplesPerSide?: number;
    minimumEffectGap?: number;
  },
): LearnedActionPrerequisite |
  undefined {
  const relevant =
    observations.filter(
      (observation) =>
        observation.actionId ===
        actionId,
    );

  const minimumSamplesPerSide =
    options
      ?.minimumSamplesPerSide ??
    2;

  const minimumEffectGap =
    options
      ?.minimumEffectGap ??
    0.25;

  if (
    !Number.isInteger(
      minimumSamplesPerSide,
    ) ||
    minimumSamplesPerSide <
      1
  ) {
    throw new Error(
      "minimumSamplesPerSide must be a positive integer.",
    );
  }

  validateNonNegativeFinite(
    "minimumEffectGap",
    minimumEffectGap,
  );

  if (
    relevant.length <
      minimumSamplesPerSide *
        2
  ) {
    return undefined;
  }

  let best:
    LearnedActionPrerequisite |
    undefined;

  for (
    const stateDimension of
      Array.from(
        new Set(
          candidateStateDimensions,
        ),
      ).sort()
  ) {
    const values =
      Array.from(
        new Set(
          relevant.map(
            (observation) =>
              observation
                .beforeState[
                  stateDimension
                ] ??
              0,
          ),
        ),
      ).sort(
        (
          left,
          right,
        ) =>
          left -
          right,
      );

    for (
      let index =
        0;
      index <
        values.length -
          1;
      index +=
        1
    ) {
      const left =
        values[
          index
        ];

      const right =
        values[
          index +
            1
        ];

      if (
        left ===
          undefined ||
        right ===
          undefined
      ) {
        continue;
      }

      const threshold =
        (
          left +
          right
        ) /
        2;

      const inactive =
        relevant.filter(
          (observation) =>
            (
              observation
                .beforeState[
                  stateDimension
                ] ??
              0
            ) <
            threshold,
        );

      const active =
        relevant.filter(
          (observation) =>
            (
              observation
                .beforeState[
                  stateDimension
                ] ??
              0
            ) >=
            threshold,
        );

      if (
        inactive.length <
          minimumSamplesPerSide ||
        active.length <
          minimumSamplesPerSide
      ) {
        continue;
      }

      const inactiveMeanEffect =
        mean(
          inactive.map(
            (observation) =>
              observation
                .observedEffects[
                  targetDimension
                ] ??
              0,
          ),
        );

      const activeMeanEffect =
        mean(
          active.map(
            (observation) =>
              observation
                .observedEffects[
                  targetDimension
                ] ??
              0,
          ),
        );

      const effectGap =
        activeMeanEffect -
        inactiveMeanEffect;

      if (
        effectGap <
          minimumEffectGap
      ) {
        continue;
      }

      const candidate:
        LearnedActionPrerequisite = {
        actionId,

        targetDimension,

        stateDimension,

        threshold,

        inactiveMeanEffect,

        activeMeanEffect,

        effectGap,

        evidenceCount:
          relevant.length,
      };

      if (
        !best ||
        candidate.effectGap >
          best.effectGap +
            Number.EPSILON ||
        (
          Math.abs(
            candidate.effectGap -
              best.effectGap,
          ) <=
            Number.EPSILON &&
          (
            candidate.stateDimension <
              best.stateDimension ||
            (
              candidate.stateDimension ===
                best.stateDimension &&
              candidate.threshold <
                best.threshold
            )
          )
        )
      ) {
        best =
          candidate;
      }
    }
  }

  return best;
}

function normalizeBelief(
  belief:
    ReadonlyMap<
      string,
      number
    >,
): Map<
  string,
  number
> {
  const total =
    Array.from(
      belief.values(),
    ).reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    );

  if (
    !Number.isFinite(
      total,
    ) ||
    total <=
      0
  ) {
    throw new Error(
      "Prerequisite-aware belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      belief.entries(),
    ).map(
      (
        [
          id,
          value,
        ],
      ) => [
        id,
        value /
          total,
      ],
    ),
  );
}

function actionSequences(
  actions:
    readonly WorldModelAction[],

  maximumLength:
    number,
): WorldModelAction[][] {
  const output:
    WorldModelAction[][] =
      [];

  function visit(
    remaining:
      WorldModelAction[],

    chosen:
      WorldModelAction[],
  ): void {
    if (
      chosen.length >
        0
    ) {
      output.push([
        ...chosen,
      ]);
    }

    if (
      chosen.length >=
        maximumLength
    ) {
      return;
    }

    for (
      let index =
        0;
      index <
        remaining.length;
      index +=
        1
    ) {
      const action =
        remaining[
          index
        ];

      if (
        !action
      ) {
        continue;
      }

      chosen.push(
        action,
      );

      visit(
        [
          ...remaining.slice(
            0,
            index,
          ),
          ...remaining.slice(
            index +
              1,
          ),
        ],
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    [
      ...actions,
    ],
    [],
  );

  return output;
}

function prerequisitesSatisfied(
  state:
    Readonly<
      Record<
        string,
        number
      >
    >,

  actionId:
    string,

  prerequisites:
    readonly LearnedActionPrerequisite[],
): boolean {
  return prerequisites
    .filter(
      (prerequisite) =>
        prerequisite.actionId ===
        actionId,
    )
    .every(
      (prerequisite) =>
        (
          state[
            prerequisite
              .stateDimension
          ] ??
          0
        ) >=
          prerequisite.threshold -
            Number.EPSILON,
    );
}

function applyAction(
  model:
    MultidimensionalCausalModel,

  state:
    Readonly<
      Record<
        string,
        number
      >
    >,

  action:
    WorldModelAction,

  prerequisites:
    readonly LearnedActionPrerequisite[],
): Record<
  string,
  number
> {
  const next = {
    ...state,
  };

  if (
    !prerequisitesSatisfied(
      state,
      action.id,
      prerequisites,
    )
  ) {
    return next;
  }

  for (
    const [
      dimension,
      program,
    ] of
      Object.entries(
        model.dimensionPrograms,
      )
  ) {
    next[
      dimension
    ] =
      (
        next[
          dimension
        ] ??
        0
      ) +
      predictHierarchicalProgramEffect(
        program,
        action.interventions,
      );
  }

  return next;
}

function projectSequence(
  model:
    MultidimensionalCausalModel,

  initialState:
    Readonly<
      Record<
        string,
        number
      >
    >,

  sequence:
    readonly WorldModelAction[],

  prerequisites:
    readonly LearnedActionPrerequisite[],
): Record<
  string,
  number
> {
  let state = {
    ...initialState,
  };

  for (
    const action of
      sequence
  ) {
    state =
      applyAction(
        model,
        state,
        action,
        prerequisites,
      );
  }

  return state;
}

function goalSatisfied(
  state:
    Readonly<
      Record<
        string,
        number
      >
    >,

  goal:
    MultidimensionalGoal,
): boolean {
  for (
    const [
      dimension,
      minimum,
    ] of
      Object.entries(
        goal.minimums,
      )
  ) {
    if (
      (
        state[
          dimension
        ] ??
        0
      ) <
        minimum -
          Number.EPSILON
    ) {
      return false;
    }
  }

  for (
    const [
      dimension,
      maximum,
    ] of
      Object.entries(
        goal.maximums,
      )
  ) {
    if (
      (
        state[
          dimension
        ] ??
        0
      ) >
        maximum +
          Number.EPSILON
    ) {
      return false;
    }
  }

  return true;
}

function expectedState(
  models:
    readonly MultidimensionalCausalModel[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  initialState:
    Readonly<
      Record<
        string,
        number
      >
    >,

  sequence:
    readonly WorldModelAction[],

  prerequisites:
    readonly LearnedActionPrerequisite[],
): Record<
  string,
  number
> {
  const dimensions =
    new Set(
      Object.keys(
        initialState,
      ),
    );

  for (
    const model of
      models
  ) {
    for (
      const dimension of
        Object.keys(
          model.dimensionPrograms,
        )
    ) {
      dimensions.add(
        dimension,
      );
    }
  }

  const expected:
    Record<
      string,
      number
    > = {};

  for (
    const dimension of
      dimensions
  ) {
    expected[
      dimension
    ] =
      0;
  }

  for (
    const model of
      models
  ) {
    const probability =
      belief.get(
        model.id,
      ) ??
      0;

    const projected =
      projectSequence(
        model,
        initialState,
        sequence,
        prerequisites,
      );

    for (
      const dimension of
        dimensions
    ) {
      expected[
        dimension
      ] =
        (
          expected[
            dimension
          ] ??
          0
        ) +
        probability *
        (
          projected[
            dimension
          ] ??
          0
        );
    }
  }

  return expected;
}

export function generatePrerequisiteAwarePlan(
  models:
    readonly MultidimensionalCausalModel[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  currentState:
    Readonly<
      Record<
        string,
        number
      >
    >,

  goal:
    MultidimensionalGoal,

  actions:
    readonly WorldModelAction[],

  prerequisites:
    readonly LearnedActionPrerequisite[],

  options?: {
    maximumActions?: number;
    maximumRisk?: number;
    minimumGoalSuccessProbability?: number;
  },
): PrerequisiteAwarePlan {
  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const maximumActions =
    options
      ?.maximumActions ??
    4;

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const minimumGoalSuccessProbability =
    options
      ?.minimumGoalSuccessProbability ??
    0.9;

  if (
    !Number.isInteger(
      maximumActions,
    ) ||
    maximumActions <
      1
  ) {
    throw new Error(
      "maximumActions must be a positive integer.",
    );
  }

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateUnitInterval(
    "minimumGoalSuccessProbability",
    minimumGoalSuccessProbability,
  );

  const safeActions =
    actions.filter(
      (action) => {
        validateUnitInterval(
          "prerequisite-aware action risk",
          action.risk,
        );

        validateNonNegativeFinite(
          "prerequisite-aware action cost",
          action.cost,
        );

        return action.reversible &&
          action.risk <=
            maximumRisk;
      },
    );

  let best:
    {
      sequence:
        WorldModelAction[];
      successProbability:
        number;
      expectedFinalState:
        Record<
          string,
          number
        >;
      totalCost:
        number;
      maximumRisk:
        number;
    } |
    undefined;

  for (
    const sequence of
      actionSequences(
        safeActions,
        Math.min(
          maximumActions,
          safeActions.length,
        ),
      )
  ) {
    let successProbability =
      0;

    for (
      const model of
        models
    ) {
      const probability =
        normalizedBelief.get(
          model.id,
        ) ??
        0;

      if (
        goalSatisfied(
          projectSequence(
            model,
            currentState,
            sequence,
            prerequisites,
          ),
          goal,
        )
      ) {
        successProbability +=
          probability;
      }
    }

    if (
      successProbability <
        minimumGoalSuccessProbability
    ) {
      continue;
    }

    const totalCost =
      sequence.reduce(
        (
          total,
          action,
        ) =>
          total +
          action.cost,
        0,
      );

    const sequenceMaximumRisk =
      sequence.reduce(
        (
          risk,
          action,
        ) =>
          Math.max(
            risk,
            action.risk,
          ),
        0,
      );

    if (
      !best ||
      totalCost <
        best.totalCost -
          Number.EPSILON ||
      (
        Math.abs(
          totalCost -
            best.totalCost,
        ) <=
          Number.EPSILON &&
        sequence.length <
          best.sequence.length
      ) ||
      (
        Math.abs(
          totalCost -
            best.totalCost,
        ) <=
          Number.EPSILON &&
        sequence.length ===
          best.sequence.length &&
        sequence
          .map(
            (action) =>
              action.id,
          )
          .join("|") <
          best.sequence
            .map(
              (action) =>
                action.id,
            )
            .join("|")
      )
    ) {
      best = {
        sequence:
          sequence.map(
            (action) => ({
              ...action,

              interventions: {
                ...action.interventions,
              },
            }),
          ),

        successProbability,

        expectedFinalState:
          expectedState(
            models,
            normalizedBelief,
            currentState,
            sequence,
            prerequisites,
          ),

        totalCost,

        maximumRisk:
          sequenceMaximumRisk,
      };
    }
  }

  if (
    !best
  ) {
    return {
      decision:
        "abstained",

      actionIds:
        [],

      subgoals:
        [],

      goalSuccessProbability:
        0,

      expectedFinalState: {
        ...currentState,
      },

      totalCost:
        0,

      maximumRisk:
        0,

      reason:
        "no-safe-prerequisite-plan",
    };
  }

  const subgoals:
    PrerequisiteAwareVectorSubgoal[] =
      [];

  for (
    let index =
      0;
    index <
      best.sequence.length;
    index +=
      1
  ) {
    const action =
      best.sequence[
        index
      ]!;

    const partial =
      best.sequence.slice(
        0,
        index +
          1,
      );

    const targetState =
      expectedState(
        models,
        normalizedBelief,
        currentState,
        partial,
        prerequisites,
      );

    const actionPrerequisites =
      prerequisites.filter(
        (prerequisite) =>
          prerequisite.actionId ===
          action.id,
      );

    subgoals.push({
      id:
        `prerequisite-vector-subgoal-${index + 1}`,

      actionId:
        action.id,

      targetState,

      prerequisiteDescriptions:
        actionPrerequisites.map(
          (prerequisite) =>
            `${prerequisite.stateDimension} >= ${prerequisite.threshold.toFixed(
              3,
            )} before ${action.id}`,
        ),

      dependsOnGoalIds:
        index ===
          0
          ? []
          : [
              `prerequisite-vector-subgoal-${index}`,
            ],
    });
  }

  return {
    decision:
      "planned",

    actionIds:
      best.sequence.map(
        (action) =>
          action.id,
      ),

    subgoals,

    goalSuccessProbability:
      best.successProbability,

    expectedFinalState:
      best.expectedFinalState,

    totalCost:
      best.totalCost,

    maximumRisk:
      best.maximumRisk,

    reason:
      "prerequisite-aware-vector-plan",
  };
}

function stateDescription(
  state:
    Readonly<
      Record<
        string,
        number
      >
    >,
): string {
  return Object.entries(
    state,
  )
    .sort(
      (
        left,
        right,
      ) =>
        left[
          0
        ].localeCompare(
          right[
            0
          ],
        ),
    )
    .map(
      (
        [
          dimension,
          value,
        ],
      ) =>
        `${dimension}=${value.toFixed(
          3,
        )}`,
    )
    .join(", ");
}

export function materializePrerequisiteAwareSubgoals(
  reasoner:
    HierarchicalGoalReasoner,

  parentGoalId:
    string,

  plan:
    PrerequisiteAwarePlan,
): Goal[] {
  if (
    plan.decision !==
      "planned"
  ) {
    throw new Error(
      "Cannot materialize an abstained prerequisite-aware plan.",
    );
  }

  const specifications:
    GoalSpecification[] =
      plan.subgoals.map(
        (subgoal) => ({
          id:
            subgoal.id,

          description:
            `Reach vector state ${stateDescription(
              subgoal.targetState,
            )} using ${subgoal.actionId}.`,

          successCriteria: [
            `Observed vector state reaches the planned target: ${stateDescription(
              subgoal.targetState,
            )}.`,
            ...subgoal
              .prerequisiteDescriptions,
          ],

          constraints: [
            "Preserve learned action prerequisites, terminal vector constraints, and hard safety limits.",
          ],

          dependsOnGoalIds: [
            ...subgoal
              .dependsOnGoalIds,
          ],
        }),
      );

  return reasoner.decompose(
    parentGoalId,
    specifications,
  );
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

export function revisePrerequisiteAwareGoalChain(
  reasoner:
    HierarchicalGoalReasoner,

  terminalGoalId:
    string,

  currentPlan:
    PrerequisiteAwarePlan,

  revisedPlan:
    PrerequisiteAwarePlan,

  revisionNumber =
    1,
): PrerequisitePlanRevision {
  if (
    currentPlan.decision !==
      "planned" ||
    revisedPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      oldActionIds: [
        ...currentPlan.actionIds,
      ],

      newActionIds: [
        ...revisedPlan.actionIds,
      ],

      retiredGoalIds:
        [],

      replacementGoalIds:
        [],

      terminalGoalPreserved:
        true,

      reason:
        "revision-shape-mismatch",
    };
  }

  if (
    JSON.stringify(
      currentPlan.actionIds,
    ) ===
      JSON.stringify(
        revisedPlan.actionIds,
      )
  ) {
    return {
      decision:
        "unchanged",

      oldActionIds: [
        ...currentPlan.actionIds,
      ],

      newActionIds: [
        ...revisedPlan.actionIds,
      ],

      retiredGoalIds:
        [],

      replacementGoalIds:
        [],

      terminalGoalPreserved:
        true,

      reason:
        "plan-still-valid",
    };
  }

  if (
    currentPlan.subgoals.length !==
      revisedPlan.subgoals.length
  ) {
    return {
      decision:
        "abstained",

      oldActionIds: [
        ...currentPlan.actionIds,
      ],

      newActionIds: [
        ...revisedPlan.actionIds,
      ],

      retiredGoalIds:
        [],

      replacementGoalIds:
        [],

      terminalGoalPreserved:
        true,

      reason:
        "revision-shape-mismatch",
    };
  }

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

  const replacementIds =
    revisedPlan.subgoals.map(
      (
        _subgoal,
        index,
      ) =>
        `prerequisite-revised-${revisionNumber}-${index + 1}`,
    );

  for (
    let index =
      0;
    index <
      currentPlan.subgoals.length;
    index +=
      1
  ) {
    const stale =
      currentPlan.subgoals[
        index
      ]!;

    reasoner.block(
      stale.id,
      "Learned action prerequisites changed; the old vector-goal branch is stale.",
    );

    const replacement =
      revisedPlan.subgoals[
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
        `Stale prerequisite goal ${stale.id} is missing from the hierarchy.`,
      );
    }

    reasoner.replaceBlockedGoal(
      stale.id,
      {
        id:
          replacementIds[
            index
          ]!,

        description:
          `Revised: reach vector state ${stateDescription(
            replacement.targetState,
          )} using ${replacement.actionId}.`,

        successCriteria: [
          `Observed vector state reaches the revised target: ${stateDescription(
            replacement.targetState,
          )}.`,
          ...replacement
            .prerequisiteDescriptions,
        ],

        constraints: [
          "Preserve learned action prerequisites, terminal vector constraints, and hard safety limits during revision.",
        ],

        dependsOnGoalIds:
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
                replacementIds[
                  index -
                    1
                ]!,
              ],
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
      "Prerequisite-aware revision altered the protected terminal-goal contract.",
    );
  }

  return {
    decision:
      "revised",

    oldActionIds: [
      ...currentPlan.actionIds,
    ],

    newActionIds: [
      ...revisedPlan.actionIds,
    ],

    retiredGoalIds:
      currentPlan.subgoals.map(
        (subgoal) =>
          subgoal.id,
      ),

    replacementGoalIds:
      replacementIds,

    terminalGoalPreserved,

    reason:
      "prerequisites-changed-plan",
  };
}

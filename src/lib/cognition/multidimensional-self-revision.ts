import type {
  Goal,
} from "./types";

import {
  type GoalSpecification,
  type HierarchicalGoalReasoner,
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
  WorldModelAction,
  WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface SynthesizedFragmentRepairCandidate {
  damagedFragmentId: string;
  fragment: ValidatedCausalFragment;
  discoveryMeanSquaredError: number;
  fittedCoefficient: number;
  evidenceCount: number;
}

export interface AutonomousRepairDecision {
  decision:
    | "repaired"
    | "rolled-back"
    | "retained";
  program: HierarchicalCausalProgram;
  damagedFragmentId: string;
  synthesizedFragmentId?: string;
  incumbentProtectedMeanSquaredError: number;
  revisedProtectedMeanSquaredError: number;
  improvement: number;
  reason:
    | "protected-synthesized-repair"
    | "protected-rollback"
    | "incumbent-protected";
}

export interface MultidimensionalCausalModel {
  id: string;
  dimensionPrograms: Record<
    string,
    HierarchicalCausalProgram
  >;
}

export interface MultidimensionalGoal {
  minimums: Record<
    string,
    number
  >;
  maximums: Record<
    string,
    number
  >;
}

export interface MultidimensionalSubgoal {
  id: string;
  actionId: string;
  targetState: Record<
    string,
    number
  >;
  dependsOnGoalIds: string[];
  rationale: string;
}

export interface MultidimensionalPlan {
  decision:
    | "planned"
    | "abstained";
  actionIds: string[];
  subgoals: MultidimensionalSubgoal[];
  goalSuccessProbability: number;
  expectedFinalState: Record<
    string,
    number
  >;
  totalCost: number;
  maximumRisk: number;
  reason:
    | "posterior-supported-vector-plan"
    | "no-safe-vector-plan";
}

export interface EpistemicSubgoal {
  id: string;
  experimentId: string;
  diagnosticDimension: string;
  expectedInformationGain: number;
  expectedPosteriorEntropy: number;
  risk: number;
  cost: number;
}

export interface EpistemicSelection {
  decision:
    | "selected"
    | "not-needed"
    | "abstained";
  subgoal?: EpistemicSubgoal;
  priorEntropy: number;
  reason:
    | "model-uncertainty-requires-information"
    | "model-uncertainty-low"
    | "no-safe-informative-experiment";
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

function validateFinite(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    throw new Error(
      `${name} must be finite.`,
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
      "Autonomous repair validation requires observations.",
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
      if (
        term.variables.length !==
          1
      ) {
        throw new Error(
          "Autonomous repair linear terms require exactly one variable.",
        );
      }

      return interventions[
        term.variables[
          0
        ]!
      ] ??
        0;

    case "interaction":
      if (
        term.variables.length !==
          2
      ) {
        throw new Error(
          "Autonomous repair interaction terms require exactly two variables.",
        );
      }

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
      if (
        term.variables.length !==
          0
      ) {
        throw new Error(
          "Autonomous repair latent-bias terms cannot name observed variables.",
        );
      }

      return 1;
  }
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
      `${program.id}+autonomous-repair:${damagedFragmentId}->${replacement.id}`,

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

export function synthesizeFragmentRepairCandidates(
  incumbent:
    HierarchicalCausalProgram,

  reliability:
    FragmentReliabilitySummary,

  repairEvidence:
    readonly StructuralMechanismObservation[],
): SynthesizedFragmentRepairCandidate[] {
  if (
    repairEvidence.length ===
      0
  ) {
    throw new Error(
      "Autonomous repair synthesis requires repair evidence.",
    );
  }

  const quarantined =
    reliability
      .quarantinedFragmentIds;

  if (
    quarantined.length ===
      0
  ) {
    return [];
  }

  const candidates:
    SynthesizedFragmentRepairCandidate[] =
      [];

  for (
    const damagedFragmentId of
      quarantined
  ) {
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
        "v1.17 autonomous repair synthesis currently supports one-term fragments only.",
      );
    }

    const damagedTerm =
      damaged.terms[
        0
      ]!;

    const baseline =
      programWithoutFragment(
        incumbent,
        damagedFragmentId,
      );

    let numerator =
      0;

    let denominator =
      0;

    for (
      const observation of
        repairEvidence
    ) {
      const feature =
        termFeature(
          damagedTerm,
          observation
            .experiment
            .interventions,
        );

      const baselinePrediction =
        predictHierarchicalProgramEffect(
          baseline,
          observation
            .experiment
            .interventions,
        );

      const residual =
        observation.measuredEffect -
        baselinePrediction;

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
      continue;
    }

    const fittedCoefficient =
      Math.min(
        1,
        Math.max(
          0,
          numerator /
            denominator,
        ),
      );

    const fittedTerm:
      StructuralMechanismTerm = {
      ...damagedTerm,

      coefficient:
        fittedCoefficient,

      variables: [
        ...damagedTerm.variables,
      ],
    };

    const fragment:
      ValidatedCausalFragment = {
      id:
        `${damagedFragmentId}+synthesized-repair`,

      terms: [
        fittedTerm,
      ],

      validationMeanSquaredError:
        0,

      sourceEvidenceCount:
        repairEvidence.length,
    };

    const candidateProgram =
      replaceFragment(
        incumbent,
        damagedFragmentId,
        fragment,
      );

    const discoveryMeanSquaredError =
      programMeanSquaredError(
        candidateProgram,
        repairEvidence,
      );

    fragment.validationMeanSquaredError =
      discoveryMeanSquaredError;

    candidates.push({
      damagedFragmentId,

      fragment,

      discoveryMeanSquaredError,

      fittedCoefficient,

      evidenceCount:
        repairEvidence.length,
    });
  }

  return candidates.sort(
    (
      left,
      right,
    ) =>
      left.discoveryMeanSquaredError -
        right.discoveryMeanSquaredError ||
      left.fragment.id.localeCompare(
        right.fragment.id,
      ),
  );
}

export function validateAutonomousFragmentRepairs(
  incumbent:
    HierarchicalCausalProgram,

  reliability:
    FragmentReliabilitySummary,

  candidates:
    readonly SynthesizedFragmentRepairCandidate[],

  protectedObservations:
    readonly StructuralMechanismObservation[],

  minimumProtectedImprovement =
    0.01,
): AutonomousRepairDecision {
  validateNonNegativeFinite(
    "minimumProtectedImprovement",
    minimumProtectedImprovement,
  );

  if (
    reliability
      .quarantinedFragmentIds
      .length !==
      1
  ) {
    throw new Error(
      "v1.17 autonomous repair validation requires exactly one quarantined fragment.",
    );
  }

  const damagedFragmentId =
    reliability
      .quarantinedFragmentIds[
        0
      ]!;

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

  let bestError =
    incumbentError;

  let bestKind:
    "repair" |
    "rollback" |
    "incumbent" =
      "incumbent";

  let synthesizedFragmentId:
    string |
    undefined;

  const rollbackError =
    programMeanSquaredError(
      rollback,
      protectedObservations,
    );

  if (
    rollbackError <
      bestError -
        Number.EPSILON
  ) {
    bestProgram =
      rollback;

    bestError =
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

    const error =
      programMeanSquaredError(
        repaired,
        protectedObservations,
      );

    if (
      error <
        bestError -
          Number.EPSILON ||
      (
        Math.abs(
          error -
            bestError,
        ) <=
          Number.EPSILON &&
        bestKind ===
          "rollback"
      )
    ) {
      bestProgram =
        repaired;

      bestError =
        error;

      bestKind =
        "repair";

      synthesizedFragmentId =
        candidate
          .fragment
          .id;
    }
  }

  const improvement =
    incumbentError -
    bestError;

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
      bestKind ===
        "repair"
        ? "repaired"
        : "rolled-back",

    program:
      cloneProgram(
        bestProgram,
      ),

    damagedFragmentId,

    synthesizedFragmentId,

    incumbentProtectedMeanSquaredError:
      incumbentError,

    revisedProtectedMeanSquaredError:
      bestError,

    improvement,

    reason:
      bestKind ===
        "repair"
        ? "protected-synthesized-repair"
        : "protected-rollback",
  };
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
        probability,
      ) =>
        sum +
        probability,
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
      "Multidimensional model belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      belief.entries(),
    ).map(
      (
        [
          id,
          probability,
        ],
      ) => [
        id,
        probability /
          total,
      ],
    ),
  );
}

function entropy(
  probabilities:
    readonly number[],
): number {
  let result =
    0;

  for (
    const probability of
      probabilities
  ) {
    if (
      probability >
        0
    ) {
      result -=
        probability *
        Math.log(
          probability,
        );
    }
  }

  return result;
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

function projectVectorState(
  model:
    MultidimensionalCausalModel,

  currentState:
    Readonly<
      Record<
        string,
        number
      >
    >,

  sequence:
    readonly WorldModelAction[],
): Record<
  string,
  number
> {
  const projected = {
    ...currentState,
  };

  for (
    const action of
      sequence
  ) {
    for (
      const [
        dimension,
        program,
      ] of
        Object.entries(
          model.dimensionPrograms,
        )
    ) {
      const current =
        projected[
          dimension
        ] ??
        0;

      projected[
        dimension
      ] =
        current +
        predictHierarchicalProgramEffect(
          program,
          action.interventions,
        );
    }
  }

  return projected;
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
    validateFinite(
      `minimum goal for ${dimension}`,
      minimum,
    );

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
    validateFinite(
      `maximum goal for ${dimension}`,
      maximum,
    );

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

function expectedVectorState(
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

  sequence:
    readonly WorldModelAction[],
): Record<
  string,
  number
> {
  const dimensions =
    new Set<
      string
    >(
      Object.keys(
        currentState,
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
      projectVectorState(
        model,
        currentState,
        sequence,
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

export function generateMultidimensionalPlan(
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

  options?: {
    maximumActions?: number;
    maximumRisk?: number;
    minimumGoalSuccessProbability?: number;
  },
): MultidimensionalPlan {
  if (
    models.length ===
      0
  ) {
    throw new Error(
      "Multidimensional planning requires at least one causal model.",
    );
  }

  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const maximumActions =
    options
      ?.maximumActions ??
    4;

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

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const minimumGoalSuccessProbability =
    options
      ?.minimumGoalSuccessProbability ??
    0.9;

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
          "multidimensional action risk",
          action.risk,
        );

        validateNonNegativeFinite(
          "multidimensional action cost",
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
          projectVectorState(
            model,
            currentState,
            sequence,
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
          expectedVectorState(
            models,
            normalizedBelief,
            currentState,
            sequence,
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
        "no-safe-vector-plan",
    };
  }

  const subgoals:
    MultidimensionalSubgoal[] =
      [];

  for (
    let index =
      0;
    index <
      best.sequence.length;
    index +=
      1
  ) {
    const partialSequence =
      best.sequence.slice(
        0,
        index +
          1,
      );

    const targetState =
      expectedVectorState(
        models,
        normalizedBelief,
        currentState,
        partialSequence,
      );

    subgoals.push({
      id:
        `vector-subgoal-${index + 1}`,

      actionId:
        best.sequence[
          index
        ]!
          .id,

      targetState,

      dependsOnGoalIds:
        index ===
          0
          ? []
          : [
              `vector-subgoal-${index}`,
            ],

      rationale:
        index ===
          best.sequence.length -
            1
          ? "Satisfy the complete multidimensional terminal constraint set."
          : "Reach a safe intermediate vector state required by the remaining plan.",
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
      "posterior-supported-vector-plan",
  };
}

function gaussianLikelihood(
  observation:
    number,

  mean:
    number,

  stdDev:
    number,
): number {
  const variance =
    stdDev *
    stdDev;

  return Math.exp(
    -(
      (
        observation -
        mean
      ) *
      (
        observation -
        mean
      )
    ) /
    (
      2 *
      variance
    ),
  ) /
    (
      stdDev *
      Math.sqrt(
        2 *
        Math.PI,
      )
    );
}

function updateModelBelief(
  models:
    readonly MultidimensionalCausalModel[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  experiment:
    WorldModelExperiment,

  diagnosticDimension:
    string,

  observation:
    number,
): Map<
  string,
  number
> {
  const weighted =
    new Map<
      string,
      number
    >();

  for (
    const model of
      models
  ) {
    const program =
      model.dimensionPrograms[
        diagnosticDimension
      ];

    if (
      !program
    ) {
      throw new Error(
        `Model ${model.id} lacks diagnostic dimension ${diagnosticDimension}.`,
      );
    }

    const prediction =
      predictHierarchicalProgramEffect(
        program,
        experiment.interventions,
      );

    weighted.set(
      model.id,
      (
        prior.get(
          model.id,
        ) ??
        0
      ) *
        gaussianLikelihood(
          observation,
          prediction,
          program.observationStdDev,
        ),
    );
  }

  return normalizeBelief(
    weighted,
  );
}

export function chooseEpistemicSubgoal(
  models:
    readonly MultidimensionalCausalModel[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  experiments:
    readonly WorldModelExperiment[],

  diagnosticDimension:
    string,

  options?: {
    entropyThreshold?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
  },
): EpistemicSelection {
  if (
    models.length <
      2
  ) {
    return {
      decision:
        "not-needed",

      priorEntropy:
        0,

      reason:
        "model-uncertainty-low",
    };
  }

  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const priorEntropy =
    entropy(
      Array.from(
        normalizedBelief.values(),
      ),
    );

  const entropyThreshold =
    options
      ?.entropyThreshold ??
    0.2;

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const minimumInformationGain =
    options
      ?.minimumInformationGain ??
    0.05;

  validateNonNegativeFinite(
    "entropyThreshold",
    entropyThreshold,
  );

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "minimumInformationGain",
    minimumInformationGain,
  );

  if (
    priorEntropy <=
      entropyThreshold
  ) {
    return {
      decision:
        "not-needed",

      priorEntropy,

      reason:
        "model-uncertainty-low",
    };
  }

  let best:
    EpistemicSubgoal |
    undefined;

  for (
    const experiment of
      experiments
  ) {
    validateUnitInterval(
      "epistemic experiment risk",
      experiment.risk,
    );

    validateNonNegativeFinite(
      "epistemic experiment cost",
      experiment.cost,
    );

    if (
      !experiment.reversible ||
      experiment.risk >
        maximumRisk
    ) {
      continue;
    }

    let expectedPosteriorEntropy =
      0;

    for (
      const truth of
        models
    ) {
      const truthProbability =
        normalizedBelief.get(
          truth.id,
        ) ??
        0;

      if (
        truthProbability <=
          0
      ) {
        continue;
      }

      const truthProgram =
        truth.dimensionPrograms[
          diagnosticDimension
        ];

      if (
        !truthProgram
      ) {
        throw new Error(
          `Model ${truth.id} lacks diagnostic dimension ${diagnosticDimension}.`,
        );
      }

      const representativeObservation =
        predictHierarchicalProgramEffect(
          truthProgram,
          experiment.interventions,
        );

      const posterior =
        updateModelBelief(
          models,
          normalizedBelief,
          experiment,
          diagnosticDimension,
          representativeObservation,
        );

      expectedPosteriorEntropy +=
        truthProbability *
        entropy(
          Array.from(
            posterior.values(),
          ),
        );
    }

    const informationGain =
      Math.max(
        0,
        priorEntropy -
          expectedPosteriorEntropy,
      );

    if (
      informationGain <
        minimumInformationGain
    ) {
      continue;
    }

    const candidate:
      EpistemicSubgoal = {
      id:
        "epistemic-subgoal-1",

      experimentId:
        experiment.id,

      diagnosticDimension,

      expectedInformationGain:
        informationGain,

      expectedPosteriorEntropy,

      risk:
        experiment.risk,

      cost:
        experiment.cost,
    };

    if (
      !best ||
      candidate.expectedInformationGain -
        candidate.cost >
        best.expectedInformationGain -
          best.cost +
          Number.EPSILON ||
      (
        Math.abs(
          (
            candidate.expectedInformationGain -
            candidate.cost
          ) -
          (
            best.expectedInformationGain -
            best.cost
          ),
        ) <=
          Number.EPSILON &&
        candidate.experimentId <
          best.experimentId
      )
    ) {
      best =
        candidate;
    }
  }

  if (
    !best
  ) {
    return {
      decision:
        "abstained",

      priorEntropy,

      reason:
        "no-safe-informative-experiment",
    };
  }

  return {
    decision:
      "selected",

    subgoal:
      best,

    priorEntropy,

    reason:
      "model-uncertainty-requires-information",
  };
}

export function updateMultidimensionalBeliefFromExperiment(
  models:
    readonly MultidimensionalCausalModel[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  experiment:
    WorldModelExperiment,

  diagnosticDimension:
    string,

  measuredEffect:
    number,
): ReadonlyMap<
  string,
  number
> {
  validateNonNegativeFinite(
    "measuredEffect",
    measuredEffect,
  );

  return updateModelBelief(
    models,
    normalizeBelief(
      belief,
    ),
    experiment,
    diagnosticDimension,
    measuredEffect,
  );
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

export function materializeEpistemicSubgoal(
  reasoner:
    HierarchicalGoalReasoner,

  parentGoalId:
    string,

  selection:
    EpistemicSelection,
): Goal {
  if (
    selection.decision !==
      "selected" ||
    !selection.subgoal
  ) {
    throw new Error(
      "Cannot materialize an epistemic subgoal when no experiment was selected.",
    );
  }

  return reasoner.decompose(
    parentGoalId,
    [
      {
        id:
          selection
            .subgoal
            .id,

        description:
          `Reduce causal-model uncertainty with experiment ${selection.subgoal.experimentId}.`,

        successCriteria: [
          `Record the result of experiment ${selection.subgoal.experimentId} and update the model posterior.`,
        ],

        constraints: [
          "Use only reversible information-gathering experiments within the approved risk ceiling.",
        ],
      },
    ],
  )[
    0
  ]!;
}

export function materializeMultidimensionalSubgoals(
  reasoner:
    HierarchicalGoalReasoner,

  parentGoalId:
    string,

  plan:
    MultidimensionalPlan,

  prerequisiteGoalId?: string,
): Goal[] {
  if (
    plan.decision !==
      "planned"
  ) {
    throw new Error(
      "Cannot materialize an abstained multidimensional plan.",
    );
  }

  const specifications:
    GoalSpecification[] =
      plan.subgoals.map(
        (
          subgoal,
          index,
        ) => ({
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
          ],

          constraints: [
            "Preserve all multidimensional terminal constraints and hard safety limits.",
          ],

          dependsOnGoalIds:
            index ===
              0 &&
            prerequisiteGoalId
              ? [
                  prerequisiteGoalId,
                ]
              : [
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

import {
  predictStructuredMechanismEffect,
  type StructuralMechanismObservation,
  type StructuralMechanismTerm,
  type StructuredCausalMechanism,
} from "./mechanism-structure-synthesis";

import {
  predictMechanismEffect,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface ValidatedCausalFragment {
  id: string;
  terms: StructuralMechanismTerm[];
  validationMeanSquaredError: number;
  sourceEvidenceCount: number;
}

export interface HierarchicalCausalProgram {
  id: string;
  baseEffects: Record<
    string,
    number
  >;
  fragments: ValidatedCausalFragment[];
  observationStdDev: number;
  depth: number;
  complexity: number;
}

export interface HierarchicalProgramCandidate {
  program: HierarchicalCausalProgram;
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
}

export interface HierarchicalProgramDecision {
  champion: HierarchicalCausalProgram;
  promoted: boolean;
  previousChampionId?: string;
  protectedMeanSquaredError: number;
  incumbentProtectedMeanSquaredError: number;
  improvement: number;
  reason:
    | "validated-hierarchical-program"
    | "incumbent-program-retained";
}

export interface LongHorizonPolicyBranch {
  representativeMechanismId: string;
  representativeObservation: number;
  probability: number;
  child: LongHorizonPolicyNode;
}

export interface LongHorizonPolicyNode {
  kind:
    | "experiment"
    | "action"
    | "stop";
  selectedId?: string;
  state: number;
  depthRemaining: number;
  expectedUtility: number;
  expectedGoalSuccessProbability: number;
  totalExpectedCost: number;
  maximumRisk: number;
  branches?: LongHorizonPolicyBranch[];
  child?: LongHorizonPolicyNode;
}

export interface LongHorizonDualControlPlan {
  decision:
    | "plan"
    | "abstained";
  root?: LongHorizonPolicyNode;
  expectedUtility: number;
  expectedGoalSuccessProbability: number;
  expectedCost: number;
  maximumRisk: number;
  reason:
    | "safe-long-horizon-policy"
    | "no-safe-long-horizon-policy";
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

function combinations<T>(
  values:
    readonly T[],

  size:
    number,
): T[][] {
  const output:
    T[][] =
      [];

  function visit(
    start:
      number,

    chosen:
      T[],
  ): void {
    if (
      chosen.length ===
        size
    ) {
      output.push([
        ...chosen,
      ]);

      return;
    }

    for (
      let index =
        start;
      index <
        values.length;
      index +=
        1
    ) {
      const value =
        values[
          index
        ];

      if (
        value ===
          undefined
      ) {
        continue;
      }

      chosen.push(
        value,
      );

      visit(
        index +
          1,
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    0,
    [],
  );

  return output;
}

function cloneTerm(
  term:
    StructuralMechanismTerm,
): StructuralMechanismTerm {
  return {
    ...term,

    variables: [
      ...term.variables,
    ],
  };
}

function cloneFragment(
  fragment:
    ValidatedCausalFragment,
): ValidatedCausalFragment {
  return {
    ...fragment,

    terms:
      fragment.terms.map(
        cloneTerm,
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

export function flattenHierarchicalCausalProgram(
  program:
    HierarchicalCausalProgram,
): StructuredCausalMechanism {
  return {
    id:
      program.id,

    baseEffects: {
      ...program.baseEffects,
    },

    terms:
      program.fragments.flatMap(
        (fragment) =>
          fragment.terms.map(
            cloneTerm,
          ),
      ),

    observationStdDev:
      program.observationStdDev,
  };
}

export function predictHierarchicalProgramEffect(
  program:
    HierarchicalCausalProgram,

  interventions:
    Readonly<
      Record<
        string,
        number
      >
    >,
): number {
  return predictStructuredMechanismEffect(
    flattenHierarchicalCausalProgram(
      program,
    ),
    interventions,
  );
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
      "Hierarchical program evaluation requires observations.",
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

function validateFragments(
  fragments:
    readonly ValidatedCausalFragment[],
): void {
  const seen =
    new Set<
      string
    >();

  for (
    const fragment of
      fragments
  ) {
    if (
      !fragment.id.trim() ||
      seen.has(
        fragment.id,
      )
    ) {
      throw new Error(
        "Validated causal fragment ids must be non-empty and unique.",
      );
    }

    if (
      fragment.terms.length ===
        0
    ) {
      throw new Error(
        `Validated causal fragment ${fragment.id} must contain at least one term.`,
      );
    }

    validateNonNegativeFinite(
      `validationMeanSquaredError for ${fragment.id}`,
      fragment.validationMeanSquaredError,
    );

    if (
      !Number.isInteger(
        fragment.sourceEvidenceCount,
      ) ||
      fragment.sourceEvidenceCount <
        1
    ) {
      throw new Error(
        `Validated causal fragment ${fragment.id} requires positive source evidence.`,
      );
    }

    seen.add(
      fragment.id,
    );
  }
}

export function synthesizeHierarchicalCausalPrograms(
  incumbent:
    HierarchicalCausalProgram,

  fragments:
    readonly ValidatedCausalFragment[],

  discoveryObservations:
    readonly StructuralMechanismObservation[],

  options?: {
    maximumFragments?: number;
    complexityPenaltyPerTerm?: number;
    maximumCandidates?: number;
  },
): HierarchicalProgramCandidate[] {
  validateFragments(
    fragments,
  );

  if (
    discoveryObservations.length ===
      0
  ) {
    throw new Error(
      "Hierarchical program synthesis requires discovery observations.",
    );
  }

  const maximumFragments =
    Math.min(
      options
        ?.maximumFragments ??
        2,
      fragments.length,
    );

  if (
    !Number.isInteger(
      maximumFragments,
    ) ||
    maximumFragments <
      1
  ) {
    throw new Error(
      "maximumFragments must be a positive integer.",
    );
  }

  const complexityPenaltyPerTerm =
    options
      ?.complexityPenaltyPerTerm ??
    0.005;

  validateNonNegativeFinite(
    "complexityPenaltyPerTerm",
    complexityPenaltyPerTerm,
  );

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    16;

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

  const candidates:
    HierarchicalProgramCandidate[] =
      [];

  for (
    let fragmentCount =
      1;
    fragmentCount <=
      maximumFragments;
    fragmentCount +=
      1
  ) {
    for (
      const selected of
        combinations(
          fragments,
          fragmentCount,
        )
    ) {
      const fragmentCopies =
        selected.map(
          cloneFragment,
        );

      const termCount =
        fragmentCopies.reduce(
          (
            total,
            fragment,
          ) =>
            total +
            fragment.terms.length,
          0,
        );

      const program:
        HierarchicalCausalProgram = {
        id:
          `${incumbent.id}+program:${fragmentCopies.map(
            (fragment) =>
              fragment.id,
          ).join("+")}`,

        baseEffects: {
          ...incumbent.baseEffects,
        },

        fragments:
          fragmentCopies,

        observationStdDev:
          incumbent
            .observationStdDev,

        depth:
          1 +
          fragmentCopies.length,

        complexity:
          termCount,
      };

      const discoveryMeanSquaredError =
        programMeanSquaredError(
          program,
          discoveryObservations,
        );

      const complexityPenalty =
        termCount *
        complexityPenaltyPerTerm;

      candidates.push({
        program,

        discoveryMeanSquaredError,

        complexityPenalty,

        objective:
          discoveryMeanSquaredError +
          complexityPenalty,
      });
    }
  }

  return candidates
    .sort(
      (
        left,
        right,
      ) =>
        left.objective -
          right.objective ||
        left.program.complexity -
          right.program.complexity ||
        left.program.id.localeCompare(
          right.program.id,
        ),
    )
    .slice(
      0,
      maximumCandidates,
    );
}

export function selectValidatedHierarchicalProgram(
  incumbent:
    HierarchicalCausalProgram,

  candidates:
    readonly HierarchicalProgramCandidate[],

  protectedObservations:
    readonly StructuralMechanismObservation[],

  options?: {
    minimumImprovement?: number;
    protectedComplexityPenaltyPerTerm?: number;
  },
): HierarchicalProgramDecision {
  if (
    protectedObservations.length ===
      0
  ) {
    throw new Error(
      "Hierarchical program validation requires protected observations.",
    );
  }

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.01;

  const complexityPenaltyPerTerm =
    options
      ?.protectedComplexityPenaltyPerTerm ??
    0.002;

  validateNonNegativeFinite(
    "minimumImprovement",
    minimumImprovement,
  );

  validateNonNegativeFinite(
    "protectedComplexityPenaltyPerTerm",
    complexityPenaltyPerTerm,
  );

  const incumbentError =
    programMeanSquaredError(
      incumbent,
      protectedObservations,
    );

  let bestProgram =
    incumbent;

  let bestRawError =
    incumbentError;

  let bestObjective =
    incumbentError;

  for (
    const candidate of
      candidates
  ) {
    const rawError =
      programMeanSquaredError(
        candidate.program,
        protectedObservations,
      );

    const objective =
      rawError +
      candidate.program
        .complexity *
        complexityPenaltyPerTerm;

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
        candidate.program.id.localeCompare(
          bestProgram.id,
        ) <
          0
      )
    ) {
      bestProgram =
        candidate.program;

      bestRawError =
        rawError;

      bestObjective =
        objective;
    }
  }

  const improvement =
    incumbentError -
    bestObjective;

  if (
    bestProgram.id ===
      incumbent.id ||
    improvement <
      minimumImprovement
  ) {
    return {
      champion:
        cloneProgram(
          incumbent,
        ),

      promoted:
        false,

      protectedMeanSquaredError:
        incumbentError,

      incumbentProtectedMeanSquaredError:
        incumbentError,

      improvement,

      reason:
        "incumbent-program-retained",
    };
  }

  return {
    champion:
      cloneProgram(
        bestProgram,
      ),

    previousChampionId:
      incumbent.id,

    promoted:
      true,

    protectedMeanSquaredError:
      bestRawError,

    incumbentProtectedMeanSquaredError:
      incumbentError,

    improvement,

    reason:
      "validated-hierarchical-program",
  };
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

  const exponent =
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
    );

  return Math.exp(
    exponent,
  ) /
    (
      stdDev *
      Math.sqrt(
        2 *
        Math.PI,
      )
    );
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
      "Long-horizon dual-control belief cannot be normalized.",
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

function updateBelief(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  experiment:
    WorldModelExperiment,

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
    const mechanism of
      mechanisms
  ) {
    weighted.set(
      mechanism.id,
      (
        prior.get(
          mechanism.id,
        ) ??
        0
      ) *
        gaussianLikelihood(
          observation,
          predictMechanismEffect(
            mechanism,
            experiment.interventions,
          ),
          mechanism.observationStdDev,
        ),
    );
  }

  return normalizeBelief(
    weighted,
  );
}

function beliefEntropy(
  belief:
    ReadonlyMap<
      string,
      number
    >,
): number {
  return entropy(
    Array.from(
      belief.values(),
    ),
  );
}

function weightedExpectedEffect(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  action:
    WorldModelAction,
): number {
  return mechanisms.reduce(
    (
      total,
      mechanism,
    ) =>
      total +
      (
        belief.get(
          mechanism.id,
        ) ??
        0
      ) *
      predictMechanismEffect(
        mechanism,
        action.interventions,
      ),
    0,
  );
}

function safeExperiment(
  experiment:
    WorldModelExperiment,

  maximumRisk:
    number,
): boolean {
  validateUnitInterval(
    "experiment risk",
    experiment.risk,
  );

  validateNonNegativeFinite(
    "experiment cost",
    experiment.cost,
  );

  return experiment.reversible &&
    experiment.risk <=
      maximumRisk;
}

function safeAction(
  action:
    WorldModelAction,

  maximumRisk:
    number,
): boolean {
  validateUnitInterval(
    "action risk",
    action.risk,
  );

  validateNonNegativeFinite(
    "action cost",
    action.cost,
  );

  return action.reversible &&
    action.risk <=
      maximumRisk;
}

function betterNode(
  candidate:
    LongHorizonPolicyNode,

  current:
    LongHorizonPolicyNode,
): boolean {
  if (
    candidate.expectedUtility >
      current.expectedUtility +
        Number.EPSILON
  ) {
    return true;
  }

  if (
    Math.abs(
      candidate.expectedUtility -
        current.expectedUtility,
    ) >
      Number.EPSILON
  ) {
    return false;
  }

  if (
    candidate.expectedGoalSuccessProbability >
      current.expectedGoalSuccessProbability +
        Number.EPSILON
  ) {
    return true;
  }

  if (
    Math.abs(
      candidate.expectedGoalSuccessProbability -
        current.expectedGoalSuccessProbability,
    ) >
      Number.EPSILON
  ) {
    return false;
  }

  if (
    candidate.totalExpectedCost <
      current.totalExpectedCost -
        Number.EPSILON
  ) {
    return true;
  }

  if (
    Math.abs(
      candidate.totalExpectedCost -
        current.totalExpectedCost,
    ) >
      Number.EPSILON
  ) {
    return false;
  }

  return (
    candidate.selectedId ??
    ""
  ).localeCompare(
    current.selectedId ??
      "",
  ) <
    0;
}

function planNode(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  state:
    number,

  goal:
    number,

  experiments:
    readonly WorldModelExperiment[],

  actions:
    readonly WorldModelAction[],

  depth:
    number,

  maximumRisk:
    number,

  costPenalty:
    number,

  progressWeight:
    number,
): LongHorizonPolicyNode {
  const progress =
    Math.min(
      1,
      state /
        Math.max(
          goal,
          Number.EPSILON,
        ),
    );

  const goalReached =
    state >=
      goal;

  let best:
    LongHorizonPolicyNode = {
    kind:
      "stop",

    state,

    depthRemaining:
      depth,

    expectedUtility:
      goalReached
        ? 1
        : progressWeight *
          progress,

    expectedGoalSuccessProbability:
      goalReached
        ? 1
        : 0,

    totalExpectedCost:
      0,

    maximumRisk:
      0,
  };

  if (
    goalReached ||
    depth <=
      0
  ) {
    return best;
  }

  for (
    const experiment of
      experiments
  ) {
    if (
      !safeExperiment(
        experiment,
        maximumRisk,
      )
    ) {
      continue;
    }

    const branches:
      LongHorizonPolicyBranch[] =
        [];

    let expectedUtility =
      -costPenalty *
      experiment.cost;

    let expectedGoalSuccessProbability =
      0;

    let expectedFutureCost =
      0;

    let branchMaximumRisk =
      experiment.risk;

    for (
      const mechanism of
        mechanisms
    ) {
      const probability =
        belief.get(
          mechanism.id,
        ) ??
        0;

      if (
        probability <=
          0
      ) {
        continue;
      }

      const observation =
        predictMechanismEffect(
          mechanism,
          experiment.interventions,
        );

      const posterior =
        updateBelief(
          mechanisms,
          belief,
          experiment,
          observation,
        );

      const child =
        planNode(
          mechanisms,
          posterior,
          state,
          goal,
          experiments.filter(
            (candidate) =>
              candidate.id !==
              experiment.id,
          ),
          actions,
          depth -
            1,
          maximumRisk,
          costPenalty,
          progressWeight,
        );

      branches.push({
        representativeMechanismId:
          mechanism.id,

        representativeObservation:
          observation,

        probability,

        child,
      });

      expectedUtility +=
        probability *
        child.expectedUtility;

      expectedGoalSuccessProbability +=
        probability *
        child
          .expectedGoalSuccessProbability;

      expectedFutureCost +=
        probability *
        child.totalExpectedCost;

      branchMaximumRisk =
        Math.max(
          branchMaximumRisk,
          child.maximumRisk,
        );
    }

    const candidate:
      LongHorizonPolicyNode = {
      kind:
        "experiment",

      selectedId:
        experiment.id,

      state,

      depthRemaining:
        depth,

      expectedUtility,

      expectedGoalSuccessProbability,

      totalExpectedCost:
        experiment.cost +
        expectedFutureCost,

      maximumRisk:
        branchMaximumRisk,

      branches,
    };

    if (
      betterNode(
        candidate,
        best,
      )
    ) {
      best =
        candidate;
    }
  }

  for (
    const action of
      actions
  ) {
    if (
      !safeAction(
        action,
        maximumRisk,
      )
    ) {
      continue;
    }

    const effect =
      weightedExpectedEffect(
        mechanisms,
        belief,
        action,
      );

    if (
      effect <=
        Number.EPSILON
    ) {
      continue;
    }

    const child =
      planNode(
        mechanisms,
        belief,
        state +
          effect,
        goal,
        experiments,
        actions.filter(
          (candidate) =>
            candidate.id !==
            action.id,
        ),
        depth -
          1,
        maximumRisk,
        costPenalty,
        progressWeight,
      );

    const candidate:
      LongHorizonPolicyNode = {
      kind:
        "action",

      selectedId:
        action.id,

      state,

      depthRemaining:
        depth,

      expectedUtility:
        child.expectedUtility -
        costPenalty *
          action.cost,

      expectedGoalSuccessProbability:
        child
          .expectedGoalSuccessProbability,

      totalExpectedCost:
        action.cost +
        child.totalExpectedCost,

      maximumRisk:
        Math.max(
          action.risk,
          child.maximumRisk,
        ),

      child,
    };

    if (
      betterNode(
        candidate,
        best,
      )
    ) {
      best =
        candidate;
    }
  }

  return best;
}

export function planLongHorizonDualControl(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  initialState:
    number,

  goalState:
    number,

  experiments:
    readonly WorldModelExperiment[],

  actions:
    readonly WorldModelAction[],

  options?: {
    horizon?: number;
    maximumRisk?: number;
    costPenalty?: number;
    partialProgressWeight?: number;
  },
): LongHorizonDualControlPlan {
  if (
    mechanisms.length <
      2
  ) {
    throw new Error(
      "Long-horizon dual control requires at least two competing mechanisms.",
    );
  }

  validateNonNegativeFinite(
    "initialState",
    initialState,
  );

  validateNonNegativeFinite(
    "goalState",
    goalState,
  );

  const horizon =
    options?.horizon ??
    3;

  if (
    !Number.isInteger(
      horizon,
    ) ||
    horizon <
      1
  ) {
    throw new Error(
      "Long-horizon dual-control horizon must be a positive integer.",
    );
  }

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    1;

  const partialProgressWeight =
    options
      ?.partialProgressWeight ??
    0.6;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  validateUnitInterval(
    "partialProgressWeight",
    partialProgressWeight,
  );

  const normalizedPrior =
    normalizeBelief(
      prior,
    );

  for (
    const mechanism of
      mechanisms
  ) {
    if (
      !normalizedPrior.has(
        mechanism.id,
      )
    ) {
      throw new Error(
        `Long-horizon prior is missing mechanism ${mechanism.id}.`,
      );
    }
  }

  const root =
    planNode(
      mechanisms,
      normalizedPrior,
      initialState,
      goalState,
      experiments,
      actions,
      horizon,
      maximumRisk,
      costPenalty,
      partialProgressWeight,
    );

  if (
    root.kind ===
      "stop" &&
    initialState <
      goalState
  ) {
    return {
      decision:
        "abstained",

      expectedUtility:
        root.expectedUtility,

      expectedGoalSuccessProbability:
        root
          .expectedGoalSuccessProbability,

      expectedCost:
        root.totalExpectedCost,

      maximumRisk:
        root.maximumRisk,

      reason:
        "no-safe-long-horizon-policy",
    };
  }

  return {
    decision:
      "plan",

    root,

    expectedUtility:
      root.expectedUtility,

    expectedGoalSuccessProbability:
      root
        .expectedGoalSuccessProbability,

    expectedCost:
      root.totalExpectedCost,

    maximumRisk:
      root.maximumRisk,

    reason:
      "safe-long-horizon-policy",
  };
}

export function summarizePolicyPathForMechanism(
  root:
    LongHorizonPolicyNode,

  mechanismId:
    string,
): string[] {
  const path:
    string[] =
      [];

  let current:
    LongHorizonPolicyNode |
    undefined =
      root;

  while (
    current
  ) {
    if (
      current.kind ===
        "stop"
    ) {
      path.push(
        "stop",
      );

      break;
    }

    if (
      current.selectedId
    ) {
      path.push(
        current.selectedId,
      );
    }

    if (
      current.kind ===
        "action"
    ) {
      current =
        current.child;

      continue;
    }

    const branch =
      current.branches
        ?.find(
          (candidate) =>
            candidate
              .representativeMechanismId ===
            mechanismId,
        );

    current =
      branch
        ?.child;
  }

  return path;
}

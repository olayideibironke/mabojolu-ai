import {
  ProbabilisticCausalWorldModel,
  chooseProbabilisticActionPlan,
  predictMechanismEffect,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export type StructuralTermKind =
  | "linear"
  | "interaction"
  | "latent-bias";

export interface StructuralMechanismTerm {
  id: string;
  kind: StructuralTermKind;
  variables: string[];
  coefficient: number;
}

export interface StructuredCausalMechanism {
  id: string;
  baseEffects: Record<
    string,
    number
  >;
  terms: StructuralMechanismTerm[];
  observationStdDev: number;
}

export interface StructuralMechanismObservation {
  experiment: WorldModelExperiment;
  measuredEffect: number;
}

export interface StructuralChallenger {
  mechanism: StructuredCausalMechanism;
  addedTerm: StructuralMechanismTerm;
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
}

export interface StructuralChampionDecision {
  champion: StructuredCausalMechanism;
  previousChampionId?: string;
  promoted: boolean;
  protectedMeanSquaredError: number;
  incumbentProtectedMeanSquaredError: number;
  improvement: number;
  reason:
    | "validated-structural-challenger"
    | "incumbent-structure-retained";
}

export interface DualControlDecision {
  decision:
    | "experiment"
    | "act"
    | "stop"
    | "abstained";
  selectedId?: string;
  experimentScore: number;
  actionScore: number;
  expectedInformationGain: number;
  expectedGoalProgress: number;
  goalSuccessProbability: number;
  reason:
    | "information-value-dominates"
    | "goal-progress-dominates"
    | "goal-already-reached"
    | "no-safe-useful-choice";
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

function normalizeProbabilityMap(
  values:
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
      values.values(),
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
      "Dual-control belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      values.entries(),
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

function interactionFeature(
  variables:
    readonly string[],

  interventions:
    Readonly<
      Record<
        string,
        number
      >
    >,
): number {
  return variables.reduce(
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
}

export function predictStructuredMechanismEffect(
  mechanism:
    StructuredCausalMechanism,

  interventions:
    Readonly<
      Record<
        string,
        number
      >
    >,
): number {
  let effect =
    Object.entries(
      interventions,
    ).reduce(
      (
        total,
        [
          variable,
          magnitude,
        ],
      ) => {
        validateUnitInterval(
          `intervention magnitude for ${variable}`,
          magnitude,
        );

        return total +
          (
            mechanism
              .baseEffects[
                variable
              ] ??
            0
          ) *
          magnitude;
      },
      0,
    );

  for (
    const term of
      mechanism.terms
  ) {
    validateUnitInterval(
      `structural coefficient ${term.id}`,
      term.coefficient,
    );

    switch (
      term.kind
    ) {
      case "linear": {
        if (
          term.variables.length !==
            1
        ) {
          throw new Error(
            "Linear structural terms require exactly one variable.",
          );
        }

        effect +=
          term.coefficient *
          (
            interventions[
              term.variables[
                0
              ]!
            ] ??
            0
          );

        break;
      }

      case "interaction": {
        if (
          term.variables.length !==
            2
        ) {
          throw new Error(
            "Interaction structural terms require exactly two variables.",
          );
        }

        effect +=
          term.coefficient *
          interactionFeature(
            term.variables,
            interventions,
          );

        break;
      }

      case "latent-bias": {
        if (
          term.variables.length !==
            0
        ) {
          throw new Error(
            "Latent-bias structural terms cannot name observed variables.",
          );
        }

        effect +=
          term.coefficient;

        break;
      }
    }
  }

  return effect;
}

function mechanismMeanSquaredError(
  mechanism:
    StructuredCausalMechanism,

  observations:
    readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Structural mechanism evaluation requires at least one observation.",
    );
  }

  return observations.reduce(
    (
      total,
      observation,
    ) => {
      const error =
        observation.measuredEffect -
        predictStructuredMechanismEffect(
          mechanism,
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

function residualFeature(
  term:
    StructuralMechanismTerm,

  observation:
    StructuralMechanismObservation,
): number {
  switch (
    term.kind
  ) {
    case "linear":
      return observation
        .experiment
        .interventions[
          term.variables[
            0
          ]!
        ] ??
        0;

    case "interaction":
      return interactionFeature(
        term.variables,
        observation
          .experiment
          .interventions,
      );

    case "latent-bias":
      return 1;
  }
}

function fitCandidateCoefficient(
  incumbent:
    StructuredCausalMechanism,

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
      residualFeature(
        term,
        observation,
      );

    const residual =
      observation.measuredEffect -
      predictStructuredMechanismEffect(
        incumbent,
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

export function synthesizeBoundedStructuralChallengers(
  incumbent:
    StructuredCausalMechanism,

  discoveryObservations:
    readonly StructuralMechanismObservation[],

  variables:
    readonly string[],

  options?: {
    maximumChallengers?: number;
    complexityPenaltyPerVariable?: number;
    includeLatentBias?: boolean;
  },
): StructuralChallenger[] {
  if (
    discoveryObservations.length ===
      0
  ) {
    throw new Error(
      "Structural synthesis requires discovery observations.",
    );
  }

  const distinctVariables =
    Array.from(
      new Set(
        variables,
      ),
    ).sort();

  if (
    distinctVariables.length ===
      0
  ) {
    throw new Error(
      "Structural synthesis requires at least one observed variable.",
    );
  }

  const maximumChallengers =
    options
      ?.maximumChallengers ??
    8;

  if (
    !Number.isInteger(
      maximumChallengers,
    ) ||
    maximumChallengers <
      1
  ) {
    throw new Error(
      "maximumChallengers must be a positive integer.",
    );
  }

  const penaltyPerVariable =
    options
      ?.complexityPenaltyPerVariable ??
    0.01;

  validateNonNegativeFinite(
    "complexityPenaltyPerVariable",
    penaltyPerVariable,
  );

  const existing =
    new Set(
      incumbent.terms.map(
        termSignature,
      ),
    );

  const candidates:
    StructuralMechanismTerm[] =
      [];

  for (
    const variable of
      distinctVariables
  ) {
    const term:
      StructuralMechanismTerm = {
      id:
        `linear(${variable})`,

      kind:
        "linear",

      variables: [
        variable,
      ],

      coefficient:
        0,
    };

    if (
      !existing.has(
        termSignature(
          term,
        ),
      )
    ) {
      candidates.push(
        term,
      );
    }
  }

  for (
    let leftIndex =
      0;
    leftIndex <
      distinctVariables.length;
    leftIndex +=
      1
  ) {
    for (
      let rightIndex =
        leftIndex +
          1;
      rightIndex <
        distinctVariables.length;
      rightIndex +=
        1
    ) {
      const left =
        distinctVariables[
          leftIndex
        ];

      const right =
        distinctVariables[
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

      const term:
        StructuralMechanismTerm = {
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
      };

      if (
        !existing.has(
          termSignature(
            term,
          ),
        )
      ) {
        candidates.push(
          term,
        );
      }
    }
  }

  if (
    options
      ?.includeLatentBias !==
      false
  ) {
    const bias:
      StructuralMechanismTerm = {
      id:
        "latent-bias",

      kind:
        "latent-bias",

      variables:
        [],

      coefficient:
        0,
    };

    if (
      !existing.has(
        termSignature(
          bias,
        ),
      )
    ) {
      candidates.push(
        bias,
      );
    }
  }

  return candidates
    .map(
      (candidate) => {
        const fitted:
          StructuralMechanismTerm = {
          ...candidate,

          variables: [
            ...candidate
              .variables,
          ],

          coefficient:
            fitCandidateCoefficient(
              incumbent,
              candidate,
              discoveryObservations,
            ),
        };

        const mechanism:
          StructuredCausalMechanism = {
          id:
            `${incumbent.id}+structure:${fitted.id}`,

          baseEffects: {
            ...incumbent.baseEffects,
          },

          terms: [
            ...incumbent.terms.map(
              (term) => ({
                ...term,

                variables: [
                  ...term.variables,
                ],
              }),
            ),
            fitted,
          ],

          observationStdDev:
            incumbent
              .observationStdDev,
        };

        const discoveryMeanSquaredError =
          mechanismMeanSquaredError(
            mechanism,
            discoveryObservations,
          );

        const complexityPenalty =
          penaltyPerVariable *
          Math.max(
            1,
            fitted.variables
              .length,
          );

        return {
          mechanism,
          addedTerm:
            fitted,
          discoveryMeanSquaredError,
          complexityPenalty,
          objective:
            discoveryMeanSquaredError +
            complexityPenalty,
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
        left.addedTerm.id.localeCompare(
          right.addedTerm.id,
        ),
    )
    .slice(
      0,
      maximumChallengers,
    );
}

export function selectValidatedStructuralChampion(
  incumbent:
    StructuredCausalMechanism,

  challengers:
    readonly StructuralChallenger[],

  protectedObservations:
    readonly StructuralMechanismObservation[],

  options?: {
    minimumImprovement?: number;
    protectedComplexityPenaltyPerVariable?: number;
  },
): StructuralChampionDecision {
  if (
    protectedObservations.length ===
      0
  ) {
    throw new Error(
      "Structural challenger validation requires protected observations.",
    );
  }

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.01;

  const complexityPenaltyPerVariable =
    options
      ?.protectedComplexityPenaltyPerVariable ??
    0.002;

  validateNonNegativeFinite(
    "minimumImprovement",
    minimumImprovement,
  );

  validateNonNegativeFinite(
    "protectedComplexityPenaltyPerVariable",
    complexityPenaltyPerVariable,
  );

  const incumbentError =
    mechanismMeanSquaredError(
      incumbent,
      protectedObservations,
    );

  let bestMechanism =
    incumbent;

  let bestRawError =
    incumbentError;

  let bestObjective =
    incumbentError;

  for (
    const challenger of
      challengers
  ) {
    const rawError =
      mechanismMeanSquaredError(
        challenger.mechanism,
        protectedObservations,
      );

    const structuralComplexity =
      challenger
        .addedTerm
        .kind ===
          "latent-bias"
        ? 1
        : challenger
            .addedTerm
            .variables
            .length;

    const objective =
      rawError +
      structuralComplexity *
        complexityPenaltyPerVariable;

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
        challenger
          .addedTerm
          .id <
          (
            bestMechanism.id
          )
      )
    ) {
      bestMechanism =
        challenger.mechanism;

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
    bestMechanism.id ===
      incumbent.id ||
    improvement <
      minimumImprovement
  ) {
    return {
      champion: {
        ...incumbent,

        baseEffects: {
          ...incumbent.baseEffects,
        },

        terms:
          incumbent.terms.map(
            (term) => ({
              ...term,

              variables: [
                ...term.variables,
              ],
            }),
          ),
      },

      promoted:
        false,

      protectedMeanSquaredError:
        incumbentError,

      incumbentProtectedMeanSquaredError:
        incumbentError,

      improvement,

      reason:
        "incumbent-structure-retained",
    };
  }

  return {
    champion: {
      ...bestMechanism,

      baseEffects: {
        ...bestMechanism
          .baseEffects,
      },

      terms:
        bestMechanism.terms.map(
          (term) => ({
            ...term,

            variables: [
              ...term.variables,
            ],
          }),
        ),
    },

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
      "validated-structural-challenger",
  };
}

function expectedEntropyAfterExperiment(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  experiment:
    WorldModelExperiment,
): number {
  let expected =
    0;

  for (
    const truth of
      mechanisms
  ) {
    const truthProbability =
      prior.get(
        truth.id,
      ) ??
      0;

    if (
      truthProbability <=
        0
    ) {
      continue;
    }

    const observation =
      predictMechanismEffect(
        truth,
        experiment.interventions,
      );

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

    const posterior =
      normalizeProbabilityMap(
        weighted,
      );

    expected +=
      truthProbability *
      entropy(
        Array.from(
          posterior.values(),
        ),
      );
  }

  return expected;
}

function actionProgressScore(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  currentState:
    number,

  goalState:
    number,

  action:
    WorldModelAction,
): {
  expectedProgress: number;
  successProbability: number;
} {
  const gap =
    Math.max(
      Number.EPSILON,
      goalState -
        currentState,
    );

  let expectedProgress =
    0;

  let successProbability =
    0;

  for (
    const mechanism of
      mechanisms
  ) {
    const probability =
      belief.get(
        mechanism.id,
      ) ??
      0;

    const effect =
      predictMechanismEffect(
        mechanism,
        action.interventions,
      );

    expectedProgress +=
      probability *
      Math.min(
        1,
        effect /
          gap,
      );

    if (
      currentState +
        effect >=
      goalState
    ) {
      successProbability +=
        probability;
    }
  }

  return {
    expectedProgress,
    successProbability,
  };
}

export function chooseDualControlDecision(
  model:
    ProbabilisticCausalWorldModel,

  currentState:
    number,

  goalState:
    number,

  experiments:
    readonly WorldModelExperiment[],

  actions:
    readonly WorldModelAction[],

  options?: {
    maximumRisk?: number;
    informationWeight?: number;
    goalWeight?: number;
    successWeight?: number;
    costPenalty?: number;
  },
): DualControlDecision {
  if (
    currentState >=
      goalState
  ) {
    return {
      decision:
        "stop",

      experimentScore:
        Number.NEGATIVE_INFINITY,

      actionScore:
        Number.NEGATIVE_INFINITY,

      expectedInformationGain:
        0,

      expectedGoalProgress:
        0,

      goalSuccessProbability:
        1,

      reason:
        "goal-already-reached",
    };
  }

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const informationWeight =
    options
      ?.informationWeight ??
    1;

  const goalWeight =
    options
      ?.goalWeight ??
    0.5;

  const successWeight =
    options
      ?.successWeight ??
    0.5;

  const costPenalty =
    options
      ?.costPenalty ??
    1;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "informationWeight",
    informationWeight,
  );

  validateNonNegativeFinite(
    "goalWeight",
    goalWeight,
  );

  validateNonNegativeFinite(
    "successWeight",
    successWeight,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  const mechanisms =
    model.getMechanisms();

  const belief =
    model.getProbabilityMap();

  const priorEntropy =
    entropy(
      Array.from(
        belief.values(),
      ),
    );

  let bestExperiment:
    {
      experiment:
        WorldModelExperiment;
      informationGain:
        number;
      score:
        number;
    } |
    undefined;

  for (
    const experiment of
      experiments
  ) {
    validateUnitInterval(
      "dual-control experiment risk",
      experiment.risk,
    );

    validateNonNegativeFinite(
      "dual-control experiment cost",
      experiment.cost,
    );

    if (
      !experiment.reversible ||
      experiment.risk >
        maximumRisk
    ) {
      continue;
    }

    const terminalEntropy =
      expectedEntropyAfterExperiment(
        mechanisms,
        belief,
        experiment,
      );

    const informationGain =
      Math.max(
        0,
        priorEntropy -
          terminalEntropy,
      );

    const score =
      informationWeight *
        informationGain -
      costPenalty *
        experiment.cost;

    if (
      informationGain >
        Number.EPSILON &&
      (
        !bestExperiment ||
        score >
          bestExperiment.score +
            Number.EPSILON ||
        (
          Math.abs(
            score -
            bestExperiment.score,
          ) <=
            Number.EPSILON &&
          experiment.cost <
            bestExperiment
              .experiment
              .cost -
            Number.EPSILON
        )
      )
    ) {
      bestExperiment = {
        experiment,
        informationGain,
        score,
      };
    }
  }

  let bestAction:
    {
      action:
        WorldModelAction;
      expectedProgress:
        number;
      successProbability:
        number;
      score:
        number;
    } |
    undefined;

  for (
    const action of
      actions
  ) {
    validateUnitInterval(
      "dual-control action risk",
      action.risk,
    );

    validateNonNegativeFinite(
      "dual-control action cost",
      action.cost,
    );

    if (
      !action.reversible ||
      action.risk >
        maximumRisk
    ) {
      continue;
    }

    const progress =
      actionProgressScore(
        mechanisms,
        belief,
        currentState,
        goalState,
        action,
      );

    const score =
      goalWeight *
        progress
          .expectedProgress +
      successWeight *
        progress
          .successProbability -
      costPenalty *
        action.cost;

    if (
      progress.expectedProgress >
        Number.EPSILON &&
      (
        !bestAction ||
        score >
          bestAction.score +
            Number.EPSILON ||
        (
          Math.abs(
            score -
            bestAction.score,
          ) <=
            Number.EPSILON &&
          action.cost <
            bestAction
              .action
              .cost -
            Number.EPSILON
        )
      )
    ) {
      bestAction = {
        action,
        expectedProgress:
          progress
            .expectedProgress,
        successProbability:
          progress
            .successProbability,
        score,
      };
    }
  }

  const experimentScore =
    bestExperiment
      ?.score ??
    Number.NEGATIVE_INFINITY;

  const actionScore =
    bestAction
      ?.score ??
    Number.NEGATIVE_INFINITY;

  if (
    !bestExperiment &&
    !bestAction
  ) {
    return {
      decision:
        "abstained",

      experimentScore,
      actionScore,

      expectedInformationGain:
        0,

      expectedGoalProgress:
        0,

      goalSuccessProbability:
        0,

      reason:
        "no-safe-useful-choice",
    };
  }

  if (
    bestExperiment &&
    (
      !bestAction ||
      experimentScore >
        actionScore +
          Number.EPSILON
    )
  ) {
    return {
      decision:
        "experiment",

      selectedId:
        bestExperiment
          .experiment
          .id,

      experimentScore,
      actionScore,

      expectedInformationGain:
        bestExperiment
          .informationGain,

      expectedGoalProgress:
        bestAction
          ?.expectedProgress ??
        0,

      goalSuccessProbability:
        bestAction
          ?.successProbability ??
        0,

      reason:
        "information-value-dominates",
    };
  }

  if (
    bestAction
  ) {
    return {
      decision:
        "act",

      selectedId:
        bestAction
          .action
          .id,

      experimentScore,
      actionScore,

      expectedInformationGain:
        bestExperiment
          ?.informationGain ??
        0,

      expectedGoalProgress:
        bestAction
          .expectedProgress,

      goalSuccessProbability:
        bestAction
          .successProbability,

      reason:
        "goal-progress-dominates",
    };
  }

  return {
    decision:
      "abstained",

    experimentScore,
    actionScore,

    expectedInformationGain:
      0,

    expectedGoalProgress:
      0,

    goalSuccessProbability:
      0,

    reason:
      "no-safe-useful-choice",
  };
}

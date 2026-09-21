import {
  chooseProbabilisticActionPlan,
  predictMechanismEffect,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelActionPlan,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface MechanismLearningObservation {
  experiment: WorldModelExperiment;
  measuredEffect: number;
}

export interface LearnedEffectEstimate {
  variable: string;
  mean: number;
  samples: number;
  sampleVariance: number;
}

export interface MechanismParameterLearningSummary {
  effects: Record<
    string,
    LearnedEffectEstimate
  >;
  residualStdDev: number;
  observations: number;
}

export interface MechanismPredictiveFit {
  mechanismId: string;
  meanSquaredError: number;
  meanLikelihood: number;
}

export interface MechanismFamilyAdequacy {
  adequate: boolean;
  bestMechanismId: string;
  bestMeanLikelihood: number;
  fits: MechanismPredictiveFit[];
}

export interface MechanismChallengerProposal {
  reason:
    | "predictive-misfit"
    | "model-family-adequate";
  challengers: ProbabilisticCausalMechanism[];
}

export interface MechanismChampionDecision {
  champion: ProbabilisticCausalMechanism;
  previousChampionId?: string;
  promoted: boolean;
  improvement: number;
  reason:
    | "validated-challenger"
    | "incumbent-retained";
}

export interface ContingentExperimentBranch {
  representativeMechanismId: string;
  representativeObservation: number;
  posteriorEntropy: number;
  nextExperimentId?: string;
  terminalEntropy: number;
}

export interface ContingentExperimentPolicy {
  decision:
    | "policy"
    | "abstained";
  firstExperimentId?: string;
  branches: ContingentExperimentBranch[];
  expectedTerminalEntropy: number;
  expectedTotalCost: number;
  maximumRisk: number;
  score: number;
  reason:
    | "safe-contingent-policy"
    | "no-safe-contingent-policy";
}

export interface RecedingHorizonDecision {
  decision:
    | "act"
    | "stop"
    | "abstained";
  actionId?: string;
  underlyingPlan?: WorldModelActionPlan;
  reason:
    | "execute-first-safe-action"
    | "goal-already-reached"
    | "no-safe-goal-plan";
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

function normalizeProbabilityMap(
  probabilities:
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
      probabilities.values(),
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
      "Adaptive mechanism belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      probabilities.entries(),
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

  measuredEffect:
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
    const likelihood =
      gaussianLikelihood(
        measuredEffect,
        predictMechanismEffect(
          mechanism,
          experiment.interventions,
        ),
        mechanism.observationStdDev,
      );

    weighted.set(
      mechanism.id,
      (
        prior.get(
          mechanism.id,
        ) ??
        0
      ) *
        likelihood,
    );
  }

  return normalizeProbabilityMap(
    weighted,
  );
}

function experimentVariables(
  experiment:
    WorldModelExperiment,
): string[] {
  return Object.entries(
    experiment.interventions,
  )
    .filter(
      (
        [
          ,
          magnitude,
        ],
      ) =>
        magnitude >
        0,
    )
    .map(
      (
        [
          variable,
        ],
      ) =>
        variable,
    );
}

function safeExperiments(
  experiments:
    readonly WorldModelExperiment[],

  maximumRisk:
    number,
): WorldModelExperiment[] {
  return experiments.filter(
    (experiment) => {
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
    },
  );
}

export class OnlineMechanismParameterLearner {
  private readonly estimates =
    new Map<
      string,
      {
        mean:
          number;
        samples:
          number;
        m2:
          number;
      }
    >();

  private readonly residuals:
    number[] =
      [];

  constructor(
    variables:
      readonly string[],
  ) {
    const distinct =
      Array.from(
        new Set(
          variables,
        ),
      );

    if (
      distinct.length ===
        0
    ) {
      throw new Error(
        "Online mechanism parameter learning requires at least one variable.",
      );
    }

    for (
      const variable of
        distinct
    ) {
      if (
        !variable.trim()
      ) {
        throw new Error(
          "Mechanism learning variable names cannot be empty.",
        );
      }

      this.estimates.set(
        variable,
        {
          mean:
            0,
          samples:
            0,
          m2:
            0,
        },
      );
    }
  }

  recordObservation(
    observation:
      MechanismLearningObservation,
  ): void {
    validateNonNegativeFinite(
      "measuredEffect",
      observation.measuredEffect,
    );

    const variables =
      experimentVariables(
        observation.experiment,
      );

    if (
      variables.length !==
        1
    ) {
      throw new Error(
        "Online parameter learning currently requires a single-variable intervention.",
      );
    }

    const variable =
      variables[
        0
      ]!;

    const estimate =
      this.estimates.get(
        variable,
      );

    if (
      !estimate
    ) {
      throw new Error(
        `Online parameter learner does not track variable ${variable}.`,
      );
    }

    const magnitude =
      observation
        .experiment
        .interventions[
          variable
        ]!;

    if (
      magnitude <=
        0
    ) {
      throw new Error(
        "Mechanism learning intervention magnitude must be positive.",
      );
    }

    const impliedEffect =
      Math.min(
        1,
        Math.max(
          0,
          observation.measuredEffect /
            magnitude,
        ),
      );

    const previousMean =
      estimate.mean;

    estimate.samples +=
      1;

    estimate.mean +=
      (
        impliedEffect -
        estimate.mean
      ) /
      estimate.samples;

    estimate.m2 +=
      (
        impliedEffect -
        previousMean
      ) *
      (
        impliedEffect -
        estimate.mean
      );

    this.residuals.push(
      observation.measuredEffect -
        estimate.mean *
          magnitude,
    );
  }

  getSummary():
    MechanismParameterLearningSummary {
    const effects:
      Record<
        string,
        LearnedEffectEstimate
      > = {};

    for (
      const [
        variable,
        estimate,
      ] of
        this.estimates.entries()
    ) {
      effects[
        variable
      ] = {
        variable,

        mean:
          estimate.mean,

        samples:
          estimate.samples,

        sampleVariance:
          estimate.samples >
            1
            ? estimate.m2 /
              (
                estimate.samples -
                1
              )
            : 0,
      };
    }

    const residualVariance =
      this.residuals.length >
        0
        ? this.residuals.reduce(
            (
              total,
              residual,
            ) =>
              total +
              residual *
                residual,
            0,
          ) /
          this.residuals.length
        : 0;

    return {
      effects,

      residualStdDev:
        Math.sqrt(
          residualVariance,
        ),

      observations:
        this.residuals.length,
    };
  }
}

export function evaluateMechanismFamilyAdequacy(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  observations:
    readonly MechanismLearningObservation[],

  minimumMeanLikelihood =
    0.5,
): MechanismFamilyAdequacy {
  if (
    mechanisms.length ===
      0
  ) {
    throw new Error(
      "Mechanism adequacy evaluation requires at least one mechanism.",
    );
  }

  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Mechanism adequacy evaluation requires at least one observation.",
    );
  }

  validateNonNegativeFinite(
    "minimumMeanLikelihood",
    minimumMeanLikelihood,
  );

  const fits =
    mechanisms.map(
      (mechanism) => {
        let squaredError =
          0;

        let likelihood =
          0;

        for (
          const observation of
            observations
        ) {
          const predicted =
            predictMechanismEffect(
              mechanism,
              observation
                .experiment
                .interventions,
            );

          const error =
            observation.measuredEffect -
            predicted;

          squaredError +=
            error *
            error;

          likelihood +=
            gaussianLikelihood(
              observation.measuredEffect,
              predicted,
              mechanism.observationStdDev,
            );
        }

        return {
          mechanismId:
            mechanism.id,

          meanSquaredError:
            squaredError /
            observations.length,

          meanLikelihood:
            likelihood /
            observations.length,
        };
      },
    )
      .sort(
        (
          left,
          right,
        ) =>
          right.meanLikelihood -
            left.meanLikelihood ||
          left.meanSquaredError -
            right.meanSquaredError ||
          left.mechanismId.localeCompare(
            right.mechanismId,
          ),
      );

  const best =
    fits[
      0
    ]!;

  return {
    adequate:
      best.meanLikelihood >=
        minimumMeanLikelihood,

    bestMechanismId:
      best.mechanismId,

    bestMeanLikelihood:
      best.meanLikelihood,

    fits,
  };
}

export function proposeBoundedMechanismChallengers(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  observation:
    MechanismLearningObservation,

  adequacy:
    MechanismFamilyAdequacy,

  maximumChallengers =
    3,
): MechanismChallengerProposal {
  if (
    adequacy.adequate
  ) {
    return {
      reason:
        "model-family-adequate",

      challengers:
        [],
    };
  }

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

  const variables =
    experimentVariables(
      observation.experiment,
    );

  if (
    variables.length !==
      1
  ) {
    throw new Error(
      "Bounded mechanism challenger proposal currently requires a single-variable intervention.",
    );
  }

  const variable =
    variables[
      0
    ]!;

  const magnitude =
    observation
      .experiment
      .interventions[
        variable
      ]!;

  const inferredEffect =
    Math.min(
      1,
      Math.max(
        0,
        observation.measuredEffect /
          magnitude,
      ),
    );

  const sorted =
    mechanisms
      .slice()
      .sort(
        (
          left,
          right,
        ) =>
          left.id.localeCompare(
            right.id,
          ),
      );

  const signatures =
    new Set<
      string
    >();

  const challengers:
    ProbabilisticCausalMechanism[] =
      [];

  for (
    const mechanism of
      sorted
  ) {
    if (
      challengers.length >=
        maximumChallengers
    ) {
      break;
    }

    const effects = {
      ...mechanism.effects,

      [
        variable
      ]:
        inferredEffect,
    };

    const signature =
      Object.entries(
        effects,
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
              key,
              value,
            ],
          ) =>
            `${key}:${value.toFixed(
              6,
            )}`,
        )
        .join(
          "|",
        );

    if (
      signatures.has(
        signature,
      )
    ) {
      continue;
    }

    signatures.add(
      signature,
    );

    challengers.push({
      id:
        `${mechanism.id}-challenge-${variable}-${challengers.length + 1}`,

      effects,

      observationStdDev:
        mechanism.observationStdDev,
    });
  }

  return {
    reason:
      "predictive-misfit",

    challengers,
  };
}

function mechanismMse(
  mechanism:
    ProbabilisticCausalMechanism,

  observations:
    readonly MechanismLearningObservation[],
): number {
  return observations.reduce(
    (
      total,
      observation,
    ) => {
      const error =
        observation.measuredEffect -
        predictMechanismEffect(
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

export function selectValidatedMechanismChampion(
  incumbent:
    ProbabilisticCausalMechanism,

  challengers:
    readonly ProbabilisticCausalMechanism[],

  protectedObservations:
    readonly MechanismLearningObservation[],

  minimumImprovement =
    0.01,
): MechanismChampionDecision {
  if (
    protectedObservations.length ===
      0
  ) {
    throw new Error(
      "Mechanism challenger validation requires protected observations.",
    );
  }

  validateNonNegativeFinite(
    "minimumImprovement",
    minimumImprovement,
  );

  const incumbentError =
    mechanismMse(
      incumbent,
      protectedObservations,
    );

  let best =
    incumbent;

  let bestError =
    incumbentError;

  for (
    const challenger of
      challengers
  ) {
    const error =
      mechanismMse(
        challenger,
        protectedObservations,
      );

    if (
      error <
        bestError -
          Number.EPSILON
    ) {
      best =
        challenger;

      bestError =
        error;
    }
  }

  const improvement =
    incumbentError -
    bestError;

  if (
    best.id ===
      incumbent.id ||
    improvement <
      minimumImprovement
  ) {
    return {
      champion:
        {
          ...incumbent,

          effects: {
            ...incumbent.effects,
          },
        },

      promoted:
        false,

      improvement,

      reason:
        "incumbent-retained",
    };
  }

  return {
    champion:
      {
        ...best,

        effects: {
          ...best.effects,
        },
      },

    previousChampionId:
      incumbent.id,

    promoted:
      true,

    improvement,

    reason:
      "validated-challenger",
  };
}

function expectedBranchEntropy(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  firstExperiment:
    WorldModelExperiment,

  remainingExperiments:
    readonly WorldModelExperiment[],
  costPenalty:
    number,
): {
  branches:
    ContingentExperimentBranch[];
  expectedTerminalEntropy:
    number;
  expectedAdditionalCost:
    number;
  maximumAdditionalRisk:
    number;
} {
  const branches:
    ContingentExperimentBranch[] =
      [];

  let expectedTerminalEntropy =
    0;

  let expectedAdditionalCost =
    0;

  let maximumAdditionalRisk =
    0;

  for (
    const representativeMechanism of
      mechanisms
  ) {
    const branchProbability =
      prior.get(
        representativeMechanism.id,
      ) ??
      0;

    if (
      branchProbability <=
        0
    ) {
      continue;
    }

    const representativeObservation =
      predictMechanismEffect(
        representativeMechanism,
        firstExperiment.interventions,
      );

    const posterior =
      updateBelief(
        mechanisms,
        prior,
        firstExperiment,
        representativeObservation,
      );

    const posteriorEntropy =
      entropy(
        Array.from(
          posterior.values(),
        ),
      );

    let bestNext:
      {
        experiment:
          WorldModelExperiment;
        entropy:
          number;
        score:
          number;
      } |
      undefined;

    for (
      const experiment of
        remainingExperiments
    ) {
      let expectedEntropy =
        0;

      for (
        const nextTruth of
          mechanisms
      ) {
        const probability =
          posterior.get(
            nextTruth.id,
          ) ??
          0;

        if (
          probability <=
            0
        ) {
          continue;
        }

        const nextObservation =
          predictMechanismEffect(
            nextTruth,
            experiment.interventions,
          );

        const nextPosterior =
          updateBelief(
            mechanisms,
            posterior,
            experiment,
            nextObservation,
          );

        expectedEntropy +=
          probability *
          entropy(
            Array.from(
              nextPosterior.values(),
            ),
          );
      }

      const informationGain =
        Math.max(
          0,
          posteriorEntropy -
            expectedEntropy,
        );

      const score =
        informationGain -
        costPenalty *
          experiment.cost;

      if (
        informationGain >
          Number.EPSILON &&
        (
          !bestNext ||
          score >
            bestNext.score +
              Number.EPSILON ||
          (
            Math.abs(
              score -
              bestNext.score,
            ) <=
              Number.EPSILON &&
            experiment.cost <
              bestNext
                .experiment
                .cost -
              Number.EPSILON
          ) ||
          (
            Math.abs(
              score -
              bestNext.score,
            ) <=
              Number.EPSILON &&
            Math.abs(
              experiment.cost -
              bestNext
                .experiment
                .cost,
            ) <=
              Number.EPSILON &&
            experiment.id <
              bestNext
                .experiment
                .id
          )
        )
      ) {
        bestNext = {
          experiment,
          entropy:
            expectedEntropy,
          score,
        };
      }
    }

    const terminalEntropy =
      bestNext
        ?.entropy ??
      posteriorEntropy;

    branches.push({
      representativeMechanismId:
        representativeMechanism.id,

      representativeObservation,

      posteriorEntropy,

      nextExperimentId:
        bestNext
          ?.experiment
          .id,

      terminalEntropy,
    });

    expectedTerminalEntropy +=
      branchProbability *
      terminalEntropy;

    if (
      bestNext
    ) {
      expectedAdditionalCost +=
        branchProbability *
        bestNext
          .experiment
          .cost;

      maximumAdditionalRisk =
        Math.max(
          maximumAdditionalRisk,
          bestNext
            .experiment
            .risk,
        );
    }
  }

  return {
    branches,

    expectedTerminalEntropy,

    expectedAdditionalCost,

    maximumAdditionalRisk,
  };
}

export function chooseContingentExperimentPolicy(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  experiments:
    readonly WorldModelExperiment[],

  options?: {
    maximumRisk?: number;
    costPenalty?: number;
  },
): ContingentExperimentPolicy {
  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    1;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  const safe =
    safeExperiments(
      experiments,
      maximumRisk,
    );

  if (
    safe.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      branches:
        [],

      expectedTerminalEntropy:
        entropy(
          Array.from(
            prior.values(),
          ),
        ),

      expectedTotalCost:
        0,

      maximumRisk:
        0,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-contingent-policy",
    };
  }

  const priorEntropy =
    entropy(
      Array.from(
        prior.values(),
      ),
    );

  let best:
    ContingentExperimentPolicy |
    undefined;

  for (
    const firstExperiment of
      safe
  ) {
    const remaining =
      safe.filter(
        (experiment) =>
          experiment.id !==
          firstExperiment.id,
      );

    const branchResult =
      expectedBranchEntropy(
        mechanisms,
        prior,
        firstExperiment,
        remaining,
        costPenalty,
      );

    const expectedInformationGain =
      Math.max(
        0,
        priorEntropy -
          branchResult
            .expectedTerminalEntropy,
      );

    if (
      expectedInformationGain <=
        Number.EPSILON
    ) {
      continue;
    }

    const expectedTotalCost =
      firstExperiment.cost +
      branchResult
        .expectedAdditionalCost;

    const score =
      expectedInformationGain -
      costPenalty *
        expectedTotalCost;

    const candidate:
      ContingentExperimentPolicy = {
      decision:
        "policy",

      firstExperimentId:
        firstExperiment.id,

      branches:
        branchResult.branches,

      expectedTerminalEntropy:
        branchResult
          .expectedTerminalEntropy,

      expectedTotalCost,

      maximumRisk:
        Math.max(
          firstExperiment.risk,
          branchResult
            .maximumAdditionalRisk,
        ),

      score,

      reason:
        "safe-contingent-policy",
    };

    if (
      !best ||
      candidate.score >
        best.score +
          Number.EPSILON ||
      (
        Math.abs(
          candidate.score -
          best.score,
        ) <=
          Number.EPSILON &&
        candidate.expectedTotalCost <
          best.expectedTotalCost -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
          best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.expectedTotalCost -
          best.expectedTotalCost,
        ) <=
          Number.EPSILON &&
        (
          candidate
            .firstExperimentId ??
          ""
        ) <
          (
            best
              .firstExperimentId ??
            ""
          )
      )
    ) {
      best =
        candidate;
    }
  }

  return best ??
    {
      decision:
        "abstained",

      branches:
        [],

      expectedTerminalEntropy:
        priorEntropy,

      expectedTotalCost:
        0,

      maximumRisk:
        0,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-contingent-policy",
    };
}

export function chooseRecedingHorizonDecision(
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

  actions:
    readonly WorldModelAction[],

  options?: {
    horizon?: number;
    maximumActionRisk?: number;
    minimumGoalSuccessProbability?: number;
  },
): RecedingHorizonDecision {
  if (
    currentState >=
      goalState
  ) {
    return {
      decision:
        "stop",

      reason:
        "goal-already-reached",
    };
  }

  const plan =
    chooseProbabilisticActionPlan(
      mechanisms,
      belief,
      currentState,
      goalState,
      actions,
      options,
    );

  if (
    plan.decision !==
      "plan" ||
    plan.actionIds.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      underlyingPlan:
        plan,

      reason:
        "no-safe-goal-plan",
    };
  }

  return {
    decision:
      "act",

    actionId:
      plan.actionIds[
        0
      ],

    underlyingPlan:
      plan,

    reason:
      "execute-first-safe-action",
  };
}

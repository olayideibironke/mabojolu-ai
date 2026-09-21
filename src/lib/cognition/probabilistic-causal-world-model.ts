export interface ProbabilisticCausalMechanism {
  id: string;
  effects: Record<
    string,
    number
  >;
  observationStdDev: number;
}

export interface WorldModelExperiment {
  id: string;
  interventions: Record<
    string,
    number
  >;
  risk: number;
  cost: number;
  reversible: boolean;
}

export interface NoisyWorldModelObservation {
  experimentId: string;
  measuredEffect: number;
}

export interface ProbabilisticMechanismBelief {
  probabilities: Record<
    string,
    number
  >;
  topMechanismId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
}

export interface ExperimentSequencePlan {
  decision:
    | "plan"
    | "abstained";
  experimentIds: string[];
  expectedInformationGain: number;
  expectedTerminalEntropy: number;
  totalCost: number;
  maximumRisk: number;
  score: number;
  reason:
    | "safe-information-plan"
    | "no-safe-informative-plan";
}

export interface WorldModelAction {
  id: string;
  interventions: Record<
    string,
    number
  >;
  risk: number;
  cost: number;
  reversible: boolean;
}

export interface WorldModelActionPlan {
  decision:
    | "plan"
    | "abstained";
  actionIds: string[];
  goalSuccessProbability: number;
  expectedFinalState: number;
  totalCost: number;
  maximumRisk: number;
  reason:
    | "safe-probabilistic-goal-plan"
    | "no-safe-goal-plan";
}

export interface ProbabilisticWorldModelAudit {
  observationsRecorded: string[];
  blockedExperimentIds: string[];
  belief: ProbabilisticMechanismBelief;
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

function normalizedEntropy(
  probabilities:
    readonly number[],
): number {
  if (
    probabilities.length <=
      1
  ) {
    return 0;
  }

  return entropy(
    probabilities,
  ) /
    Math.log(
      probabilities.length,
    );
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
      "Probabilistic causal world-model belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      probabilities.entries(),
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

function permutationsWithoutReplacement<T>(
  values:
    readonly T[],

  length:
    number,
): T[][] {
  const output:
    T[][] =
      [];

  function visit(
    remaining:
      T[],

    chosen:
      T[],
  ): void {
    if (
      chosen.length ===
        length
    ) {
      output.push([
        ...chosen,
      ]);

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
      const value =
        remaining[
          index
        ];

      if (
        value ===
          undefined
      ) {
        continue;
      }

      const nextRemaining = [
        ...remaining.slice(
          0,
          index,
        ),
        ...remaining.slice(
          index +
            1,
        ),
      ];

      chosen.push(
        value,
      );

      visit(
        nextRemaining,
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    [
      ...values,
    ],
    [],
  );

  return output;
}

export function predictMechanismEffect(
  mechanism:
    ProbabilisticCausalMechanism,

  interventions:
    Readonly<
      Record<
        string,
        number
      >
    >,
): number {
  let effect =
    0;

  for (
    const [
      variable,
      magnitude,
    ] of
      Object.entries(
        interventions,
      )
  ) {
    validateUnitInterval(
      `intervention magnitude for ${variable}`,
      magnitude,
    );

    effect +=
      (
        mechanism.effects[
          variable
        ] ??
        0
      ) *
      magnitude;
  }

  return effect;
}

function validateMechanisms(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],
): void {
  if (
    mechanisms.length <
      2
  ) {
    throw new Error(
      "Probabilistic causal world-model transfer requires at least two mechanisms.",
    );
  }

  const seen =
    new Set<
      string
    >();

  for (
    const mechanism of
      mechanisms
  ) {
    if (
      !mechanism.id.trim() ||
      seen.has(
        mechanism.id,
      )
    ) {
      throw new Error(
        "Probabilistic causal mechanism ids must be non-empty and unique.",
      );
    }

    if (
      !Number.isFinite(
        mechanism.observationStdDev,
      ) ||
      mechanism.observationStdDev <=
        0
    ) {
      throw new Error(
        `Mechanism ${mechanism.id} must have a positive finite observationStdDev.`,
      );
    }

    for (
      const [
        variable,
        effect,
      ] of
        Object.entries(
          mechanism.effects,
        )
    ) {
      validateUnitInterval(
        `mechanism effect ${variable}`,
        effect,
      );
    }

    seen.add(
      mechanism.id,
    );
  }
}

function updateBeliefForObservation(
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
  validateNonNegativeFinite(
    "measuredEffect",
    measuredEffect,
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
    const priorProbability =
      prior.get(
        mechanism.id,
      ) ??
      0;

    const predicted =
      predictMechanismEffect(
        mechanism,
        experiment.interventions,
      );

    const likelihood =
      gaussianLikelihood(
        measuredEffect,
        predicted,
        mechanism.observationStdDev,
      );

    weighted.set(
      mechanism.id,
      priorProbability *
        likelihood,
    );
  }

  return normalizeProbabilityMap(
    weighted,
  );
}

function expectedEntropyAfterSequence(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  prior:
    ReadonlyMap<
      string,
      number
    >,

  sequence:
    readonly WorldModelExperiment[],
): number {
  let expected =
    0;

  for (
    const trueMechanism of
      mechanisms
  ) {
    const truthProbability =
      prior.get(
        trueMechanism.id,
      ) ??
      0;

    if (
      truthProbability <=
        0
    ) {
      continue;
    }

    let posterior =
      new Map(
        prior,
      );

    for (
      const experiment of
        sequence
    ) {
      const representativeObservation =
        predictMechanismEffect(
          trueMechanism,
          experiment.interventions,
        );

      posterior =
        updateBeliefForObservation(
          mechanisms,
          posterior,
          experiment,
          representativeObservation,
        );
    }

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

function sequenceCost(
  sequence:
    readonly {
      cost: number;
    }[],
): number {
  return sequence.reduce(
    (
      total,
      item,
    ) =>
      total +
      item.cost,
    0,
  );
}

function maximumRisk(
  sequence:
    readonly {
      risk: number;
    }[],
): number {
  return sequence.reduce(
    (
      current,
      item,
    ) =>
      Math.max(
        current,
        item.risk,
      ),
    0,
  );
}

export class ProbabilisticCausalWorldModel {
  private probabilities:
    Map<
      string,
      number
    >;

  private readonly observationsRecorded =
    new Set<
      string
    >();

  private readonly blockedExperimentIds =
    new Set<
      string
    >();

  constructor(
    private readonly mechanisms:
      readonly ProbabilisticCausalMechanism[],

    prior?: Readonly<
      Record<
        string,
        number
      >
    >,

    private readonly maximumExperimentRisk =
      0.3,

    private readonly experimentCostPenalty =
      1,
  ) {
    validateMechanisms(
      mechanisms,
    );

    validateUnitInterval(
      "maximumExperimentRisk",
      maximumExperimentRisk,
    );

    validateNonNegativeFinite(
      "experimentCostPenalty",
      experimentCostPenalty,
    );

    if (
      prior
    ) {
      const raw =
        new Map<
          string,
          number
        >();

      for (
        const mechanism of
          mechanisms
      ) {
        const probability =
          prior[
            mechanism.id
          ];

        if (
          probability ===
            undefined
        ) {
          throw new Error(
            `Prior is missing mechanism ${mechanism.id}.`,
          );
        }

        validateNonNegativeFinite(
          `prior probability for ${mechanism.id}`,
          probability,
        );

        raw.set(
          mechanism.id,
          probability,
        );
      }

      this.probabilities =
        normalizeProbabilityMap(
          raw,
        );
    } else {
      const uniform =
        1 /
        mechanisms.length;

      this.probabilities =
        new Map(
          mechanisms.map(
            (mechanism) => [
              mechanism.id,
              uniform,
            ],
          ),
        );
    }
  }

  recordObservation(
    experiment:
      WorldModelExperiment,

    observation:
      NoisyWorldModelObservation,
  ): void {
    this.validateExperiment(
      experiment,
    );

    if (
      observation.experimentId !==
        experiment.id
    ) {
      throw new Error(
        "World-model observation does not match the selected experiment.",
      );
    }

    if (
      this.observationsRecorded.has(
        experiment.id,
      )
    ) {
      throw new Error(
        `World-model experiment ${experiment.id} has already been recorded.`,
      );
    }

    if (
      !experiment.reversible ||
      experiment.risk >
        this.maximumExperimentRisk
    ) {
      this.blockedExperimentIds.add(
        experiment.id,
      );

      throw new Error(
        "Refusing to record an unsafe or irreversible world-model experiment.",
      );
    }

    this.probabilities =
      updateBeliefForObservation(
        this.mechanisms,
        this.probabilities,
        experiment,
        observation.measuredEffect,
      );

    this.observationsRecorded.add(
      experiment.id,
    );
  }

  chooseMyopicExperiment(
    experiments:
      readonly WorldModelExperiment[],
  ): ExperimentSequencePlan {
    return this.chooseExperimentSequence(
      experiments,
      1,
    );
  }

  chooseExperimentSequence(
    experiments:
      readonly WorldModelExperiment[],

    horizon =
      2,
  ): ExperimentSequencePlan {
    if (
      !Number.isInteger(
        horizon,
      ) ||
      horizon <
        1
    ) {
      throw new Error(
        "Experiment planning horizon must be a positive integer.",
      );
    }

    const available =
      experiments.filter(
        (experiment) => {
          this.validateExperiment(
            experiment,
          );

          if (
            this.observationsRecorded.has(
              experiment.id,
            )
          ) {
            return false;
          }

          if (
            !experiment.reversible ||
            experiment.risk >
              this.maximumExperimentRisk
          ) {
            this.blockedExperimentIds.add(
              experiment.id,
            );

            return false;
          }

          return true;
        },
      );

    const boundedHorizon =
      Math.min(
        horizon,
        available.length,
      );

    if (
      boundedHorizon ===
        0
    ) {
      return {
        decision:
          "abstained",

        experimentIds:
          [],

        expectedInformationGain:
          0,

        expectedTerminalEntropy:
          entropy(
            Array.from(
              this.probabilities.values(),
            ),
          ),

        totalCost:
          0,

        maximumRisk:
          0,

        score:
          Number.NEGATIVE_INFINITY,

        reason:
          "no-safe-informative-plan",
      };
    }

    const priorEntropy =
      entropy(
        Array.from(
          this.probabilities.values(),
        ),
      );

    let best:
      ExperimentSequencePlan |
      undefined;

    for (
      let sequenceLength =
        1;
      sequenceLength <=
        boundedHorizon;
      sequenceLength +=
        1
    ) {
      for (
        const sequence of
          permutationsWithoutReplacement(
            available,
            sequenceLength,
          )
      ) {
        const terminalEntropy =
          expectedEntropyAfterSequence(
            this.mechanisms,
            this.probabilities,
            sequence,
          );

        const informationGain =
          Math.max(
            0,
            priorEntropy -
              terminalEntropy,
          );

        const totalCost =
          sequenceCost(
            sequence,
          );

        const score =
          informationGain -
          this.experimentCostPenalty *
            totalCost;

        if (
          informationGain <=
            Number.EPSILON
        ) {
          continue;
        }

        const candidate:
          ExperimentSequencePlan = {
          decision:
            "plan",

          experimentIds:
            sequence.map(
              (experiment) =>
                experiment.id,
            ),

          expectedInformationGain:
            informationGain,

          expectedTerminalEntropy:
            terminalEntropy,

          totalCost,

          maximumRisk:
            maximumRisk(
              sequence,
            ),

          score,

          reason:
            "safe-information-plan",
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
            candidate.totalCost <
              best.totalCost -
                Number.EPSILON
          ) ||
          (
            Math.abs(
              candidate.score -
              best.score,
            ) <=
              Number.EPSILON &&
            Math.abs(
              candidate.totalCost -
              best.totalCost,
            ) <=
              Number.EPSILON &&
            candidate.experimentIds.join(
              "|",
            ) <
              best.experimentIds.join(
                "|",
              )
          )
        ) {
          best =
            candidate;
        }
      }
    }

    if (
      !best
    ) {
      return {
        decision:
          "abstained",

        experimentIds:
          [],

        expectedInformationGain:
          0,

        expectedTerminalEntropy:
          priorEntropy,

        totalCost:
          0,

        maximumRisk:
          0,

        score:
          Number.NEGATIVE_INFINITY,

        reason:
          "no-safe-informative-plan",
      };
    }

    return best;
  }

  getBelief():
    ProbabilisticMechanismBelief {
    const ranked =
      Array.from(
        this.probabilities.entries(),
      )
        .map(
          (
            [
              mechanismId,
              probability,
            ],
          ) => ({
            mechanismId,
            probability,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.probability -
              left.probability ||
            left.mechanismId.localeCompare(
              right.mechanismId,
            ),
        );

    const top =
      ranked[
        0
      ];

    const runnerUp =
      ranked[
        1
      ];

    if (
      !top
    ) {
      throw new Error(
        "Probabilistic causal world-model has no belief state.",
      );
    }

    const probabilities:
      Record<
        string,
        number
      > = {};

    for (
      const item of
        ranked
    ) {
      probabilities[
        item.mechanismId
      ] =
        item.probability;
    }

    return {
      probabilities,

      topMechanismId:
        top.mechanismId,

      confidence:
        top.probability,

      margin:
        top.probability -
        (
          runnerUp
            ?.probability ??
          0
        ),

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            (item) =>
              item.probability,
          ),
        ),
    };
  }

  getAuditSummary():
    ProbabilisticWorldModelAudit {
    return {
      observationsRecorded:
        Array.from(
          this.observationsRecorded,
        ),

      blockedExperimentIds:
        Array.from(
          this.blockedExperimentIds,
        ),

      belief:
        this.getBelief(),
    };
  }

  getMechanisms():
    readonly ProbabilisticCausalMechanism[] {
    return this.mechanisms.map(
      (mechanism) => ({
        id:
          mechanism.id,

        effects: {
          ...mechanism.effects,
        },

        observationStdDev:
          mechanism.observationStdDev,
      }),
    );
  }

  getProbabilityMap():
    ReadonlyMap<
      string,
      number
    > {
    return new Map(
      this.probabilities,
    );
  }

  private validateExperiment(
    experiment:
      WorldModelExperiment,
  ): void {
    if (
      !experiment.id.trim()
    ) {
      throw new Error(
        "World-model experiment id cannot be empty.",
      );
    }

    validateUnitInterval(
      "world-model experiment risk",
      experiment.risk,
    );

    validateNonNegativeFinite(
      "world-model experiment cost",
      experiment.cost,
    );

    if (
      Object.keys(
        experiment.interventions,
      ).length ===
        0
    ) {
      throw new Error(
        "World-model experiment requires at least one intervention.",
      );
    }

    for (
      const [
        variable,
        magnitude,
      ] of
        Object.entries(
          experiment.interventions,
        )
    ) {
      validateUnitInterval(
        `world-model experiment magnitude for ${variable}`,
        magnitude,
      );
    }
  }
}

function actionSequences(
  actions:
    readonly WorldModelAction[],

  horizon:
    number,
): WorldModelAction[][] {
  const output:
    WorldModelAction[][] =
      [];

  for (
    let length =
      1;
    length <=
      horizon;
    length +=
      1
  ) {
    output.push(
      ...permutationsWithoutReplacement(
        actions,
        length,
      ),
    );
  }

  return output;
}

function projectedStateForMechanism(
  mechanism:
    ProbabilisticCausalMechanism,

  initialState:
    number,

  sequence:
    readonly WorldModelAction[],
): number {
  let state =
    initialState;

  for (
    const action of
      sequence
  ) {
    state +=
      predictMechanismEffect(
        mechanism,
        action.interventions,
      );
  }

  return state;
}

export function chooseProbabilisticActionPlan(
  mechanisms:
    readonly ProbabilisticCausalMechanism[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  initialState:
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
): WorldModelActionPlan {
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
    2;

  const maximumActionRisk =
    options
      ?.maximumActionRisk ??
    0.3;

  const minimumGoalSuccessProbability =
    options
      ?.minimumGoalSuccessProbability ??
    0.9;

  if (
    !Number.isInteger(
      horizon,
    ) ||
    horizon <
      1
  ) {
    throw new Error(
      "World-model action planning horizon must be a positive integer.",
    );
  }

  validateUnitInterval(
    "maximumActionRisk",
    maximumActionRisk,
  );

  validateUnitInterval(
    "minimumGoalSuccessProbability",
    minimumGoalSuccessProbability,
  );

  const safeActions =
    actions.filter(
      (action) => {
        validateUnitInterval(
          "world-model action risk",
          action.risk,
        );

        validateNonNegativeFinite(
          "world-model action cost",
          action.cost,
        );

        for (
          const [
            variable,
            magnitude,
          ] of
            Object.entries(
              action.interventions,
            )
        ) {
          validateUnitInterval(
            `world-model action magnitude for ${variable}`,
            magnitude,
          );
        }

        return action.reversible &&
          action.risk <=
            maximumActionRisk;
      },
    );

  let best:
    WorldModelActionPlan |
    undefined;

  for (
    const sequence of
      actionSequences(
        safeActions,
        Math.min(
          horizon,
          safeActions.length,
        ),
      )
  ) {
    let successProbability =
      0;

    let expectedFinalState =
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

      const finalState =
        projectedStateForMechanism(
          mechanism,
          initialState,
          sequence,
        );

      expectedFinalState +=
        probability *
        finalState;

      if (
        finalState >=
          goalState
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
      sequenceCost(
        sequence,
      );

    const candidate:
      WorldModelActionPlan = {
      decision:
        "plan",

      actionIds:
        sequence.map(
          (action) =>
            action.id,
        ),

      goalSuccessProbability:
        successProbability,

      expectedFinalState,

      totalCost,

      maximumRisk:
        maximumRisk(
          sequence,
        ),

      reason:
        "safe-probabilistic-goal-plan",
    };

    if (
      !best ||
      candidate.totalCost <
        best.totalCost -
          Number.EPSILON ||
      (
        Math.abs(
          candidate.totalCost -
          best.totalCost,
        ) <=
          Number.EPSILON &&
        candidate.goalSuccessProbability >
          best.goalSuccessProbability +
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.totalCost -
          best.totalCost,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.goalSuccessProbability -
          best.goalSuccessProbability,
        ) <=
          Number.EPSILON &&
        candidate.actionIds.join(
          "|",
        ) <
          best.actionIds.join(
            "|",
          )
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

      actionIds:
        [],

      goalSuccessProbability:
        0,

      expectedFinalState:
        initialState,

      totalCost:
        0,

      maximumRisk:
        0,

      reason:
        "no-safe-goal-plan",
    };
  }

  return best;
}

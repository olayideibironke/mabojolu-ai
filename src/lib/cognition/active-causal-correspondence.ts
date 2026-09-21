import {
  evaluateRepresentationPrimitive,
  type RepresentationDomainBinding,
  type RepresentationPrimitive,
} from "./representation-synthesis";

export interface CausalCorrespondenceHypothesis {
  id: string;
  variableSet: string[];
}

export interface CausalCorrespondenceExperiment {
  id: string;
  variables: string[];
  interventionMagnitude: number;
  risk: number;
  cost: number;
  reversible: boolean;
}

export interface CausalCorrespondenceExperimentChoice {
  decision:
    | "experiment"
    | "abstained";
  experiment?: CausalCorrespondenceExperiment;
  expectedInformationGain: number;
  reason:
    | "informative-safe-experiment"
    | "no-safe-informative-experiment";
}

export interface CausalCorrespondenceObservation {
  experimentId: string;
  measuredEffect: number;
}

export interface CausalCorrespondenceBelief {
  probabilities: Record<
    string,
    number
  >;
  topHypothesisId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyCertain: boolean;
}

export interface CausalCorrespondenceResolution {
  decision:
    | "resolved"
    | "unresolved";
  hypothesisId?: string;
  variableSet?: string[];
  belief: CausalCorrespondenceBelief;
}

export interface CausalCorrespondenceAudit {
  experimentsRun: string[];
  blockedExperimentIds: string[];
  belief: CausalCorrespondenceBelief;
}

export interface TransferredPlanningAction {
  id: string;
  variable: string;
  delta: number;
  cost: number;
  risk: number;
  reversible: boolean;
}

export interface TransferredPlanningDecision {
  decision:
    | "act"
    | "abstained";
  action?: TransferredPlanningAction;
  projectedRepresentationValue?: number;
  reason:
    | "safe-goal-reaching-action"
    | "no-safe-goal-reaching-action";
}

function combinations(
  values:
    readonly string[],

  size:
    number,
): string[][] {
  const output:
    string[][] =
      [];

  function visit(
    start:
      number,

    chosen:
      string[],
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

function normalizeVariableSet(
  variables:
    readonly string[],
): string[] {
  return [
    ...new Set(
      variables,
    ),
  ].sort();
}

function entropy(
  probabilities:
    readonly number[],
): number {
  let value =
    0;

  for (
    const probability of
      probabilities
  ) {
    if (
      probability >
      0
    ) {
      value -=
        probability *
        Math.log(
          probability,
        );
    }
  }

  return value;
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

function predictionKey(
  value:
    number,
): string {
  return value.toFixed(
    12,
  );
}

export function generateCausalCorrespondenceHypotheses(
  variables:
    readonly string[],

  roleCount:
    number,
): CausalCorrespondenceHypothesis[] {
  const distinctVariables =
    normalizeVariableSet(
      variables,
    );

  if (
    !Number.isInteger(
      roleCount,
    ) ||
    roleCount <
      1 ||
    roleCount >
      distinctVariables.length
  ) {
    throw new Error(
      "Causal correspondence roleCount must be a positive integer no larger than the variable count.",
    );
  }

  return combinations(
    distinctVariables,
    roleCount,
  ).map(
    (
      variableSet,
      index,
    ) => ({
      id:
        `hypothesis-${String(
          index +
            1,
        ).padStart(
          3,
          "0",
        )}`,

      variableSet:
        normalizeVariableSet(
          variableSet,
        ),
    }),
  );
}

export function predictCausalExperimentEffect(
  hypothesis:
    CausalCorrespondenceHypothesis,

  experiment:
    CausalCorrespondenceExperiment,

  roleCount:
    number,
): number {
  if (
    roleCount <=
      0
  ) {
    throw new Error(
      "Causal experiment prediction requires a positive role count.",
    );
  }

  validateUnitInterval(
    "experiment risk",
    experiment.risk,
  );

  validateUnitInterval(
    "experiment cost",
    experiment.cost,
  );

  if (
    !Number.isFinite(
      experiment.interventionMagnitude,
    ) ||
    experiment.interventionMagnitude <=
      0 ||
    experiment.interventionMagnitude >
      1
  ) {
    throw new Error(
      "Causal experiment interventionMagnitude must be finite and in (0, 1].",
    );
  }

  const hypothesisVariables =
    new Set(
      hypothesis.variableSet,
    );

  let included =
    0;

  for (
    const variable of
      normalizeVariableSet(
        experiment.variables,
      )
  ) {
    if (
      hypothesisVariables.has(
        variable,
      )
    ) {
      included +=
        1;
    }
  }

  return (
    included /
    roleCount
  ) *
    experiment.interventionMagnitude;
}

export class ActiveCausalCorrespondenceLearner {
  private readonly hypothesisById =
    new Map<
      string,
      CausalCorrespondenceHypothesis
    >();

  private probabilities =
    new Map<
      string,
      number
    >();

  private readonly experimentsRun =
    new Set<
      string
    >();

  private readonly blockedExperimentIds =
    new Set<
      string
    >();

  constructor(
    hypotheses:
      readonly CausalCorrespondenceHypothesis[],

    private readonly roleCount:
      number,

    private readonly maximumExperimentRisk =
      0.3,

    private readonly minimumInformationGain =
      0.05,

    private readonly experimentCostPenalty =
      0.05,

    private readonly observationTolerance =
      1e-9,

    private readonly confidenceThreshold =
      0.9,

    private readonly marginThreshold =
      0.5,
  ) {
    if (
      hypotheses.length <
        2
    ) {
      throw new Error(
        "Active causal correspondence learning requires at least two hypotheses.",
      );
    }

    if (
      !Number.isInteger(
        roleCount,
      ) ||
      roleCount <
        1
    ) {
      throw new Error(
        "Active causal correspondence learning requires a positive integer role count.",
      );
    }

    validateUnitInterval(
      "maximumExperimentRisk",
      maximumExperimentRisk,
    );

    validateUnitInterval(
      "minimumInformationGain",
      minimumInformationGain,
    );

    validateUnitInterval(
      "experimentCostPenalty",
      experimentCostPenalty,
    );

    validateUnitInterval(
      "confidenceThreshold",
      confidenceThreshold,
    );

    validateUnitInterval(
      "marginThreshold",
      marginThreshold,
    );

    if (
      !Number.isFinite(
        observationTolerance,
      ) ||
      observationTolerance <
        0
    ) {
      throw new Error(
        "observationTolerance must be a non-negative finite number.",
      );
    }

    const seen =
      new Set<
        string
      >();

    for (
      const hypothesis of
        hypotheses
    ) {
      if (
        !hypothesis.id.trim() ||
        seen.has(
          hypothesis.id,
        )
      ) {
        throw new Error(
          "Causal correspondence hypothesis ids must be non-empty and unique.",
        );
      }

      if (
        hypothesis.variableSet.length !==
          roleCount
      ) {
        throw new Error(
          `Hypothesis ${hypothesis.id} does not contain exactly ${roleCount} variables.`,
        );
      }

      seen.add(
        hypothesis.id,
      );

      this.hypothesisById.set(
        hypothesis.id,
        {
          id:
            hypothesis.id,

          variableSet:
            normalizeVariableSet(
              hypothesis.variableSet,
            ),
        },
      );
    }

    const uniform =
      1 /
      hypotheses.length;

    for (
      const hypothesis of
        hypotheses
    ) {
      this.probabilities.set(
        hypothesis.id,
        uniform,
      );
    }
  }

  chooseExperiment(
    experiments:
      readonly CausalCorrespondenceExperiment[],
  ): CausalCorrespondenceExperimentChoice {
    const priorEntropy =
      entropy(
        Array.from(
          this.probabilities.values(),
        ),
      );

    let best:
      {
        experiment:
          CausalCorrespondenceExperiment;
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
      if (
        this.experimentsRun.has(
          experiment.id,
        )
      ) {
        continue;
      }

      validateUnitInterval(
        "experiment risk",
        experiment.risk,
      );

      validateUnitInterval(
        "experiment cost",
        experiment.cost,
      );

      if (
        !experiment.reversible ||
        experiment.risk >
          this.maximumExperimentRisk
      ) {
        this.blockedExperimentIds.add(
          experiment.id,
        );

        continue;
      }

      const groups =
        new Map<
          string,
          string[]
        >();

      for (
        const [
          hypothesisId,
          probability,
        ] of
          this.probabilities.entries()
      ) {
        if (
          probability <=
            0
        ) {
          continue;
        }

        const hypothesis =
          this.hypothesisById.get(
            hypothesisId,
          );

        if (
          !hypothesis
        ) {
          throw new Error(
            "Causal correspondence hypothesis store is inconsistent.",
          );
        }

        const key =
          predictionKey(
            predictCausalExperimentEffect(
              hypothesis,
              experiment,
              this.roleCount,
            ),
          );

        const group =
          groups.get(
            key,
          ) ??
          [];

        group.push(
          hypothesisId,
        );

        groups.set(
          key,
          group,
        );
      }

      let expectedPosteriorEntropy =
        0;

      for (
        const hypothesisIds of
          groups.values()
      ) {
        const groupProbability =
          hypothesisIds.reduce(
            (
              total,
              hypothesisId,
            ) =>
              total +
              (
                this.probabilities.get(
                  hypothesisId,
                ) ??
                0
              ),
            0,
          );

        if (
          groupProbability <=
            0
        ) {
          continue;
        }

        const posteriorProbabilities =
          hypothesisIds.map(
            (hypothesisId) =>
              (
                this.probabilities.get(
                  hypothesisId,
                ) ??
                0
              ) /
              groupProbability,
          );

        expectedPosteriorEntropy +=
          groupProbability *
          entropy(
            posteriorProbabilities,
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
          this.minimumInformationGain
      ) {
        continue;
      }

      const score =
        informationGain -
        this.experimentCostPenalty *
          experiment.cost;

      const candidate = {
        experiment,
        informationGain,
        score,
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
          candidate.experiment.risk <
            best.experiment.risk -
              Number.EPSILON
        ) ||
        (
          Math.abs(
            candidate.score -
            best.score,
          ) <=
            Number.EPSILON &&
          Math.abs(
            candidate.experiment.risk -
            best.experiment.risk,
          ) <=
            Number.EPSILON &&
          candidate.experiment.cost <
            best.experiment.cost -
              Number.EPSILON
        ) ||
        (
          Math.abs(
            candidate.score -
            best.score,
          ) <=
            Number.EPSILON &&
          Math.abs(
            candidate.experiment.risk -
            best.experiment.risk,
          ) <=
            Number.EPSILON &&
          Math.abs(
            candidate.experiment.cost -
            best.experiment.cost,
          ) <=
            Number.EPSILON &&
          candidate.experiment.id <
            best.experiment.id
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

        expectedInformationGain:
          0,

        reason:
          "no-safe-informative-experiment",
      };
    }

    return {
      decision:
        "experiment",

      experiment: {
        ...best.experiment,

        variables: [
          ...best
            .experiment
            .variables,
        ],
      },

      expectedInformationGain:
        best.informationGain,

      reason:
        "informative-safe-experiment",
    };
  }

  recordObservation(
    experiment:
      CausalCorrespondenceExperiment,

    observation:
      CausalCorrespondenceObservation,
  ): void {
    if (
      observation.experimentId !==
        experiment.id
    ) {
      throw new Error(
        "Causal correspondence observation does not match the selected experiment.",
      );
    }

    if (
      this.blockedExperimentIds.has(
        experiment.id,
      ) ||
      !experiment.reversible ||
      experiment.risk >
        this.maximumExperimentRisk
    ) {
      throw new Error(
        "Refusing to record an unsafe or blocked causal correspondence experiment.",
      );
    }

    if (
      this.experimentsRun.has(
        experiment.id,
      )
    ) {
      throw new Error(
        `Causal correspondence experiment ${experiment.id} has already been recorded.`,
      );
    }

    if (
      !Number.isFinite(
        observation.measuredEffect,
      ) ||
      observation.measuredEffect <
        0
    ) {
      throw new Error(
        "Causal correspondence measuredEffect must be a non-negative finite number.",
      );
    }

    const compatible:
      string[] =
        [];

    for (
      const [
        hypothesisId,
        probability,
      ] of
        this.probabilities.entries()
    ) {
      if (
        probability <=
          0
      ) {
        continue;
      }

      const hypothesis =
        this.hypothesisById.get(
          hypothesisId,
        );

      if (
        !hypothesis
      ) {
        throw new Error(
          "Causal correspondence hypothesis store is inconsistent.",
        );
      }

      const predicted =
        predictCausalExperimentEffect(
          hypothesis,
          experiment,
          this.roleCount,
        );

      if (
        Math.abs(
          predicted -
          observation.measuredEffect,
        ) <=
          this.observationTolerance
      ) {
        compatible.push(
          hypothesisId,
        );
      }
    }

    if (
      compatible.length ===
        0
    ) {
      throw new Error(
        "Observed causal effect is inconsistent with every active correspondence hypothesis.",
      );
    }

    const normalizer =
      compatible.reduce(
        (
          total,
          hypothesisId,
        ) =>
          total +
          (
            this.probabilities.get(
              hypothesisId,
            ) ??
            0
          ),
        0,
      );

    for (
      const hypothesisId of
        this.probabilities.keys()
    ) {
      this.probabilities.set(
        hypothesisId,
        compatible.includes(
          hypothesisId,
        )
          ? (
              this.probabilities.get(
                hypothesisId,
              ) ??
              0
            ) /
            normalizer
          : 0,
      );
    }

    this.experimentsRun.add(
      experiment.id,
    );
  }

  getBelief():
    CausalCorrespondenceBelief {
    const ranked =
      Array.from(
        this.probabilities.entries(),
      )
        .map(
          (
            [
              hypothesisId,
              probability,
            ],
          ) => ({
            hypothesisId,
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
            left.hypothesisId.localeCompare(
              right.hypothesisId,
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
        "Causal correspondence belief has no hypotheses.",
      );
    }

    const margin =
      top.probability -
      (
        runnerUp
          ?.probability ??
        0
      );

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
        item.hypothesisId
      ] =
        item.probability;
    }

    return {
      probabilities,

      topHypothesisId:
        top.hypothesisId,

      confidence:
        top.probability,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            (item) =>
              item.probability,
          ),
        ),

      sufficientlyCertain:
        top.probability >=
          this.confidenceThreshold &&
        margin >=
          this.marginThreshold,
    };
  }

  resolve():
    CausalCorrespondenceResolution {
    const belief =
      this.getBelief();

    if (
      !belief.sufficientlyCertain
    ) {
      return {
        decision:
          "unresolved",

        belief,
      };
    }

    const hypothesis =
      this.hypothesisById.get(
        belief.topHypothesisId,
      );

    if (
      !hypothesis
    ) {
      throw new Error(
        "Resolved causal correspondence hypothesis is missing.",
      );
    }

    return {
      decision:
        "resolved",

      hypothesisId:
        hypothesis.id,

      variableSet: [
        ...hypothesis
          .variableSet,
      ],

      belief,
    };
  }

  getAuditSummary():
    CausalCorrespondenceAudit {
    return {
      experimentsRun:
        Array.from(
          this.experimentsRun,
        ),

      blockedExperimentIds:
        Array.from(
          this.blockedExperimentIds,
        ),

      belief:
        this.getBelief(),
    };
  }
}

export function simulateCausalExperimentObservation(
  trueVariableSet:
    readonly string[],

  experiment:
    CausalCorrespondenceExperiment,

  roleCount:
    number,
): CausalCorrespondenceObservation {
  const hiddenHypothesis:
    CausalCorrespondenceHypothesis = {
    id:
      "hidden-ground-truth",

    variableSet:
      normalizeVariableSet(
        trueVariableSet,
      ),
  };

  return {
    experimentId:
      experiment.id,

    measuredEffect:
      predictCausalExperimentEffect(
        hiddenHypothesis,
        experiment,
        roleCount,
      ),
  };
}

function bindingFromResolvedVariables(
  domainId:
    string,

  primitive:
    RepresentationPrimitive,

  variableSet:
    readonly string[],
): RepresentationDomainBinding {
  if (
    primitive.roles.length !==
      variableSet.length
  ) {
    throw new Error(
      "Transferred planner cannot bind a primitive to a variable set of different arity.",
    );
  }

  const variables =
    normalizeVariableSet(
      variableSet,
    );

  const roleToVariable:
    Record<
      string,
      string
    > = {};

  for (
    let index =
      0;
    index <
      primitive.roles.length;
    index +=
      1
  ) {
    const role =
      primitive.roles[
        index
      ];

    const variable =
      variables[
        index
      ];

    if (
      role ===
        undefined ||
      variable ===
        undefined
    ) {
      throw new Error(
        "Transferred planner could not construct its structural binding.",
      );
    }

    roleToVariable[
      role
    ] =
      variable;
  }

  return {
    domainId,
    roleToVariable,
  };
}

export function chooseTransferredPlanningAction(
  primitive:
    RepresentationPrimitive,

  threshold:
    number,

  resolvedVariableSet:
    readonly string[],

  currentState:
    Readonly<
      Record<
        string,
        number
      >
    >,

  actions:
    readonly TransferredPlanningAction[],

  maximumActionRisk =
    0.3,
): TransferredPlanningDecision {
  validateUnitInterval(
    "maximumActionRisk",
    maximumActionRisk,
  );

  const binding =
    bindingFromResolvedVariables(
      "active-causal-planning",
      primitive,
      resolvedVariableSet,
    );

  let best:
    {
      action:
        TransferredPlanningAction;
      value:
        number;
    } |
    undefined;

  for (
    const action of
      actions
  ) {
    validateUnitInterval(
      "planning action risk",
      action.risk,
    );

    if (
      !action.reversible ||
      action.risk >
        maximumActionRisk
    ) {
      continue;
    }

    if (
      !Number.isFinite(
        action.delta,
      ) ||
      action.delta <=
        0
    ) {
      throw new Error(
        "Transferred planning action delta must be a positive finite number.",
      );
    }

    if (
      !Number.isFinite(
        action.cost,
      ) ||
      action.cost <
        0
    ) {
      throw new Error(
        "Transferred planning action cost must be a non-negative finite number.",
      );
    }

    const currentValue =
      currentState[
        action.variable
      ];

    if (
      currentValue ===
        undefined
    ) {
      continue;
    }

    const projectedState = {
      ...currentState,

      [
        action.variable
      ]:
        Math.min(
          1,
          Math.max(
            0,
            currentValue +
              action.delta,
          ),
        ),
    };

    const value =
      evaluateRepresentationPrimitive(
        primitive,
        projectedState,
        binding,
      );

    if (
      value <=
        threshold
    ) {
      continue;
    }

    if (
      !best ||
      action.cost <
        best.action.cost -
          Number.EPSILON ||
      (
        Math.abs(
          action.cost -
          best.action.cost,
        ) <=
          Number.EPSILON &&
        action.risk <
          best.action.risk -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          action.cost -
          best.action.cost,
        ) <=
          Number.EPSILON &&
        Math.abs(
          action.risk -
          best.action.risk,
        ) <=
          Number.EPSILON &&
        action.id <
          best.action.id
      )
    ) {
      best = {
        action,
        value,
      };
    }
  }

  if (
    !best
  ) {
    return {
      decision:
        "abstained",

      reason:
        "no-safe-goal-reaching-action",
    };
  }

  return {
    decision:
      "act",

    action: {
      ...best.action,
    },

    projectedRepresentationValue:
      best.value,

    reason:
      "safe-goal-reaching-action",
  };
}

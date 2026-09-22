import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import type {
  ActionPrerequisiteObservation,
  LearnedActionPrerequisite,
  StructuralRepairTopologyCandidate,
} from "./structural-repair-prerequisite-planning";

export interface PrerequisiteHypothesis
  extends LearnedActionPrerequisite {
  id: string;
  fitMeanSquaredError: number;
}

export type JointDiscoveryExperiment =
  | {
      id: string;
      kind: "repair";
      interventions: Record<
        string,
        number
      >;
      risk: number;
      cost: number;
      reversible: boolean;
      observationStdDev: number;
    }
  | {
      id: string;
      kind: "prerequisite";
      actionId: string;
      targetDimension: string;
      beforeState: Record<
        string,
        number
      >;
      risk: number;
      cost: number;
      reversible: boolean;
      observationStdDev: number;
    };

export interface JointRepairPrerequisiteBelief {
  jointProbabilities: Record<
    string,
    number
  >;
  repairProbabilities: Record<
    string,
    number
  >;
  prerequisiteProbabilities: Record<
    string,
    number
  >;
  topJointHypothesisId: string;
  topRepairCandidateId: string;
  topPrerequisiteHypothesisId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyCertain: boolean;
}

export interface ActiveJointExperimentChoice {
  decision:
    | "experiment"
    | "abstained";
  experiment?: JointDiscoveryExperiment;
  expectedInformationGain: number;
  expectedPosteriorEntropy: number;
  score: number;
  reason:
    | "safe-informative-joint-experiment"
    | "no-safe-informative-joint-experiment";
}

interface JointHypothesis {
  id: string;
  repairCandidateId: string;
  prerequisiteHypothesisId: string;
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

function mean(
  values:
    readonly number[],
): number {
  if (
    values.length ===
      0
  ) {
    throw new Error(
      "Cannot calculate a mean from zero values.",
    );
  }

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

  meanValue:
    number,

  stdDev:
    number,
): number {
  if (
    !Number.isFinite(
      stdDev,
    ) ||
    stdDev <=
      0
  ) {
    throw new Error(
      "Joint discovery observationStdDev must be positive and finite.",
    );
  }

  const variance =
    stdDev *
    stdDev;

  const exponent =
    -(
      (
        observation -
        meanValue
      ) *
      (
        observation -
        meanValue
      )
    ) /
    (
      2 *
      variance
    );

  return Math.max(
    Number.MIN_VALUE,
    Math.exp(
      exponent,
    ) /
      (
        stdDev *
        Math.sqrt(
          2 *
          Math.PI,
        )
      ),
  );
}

function normalizeMap(
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
      "Joint repair-prerequisite belief cannot be normalized.",
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

function buildRepairProgram(
  incumbent:
    HierarchicalCausalProgram,

  candidate:
    StructuralRepairTopologyCandidate,
): HierarchicalCausalProgram {
  const fragments =
    incumbent.fragments.map(
      (fragment) =>
        fragment.id ===
          candidate.damagedFragmentId
          ? {
              ...candidate.fragment,

              terms:
                candidate.fragment.terms.map(
                  (term) => ({
                    ...term,

                    variables: [
                      ...term.variables,
                    ],
                  }),
                ),
            }
          : {
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
            },
    );

  return {
    ...cloneProgram(
      incumbent,
    ),

    id:
      `${incumbent.id}+probabilistic-repair:${candidate.fragment.id}`,

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

function thresholdFitMeanSquaredError(
  observations:
    readonly ActionPrerequisiteObservation[],

  stateDimension:
    string,

  targetDimension:
    string,

  threshold:
    number,

  inactiveMeanEffect:
    number,

  activeMeanEffect:
    number,
): number {
  return observations.reduce(
    (
      total,
      observation,
    ) => {
      const stateValue =
        observation.beforeState[
          stateDimension
        ] ??
        0;

      const predicted =
        stateValue >=
          threshold
          ? activeMeanEffect
          : inactiveMeanEffect;

      const actual =
        observation.observedEffects[
          targetDimension
        ] ??
        0;

      const error =
        actual -
        predicted;

      return total +
        error *
          error;
    },
    0,
  ) /
    observations.length;
}

export function generatePrerequisiteHypotheses(
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
    maximumHypotheses?: number;
  },
): PrerequisiteHypothesis[] {
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
    0.15;

  const maximumHypotheses =
    options
      ?.maximumHypotheses ??
    6;

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
    !Number.isInteger(
      maximumHypotheses,
    ) ||
    maximumHypotheses <
      1
  ) {
    throw new Error(
      "maximumHypotheses must be a positive integer.",
    );
  }

  if (
    relevant.length <
      minimumSamplesPerSide *
        2
  ) {
    return [];
  }

  const hypotheses:
    PrerequisiteHypothesis[] =
      [];

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
              observation.beforeState[
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
              observation.beforeState[
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
              observation.beforeState[
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
              observation.observedEffects[
                targetDimension
              ] ??
              0,
          ),
        );

      const activeMeanEffect =
        mean(
          active.map(
            (observation) =>
              observation.observedEffects[
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

      hypotheses.push({
        id:
          `${actionId}:${targetDimension}:${stateDimension}>=${threshold.toFixed(
            6,
          )}`,

        actionId,

        targetDimension,

        stateDimension,

        threshold,

        inactiveMeanEffect,

        activeMeanEffect,

        effectGap,

        evidenceCount:
          relevant.length,

        fitMeanSquaredError:
          thresholdFitMeanSquaredError(
            relevant,
            stateDimension,
            targetDimension,
            threshold,
            inactiveMeanEffect,
            activeMeanEffect,
          ),
      });
    }
  }

  return hypotheses
    .sort(
      (
        left,
        right,
      ) =>
        left.fitMeanSquaredError -
          right.fitMeanSquaredError ||
        right.effectGap -
          left.effectGap ||
        left.id.localeCompare(
          right.id,
        ),
    )
    .slice(
      0,
      maximumHypotheses,
    );
}

export class JointRepairPrerequisitePosterior {
  private readonly repairPrograms =
    new Map<
      string,
      HierarchicalCausalProgram
    >();

  private readonly prerequisiteById =
    new Map<
      string,
      PrerequisiteHypothesis
    >();

  private readonly jointHypotheses:
    JointHypothesis[];

  private probabilities:
    Map<
      string,
      number
    >;

  constructor(
    incumbent:
      HierarchicalCausalProgram,

    repairCandidates:
      readonly StructuralRepairTopologyCandidate[],

    prerequisiteHypotheses:
      readonly PrerequisiteHypothesis[],

    prior?: Readonly<
      Record<
        string,
        number
      >
    >,
  ) {
    if (
      repairCandidates.length <
        2
    ) {
      throw new Error(
        "Joint repair discovery requires at least two repair candidates.",
      );
    }

    if (
      prerequisiteHypotheses.length <
        2
    ) {
      throw new Error(
        "Joint prerequisite discovery requires at least two prerequisite hypotheses.",
      );
    }

    for (
      const candidate of
        repairCandidates
    ) {
      const id =
        candidate.fragment.id;

      if (
        this.repairPrograms.has(
          id,
        )
      ) {
        throw new Error(
          `Duplicate repair candidate id ${id}.`,
        );
      }

      this.repairPrograms.set(
        id,
        buildRepairProgram(
          incumbent,
          candidate,
        ),
      );
    }

    for (
      const hypothesis of
        prerequisiteHypotheses
    ) {
      if (
        this.prerequisiteById.has(
          hypothesis.id,
        )
      ) {
        throw new Error(
          `Duplicate prerequisite hypothesis id ${hypothesis.id}.`,
        );
      }

      this.prerequisiteById.set(
        hypothesis.id,
        {
          ...hypothesis,
        },
      );
    }

    this.jointHypotheses =
      Array.from(
        this.repairPrograms.keys(),
      ).flatMap(
        (repairCandidateId) =>
          Array.from(
            this.prerequisiteById.keys(),
          ).map(
            (prerequisiteHypothesisId) => ({
              id:
                `${repairCandidateId}::${prerequisiteHypothesisId}`,

              repairCandidateId,

              prerequisiteHypothesisId,
            }),
          ),
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
        const hypothesis of
          this.jointHypotheses
      ) {
        const probability =
          prior[
            hypothesis.id
          ];

        if (
          probability ===
            undefined
        ) {
          throw new Error(
            `Joint prior is missing ${hypothesis.id}.`,
          );
        }

        validateNonNegativeFinite(
          `joint prior for ${hypothesis.id}`,
          probability,
        );

        raw.set(
          hypothesis.id,
          probability,
        );
      }

      this.probabilities =
        normalizeMap(
          raw,
        );
    } else {
      const uniform =
        1 /
        this.jointHypotheses.length;

      this.probabilities =
        new Map(
          this.jointHypotheses.map(
            (hypothesis) => [
              hypothesis.id,
              uniform,
            ],
          ),
        );
    }
  }

  private predict(
    hypothesis:
      JointHypothesis,

    experiment:
      JointDiscoveryExperiment,
  ): number {
    if (
      experiment.kind ===
        "repair"
    ) {
      const program =
        this.repairPrograms.get(
          hypothesis.repairCandidateId,
        );

      if (
        !program
      ) {
        throw new Error(
          `Missing repair program ${hypothesis.repairCandidateId}.`,
        );
      }

      return predictHierarchicalProgramEffect(
        program,
        experiment.interventions,
      );
    }

    const prerequisite =
      this.prerequisiteById.get(
        hypothesis.prerequisiteHypothesisId,
      );

    if (
      !prerequisite
    ) {
      throw new Error(
        `Missing prerequisite hypothesis ${hypothesis.prerequisiteHypothesisId}.`,
      );
    }

    if (
      prerequisite.actionId !==
        experiment.actionId ||
      prerequisite.targetDimension !==
        experiment.targetDimension
    ) {
      throw new Error(
        "Prerequisite discovery experiment does not match the hypothesis action and target dimension.",
      );
    }

    const stateValue =
      experiment.beforeState[
        prerequisite.stateDimension
      ] ??
      0;

    return stateValue >=
      prerequisite.threshold
      ? prerequisite.activeMeanEffect
      : prerequisite.inactiveMeanEffect;
  }

  private posteriorForObservation(
    prior:
      ReadonlyMap<
        string,
        number
      >,

    experiment:
      JointDiscoveryExperiment,

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
      const hypothesis of
        this.jointHypotheses
    ) {
      weighted.set(
        hypothesis.id,
        (
          prior.get(
            hypothesis.id,
          ) ??
          0
        ) *
          gaussianLikelihood(
            observation,
            this.predict(
              hypothesis,
              experiment,
            ),
            experiment.observationStdDev,
          ),
      );
    }

    return normalizeMap(
      weighted,
    );
  }

  chooseExperiment(
    experiments:
      readonly JointDiscoveryExperiment[],

    options?: {
      maximumRisk?: number;
      minimumInformationGain?: number;
      costPenalty?: number;
    },
  ): ActiveJointExperimentChoice {
    const maximumRisk =
      options
        ?.maximumRisk ??
      0.3;

    const minimumInformationGain =
      options
        ?.minimumInformationGain ??
      0.05;

    const costPenalty =
      options
        ?.costPenalty ??
      0.1;

    validateUnitInterval(
      "maximumRisk",
      maximumRisk,
    );

    validateNonNegativeFinite(
      "minimumInformationGain",
      minimumInformationGain,
    );

    validateNonNegativeFinite(
      "costPenalty",
      costPenalty,
    );

    const priorEntropy =
      entropy(
        Array.from(
          this.probabilities.values(),
        ),
      );

    let best:
      ActiveJointExperimentChoice |
      undefined;

    for (
      const experiment of
        experiments
    ) {
      validateUnitInterval(
        "joint experiment risk",
        experiment.risk,
      );

      validateNonNegativeFinite(
        "joint experiment cost",
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
          this.jointHypotheses
      ) {
        const truthProbability =
          this.probabilities.get(
            truth.id,
          ) ??
          0;

        if (
          truthProbability <=
            0
        ) {
          continue;
        }

        const representativeObservation =
          this.predict(
            truth,
            experiment,
          );

        const posterior =
          this.posteriorForObservation(
            this.probabilities,
            experiment,
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

      const expectedInformationGain =
        Math.max(
          0,
          priorEntropy -
            expectedPosteriorEntropy,
        );

      if (
        expectedInformationGain <
          minimumInformationGain
      ) {
        continue;
      }

      const score =
        expectedInformationGain -
        costPenalty *
          experiment.cost;

      const candidate:
        ActiveJointExperimentChoice = {
        decision:
          "experiment",

        experiment: {
          ...experiment,

          ...(
            experiment.kind ===
              "repair"
              ? {
                  interventions: {
                    ...experiment.interventions,
                  },
                }
              : {
                  beforeState: {
                    ...experiment.beforeState,
                  },
                }
          ),
        } as JointDiscoveryExperiment,

        expectedInformationGain,

        expectedPosteriorEntropy,

        score,

        reason:
          "safe-informative-joint-experiment",
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
          (
            experiment.risk <
              (
                best.experiment
                  ?.risk ??
                Number.POSITIVE_INFINITY
              ) -
                Number.EPSILON ||
            (
              Math.abs(
                experiment.risk -
                  (
                    best.experiment
                      ?.risk ??
                    Number.POSITIVE_INFINITY
                  ),
              ) <=
                Number.EPSILON &&
              experiment.id <
                (
                  best.experiment
                    ?.id ??
                  ""
                )
            )
          )
        )
      ) {
        best =
          candidate;
      }
    }

    return best ?? {
      decision:
        "abstained",

      expectedInformationGain:
        0,

      expectedPosteriorEntropy:
        priorEntropy,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-informative-joint-experiment",
    };
  }

  recordObservation(
    experiment:
      JointDiscoveryExperiment,

    measuredEffect:
      number,
  ): void {
    validateNonNegativeFinite(
      "joint measuredEffect",
      measuredEffect,
    );

    this.probabilities =
      this.posteriorForObservation(
        this.probabilities,
        experiment,
        measuredEffect,
      );
  }

  simulateObservation(
    repairCandidateId:
      string,

    prerequisiteHypothesisId:
      string,

    experiment:
      JointDiscoveryExperiment,
  ): number {
    const hypothesis =
      this.jointHypotheses.find(
        (candidate) =>
          candidate.repairCandidateId ===
            repairCandidateId &&
          candidate.prerequisiteHypothesisId ===
            prerequisiteHypothesisId,
      );

    if (
      !hypothesis
    ) {
      throw new Error(
        "Requested hidden joint hypothesis does not exist.",
      );
    }

    return this.predict(
      hypothesis,
      experiment,
    );
  }

  getBelief(
    options?: {
      confidenceThreshold?: number;
      marginThreshold?: number;
    },
  ): JointRepairPrerequisiteBelief {
    const confidenceThreshold =
      options
        ?.confidenceThreshold ??
      0.95;

    const marginThreshold =
      options
        ?.marginThreshold ??
      0.8;

    validateUnitInterval(
      "confidenceThreshold",
      confidenceThreshold,
    );

    validateUnitInterval(
      "marginThreshold",
      marginThreshold,
    );

    const ranked =
      Array.from(
        this.probabilities.entries(),
      )
        .map(
          (
            [
              id,
              probability,
            ],
          ) => ({
            id,
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
            left.id.localeCompare(
              right.id,
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
        "Joint posterior has no hypotheses.",
      );
    }

    const topJoint =
      this.jointHypotheses.find(
        (hypothesis) =>
          hypothesis.id ===
          top.id,
      );

    if (
      !topJoint
    ) {
      throw new Error(
        "Top joint hypothesis is missing.",
      );
    }

    const repairMarginals =
      new Map<
        string,
        number
      >();

    const prerequisiteMarginals =
      new Map<
        string,
        number
      >();

    const jointProbabilities:
      Record<
        string,
        number
      > = {};

    for (
      const hypothesis of
        this.jointHypotheses
    ) {
      const probability =
        this.probabilities.get(
          hypothesis.id,
        ) ??
        0;

      jointProbabilities[
        hypothesis.id
      ] =
        probability;

      repairMarginals.set(
        hypothesis.repairCandidateId,
        (
          repairMarginals.get(
            hypothesis.repairCandidateId,
          ) ??
          0
        ) +
          probability,
      );

      prerequisiteMarginals.set(
        hypothesis.prerequisiteHypothesisId,
        (
          prerequisiteMarginals.get(
            hypothesis.prerequisiteHypothesisId,
          ) ??
          0
        ) +
          probability,
      );
    }

    const topRepair =
      Array.from(
        repairMarginals.entries(),
      ).sort(
        (
          left,
          right,
        ) =>
          right[
            1
          ] -
            left[
              1
            ] ||
          left[
            0
          ].localeCompare(
            right[
              0
            ],
          ),
      )[
        0
      ]!;

    const topPrerequisite =
      Array.from(
        prerequisiteMarginals.entries(),
      ).sort(
        (
          left,
          right,
        ) =>
          right[
            1
          ] -
            left[
              1
            ] ||
          left[
            0
          ].localeCompare(
            right[
              0
            ],
          ),
      )[
        0
      ]!;

    const confidence =
      top.probability;

    const margin =
      top.probability -
      (
        runnerUp
          ?.probability ??
        0
      );

    const repairProbabilities:
      Record<
        string,
        number
      > = {};

    for (
      const [
        id,
        probability,
      ] of
        repairMarginals
    ) {
      repairProbabilities[
        id
      ] =
        probability;
    }

    const prerequisiteProbabilities:
      Record<
        string,
        number
      > = {};

    for (
      const [
        id,
        probability,
      ] of
        prerequisiteMarginals
    ) {
      prerequisiteProbabilities[
        id
      ] =
        probability;
    }

    return {
      jointProbabilities,

      repairProbabilities,

      prerequisiteProbabilities,

      topJointHypothesisId:
        top.id,

      topRepairCandidateId:
        topRepair[
          0
        ],

      topPrerequisiteHypothesisId:
        topPrerequisite[
          0
        ],

      confidence,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            (item) =>
              item.probability,
          ),
        ),

      sufficientlyCertain:
        confidence >=
          confidenceThreshold &&
        margin >=
          marginThreshold,
    };
  }

  getPrerequisite(
    hypothesisId:
      string,
  ): PrerequisiteHypothesis {
    const hypothesis =
      this.prerequisiteById.get(
        hypothesisId,
      );

    if (
      !hypothesis
    ) {
      throw new Error(
        `Unknown prerequisite hypothesis ${hypothesisId}.`,
      );
    }

    return {
      ...hypothesis,
    };
  }
}

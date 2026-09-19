import type {
  ContextFeatureName,
} from "./context-feature-learning";

import type {
  InducedContextSignature,
} from "./principle-context-signature";

type CountFeatureName =
  | "historyLength"
  | "distinctActionsSeen"
  | "candidateAttempts"
  | "candidateNoEffectAttempts"
  | "candidateEffectAttempts";

export type SymbolicPredicateOperator =
  | "equal"
  | "less-than"
  | "greater-than"
  | "difference-equals"
  | "absolute-difference-at-most";

export interface SymbolicPredicateProgram {
  id:
    string;

  left:
    CountFeatureName;

  right:
    CountFeatureName;

  operator:
    SymbolicPredicateOperator;

  parameter?:
    number;

  complexity:
    number;

  informationGain:
    number;

  complexityPenalty:
    number;

  regularizedScore:
    number;

  bestAtomicInformationGain:
    number;

  gainOverBestAtomic:
    number;
}

export interface SymbolicPredicateProjection {
  programId:
    string;

  left:
    CountFeatureName;

  right:
    CountFeatureName;

  operator:
    SymbolicPredicateOperator;

  parameter?:
    number;

  predicateValue:
    boolean;

  projectionKey:
    string;
}

export interface SymbolicPredicateApplicabilityEstimate {
  principleId:
    string;

  program:
    SymbolicPredicateProgram;

  projection:
    SymbolicPredicateProjection;

  successes:
    number;

  failures:
    number;

  evidenceCount:
    number;

  applicability:
    number;
}

interface Observation {
  signature:
    InducedContextSignature;

  useful:
    boolean;
}

interface Relevance {
  informationGain:
    number;

  distinctValues:
    number;
}

interface PredicateTemplate {
  operator:
    SymbolicPredicateOperator;

  parameter?:
    number;

  complexity:
    number;
}

const COUNT_FEATURES:
  readonly CountFeatureName[] = [
    "historyLength",
    "distinctActionsSeen",
    "candidateAttempts",
    "candidateNoEffectAttempts",
    "candidateEffectAttempts",
  ];

const ALL_FEATURES:
  readonly ContextFeatureName[] = [
    "candidateAttempts",
    "candidateEffectAttempts",
    "candidateMatchesLastAction",
    "candidateMatchesLastProductiveAction",
    "candidateNoEffectAttempts",
    "distinctActionsSeen",
    "historyLength",
    "lastChangeArity",
    "lastValueShapes",
    "stepsSinceCandidateAttempt",
  ];

const PREDICATE_TEMPLATES:
  readonly PredicateTemplate[] = [
    {
      operator:
        "equal",

      complexity:
        1,
    },

    {
      operator:
        "greater-than",

      complexity:
        1,
    },

    {
      operator:
        "less-than",

      complexity:
        1,
    },

    ...[
      -2,
      -1,
      0,
      1,
      2,
    ].map(
      (parameter) => ({
        operator:
          "difference-equals" as const,

        parameter,

        complexity:
          2,
      }),
    ),

    ...[
      0,
      1,
      2,
    ].map(
      (parameter) => ({
        operator:
          "absolute-difference-at-most" as const,

        parameter,

        complexity:
          2,
      }),
    ),
  ];

const EPSILON =
  1e-12;

function entropy(
  positive:
    number,

  negative:
    number,
):
  number {
  const total =
    positive +
    negative;

  if (
    total ===
      0 ||
    positive ===
      0 ||
    negative ===
      0
  ) {
    return 0;
  }

  const positiveProbability =
    positive /
    total;

  const negativeProbability =
    negative /
    total;

  return (
    -positiveProbability *
      Math.log2(
        positiveProbability,
      ) -
    negativeProbability *
      Math.log2(
        negativeProbability,
      )
  );
}

function featureValue(
  signature:
    InducedContextSignature,

  feature:
    ContextFeatureName,
):
  string {
  return JSON.stringify(
    signature.features[
      feature
    ],
  );
}

function countValue(
  signature:
    InducedContextSignature,

  feature:
    CountFeatureName,
):
  number {
  const value =
    signature.features[
      feature
    ];

  if (
    value ===
      "0"
  ) {
    return 0;
  }

  if (
    value ===
      "1"
  ) {
    return 1;
  }

  if (
    value ===
      "2"
  ) {
    return 2;
  }

  return 3;
}

function predicateValue(
  signature:
    InducedContextSignature,

  left:
    CountFeatureName,

  right:
    CountFeatureName,

  template:
    PredicateTemplate,
):
  boolean {
  const leftValue =
    countValue(
      signature,
      left,
    );

  const rightValue =
    countValue(
      signature,
      right,
    );

  if (
    template.operator ===
      "equal"
  ) {
    return (
      leftValue ===
      rightValue
    );
  }

  if (
    template.operator ===
      "less-than"
  ) {
    return (
      leftValue <
      rightValue
    );
  }

  if (
    template.operator ===
      "greater-than"
  ) {
    return (
      leftValue >
      rightValue
    );
  }

  if (
    template.operator ===
      "difference-equals"
  ) {
    return (
      leftValue -
        rightValue ===
      template.parameter
    );
  }

  return (
    Math.abs(
      leftValue -
      rightValue,
    ) <=
    (
      template.parameter ??
      0
    )
  );
}

function relevanceFor(
  observations:
    readonly Observation[],

  valueFor:
    (
      observation:
        Observation,
    ) => string,
):
  Relevance {
  const positives =
    observations.filter(
      (observation) =>
        observation.useful,
    ).length;

  const negatives =
    observations.length -
    positives;

  const baseEntropy =
    entropy(
      positives,
      negatives,
    );

  const buckets =
    new Map<
      string,
      {
        positive:
          number;

        negative:
          number;
      }
    >();

  for (
    const observation of
      observations
  ) {
    const value =
      valueFor(
        observation,
      );

    const bucket =
      buckets.get(
        value,
      ) ?? {
        positive:
          0,

        negative:
          0,
      };

    if (
      observation.useful
    ) {
      bucket.positive +=
        1;
    } else {
      bucket.negative +=
        1;
    }

    buckets.set(
      value,
      bucket,
    );
  }

  let conditionalEntropy =
    0;

  for (
    const bucket of
      buckets.values()
  ) {
    const total =
      bucket.positive +
      bucket.negative;

    conditionalEntropy +=
      (
        total /
        observations.length
      ) *
      entropy(
        bucket.positive,
        bucket.negative,
      );
  }

  return {
    informationGain:
      baseEntropy -
      conditionalEntropy,

    distinctValues:
      buckets.size,
  };
}

function cloneSignature(
  signature:
    InducedContextSignature,
):
  InducedContextSignature {
  return {
    key:
      signature.key,

    features: {
      ...signature.features,

      lastValueShapes: [
        ...signature
          .features
          .lastValueShapes,
      ],
    },
  };
}

function templateId(
  left:
    CountFeatureName,

  right:
    CountFeatureName,

  template:
    PredicateTemplate,
):
  string {
  return [
    "predicate",
    left,
    right,
    template.operator,
    template.parameter ??
      "none",
  ].join(
    "::",
  );
}

/**
 * Searches a compact symbolic predicate grammar and regularizes candidate
 * programs by complexity.
 *
 * More expressive predicates are admitted only when their regularized score
 * still improves on the best atomic structural feature for the same evidence.
 * This gives the search an explicit simplicity bias and prevents a more complex
 * rule from winning merely because it can fit the observations.
 */
export class SymbolicPredicateApplicabilityModel {
  private readonly observations =
    new Map<
      string,
      Observation[]
    >();

  constructor(
    private readonly minimumObservations =
      6,

    private readonly penaltyPerExtraOperation =
      0.05,
  ) {
    if (
      !Number.isInteger(
        minimumObservations,
      ) ||
      minimumObservations <
        4
    ) {
      throw new Error(
        "minimumObservations must be at least 4.",
      );
    }

    if (
      !Number.isFinite(
        penaltyPerExtraOperation,
      ) ||
      penaltyPerExtraOperation <
        0
    ) {
      throw new Error(
        "penaltyPerExtraOperation must be nonnegative.",
      );
    }
  }

  record(input: {
    principleId:
      string;

    signature:
      InducedContextSignature;

    useful:
      boolean;
  }):
    SymbolicPredicateApplicabilityEstimate |
    undefined {
    const observations =
      this.observations.get(
        input.principleId,
      ) ?? [];

    observations.push({
      signature:
        cloneSignature(
          input.signature,
        ),

      useful:
        input.useful,
    });

    this.observations.set(
      input.principleId,
      observations,
    );

    return this.estimate(
      input.principleId,
      input.signature,
    );
  }

  rankPrograms(
    principleId:
      string,
  ):
    SymbolicPredicateProgram[] {
    const observations =
      this.observations.get(
        principleId,
      ) ?? [];

    if (
      observations.length <
        this.minimumObservations
    ) {
      return [];
    }

    const outcomes =
      new Set(
        observations.map(
          (observation) =>
            observation.useful,
        ),
      );

    if (
      outcomes.size <
        2
    ) {
      return [];
    }

    const bestAtomicInformationGain =
      Math.max(
        0,
        ...ALL_FEATURES.map(
          (feature) =>
            relevanceFor(
              observations,
              (observation) =>
                featureValue(
                  observation
                    .signature,
                  feature,
                ),
            )
              .informationGain,
        ),
      );

    const programs:
      SymbolicPredicateProgram[] =
      [];

    for (
      let leftIndex =
        0;
      leftIndex <
        COUNT_FEATURES.length;
      leftIndex +=
        1
    ) {
      for (
        let rightIndex =
          leftIndex +
          1;
        rightIndex <
          COUNT_FEATURES.length;
        rightIndex +=
          1
      ) {
        const left =
          COUNT_FEATURES[
            leftIndex
          ];

        const right =
          COUNT_FEATURES[
            rightIndex
          ];

        for (
          const template of
            PREDICATE_TEMPLATES
        ) {
          const relevance =
            relevanceFor(
              observations,
              (observation) =>
                JSON.stringify(
                  predicateValue(
                    observation
                      .signature,
                    left,
                    right,
                    template,
                  ),
                ),
            );

          if (
            relevance
              .distinctValues <=
              1
          ) {
            continue;
          }

          const complexityPenalty =
            (
              template.complexity -
              1
            ) *
            this
              .penaltyPerExtraOperation;

          const regularizedScore =
            relevance
              .informationGain -
            complexityPenalty;

          const gainOverBestAtomic =
            regularizedScore -
            bestAtomicInformationGain;

          if (
            gainOverBestAtomic <=
              EPSILON
          ) {
            continue;
          }

          programs.push({
            id:
              templateId(
                left,
                right,
                template,
              ),

            left,

            right,

            operator:
              template.operator,

            ...(template.parameter !==
              undefined
              ? {
                  parameter:
                    template.parameter,
                }
              : {}),

            complexity:
              template.complexity,

            informationGain:
              relevance
                .informationGain,

            complexityPenalty,

            regularizedScore,

            bestAtomicInformationGain,

            gainOverBestAtomic,
          });
        }
      }
    }

    return programs.sort(
      (
        left,
        right,
      ) => {
        if (
          right.regularizedScore !==
          left.regularizedScore
        ) {
          return (
            right.regularizedScore -
            left.regularizedScore
          );
        }

        if (
          left.complexity !==
          right.complexity
        ) {
          return (
            left.complexity -
            right.complexity
          );
        }

        if (
          right.informationGain !==
          left.informationGain
        ) {
          return (
            right.informationGain -
            left.informationGain
          );
        }

        return left.id
          .localeCompare(
            right.id,
          );
      },
    );
  }

  project(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    SymbolicPredicateProjection |
    undefined {
    const program =
      this.rankPrograms(
        principleId,
      )[0];

    if (
      !program
    ) {
      return undefined;
    }

    const template:
      PredicateTemplate = {
      operator:
        program.operator,

      ...(program.parameter !==
        undefined
        ? {
            parameter:
              program.parameter,
          }
        : {}),

      complexity:
        program.complexity,
    };

    const value =
      predicateValue(
        signature,
        program.left,
        program.right,
        template,
      );

    return {
      programId:
        program.id,

      left:
        program.left,

      right:
        program.right,

      operator:
        program.operator,

      ...(program.parameter !==
        undefined
        ? {
            parameter:
              program.parameter,
          }
        : {}),

      predicateValue:
        value,

      projectionKey:
        JSON.stringify([
          program.id,
          value,
        ]),
    };
  }

  estimate(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    SymbolicPredicateApplicabilityEstimate |
    undefined {
    const program =
      this.rankPrograms(
        principleId,
      )[0];

    const projection =
      this.project(
        principleId,
        signature,
      );

    if (
      !program ||
      !projection
    ) {
      return undefined;
    }

    const observations =
      this.observations.get(
        principleId,
      ) ?? [];

    const matches =
      observations.filter(
        (observation) =>
          this.project(
            principleId,
            observation
              .signature,
          )
            ?.projectionKey ===
          projection
            .projectionKey,
      );

    const successes =
      matches.filter(
        (observation) =>
          observation.useful,
      ).length;

    const failures =
      matches.length -
      successes;

    return {
      principleId,

      program: {
        ...program,
      },

      projection: {
        ...projection,
      },

      successes,

      failures,

      evidenceCount:
        matches.length,

      applicability:
        (
          successes +
          1
        ) / (
          successes +
          failures +
          2
        ),
    };
  }

  getObservationCount(
    principleId?:
      string,
  ):
    number {
    if (
      principleId
    ) {
      return (
        this.observations
          .get(
            principleId,
          )
          ?.length ??
        0
      );
    }

    let count =
      0;

    for (
      const observations of
        this.observations
          .values()
    ) {
      count +=
        observations.length;
    }

    return count;
  }
}

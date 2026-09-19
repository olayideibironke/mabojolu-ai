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

export type ContextRelationOperator =
  | "equal"
  | "less-than"
  | "greater-than";

export interface RelationalContextFeature {
  id:
    string;

  left:
    CountFeatureName;

  right:
    CountFeatureName;

  operator:
    ContextRelationOperator;

  informationGain:
    number;

  bestAtomicInformationGain:
    number;

  gainOverBestAtomic:
    number;
}

export interface RelationalContextProjection {
  featureId:
    string;

  left:
    CountFeatureName;

  right:
    CountFeatureName;

  operator:
    ContextRelationOperator;

  relationValue:
    boolean;

  projectionKey:
    string;
}

export interface RelationalContextApplicabilityEstimate {
  principleId:
    string;

  feature:
    RelationalContextFeature;

  projection:
    RelationalContextProjection;

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

const OPERATORS:
  readonly ContextRelationOperator[] = [
    "equal",
    "greater-than",
    "less-than",
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

function relationValue(
  signature:
    InducedContextSignature,

  left:
    CountFeatureName,

  right:
    CountFeatureName,

  operator:
    ContextRelationOperator,
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
    operator ===
      "equal"
  ) {
    return (
      leftValue ===
      rightValue
    );
  }

  if (
    operator ===
      "less-than"
  ) {
    return (
      leftValue <
      rightValue
    );
  }

  return (
    leftValue >
    rightValue
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

function featureId(
  left:
    CountFeatureName,

  right:
    CountFeatureName,

  operator:
    ContextRelationOperator,
):
  string {
  return (
    "relation::" +
    left +
    "::" +
    right +
    "::" +
    operator
  );
}

/**
 * Synthesizes relational predicates over count-like structural context
 * dimensions.
 *
 * Unlike exact pair composition, the learned projection is the relation result
 * itself. This permits transfer to unseen value combinations when the relation
 * remains the same.
 */
export class RelationalContextFeatureApplicabilityModel {
  private readonly observations =
    new Map<
      string,
      Observation[]
    >();

  constructor(
    private readonly minimumObservations =
      5,
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
  }

  record(input: {
    principleId:
      string;

    signature:
      InducedContextSignature;

    useful:
      boolean;
  }):
    RelationalContextApplicabilityEstimate |
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

  rankRelations(
    principleId:
      string,
  ):
    RelationalContextFeature[] {
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

    const candidates:
      RelationalContextFeature[] =
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
          const operator of
            OPERATORS
        ) {
          const relevance =
            relevanceFor(
              observations,
              (observation) =>
                JSON.stringify(
                  relationValue(
                    observation
                      .signature,
                    left,
                    right,
                    operator,
                  ),
                ),
            );

          const gainOverBestAtomic =
            relevance
              .informationGain -
            bestAtomicInformationGain;

          if (
            relevance
              .distinctValues <=
              1 ||
            gainOverBestAtomic <=
              EPSILON
          ) {
            continue;
          }

          candidates.push({
            id:
              featureId(
                left,
                right,
                operator,
              ),

            left,

            right,

            operator,

            informationGain:
              relevance
                .informationGain,

            bestAtomicInformationGain,

            gainOverBestAtomic,
          });
        }
      }
    }

    return candidates.sort(
      (
        left,
        right,
      ) => {
        if (
          right.gainOverBestAtomic !==
          left.gainOverBestAtomic
        ) {
          return (
            right.gainOverBestAtomic -
            left.gainOverBestAtomic
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
    RelationalContextProjection |
    undefined {
    const feature =
      this.rankRelations(
        principleId,
      )[0];

    if (
      !feature
    ) {
      return undefined;
    }

    const value =
      relationValue(
        signature,
        feature.left,
        feature.right,
        feature.operator,
      );

    return {
      featureId:
        feature.id,

      left:
        feature.left,

      right:
        feature.right,

      operator:
        feature.operator,

      relationValue:
        value,

      projectionKey:
        JSON.stringify([
          feature.id,
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
    RelationalContextApplicabilityEstimate |
    undefined {
    const feature =
      this.rankRelations(
        principleId,
      )[0];

    const projection =
      this.project(
        principleId,
        signature,
      );

    if (
      !feature ||
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

      feature: {
        ...feature,
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

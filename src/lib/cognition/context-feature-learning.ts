import type {
  InducedContextFeatures,
  InducedContextSignature,
} from "./principle-context-signature";

export type ContextFeatureName =
  keyof InducedContextFeatures;

export interface ContextFeatureRelevance {
  feature:
    ContextFeatureName;

  informationGain:
    number;

  distinctValues:
    number;
}

export interface LearnedContextProjection {
  selectedFeatures:
    ContextFeatureName[];

  projectionKey:
    string;
}

export interface LearnedFeatureApplicabilityEstimate {
  principleId:
    string;

  projection:
    LearnedContextProjection;

  successes:
    number;

  failures:
    number;

  evidenceCount:
    number;

  applicability:
    number;

  relevance:
    ContextFeatureRelevance[];
}

interface FeatureObservation {
  signature:
    InducedContextSignature;

  useful:
    boolean;
}

const FEATURE_NAMES:
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
  const value =
    signature.features[
      feature
    ];

  return Array.isArray(
    value,
  )
    ? JSON.stringify(
        value,
      )
    : JSON.stringify(
        value,
      );
}

function informationGainFor(
  observations:
    readonly FeatureObservation[],

  feature:
    ContextFeatureName,
):
  ContextFeatureRelevance {
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
      featureValue(
        observation
          .signature,
        feature,
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
    const bucketTotal =
      bucket.positive +
      bucket.negative;

    conditionalEntropy +=
      (
        bucketTotal /
        observations.length
      ) *
      entropy(
        bucket.positive,
        bucket.negative,
      );
  }

  return {
    feature,

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

/**
 * Learns which dimensions of an induced structural signature are actually
 * predictive of principle usefulness.
 *
 * Feature relevance is estimated independently per principle using empirical
 * information gain. The best evidenced dimensions become a compressed
 * projection key. Source symbols never enter this model.
 */
export class LearnedContextFeatureApplicabilityModel {
  private readonly observations =
    new Map<
      string,
      FeatureObservation[]
    >();

  constructor(
    private readonly maxFeatures =
      1,

    private readonly minimumObservations =
      4,
  ) {
    if (
      !Number.isInteger(
        maxFeatures,
      ) ||
      maxFeatures <
        1
    ) {
      throw new Error(
        "maxFeatures must be a positive integer.",
      );
    }

    if (
      !Number.isInteger(
        minimumObservations,
      ) ||
      minimumObservations <
        2
    ) {
      throw new Error(
        "minimumObservations must be at least 2.",
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
    LearnedFeatureApplicabilityEstimate {
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

  rankFeatures(
    principleId:
      string,
  ):
    ContextFeatureRelevance[] {
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

    return FEATURE_NAMES
      .map(
        (feature) =>
          informationGainFor(
            observations,
            feature,
          ),
      )
      .filter(
        (relevance) =>
          relevance.distinctValues >
            1 &&
          relevance.informationGain >
            0,
      )
      .sort(
        (
          left,
          right,
        ) => {
          if (
            right.informationGain !==
            left.informationGain
          ) {
            return (
              right.informationGain -
              left.informationGain
            );
          }

          return left.feature
            .localeCompare(
              right.feature,
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
    LearnedContextProjection {
    const selectedFeatures =
      this.rankFeatures(
        principleId,
      )
        .slice(
          0,
          this.maxFeatures,
        )
        .map(
          (relevance) =>
            relevance.feature,
        );

    return {
      selectedFeatures,

      projectionKey:
        JSON.stringify(
          selectedFeatures.map(
            (feature) => [
              feature,
              featureValue(
                signature,
                feature,
              ),
            ],
          ),
        ),
    };
  }

  estimate(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    LearnedFeatureApplicabilityEstimate {
    const observations =
      this.observations.get(
        principleId,
      ) ?? [];

    const relevance =
      this.rankFeatures(
        principleId,
      );

    const projection =
      this.project(
        principleId,
        signature,
      );

    const matches =
      projection
        .selectedFeatures
        .length >
        0
        ? observations.filter(
            (observation) =>
              this.project(
                principleId,
                observation
                  .signature,
              )
                .projectionKey ===
              projection
                .projectionKey,
          )
        : [];

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

      projection: {
        selectedFeatures: [
          ...projection
            .selectedFeatures,
        ],

        projectionKey:
          projection
            .projectionKey,
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

      relevance:
        relevance.map(
          (item) => ({
            ...item,
          }),
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

import type {
  ContextFeatureName,
} from "./context-feature-learning";

import type {
  InducedContextSignature,
} from "./principle-context-signature";

export interface ComposedContextFeature {
  id:
    string;

  components:
    readonly [
      ContextFeatureName,
      ContextFeatureName,
    ];

  informationGain:
    number;

  bestAtomicInformationGain:
    number;

  gainOverBestAtomic:
    number;

  distinctValues:
    number;
}

export interface ComposedContextProjection {
  featureId:
    string;

  components:
    readonly [
      ContextFeatureName,
      ContextFeatureName,
    ];

  projectionKey:
    string;
}

export interface ComposedContextApplicabilityEstimate {
  principleId:
    string;

  feature:
    ComposedContextFeature;

  projection:
    ComposedContextProjection;

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

function compositionId(
  first:
    ContextFeatureName,

  second:
    ContextFeatureName,
):
  string {
  return (
    "pair::" +
    first +
    "::" +
    second
  );
}

/**
 * Constructs pairwise context features when combinations predict principle
 * usefulness better than any supplied atomic dimension.
 *
 * The composition grammar is intentionally narrow and auditable: unordered
 * pairs of existing symbol-independent structural dimensions. A pair is not
 * accepted merely because it has information gain; it must improve on the best
 * atomic feature for the same principle evidence.
 */
export class ComposedContextFeatureApplicabilityModel {
  private readonly observations =
    new Map<
      string,
      Observation[]
    >();

  constructor(
    private readonly minimumObservations =
      4,
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
    ComposedContextApplicabilityEstimate |
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

  rankCompositions(
    principleId:
      string,
  ):
    ComposedContextFeature[] {
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

    const atomicGains =
      FEATURE_NAMES.map(
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
      );

    const bestAtomicInformationGain =
      Math.max(
        0,
        ...atomicGains,
      );

    const candidates:
      ComposedContextFeature[] =
      [];

    for (
      let firstIndex =
        0;
      firstIndex <
        FEATURE_NAMES.length;
      firstIndex +=
        1
    ) {
      for (
        let secondIndex =
          firstIndex +
          1;
        secondIndex <
          FEATURE_NAMES.length;
        secondIndex +=
          1
      ) {
        const first =
          FEATURE_NAMES[
            firstIndex
          ];

        const second =
          FEATURE_NAMES[
            secondIndex
          ];

        const relevance =
          relevanceFor(
            observations,
            (observation) =>
              JSON.stringify([
                featureValue(
                  observation
                    .signature,
                  first,
                ),

                featureValue(
                  observation
                    .signature,
                  second,
                ),
              ]),
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
            compositionId(
              first,
              second,
            ),

          components: [
            first,
            second,
          ],

          informationGain:
            relevance
              .informationGain,

          bestAtomicInformationGain,

          gainOverBestAtomic,

          distinctValues:
            relevance
              .distinctValues,
        });
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
    ComposedContextProjection |
    undefined {
    const feature =
      this.rankCompositions(
        principleId,
      )[0];

    if (
      !feature
    ) {
      return undefined;
    }

    return {
      featureId:
        feature.id,

      components: [
        feature.components[0],
        feature.components[1],
      ],

      projectionKey:
        JSON.stringify(
          feature.components.map(
            (component) => [
              component,
              featureValue(
                signature,
                component,
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
    ComposedContextApplicabilityEstimate |
    undefined {
    const feature =
      this.rankCompositions(
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
          projection.projectionKey,
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

        components: [
          feature.components[0],
          feature.components[1],
        ],
      },

      projection: {
        featureId:
          projection.featureId,

        components: [
          projection.components[0],
          projection.components[1],
        ],

        projectionKey:
          projection.projectionKey,
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

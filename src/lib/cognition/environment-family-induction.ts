import {
  MetaAdaptationController,
  type MetaAdaptationEnvironmentFamily,
  type MetaAdaptationEpisode,
  type MetaAdaptationPolicy,
  type MetaAdaptationSelection,
} from "./meta-adaptation";

export type InducedEnvironmentFamily =
  Exclude<
    MetaAdaptationEnvironmentFamily,
    "unknown"
  >;

export interface EnvironmentSignalObservation {
  recentErrorRate: number;
  errorBurstiness: number;
  driftConfidence: number;
  changePointStrength: number;
  priorRegimeSimilarity: number;
  trendPersistence: number;
}

export interface EnvironmentFamilyPrototype {
  family: InducedEnvironmentFamily;
  observation: EnvironmentSignalObservation;
}

export interface EnvironmentFamilyBelief {
  probabilities: Record<
    InducedEnvironmentFamily,
    number
  >;
  topFamily: InducedEnvironmentFamily;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyCertain: boolean;
}

export interface AutonomousMetaAdaptationSelection {
  belief: EnvironmentFamilyBelief;
  policy: MetaAdaptationPolicy;
  decision:
    | "inferred-family"
    | "uncertainty-abstention";
  evidenceFamily: MetaAdaptationEnvironmentFamily;
  metaReason?: MetaAdaptationSelection["reason"];
}

export type AutonomousEpisodeOutcome =
  Omit<
    MetaAdaptationEpisode,
    "family" |
    "policyId"
  >;

const FAMILIES:
  readonly InducedEnvironmentFamily[] = [
    "stationary-noisy",
    "gradual-drift",
    "abrupt-drift",
    "recurring-regime",
  ];

const FEATURE_WEIGHTS:
  Readonly<
    EnvironmentSignalObservation
  > = {
    recentErrorRate:
      1,
    errorBurstiness:
      1,
    driftConfidence:
      1.2,
    changePointStrength:
      1.2,
    priorRegimeSimilarity:
      1.4,
    trendPersistence:
      1,
  };

export const DEFAULT_ENVIRONMENT_FAMILY_PROTOTYPES:
  readonly EnvironmentFamilyPrototype[] = [
    {
      family:
        "stationary-noisy",

      observation: {
        recentErrorRate:
          0.12,
        errorBurstiness:
          0.22,
        driftConfidence:
          0.18,
        changePointStrength:
          0.16,
        priorRegimeSimilarity:
          0.15,
        trendPersistence:
          0.12,
      },
    },
    {
      family:
        "gradual-drift",

      observation: {
        recentErrorRate:
          0.42,
        errorBurstiness:
          0.36,
        driftConfidence:
          0.58,
        changePointStrength:
          0.48,
        priorRegimeSimilarity:
          0.28,
        trendPersistence:
          0.78,
      },
    },
    {
      family:
        "abrupt-drift",

      observation: {
        recentErrorRate:
          0.74,
        errorBurstiness:
          0.86,
        driftConfidence:
          0.92,
        changePointStrength:
          0.95,
        priorRegimeSimilarity:
          0.22,
        trendPersistence:
          0.94,
      },
    },
    {
      family:
        "recurring-regime",

      observation: {
        recentErrorRate:
          0.58,
        errorBurstiness:
          0.66,
        driftConfidence:
          0.78,
        changePointStrength:
          0.74,
        priorRegimeSimilarity:
          0.92,
        trendPersistence:
          0.62,
      },
    },
  ] as const;

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

function validateObservation(
  observation:
    EnvironmentSignalObservation,
): void {
  for (
    const [
      name,
      value,
    ] of
      Object.entries(
        observation,
      )
  ) {
    validateUnitInterval(
      name,
      value,
    );
  }
}

function weightedSquaredDistance(
  left:
    EnvironmentSignalObservation,

  right:
    EnvironmentSignalObservation,
): number {
  let weightedError =
    0;

  let totalWeight =
    0;

  for (
    const key of
      Object.keys(
        FEATURE_WEIGHTS,
      ) as Array<
        keyof EnvironmentSignalObservation
      >
  ) {
    const weight =
      FEATURE_WEIGHTS[
        key
      ];

    const delta =
      left[
        key
      ] -
      right[
        key
      ];

    weightedError +=
      weight *
      delta *
      delta;

    totalWeight +=
      weight;
  }

  return weightedError /
    totalWeight;
}

function normalizedEntropy(
  probabilities:
    Record<
      InducedEnvironmentFamily,
      number
    >,
): number {
  let entropy =
    0;

  for (
    const family of
      FAMILIES
  ) {
    const probability =
      probabilities[
        family
      ];

    if (
      probability >
      0
    ) {
      entropy -=
        probability *
        Math.log(
          probability,
        );
    }
  }

  return entropy /
    Math.log(
      FAMILIES.length,
    );
}

export class EnvironmentFamilyInducer {
  private readonly prototypes:
    readonly EnvironmentFamilyPrototype[];

  constructor(
    prototypes:
      readonly EnvironmentFamilyPrototype[] =
        DEFAULT_ENVIRONMENT_FAMILY_PROTOTYPES,

    private readonly confidenceThreshold =
      0.58,

    private readonly marginThreshold =
      0.18,

    private readonly temperature =
      14,
  ) {
    if (
      prototypes.length !==
        FAMILIES.length
    ) {
      throw new Error(
        "Environment-family induction requires exactly one prototype per known family.",
      );
    }

    const seen =
      new Set<
        InducedEnvironmentFamily
      >();

    for (
      const prototype of
        prototypes
    ) {
      if (
        seen.has(
          prototype.family,
        )
      ) {
        throw new Error(
          `Duplicate environment-family prototype: ${prototype.family}`,
        );
      }

      validateObservation(
        prototype.observation,
      );

      seen.add(
        prototype.family,
      );
    }

    for (
      const family of
        FAMILIES
    ) {
      if (
        !seen.has(
          family,
        )
      ) {
        throw new Error(
          `Missing environment-family prototype: ${family}`,
        );
      }
    }

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
        temperature,
      ) ||
      temperature <=
        0
    ) {
      throw new Error(
        "temperature must be a positive finite number.",
      );
    }

    this.prototypes =
      prototypes.map(
        (prototype) => ({
          family:
            prototype.family,

          observation: {
            ...prototype.observation,
          },
        }),
      );
  }

  infer(
    observation:
      EnvironmentSignalObservation,
  ): EnvironmentFamilyBelief {
    validateObservation(
      observation,
    );

    const scores =
      new Map<
        InducedEnvironmentFamily,
        number
      >();

    let scoreTotal =
      0;

    for (
      const prototype of
        this.prototypes
    ) {
      const distance =
        weightedSquaredDistance(
          observation,
          prototype.observation,
        );

      const score =
        Math.exp(
          -this.temperature *
            distance,
        );

      scores.set(
        prototype.family,
        score,
      );

      scoreTotal +=
        score;
    }

    if (
      !Number.isFinite(
        scoreTotal,
      ) ||
      scoreTotal <=
        0
    ) {
      throw new Error(
        "Environment-family inference could not normalize its evidence.",
      );
    }

    const probabilities =
      {} as Record<
        InducedEnvironmentFamily,
        number
      >;

    for (
      const family of
        FAMILIES
    ) {
      probabilities[
        family
      ] =
        (
          scores.get(
            family,
          ) ??
          0
        ) /
        scoreTotal;
    }

    const ranked =
      FAMILIES
        .map(
          (family) => ({
            family,
            probability:
              probabilities[
                family
              ],
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.probability -
            left.probability,
        );

    const top =
      ranked[0];

    const runnerUp =
      ranked[1];

    if (
      !top ||
      !runnerUp
    ) {
      throw new Error(
        "Environment-family inference requires at least two candidate families.",
      );
    }

    const margin =
      top.probability -
      runnerUp.probability;

    return {
      probabilities,

      topFamily:
        top.family,

      confidence:
        top.probability,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          probabilities,
        ),

      sufficientlyCertain:
        top.probability >=
          this.confidenceThreshold &&
        margin >=
          this.marginThreshold,
    };
  }
}

export class AutonomousMetaAdaptationController {
  constructor(
    private readonly metaController =
      new MetaAdaptationController(),

    private readonly inducer =
      new EnvironmentFamilyInducer(),

    private readonly fallbackPolicyIds:
      readonly string[] = [
        "balanced",
        "conservative",
      ],
  ) {
    if (
      fallbackPolicyIds.length ===
        0
    ) {
      throw new Error(
        "Autonomous meta-adaptation requires at least one uncertainty fallback policy.",
      );
    }
  }

  selectPolicy(
    observation:
      EnvironmentSignalObservation,
  ): AutonomousMetaAdaptationSelection {
    const belief =
      this.inducer.infer(
        observation,
      );

    if (
      belief.sufficientlyCertain
    ) {
      const selection =
        this.metaController.selectPolicy(
          belief.topFamily,
        );

      return {
        belief,

        policy:
          selection.policy,

        decision:
          "inferred-family",

        evidenceFamily:
          belief.topFamily,

        metaReason:
          selection.reason,
      };
    }

    const audit =
      this.metaController.getAuditSummary();

    const quarantined =
      new Set(
        audit
          .quarantinedPolicyIds,
      );

    for (
      const policyId of
        this.fallbackPolicyIds
    ) {
      if (
        quarantined.has(
          policyId,
        )
      ) {
        continue;
      }

      const policy =
        this.metaController.getPolicy(
          policyId,
        );

      if (
        policy
      ) {
        return {
          belief,

          policy,

          decision:
            "uncertainty-abstention",

          evidenceFamily:
            "unknown",
        };
      }
    }

    throw new Error(
      "No safe uncertainty fallback policy remains; refusing uncertain self-adaptation.",
    );
  }

  recordEpisode(
    selection:
      AutonomousMetaAdaptationSelection,

    outcome:
      AutonomousEpisodeOutcome,
  ): number {
    return this.metaController.recordEpisode({
      family:
        selection.evidenceFamily,

      policyId:
        selection.policy.id,

      ...outcome,
    });
  }

  getAuditSummary() {
    return this.metaController.getAuditSummary();
  }
}

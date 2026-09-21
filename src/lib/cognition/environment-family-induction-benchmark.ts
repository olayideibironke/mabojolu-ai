import {
  DEFAULT_META_ADAPTATION_POLICIES,
  MetaAdaptationController,
  scoreMetaAdaptationEpisode,
  type MetaAdaptationEnvironmentFamily,
  type MetaAdaptationEpisode,
} from "./meta-adaptation";

import {
  AutonomousMetaAdaptationController,
  type AutonomousEpisodeOutcome,
  type EnvironmentSignalObservation,
} from "./environment-family-induction";

import {
  DEFAULT_META_ADAPTATION_BENCHMARK,
  type MetaAdaptationBenchmarkEpisode,
  type MetaAdaptationBenchmarkPhase,
  type MetaAdaptationBenchmarkSystemMetrics,
} from "./meta-adaptation-benchmark";

export interface EnvironmentFamilyInductionBenchmarkEpisode
  extends MetaAdaptationBenchmarkEpisode {
  observation: EnvironmentSignalObservation;
}

export interface EnvironmentFamilyInductionEpisodeResult {
  episodeId: string;
  phase: MetaAdaptationBenchmarkPhase;
  trueFamily: MetaAdaptationEnvironmentFamily;
  inferredFamily: MetaAdaptationEnvironmentFamily;
  inferenceConfidence: number;
  inferenceMargin: number;
  inferenceEntropy: number;
  decision:
    | "inferred-family"
    | "uncertainty-abstention";
  autonomousPolicyId: string;
  labelSuppliedPolicyId: string;
  staticPolicyId: string;
  oraclePolicyId: string;
  autonomousUtility: number;
  labelSuppliedUtility: number;
  staticUtility: number;
  oracleUtility: number;
  autonomousRegret: number;
  labelSuppliedRegret: number;
}

export interface EnvironmentFamilyInductionInferenceMetrics {
  episodes: number;
  inferredEpisodes: number;
  abstentions: number;
  inferenceCoverage: number;
  resolvedCorrect: number;
  resolvedFamilyAccuracy: number;
  meanConfidence: number;
  meanEntropy: number;
}

export interface EnvironmentFamilyInductionBenchmarkSlice {
  autonomous: MetaAdaptationBenchmarkSystemMetrics;
  labelSupplied: MetaAdaptationBenchmarkSystemMetrics;
  staticBaseline: MetaAdaptationBenchmarkSystemMetrics;
  inference: EnvironmentFamilyInductionInferenceMetrics;
  autonomousCumulativeRegret: number;
  labelSuppliedCumulativeRegret: number;
}

export interface EnvironmentFamilyInductionBenchmarkReport {
  episodes: EnvironmentFamilyInductionEpisodeResult[];
  overall: EnvironmentFamilyInductionBenchmarkSlice;
  calibration: EnvironmentFamilyInductionBenchmarkSlice;
  heldOut: EnvironmentFamilyInductionBenchmarkSlice;
}

type MutableMetrics = {
  episodes: number;
  cumulativeUtility: number;
  falseAlarms: number;
  missedChanges: number;
  falsePromotions: number;
  recoverySuccesses: number;
  validationEvidenceCost: number;
  detectedChangeEpisodes: number;
  totalDetectionDelay: number;
};

type MutableInferenceMetrics = {
  episodes: number;
  inferredEpisodes: number;
  abstentions: number;
  resolvedCorrect: number;
  confidenceTotal: number;
  entropyTotal: number;
};

const CALIBRATION_OBSERVATIONS:
  Record<
    Exclude<
      MetaAdaptationEnvironmentFamily,
      "unknown"
    >,
    EnvironmentSignalObservation
  > = {
    "stationary-noisy": {
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

    "gradual-drift": {
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

    "abrupt-drift": {
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

    "recurring-regime": {
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
  };

const HELD_OUT_OBSERVATIONS:
  Record<
    Exclude<
      MetaAdaptationEnvironmentFamily,
      "unknown"
    >,
    EnvironmentSignalObservation
  > = {
    "stationary-noisy": {
      recentErrorRate:
        0.16,
      errorBurstiness:
        0.27,
      driftConfidence:
        0.22,
      changePointStrength:
        0.2,
      priorRegimeSimilarity:
        0.18,
      trendPersistence:
        0.16,
    },

    "gradual-drift": {
      recentErrorRate:
        0.46,
      errorBurstiness:
        0.4,
      driftConfidence:
        0.62,
      changePointStrength:
        0.53,
      priorRegimeSimilarity:
        0.32,
      trendPersistence:
        0.72,
    },

    "abrupt-drift": {
      recentErrorRate:
        0.7,
      errorBurstiness:
        0.8,
      driftConfidence:
        0.88,
      changePointStrength:
        0.9,
      priorRegimeSimilarity:
        0.25,
      trendPersistence:
        0.88,
    },

    "recurring-regime": {
      recentErrorRate:
        0.6,
      errorBurstiness:
        0.62,
      driftConfidence:
        0.74,
      changePointStrength:
        0.7,
      priorRegimeSimilarity:
        0.86,
      trendPersistence:
        0.58,
    },
  };

const AMBIGUOUS_GRADUAL_ABRUPT:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.58,
    errorBurstiness:
      0.61,
    driftConfidence:
      0.75,
    changePointStrength:
      0.715,
    priorRegimeSimilarity:
      0.25,
    trendPersistence:
      0.86,
  };

function observationForEpisode(
  episode:
    MetaAdaptationBenchmarkEpisode,
): EnvironmentSignalObservation {
  if (
    episode.family ===
      "unknown"
  ) {
    throw new Error(
      `Benchmark episode ${episode.id} cannot synthesize signals from an unknown evaluation family.`,
    );
  }

  if (
    episode.id ===
      "held-gradual-2"
  ) {
    return {
      ...AMBIGUOUS_GRADUAL_ABRUPT,
    };
  }

  const source =
    episode.phase ===
      "calibration"
      ? CALIBRATION_OBSERVATIONS
      : HELD_OUT_OBSERVATIONS;

  return {
    ...source[
      episode.family
    ],
  };
}

export const DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK:
  readonly EnvironmentFamilyInductionBenchmarkEpisode[] =
    DEFAULT_META_ADAPTATION_BENCHMARK.map(
      (episode) => ({
        ...episode,

        observation:
          observationForEpisode(
            episode,
          ),
      }),
    );

function emptyMetrics(): MutableMetrics {
  return {
    episodes:
      0,
    cumulativeUtility:
      0,
    falseAlarms:
      0,
    missedChanges:
      0,
    falsePromotions:
      0,
    recoverySuccesses:
      0,
    validationEvidenceCost:
      0,
    detectedChangeEpisodes:
      0,
    totalDetectionDelay:
      0,
  };
}

function emptyInferenceMetrics():
  MutableInferenceMetrics {
  return {
    episodes:
      0,
    inferredEpisodes:
      0,
    abstentions:
      0,
    resolvedCorrect:
      0,
    confidenceTotal:
      0,
    entropyTotal:
      0,
  };
}

function materializeEpisode(
  benchmarkEpisode:
    EnvironmentFamilyInductionBenchmarkEpisode,

  policyId:
    string,
): MetaAdaptationEpisode {
  const outcome =
    benchmarkEpisode.outcomes[
      policyId
    ];

  if (
    !outcome
  ) {
    throw new Error(
      `Environment-family benchmark episode ${benchmarkEpisode.id} is missing outcome for policy ${policyId}.`,
    );
  }

  return {
    family:
      benchmarkEpisode.family,

    policyId,

    ...outcome,
  };
}

function outcomeOnly(
  episode:
    MetaAdaptationEpisode,
): AutonomousEpisodeOutcome {
  const {
    family:
      _family,
    policyId:
      _policyId,
    ...outcome
  } =
    episode;

  return outcome;
}

function updateMetrics(
  metrics:
    MutableMetrics,

  episode:
    MetaAdaptationEpisode,

  utility:
    number,
): void {
  metrics.episodes +=
    1;

  metrics.cumulativeUtility +=
    utility;

  if (
    !episode.trueRegimeChange &&
    episode.changeDetected
  ) {
    metrics.falseAlarms +=
      1;
  }

  if (
    episode.trueRegimeChange &&
    !episode.changeDetected
  ) {
    metrics.missedChanges +=
      1;
  }

  if (
    episode.falsePromotion
  ) {
    metrics.falsePromotions +=
      1;
  }

  if (
    episode.recoverySucceeded
  ) {
    metrics.recoverySuccesses +=
      1;
  }

  metrics.validationEvidenceCost +=
    episode.validationEvidenceCost;

  if (
    episode.trueRegimeChange &&
    episode.changeDetected
  ) {
    metrics.detectedChangeEpisodes +=
      1;

    metrics.totalDetectionDelay +=
      episode.detectionDelay ??
      0;
  }
}

function freezeMetrics(
  metrics:
    MutableMetrics,
): MetaAdaptationBenchmarkSystemMetrics {
  return {
    episodes:
      metrics.episodes,

    cumulativeUtility:
      metrics.cumulativeUtility,

    meanUtility:
      metrics.episodes >
        0
        ? metrics.cumulativeUtility /
          metrics.episodes
        : 0,

    falseAlarms:
      metrics.falseAlarms,

    missedChanges:
      metrics.missedChanges,

    falsePromotions:
      metrics.falsePromotions,

    recoverySuccesses:
      metrics.recoverySuccesses,

    validationEvidenceCost:
      metrics.validationEvidenceCost,

    detectedChangeEpisodes:
      metrics.detectedChangeEpisodes,

    totalDetectionDelay:
      metrics.totalDetectionDelay,

    ...(metrics.detectedChangeEpisodes >
      0
      ? {
          meanDetectionDelay:
            metrics.totalDetectionDelay /
            metrics.detectedChangeEpisodes,
        }
      : {}),
  };
}

function freezeInferenceMetrics(
  metrics:
    MutableInferenceMetrics,
): EnvironmentFamilyInductionInferenceMetrics {
  return {
    episodes:
      metrics.episodes,

    inferredEpisodes:
      metrics.inferredEpisodes,

    abstentions:
      metrics.abstentions,

    inferenceCoverage:
      metrics.episodes >
        0
        ? metrics.inferredEpisodes /
          metrics.episodes
        : 0,

    resolvedCorrect:
      metrics.resolvedCorrect,

    resolvedFamilyAccuracy:
      metrics.inferredEpisodes >
        0
        ? metrics.resolvedCorrect /
          metrics.inferredEpisodes
        : 0,

    meanConfidence:
      metrics.episodes >
        0
        ? metrics.confidenceTotal /
          metrics.episodes
        : 0,

    meanEntropy:
      metrics.episodes >
        0
        ? metrics.entropyTotal /
          metrics.episodes
        : 0,
  };
}

function buildSlice(
  results:
    readonly EnvironmentFamilyInductionEpisodeResult[],

  episodes:
    readonly EnvironmentFamilyInductionBenchmarkEpisode[],
): EnvironmentFamilyInductionBenchmarkSlice {
  const autonomousMetrics =
    emptyMetrics();

  const labelMetrics =
    emptyMetrics();

  const staticMetrics =
    emptyMetrics();

  const inferenceMetrics =
    emptyInferenceMetrics();

  let autonomousCumulativeRegret =
    0;

  let labelSuppliedCumulativeRegret =
    0;

  const episodeById =
    new Map(
      episodes.map(
        (episode) => [
          episode.id,
          episode,
        ],
      ),
    );

  for (
    const result of
      results
  ) {
    const benchmarkEpisode =
      episodeById.get(
        result.episodeId,
      );

    if (
      !benchmarkEpisode
    ) {
      throw new Error(
        `Missing environment-family benchmark episode ${result.episodeId} while building report.`,
      );
    }

    const autonomousEpisode =
      materializeEpisode(
        benchmarkEpisode,
        result.autonomousPolicyId,
      );

    const labelEpisode =
      materializeEpisode(
        benchmarkEpisode,
        result.labelSuppliedPolicyId,
      );

    const staticEpisode =
      materializeEpisode(
        benchmarkEpisode,
        result.staticPolicyId,
      );

    updateMetrics(
      autonomousMetrics,
      autonomousEpisode,
      result.autonomousUtility,
    );

    updateMetrics(
      labelMetrics,
      labelEpisode,
      result.labelSuppliedUtility,
    );

    updateMetrics(
      staticMetrics,
      staticEpisode,
      result.staticUtility,
    );

    inferenceMetrics.episodes +=
      1;

    inferenceMetrics.confidenceTotal +=
      result.inferenceConfidence;

    inferenceMetrics.entropyTotal +=
      result.inferenceEntropy;

    if (
      result.decision ===
        "inferred-family"
    ) {
      inferenceMetrics.inferredEpisodes +=
        1;

      if (
        result.inferredFamily ===
          result.trueFamily
      ) {
        inferenceMetrics.resolvedCorrect +=
          1;
      }
    } else {
      inferenceMetrics.abstentions +=
        1;
    }

    autonomousCumulativeRegret +=
      result.autonomousRegret;

    labelSuppliedCumulativeRegret +=
      result.labelSuppliedRegret;
  }

  return {
    autonomous:
      freezeMetrics(
        autonomousMetrics,
      ),

    labelSupplied:
      freezeMetrics(
        labelMetrics,
      ),

    staticBaseline:
      freezeMetrics(
        staticMetrics,
      ),

    inference:
      freezeInferenceMetrics(
        inferenceMetrics,
      ),

    autonomousCumulativeRegret,

    labelSuppliedCumulativeRegret,
  };
}

export function runEnvironmentFamilyInductionBenchmark(
  episodes:
    readonly EnvironmentFamilyInductionBenchmarkEpisode[] =
      DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK,
): EnvironmentFamilyInductionBenchmarkReport {
  if (
    episodes.length ===
      0
  ) {
    throw new Error(
      "Environment-family induction benchmark requires at least one episode.",
    );
  }

  const labelController =
    new MetaAdaptationController();

  const autonomousController =
    new AutonomousMetaAdaptationController();

  const staticPolicyId =
    "balanced";

  const results:
    EnvironmentFamilyInductionEpisodeResult[] =
      [];

  for (
    const benchmarkEpisode of
      episodes
  ) {
    const labelSelection =
      labelController.selectPolicy(
        benchmarkEpisode.family,
      );

    const autonomousSelection =
      autonomousController.selectPolicy(
        benchmarkEpisode.observation,
      );

    const labelEpisode =
      materializeEpisode(
        benchmarkEpisode,
        labelSelection.policy.id,
      );

    const autonomousEpisode =
      materializeEpisode(
        benchmarkEpisode,
        autonomousSelection.policy.id,
      );

    const staticEpisode =
      materializeEpisode(
        benchmarkEpisode,
        staticPolicyId,
      );

    const labelSuppliedUtility =
      scoreMetaAdaptationEpisode(
        labelEpisode,
      );

    const autonomousUtility =
      scoreMetaAdaptationEpisode(
        autonomousEpisode,
      );

    const staticUtility =
      scoreMetaAdaptationEpisode(
        staticEpisode,
      );

    let oraclePolicyId =
      DEFAULT_META_ADAPTATION_POLICIES[
        0
      ]?.id;

    let oracleUtility =
      Number.NEGATIVE_INFINITY;

    for (
      const policy of
        DEFAULT_META_ADAPTATION_POLICIES
    ) {
      const candidate =
        materializeEpisode(
          benchmarkEpisode,
          policy.id,
        );

      const utility =
        scoreMetaAdaptationEpisode(
          candidate,
        );

      if (
        utility >
          oracleUtility +
            Number.EPSILON
      ) {
        oracleUtility =
          utility;

        oraclePolicyId =
          policy.id;
      }
    }

    if (
      !oraclePolicyId ||
      !Number.isFinite(
        oracleUtility,
      )
    ) {
      throw new Error(
        `Environment-family benchmark episode ${benchmarkEpisode.id} could not determine an oracle policy.`,
      );
    }

    results.push({
      episodeId:
        benchmarkEpisode.id,

      phase:
        benchmarkEpisode.phase,

      trueFamily:
        benchmarkEpisode.family,

      inferredFamily:
        autonomousSelection
          .belief
          .topFamily,

      inferenceConfidence:
        autonomousSelection
          .belief
          .confidence,

      inferenceMargin:
        autonomousSelection
          .belief
          .margin,

      inferenceEntropy:
        autonomousSelection
          .belief
          .normalizedEntropy,

      decision:
        autonomousSelection
          .decision,

      autonomousPolicyId:
        autonomousSelection
          .policy
          .id,

      labelSuppliedPolicyId:
        labelSelection
          .policy
          .id,

      staticPolicyId,

      oraclePolicyId,

      autonomousUtility,

      labelSuppliedUtility,

      staticUtility,

      oracleUtility,

      autonomousRegret:
        Math.max(
          0,
          oracleUtility -
            autonomousUtility,
        ),

      labelSuppliedRegret:
        Math.max(
          0,
          oracleUtility -
            labelSuppliedUtility,
        ),
    });

    labelController.recordEpisode(
      labelEpisode,
    );

    autonomousController.recordEpisode(
      autonomousSelection,
      outcomeOnly(
        autonomousEpisode,
      ),
    );
  }

  const calibration =
    results.filter(
      (result) =>
        result.phase ===
        "calibration",
    );

  const heldOut =
    results.filter(
      (result) =>
        result.phase ===
        "held-out",
    );

  return {
    episodes:
      results,

    overall:
      buildSlice(
        results,
        episodes,
      ),

    calibration:
      buildSlice(
        calibration,
        episodes,
      ),

    heldOut:
      buildSlice(
        heldOut,
        episodes,
      ),
  };
}

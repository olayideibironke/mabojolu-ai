import {
  DEFAULT_META_ADAPTATION_POLICIES,
  MetaAdaptationController,
  scoreMetaAdaptationEpisode,
  type MetaAdaptationEnvironmentFamily,
  type MetaAdaptationEpisode,
  type MetaAdaptationPolicy,
} from "./meta-adaptation";

export type MetaAdaptationBenchmarkPhase =
  | "calibration"
  | "held-out";

export type MetaAdaptationCounterfactualOutcome =
  Omit<
    MetaAdaptationEpisode,
    "family" |
    "policyId"
  >;

export interface MetaAdaptationBenchmarkEpisode {
  id: string;
  phase: MetaAdaptationBenchmarkPhase;
  family: MetaAdaptationEnvironmentFamily;
  outcomes: Record<
    string,
    MetaAdaptationCounterfactualOutcome
  >;
}

export interface MetaAdaptationBenchmarkEpisodeResult {
  episodeId: string;
  phase: MetaAdaptationBenchmarkPhase;
  family: MetaAdaptationEnvironmentFamily;
  selectedPolicyId: string;
  selectionReason:
    | "family-exploration"
    | "family-evidence"
    | "cross-family-transfer";
  staticPolicyId: string;
  oraclePolicyId: string;
  metaUtility: number;
  staticUtility: number;
  oracleUtility: number;
  regret: number;
  cumulativeRegret: number;
}

export interface MetaAdaptationBenchmarkSystemMetrics {
  episodes: number;
  cumulativeUtility: number;
  meanUtility: number;
  falseAlarms: number;
  missedChanges: number;
  falsePromotions: number;
  recoverySuccesses: number;
  validationEvidenceCost: number;
  detectedChangeEpisodes: number;
  totalDetectionDelay: number;
  meanDetectionDelay?: number;
}

export interface MetaAdaptationBenchmarkSlice {
  metaAdaptive: MetaAdaptationBenchmarkSystemMetrics;
  staticBaseline: MetaAdaptationBenchmarkSystemMetrics;
  oracleCumulativeUtility: number;
  cumulativeRegret: number;
  meanRegret: number;
}

export interface MetaAdaptationBenchmarkReport {
  staticPolicyId: string;
  episodes: MetaAdaptationBenchmarkEpisodeResult[];
  overall: MetaAdaptationBenchmarkSlice;
  calibration: MetaAdaptationBenchmarkSlice;
  heldOut: MetaAdaptationBenchmarkSlice;
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

function emptyMetrics(): MutableMetrics {
  return {
    episodes: 0,
    cumulativeUtility: 0,
    falseAlarms: 0,
    missedChanges: 0,
    falsePromotions: 0,
    recoverySuccesses: 0,
    validationEvidenceCost: 0,
    detectedChangeEpisodes: 0,
    totalDetectionDelay: 0,
  };
}

function updateMetrics(
  metrics: MutableMetrics,
  episode: MetaAdaptationEpisode,
  utility: number,
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
  metrics: MutableMetrics,
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

function materializeEpisode(
  benchmarkEpisode:
    MetaAdaptationBenchmarkEpisode,

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
      `Benchmark episode ${benchmarkEpisode.id} is missing outcome for policy ${policyId}.`,
    );
  }

  return {
    family:
      benchmarkEpisode.family,

    policyId,

    ...outcome,
  };
}

function validateBenchmark(
  episodes:
    readonly MetaAdaptationBenchmarkEpisode[],

  policies:
    readonly MetaAdaptationPolicy[],

  staticPolicyId:
    string,
): void {
  if (
    episodes.length ===
      0
  ) {
    throw new Error(
      "Meta-adaptation benchmark requires at least one episode.",
    );
  }

  const policyIds =
    new Set(
      policies.map(
        (policy) =>
          policy.id,
      ),
    );

  if (
    !policyIds.has(
      staticPolicyId,
    )
  ) {
    throw new Error(
      `Static benchmark policy ${staticPolicyId} is not in the bounded policy catalog.`,
    );
  }

  const episodeIds =
    new Set<
      string
    >();

  for (
    const episode of
      episodes
  ) {
    if (
      !episode.id.trim()
    ) {
      throw new Error(
        "Benchmark episode id cannot be empty.",
      );
    }

    if (
      episodeIds.has(
        episode.id,
      )
    ) {
      throw new Error(
        `Duplicate benchmark episode id: ${episode.id}`,
      );
    }

    episodeIds.add(
      episode.id,
    );

    for (
      const policy of
        policies
    ) {
      if (
        !episode.outcomes[
          policy.id
        ]
      ) {
        throw new Error(
          `Benchmark episode ${episode.id} is missing outcome for policy ${policy.id}.`,
        );
      }
    }
  }
}

function buildSlice(
  results:
    readonly MetaAdaptationBenchmarkEpisodeResult[],

  episodes:
    readonly MetaAdaptationBenchmarkEpisode[],

  policyByEpisode:
    ReadonlyMap<
      string,
      string
    >,

  staticPolicyId:
    string,
):
  MetaAdaptationBenchmarkSlice {
  const metaMetrics =
    emptyMetrics();

  const staticMetrics =
    emptyMetrics();

  let oracleCumulativeUtility =
    0;

  let cumulativeRegret =
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
        `Missing benchmark episode ${result.episodeId} while building report.`,
      );
    }

    const selectedPolicyId =
      policyByEpisode.get(
        result.episodeId,
      );

    if (
      !selectedPolicyId
    ) {
      throw new Error(
        `Missing selected policy for benchmark episode ${result.episodeId}.`,
      );
    }

    const metaEpisode =
      materializeEpisode(
        benchmarkEpisode,
        selectedPolicyId,
      );

    const staticEpisode =
      materializeEpisode(
        benchmarkEpisode,
        staticPolicyId,
      );

    updateMetrics(
      metaMetrics,
      metaEpisode,
      result.metaUtility,
    );

    updateMetrics(
      staticMetrics,
      staticEpisode,
      result.staticUtility,
    );

    oracleCumulativeUtility +=
      result.oracleUtility;

    cumulativeRegret +=
      result.regret;
  }

  return {
    metaAdaptive:
      freezeMetrics(
        metaMetrics,
      ),

    staticBaseline:
      freezeMetrics(
        staticMetrics,
      ),

    oracleCumulativeUtility,

    cumulativeRegret,

    meanRegret:
      results.length >
        0
        ? cumulativeRegret /
          results.length
        : 0,
  };
}

export function runMetaAdaptationBenchmark(
  episodes:
    readonly MetaAdaptationBenchmarkEpisode[],

  options?: {
    policies?:
      readonly MetaAdaptationPolicy[];
    staticPolicyId?: string;
    controller?: MetaAdaptationController;
  },
): MetaAdaptationBenchmarkReport {
  const policies =
    options?.policies ??
    DEFAULT_META_ADAPTATION_POLICIES;

  const staticPolicyId =
    options?.staticPolicyId ??
    "balanced";

  validateBenchmark(
    episodes,
    policies,
    staticPolicyId,
  );

  const controller =
    options?.controller ??
    new MetaAdaptationController(
      policies,
    );

  const results:
    MetaAdaptationBenchmarkEpisodeResult[] =
      [];

  const selectedPolicyByEpisode =
    new Map<
      string,
      string
    >();

  let cumulativeRegret =
    0;

  for (
    const benchmarkEpisode of
      episodes
  ) {
    const selection =
      controller.selectPolicy(
        benchmarkEpisode.family,
      );

    const selectedEpisode =
      materializeEpisode(
        benchmarkEpisode,
        selection.policy.id,
      );

    const staticEpisode =
      materializeEpisode(
        benchmarkEpisode,
        staticPolicyId,
      );

    const metaUtility =
      scoreMetaAdaptationEpisode(
        selectedEpisode,
      );

    const staticUtility =
      scoreMetaAdaptationEpisode(
        staticEpisode,
      );

    let oraclePolicyId =
      policies[0]?.id;

    let oracleUtility =
      Number.NEGATIVE_INFINITY;

    for (
      const policy of
        policies
    ) {
      const counterfactualEpisode =
        materializeEpisode(
          benchmarkEpisode,
          policy.id,
        );

      const utility =
        scoreMetaAdaptationEpisode(
          counterfactualEpisode,
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
        `Benchmark episode ${benchmarkEpisode.id} could not determine an oracle policy.`,
      );
    }

    const regret =
      Math.max(
        0,
        oracleUtility -
          metaUtility,
      );

    cumulativeRegret +=
      regret;

    selectedPolicyByEpisode.set(
      benchmarkEpisode.id,
      selection.policy.id,
    );

    results.push({
      episodeId:
        benchmarkEpisode.id,

      phase:
        benchmarkEpisode.phase,

      family:
        benchmarkEpisode.family,

      selectedPolicyId:
        selection.policy.id,

      selectionReason:
        selection.reason,

      staticPolicyId,

      oraclePolicyId,

      metaUtility,

      staticUtility,

      oracleUtility,

      regret,

      cumulativeRegret,
    });

    controller.recordEpisode(
      selectedEpisode,
    );
  }

  const calibrationResults =
    results.filter(
      (result) =>
        result.phase ===
        "calibration",
    );

  const heldOutResults =
    results.filter(
      (result) =>
        result.phase ===
        "held-out",
    );

  return {
    staticPolicyId,

    episodes:
      results,

    overall:
      buildSlice(
        results,
        episodes,
        selectedPolicyByEpisode,
        staticPolicyId,
      ),

    calibration:
      buildSlice(
        calibrationResults,
        episodes,
        selectedPolicyByEpisode,
        staticPolicyId,
      ),

    heldOut:
      buildSlice(
        heldOutResults,
        episodes,
        selectedPolicyByEpisode,
        staticPolicyId,
      ),
  };
}

function outcome(
  input:
    MetaAdaptationCounterfactualOutcome,
): MetaAdaptationCounterfactualOutcome {
  return input;
}

const STATIONARY_NOISY_OUTCOMES = {
  conservative:
    outcome({
      trueRegimeChange:
        false,
      changeDetected:
        false,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        2,
    }),

  balanced:
    outcome({
      trueRegimeChange:
        false,
      changeDetected:
        true,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        6,
    }),

  responsive:
    outcome({
      trueRegimeChange:
        false,
      changeDetected:
        true,
      recoverySucceeded:
        false,
      falsePromotion:
        true,
      validationEvidenceCost:
        9,
    }),
};

const GRADUAL_DRIFT_OUTCOMES = {
  conservative:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        10,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        5,
    }),

  balanced:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        4,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        4,
    }),

  responsive:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        1,
      recoverySucceeded:
        false,
      falsePromotion:
        true,
      validationEvidenceCost:
        6,
    }),
};

const ABRUPT_DRIFT_OUTCOMES = {
  conservative:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        false,
      recoverySucceeded:
        false,
      falsePromotion:
        false,
      validationEvidenceCost:
        8,
    }),

  balanced:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        8,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        8,
    }),

  responsive:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        1,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        3,
    }),
};

const RECURRING_REGIME_OUTCOMES = {
  conservative:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        6,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        5,
    }),

  balanced:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        2,
      recoverySucceeded:
        true,
      falsePromotion:
        false,
      validationEvidenceCost:
        3,
    }),

  responsive:
    outcome({
      trueRegimeChange:
        true,
      changeDetected:
        true,
      detectionDelay:
        0,
      recoverySucceeded:
        true,
      falsePromotion:
        true,
      validationEvidenceCost:
        4,
    }),
};

function benchmarkEpisode(
  id:
    string,

  phase:
    MetaAdaptationBenchmarkPhase,

  family:
    MetaAdaptationEnvironmentFamily,

  outcomes:
    Record<
      string,
      MetaAdaptationCounterfactualOutcome
    >,
): MetaAdaptationBenchmarkEpisode {
  return {
    id,
    phase,
    family,
    outcomes,
  };
}

export const DEFAULT_META_ADAPTATION_BENCHMARK:
  readonly MetaAdaptationBenchmarkEpisode[] = [
    benchmarkEpisode(
      "cal-stationary-1",
      "calibration",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-stationary-2",
      "calibration",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-stationary-3",
      "calibration",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-stationary-4",
      "calibration",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),

    benchmarkEpisode(
      "cal-gradual-1",
      "calibration",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-gradual-2",
      "calibration",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-gradual-3",
      "calibration",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-gradual-4",
      "calibration",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),

    benchmarkEpisode(
      "cal-abrupt-1",
      "calibration",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-abrupt-2",
      "calibration",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-abrupt-3",
      "calibration",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-abrupt-4",
      "calibration",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),

    benchmarkEpisode(
      "cal-recurring-1",
      "calibration",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-recurring-2",
      "calibration",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-recurring-3",
      "calibration",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),
    benchmarkEpisode(
      "cal-recurring-4",
      "calibration",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),

    benchmarkEpisode(
      "held-abrupt-1",
      "held-out",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-stationary-1",
      "held-out",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-gradual-1",
      "held-out",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-recurring-1",
      "held-out",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-stationary-2",
      "held-out",
      "stationary-noisy",
      STATIONARY_NOISY_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-abrupt-2",
      "held-out",
      "abrupt-drift",
      ABRUPT_DRIFT_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-recurring-2",
      "held-out",
      "recurring-regime",
      RECURRING_REGIME_OUTCOMES,
    ),
    benchmarkEpisode(
      "held-gradual-2",
      "held-out",
      "gradual-drift",
      GRADUAL_DRIFT_OUTCOMES,
    ),
  ];

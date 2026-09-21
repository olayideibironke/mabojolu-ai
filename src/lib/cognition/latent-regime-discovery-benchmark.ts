import {
  DEFAULT_META_ADAPTATION_POLICIES,
  MetaAdaptationController,
  scoreMetaAdaptationEpisode,
  type MetaAdaptationEnvironmentFamily,
  type MetaAdaptationEpisode,
} from "./meta-adaptation";

import {
  LatentRegimeDiscoveryController,
  type LatentRegimeAuditSummary,
} from "./latent-regime-discovery";

import {
  DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK,
  type EnvironmentFamilyInductionBenchmarkEpisode,
} from "./environment-family-induction-benchmark";

import type {
  AutonomousEpisodeOutcome,
} from "./environment-family-induction";

import type {
  MetaAdaptationBenchmarkPhase,
  MetaAdaptationBenchmarkSystemMetrics,
} from "./meta-adaptation-benchmark";

export interface LatentRegimeBenchmarkEpisodeResult {
  episodeId: string;
  phase: MetaAdaptationBenchmarkPhase;
  evaluatorFamily: MetaAdaptationEnvironmentFamily;
  latentRegimeId?: string;
  latentDecision:
    | "new-regime"
    | "existing-regime"
    | "membership-abstention"
    | "capacity-abstention";
  latentPolicyReason:
    | "regime-exploration"
    | "regime-evidence"
    | "uncertainty-fallback";
  reactivatedRegime: boolean;
  latentPolicyId: string;
  labelSuppliedPolicyId: string;
  staticPolicyId: string;
  oraclePolicyId: string;
  latentUtility: number;
  labelSuppliedUtility: number;
  staticUtility: number;
  oracleUtility: number;
  latentRegret: number;
  labelSuppliedRegret: number;
}

export interface LatentRegimeDiscoveryMetrics {
  episodes: number;
  assignedEpisodes: number;
  newRegimeAssignments: number;
  existingRegimeAssignments: number;
  abstentions: number;
  reactivations: number;
  uniqueRegimes: number;
  assignmentCoverage: number;
  clusterPurity: number;
}

export interface LatentRegimeBenchmarkSlice {
  latent: MetaAdaptationBenchmarkSystemMetrics;
  labelSupplied: MetaAdaptationBenchmarkSystemMetrics;
  staticBaseline: MetaAdaptationBenchmarkSystemMetrics;
  discovery: LatentRegimeDiscoveryMetrics;
  latentCumulativeRegret: number;
  labelSuppliedCumulativeRegret: number;
}

export interface LatentRegimeBenchmarkReport {
  episodes: LatentRegimeBenchmarkEpisodeResult[];
  overall: LatentRegimeBenchmarkSlice;
  calibration: LatentRegimeBenchmarkSlice;
  heldOut: LatentRegimeBenchmarkSlice;
  latentAudit: LatentRegimeAuditSummary;
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

function emptyMetrics():
  MutableMetrics {
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
      `Latent-regime benchmark episode ${benchmarkEpisode.id} is missing outcome for policy ${policyId}.`,
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
  return {
    trueRegimeChange:
      episode.trueRegimeChange,

    changeDetected:
      episode.changeDetected,

    ...(episode.detectionDelay !==
      undefined
      ? {
          detectionDelay:
            episode.detectionDelay,
        }
      : {}),

    recoverySucceeded:
      episode.recoverySucceeded,

    falsePromotion:
      episode.falsePromotion,

    validationEvidenceCost:
      episode.validationEvidenceCost,

    ...(episode.unsafeIrreversibleAction !==
      undefined
      ? {
          unsafeIrreversibleAction:
            episode.unsafeIrreversibleAction,
        }
      : {}),
  };
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

function discoveryMetrics(
  results:
    readonly LatentRegimeBenchmarkEpisodeResult[],
): LatentRegimeDiscoveryMetrics {
  const assigned =
    results.filter(
      (result) =>
        result.latentRegimeId !==
        undefined,
    );

  const regimeIds =
    new Set(
      assigned.map(
        (result) =>
          result.latentRegimeId!,
      ),
    );

  const countsByRegime =
    new Map<
      string,
      Map<
        MetaAdaptationEnvironmentFamily,
        number
      >
    >();

  for (
    const result of
      assigned
  ) {
    const regimeId =
      result.latentRegimeId!;

    const counts =
      countsByRegime.get(
        regimeId,
      ) ??
      new Map<
        MetaAdaptationEnvironmentFamily,
        number
      >();

    counts.set(
      result.evaluatorFamily,
      (
        counts.get(
          result.evaluatorFamily,
        ) ??
        0
      ) +
        1,
    );

    countsByRegime.set(
      regimeId,
      counts,
    );
  }

  let majorityAssignments =
    0;

  for (
    const counts of
      countsByRegime.values()
  ) {
    majorityAssignments +=
      Math.max(
        ...Array.from(
          counts.values(),
        ),
      );
  }

  const newRegimeAssignments =
    results.filter(
      (result) =>
        result.latentDecision ===
        "new-regime",
    ).length;

  const existingRegimeAssignments =
    results.filter(
      (result) =>
        result.latentDecision ===
        "existing-regime",
    ).length;

  const abstentions =
    results.length -
    assigned.length;

  const reactivations =
    results.filter(
      (result) =>
        result.reactivatedRegime,
    ).length;

  return {
    episodes:
      results.length,

    assignedEpisodes:
      assigned.length,

    newRegimeAssignments,

    existingRegimeAssignments,

    abstentions,

    reactivations,

    uniqueRegimes:
      regimeIds.size,

    assignmentCoverage:
      results.length >
        0
        ? assigned.length /
          results.length
        : 0,

    clusterPurity:
      assigned.length >
        0
        ? majorityAssignments /
          assigned.length
        : 0,
  };
}

function buildSlice(
  results:
    readonly LatentRegimeBenchmarkEpisodeResult[],

  episodes:
    readonly EnvironmentFamilyInductionBenchmarkEpisode[],
): LatentRegimeBenchmarkSlice {
  const latentMetrics =
    emptyMetrics();

  const labelMetrics =
    emptyMetrics();

  const staticMetrics =
    emptyMetrics();

  let latentCumulativeRegret =
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
        `Missing latent-regime benchmark episode ${result.episodeId} while building report.`,
      );
    }

    const latentEpisode =
      materializeEpisode(
        benchmarkEpisode,
        result.latentPolicyId,
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
      latentMetrics,
      latentEpisode,
      result.latentUtility,
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

    latentCumulativeRegret +=
      result.latentRegret;

    labelSuppliedCumulativeRegret +=
      result.labelSuppliedRegret;
  }

  return {
    latent:
      freezeMetrics(
        latentMetrics,
      ),

    labelSupplied:
      freezeMetrics(
        labelMetrics,
      ),

    staticBaseline:
      freezeMetrics(
        staticMetrics,
      ),

    discovery:
      discoveryMetrics(
        results,
      ),

    latentCumulativeRegret,

    labelSuppliedCumulativeRegret,
  };
}

export function runLatentRegimeDiscoveryBenchmark(
  episodes:
    readonly EnvironmentFamilyInductionBenchmarkEpisode[] =
      DEFAULT_ENVIRONMENT_FAMILY_INDUCTION_BENCHMARK,
): LatentRegimeBenchmarkReport {
  if (
    episodes.length ===
      0
  ) {
    throw new Error(
      "Latent-regime discovery benchmark requires at least one episode.",
    );
  }

  const labelController =
    new MetaAdaptationController();

  const latentController =
    new LatentRegimeDiscoveryController();

  const staticPolicyId =
    "balanced";

  const results:
    LatentRegimeBenchmarkEpisodeResult[] =
      [];

  for (
    const benchmarkEpisode of
      episodes
  ) {
    const labelSelection =
      labelController.selectPolicy(
        benchmarkEpisode.family,
      );

    const latentSelection =
      latentController.selectPolicy(
        benchmarkEpisode.observation,
      );

    const labelEpisode =
      materializeEpisode(
        benchmarkEpisode,
        labelSelection.policy.id,
      );

    const latentEpisode =
      materializeEpisode(
        benchmarkEpisode,
        latentSelection.policy.id,
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

    const latentUtility =
      scoreMetaAdaptationEpisode(
        latentEpisode,
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
        `Latent-regime benchmark episode ${benchmarkEpisode.id} could not determine an oracle policy.`,
      );
    }

    results.push({
      episodeId:
        benchmarkEpisode.id,

      phase:
        benchmarkEpisode.phase,

      evaluatorFamily:
        benchmarkEpisode.family,

      latentRegimeId:
        latentSelection.regimeId,

      latentDecision:
        latentSelection.decision,

      latentPolicyReason:
        latentSelection.policyReason,

      reactivatedRegime:
        latentSelection.reactivatedRegime,

      latentPolicyId:
        latentSelection.policy.id,

      labelSuppliedPolicyId:
        labelSelection.policy.id,

      staticPolicyId,

      oraclePolicyId,

      latentUtility,

      labelSuppliedUtility,

      staticUtility,

      oracleUtility,

      latentRegret:
        Math.max(
          0,
          oracleUtility -
            latentUtility,
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

    latentController.recordEpisode(
      latentSelection,
      outcomeOnly(
        latentEpisode,
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

    latentAudit:
      latentController
        .getAuditSummary(),
  };
}

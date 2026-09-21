import {
  DEFAULT_META_ADAPTATION_POLICIES,
  scoreMetaAdaptationEpisode,
  type MetaAdaptationEpisode,
} from "./meta-adaptation";

import {
  AdaptiveLatentRegimeStructureController,
  type AdaptiveStructureRevision,
} from "./adaptive-latent-regime-structure";

import {
  LatentRegimeDiscoveryController,
} from "./latent-regime-discovery";

import type {
  AutonomousEpisodeOutcome,
  EnvironmentSignalObservation,
} from "./environment-family-induction";

export type AdaptiveStructureBenchmarkContext =
  | "mode-low"
  | "mode-high";

export interface AdaptiveStructureBenchmarkEpisode {
  id: string;
  phase:
    | "pre-revision"
    | "post-revision-calibration"
    | "held-out";
  context: AdaptiveStructureBenchmarkContext;
  observation: EnvironmentSignalObservation;
}

export interface AdaptiveStructureBenchmarkEpisodeResult {
  episodeId: string;
  phase:
    AdaptiveStructureBenchmarkEpisode["phase"];
  context: AdaptiveStructureBenchmarkContext;
  adaptivePolicyId: string;
  frozenPolicyId: string;
  staticPolicyId: string;
  oraclePolicyId: string;
  adaptiveUtility: number;
  frozenUtility: number;
  staticUtility: number;
  oracleUtility: number;
  adaptiveRegret: number;
  frozenRegret: number;
  staticRegret: number;
}

export interface AdaptiveStructureBenchmarkSlice {
  episodes: number;
  adaptiveCumulativeUtility: number;
  frozenCumulativeUtility: number;
  staticCumulativeUtility: number;
  adaptiveCumulativeRegret: number;
  frozenCumulativeRegret: number;
  staticCumulativeRegret: number;
}

export interface AdaptiveStructureBenchmarkReport {
  episodes: AdaptiveStructureBenchmarkEpisodeResult[];
  revision: AdaptiveStructureRevision;
  overall: AdaptiveStructureBenchmarkSlice;
  heldOut: AdaptiveStructureBenchmarkSlice;
  finalRegimeCount: number;
  splitCount: number;
  mergeCount: number;
  featureWeights: EnvironmentSignalObservation;
}

const LOW_OBSERVATION:
  EnvironmentSignalObservation = {
    recentErrorRate:
      0.2,
    errorBurstiness:
      0.3,
    driftConfidence:
      0.4,
    changePointStrength:
      0.2,
    priorRegimeSimilarity:
      0.25,
    trendPersistence:
      0.5,
  };

const HIGH_OBSERVATION:
  EnvironmentSignalObservation = {
    ...LOW_OBSERVATION,

    changePointStrength:
      0.65,
  };

function lowOutcomeForPolicy(
  policyId:
    string,
): AutonomousEpisodeOutcome {
  switch (
    policyId
  ) {
    case "conservative":
      return {
        trueRegimeChange:
          false,
        changeDetected:
          false,
        recoverySucceeded:
          true,
        falsePromotion:
          false,
        validationEvidenceCost:
          0,
      };

    case "balanced":
      return {
        trueRegimeChange:
          false,
        changeDetected:
          true,
        recoverySucceeded:
          true,
        falsePromotion:
          false,
        validationEvidenceCost:
          0,
      };

    case "responsive":
      return {
        trueRegimeChange:
          true,
        changeDetected:
          false,
        recoverySucceeded:
          false,
        falsePromotion:
          false,
        validationEvidenceCost:
          0,
      };

    default:
      throw new Error(
        `Unknown benchmark policy: ${policyId}`,
      );
  }
}

function highOutcomeForPolicy(
  policyId:
    string,
): AutonomousEpisodeOutcome {
  switch (
    policyId
  ) {
    case "conservative":
      return {
        trueRegimeChange:
          true,
        changeDetected:
          false,
        recoverySucceeded:
          false,
        falsePromotion:
          false,
        validationEvidenceCost:
          0,
      };

    case "balanced":
      return {
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
      };

    case "responsive":
      return {
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
      };

    default:
      throw new Error(
        `Unknown benchmark policy: ${policyId}`,
      );
  }
}

function outcomeFor(
  context:
    AdaptiveStructureBenchmarkContext,

  policyId:
    string,
): AutonomousEpisodeOutcome {
  return context ===
      "mode-low"
    ? lowOutcomeForPolicy(
        policyId,
      )
    : highOutcomeForPolicy(
        policyId,
      );
}

function scoreOutcome(
  policyId:
    string,

  outcome:
    AutonomousEpisodeOutcome,
): number {
  const episode:
    MetaAdaptationEpisode = {
    family:
      "unknown",

    policyId,

    ...outcome,
  };

  return scoreMetaAdaptationEpisode(
    episode,
  );
}

function benchmarkEpisode(
  id:
    string,

  phase:
    AdaptiveStructureBenchmarkEpisode["phase"],

  context:
    AdaptiveStructureBenchmarkContext,
): AdaptiveStructureBenchmarkEpisode {
  return {
    id,
    phase,
    context,
    observation:
      context ===
        "mode-low"
        ? {
            ...LOW_OBSERVATION,
          }
        : {
            ...HIGH_OBSERVATION,
          },
  };
}

export const DEFAULT_ADAPTIVE_STRUCTURE_BENCHMARK:
  readonly AdaptiveStructureBenchmarkEpisode[] = [
    ...Array.from(
      {
        length:
          8,
      },
      (
        _,
        index,
      ) =>
        benchmarkEpisode(
          `pre-low-${index + 1}`,
          "pre-revision",
          "mode-low",
        ),
    ),

    ...Array.from(
      {
        length:
          3,
      },
      (
        _,
        index,
      ) =>
        benchmarkEpisode(
          `pre-high-${index + 1}`,
          "pre-revision",
          "mode-high",
        ),
    ),

    ...Array.from(
      {
        length:
          3,
      },
      (
        _,
        index,
      ) =>
        benchmarkEpisode(
          `post-low-${index + 1}`,
          "post-revision-calibration",
          "mode-low",
        ),
    ),

    ...Array.from(
      {
        length:
          3,
      },
      (
        _,
        index,
      ) =>
        benchmarkEpisode(
          `post-high-${index + 1}`,
          "post-revision-calibration",
          "mode-high",
        ),
    ),

    ...Array.from(
      {
        length:
          4,
      },
      (
        _,
        index,
      ) => [
        benchmarkEpisode(
          `held-low-${index + 1}`,
          "held-out",
          "mode-low",
        ),
        benchmarkEpisode(
          `held-high-${index + 1}`,
          "held-out",
          "mode-high",
        ),
      ],
    ).flat(),
  ];

function buildSlice(
  results:
    readonly AdaptiveStructureBenchmarkEpisodeResult[],
): AdaptiveStructureBenchmarkSlice {
  return {
    episodes:
      results.length,

    adaptiveCumulativeUtility:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.adaptiveUtility,
        0,
      ),

    frozenCumulativeUtility:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.frozenUtility,
        0,
      ),

    staticCumulativeUtility:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.staticUtility,
        0,
      ),

    adaptiveCumulativeRegret:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.adaptiveRegret,
        0,
      ),

    frozenCumulativeRegret:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.frozenRegret,
        0,
      ),

    staticCumulativeRegret:
      results.reduce(
        (
          total,
          episode,
        ) =>
          total +
          episode.staticRegret,
        0,
      ),
  };
}

export function runAdaptiveStructureBenchmark(
  episodes:
    readonly AdaptiveStructureBenchmarkEpisode[] =
      DEFAULT_ADAPTIVE_STRUCTURE_BENCHMARK,
): AdaptiveStructureBenchmarkReport {
  const adaptive =
    new AdaptiveLatentRegimeStructureController(
      undefined,
      0.12,
      0.008,
      8,
      undefined,
      9,
      2,
      0.5,
      0.15,
    );

  const frozen =
    new LatentRegimeDiscoveryController(
      undefined,
      0.12,
      0.008,
      8,
    );

  const results:
    AdaptiveStructureBenchmarkEpisodeResult[] =
      [];

  let revision:
    AdaptiveStructureRevision = {
    events:
      [],
    featureWeights: {
      recentErrorRate:
        1,
      errorBurstiness:
        1,
      driftConfidence:
        1,
      changePointStrength:
        1,
      priorRegimeSimilarity:
        1,
      trendPersistence:
        1,
    },
  };

  for (
    const episode of
      episodes
  ) {
    if (
      episode.phase ===
        "post-revision-calibration" &&
      revision.events.length ===
        0
    ) {
      revision =
        adaptive.reviseStructure();
    }

    const adaptiveSelection =
      adaptive.selectPolicy(
        episode.observation,
      );

    const frozenSelection =
      frozen.selectPolicy(
        episode.observation,
      );

    const adaptiveOutcome =
      outcomeFor(
        episode.context,
        adaptiveSelection
          .policy
          .id,
      );

    const frozenOutcome =
      outcomeFor(
        episode.context,
        frozenSelection
          .policy
          .id,
      );

    const staticPolicyId =
      "balanced";

    const staticOutcome =
      outcomeFor(
        episode.context,
        staticPolicyId,
      );

    const adaptiveUtility =
      adaptive.recordEpisode(
        adaptiveSelection,
        adaptiveOutcome,
      );

    const frozenUtility =
      frozen.recordEpisode(
        frozenSelection,
        frozenOutcome,
      );

    const staticUtility =
      scoreOutcome(
        staticPolicyId,
        staticOutcome,
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
      const utility =
        scoreOutcome(
          policy.id,
          outcomeFor(
            episode.context,
            policy.id,
          ),
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
        `Adaptive structure benchmark episode ${episode.id} could not determine an oracle policy.`,
      );
    }

    results.push({
      episodeId:
        episode.id,

      phase:
        episode.phase,

      context:
        episode.context,

      adaptivePolicyId:
        adaptiveSelection
          .policy
          .id,

      frozenPolicyId:
        frozenSelection
          .policy
          .id,

      staticPolicyId,

      oraclePolicyId,

      adaptiveUtility,

      frozenUtility,

      staticUtility,

      oracleUtility,

      adaptiveRegret:
        Math.max(
          0,
          oracleUtility -
            adaptiveUtility,
        ),

      frozenRegret:
        Math.max(
          0,
          oracleUtility -
            frozenUtility,
        ),

      staticRegret:
        Math.max(
          0,
          oracleUtility -
            staticUtility,
        ),
    });
  }

  const heldOut =
    results.filter(
      (episode) =>
        episode.phase ===
        "held-out",
    );

  const audit =
    adaptive.getAuditSummary();

  return {
    episodes:
      results,

    revision,

    overall:
      buildSlice(
        results,
      ),

    heldOut:
      buildSlice(
        heldOut,
      ),

    finalRegimeCount:
      audit.regimeCount,

    splitCount:
      audit.splitCount,

    mergeCount:
      audit.mergeCount,

    featureWeights:
      audit.featureWeights,
  };
}

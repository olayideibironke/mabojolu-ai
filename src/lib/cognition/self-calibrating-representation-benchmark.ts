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
  DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES,
  SelfCalibratingRepresentationSelector,
  encodeRepresentationObservation,
  type RepresentationCalibrationDecision,
  type RepresentationEvaluation,
  type RepresentationRollbackDecision,
  type SelfCalibratingRepresentationProfile,
} from "./self-calibrating-representation";

import type {
  AutonomousEpisodeOutcome,
  EnvironmentSignalObservation,
} from "./environment-family-induction";

export type SelfCalibrationContext =
  | "mode-low"
  | "mode-high";

export interface SelfCalibrationEvaluationEpisode {
  id: string;
  context: SelfCalibrationContext;
  observation: EnvironmentSignalObservation;
}

export interface SelfCalibrationProfileResult {
  profileId: string;
  episodes: number;
  cumulativeUtility: number;
  cumulativeRegret: number;
  abstentions: number;
  oracleMatches: number;
  unsafeIrreversibleActions: number;
  falsePromotions: number;
}

export interface SelfCalibratingRepresentationBenchmarkReport {
  validationResults: SelfCalibrationProfileResult[];
  calibrationDecision: RepresentationCalibrationDecision;
  finalChampionResult: SelfCalibrationProfileResult;
  finalArchivedChampionResult: SelfCalibrationProfileResult;
  rollbackDecision: RepresentationRollbackDecision;
  championProfileId: string;
  championRevision: AdaptiveStructureRevision;
}

const LOW_CALIBRATION:
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

const HIGH_CALIBRATION:
  EnvironmentSignalObservation = {
    ...LOW_CALIBRATION,

    changePointStrength:
      0.65,
  };

function shiftedObservation(
  context:
    SelfCalibrationContext,

  lowChangePoint:
    number,

  highChangePoint:
    number,
): EnvironmentSignalObservation {
  return {
    ...LOW_CALIBRATION,

    changePointStrength:
      context ===
        "mode-low"
        ? lowChangePoint
        : highChangePoint,
  };
}

export const DEFAULT_REPRESENTATION_VALIDATION_EPISODES:
  readonly SelfCalibrationEvaluationEpisode[] = [
    {
      id:
        "validation-low-1",

      context:
        "mode-low",

      observation:
        shiftedObservation(
          "mode-low",
          0.415,
          0.435,
        ),
    },
    {
      id:
        "validation-high-1",

      context:
        "mode-high",

      observation:
        shiftedObservation(
          "mode-high",
          0.415,
          0.435,
        ),
    },
    {
      id:
        "validation-low-2",

      context:
        "mode-low",

      observation:
        shiftedObservation(
          "mode-low",
          0.415,
          0.435,
        ),
    },
    {
      id:
        "validation-high-2",

      context:
        "mode-high",

      observation:
        shiftedObservation(
          "mode-high",
          0.415,
          0.435,
        ),
    },
  ];

export const DEFAULT_REPRESENTATION_FINAL_EPISODES:
  readonly SelfCalibrationEvaluationEpisode[] = [
    ...Array.from(
      {
        length:
          4,
      },
      (
        _,
        index,
      ) => [
        {
          id:
            `final-low-${index + 1}`,

          context:
            "mode-low" as const,

          observation:
            shiftedObservation(
              "mode-low",
              0.417,
              0.433,
            ),
        },
        {
          id:
            `final-high-${index + 1}`,

          context:
            "mode-high" as const,

          observation:
            shiftedObservation(
              "mode-high",
              0.417,
              0.433,
            ),
        },
      ],
    ).flat(),
  ];

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
        `Unknown self-calibration benchmark policy: ${policyId}`,
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
        `Unknown self-calibration benchmark policy: ${policyId}`,
      );
  }
}

function outcomeFor(
  context:
    SelfCalibrationContext,

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

function trainProfile(
  profile:
    SelfCalibratingRepresentationProfile,
): {
  controller:
    AdaptiveLatentRegimeStructureController;
  revision:
    AdaptiveStructureRevision;
} {
  const controller =
    new AdaptiveLatentRegimeStructureController(
      undefined,
      profile
        .assignmentDistanceThreshold,
      profile
        .ambiguityMarginThreshold,
      8,
      undefined,
      9,
      2,
      profile
        .minimumSplitUtilityGap,
      profile
        .minimumSplitFeatureSeparation,
    );

  const calibrationSequence = [
    ...Array.from(
      {
        length:
          8,
      },
      () => ({
        context:
          "mode-low" as const,

        observation:
          LOW_CALIBRATION,
      }),
    ),

    ...Array.from(
      {
        length:
          3,
      },
      () => ({
        context:
          "mode-high" as const,

        observation:
          HIGH_CALIBRATION,
      }),
    ),
  ];

  for (
    const episode of
      calibrationSequence
  ) {
    const encoded =
      encodeRepresentationObservation(
        profile,
        episode.observation,
      );

    const selection =
      controller.selectPolicy(
        encoded,
      );

    controller.recordEpisode(
      selection,
      outcomeFor(
        episode.context,
        selection.policy.id,
      ),
    );
  }

  const revision =
    controller.reviseStructure();

  if (
    revision.events.length ===
      0
  ) {
    throw new Error(
      `Representation profile ${profile.id} failed to produce the expected calibration revision.`,
    );
  }

  for (
    const context of
      [
        "mode-low",
        "mode-high",
      ] as const
  ) {
    const observation =
      context ===
        "mode-low"
        ? LOW_CALIBRATION
        : HIGH_CALIBRATION;

    for (
      let index =
        0;
      index <
        3;
      index +=
        1
    ) {
      const encoded =
        encodeRepresentationObservation(
          profile,
          observation,
        );

      const selection =
        controller.selectPolicy(
          encoded,
        );

      controller.recordEpisode(
        selection,
        outcomeFor(
          context,
          selection.policy.id,
        ),
      );
    }
  }

  return {
    controller,
    revision,
  };
}

function evaluateProfile(
  profile:
    SelfCalibratingRepresentationProfile,

  episodes:
    readonly SelfCalibrationEvaluationEpisode[],
): SelfCalibrationProfileResult {
  let cumulativeUtility =
    0;

  let cumulativeRegret =
    0;

  let abstentions =
    0;

  let oracleMatches =
    0;

  let unsafeIrreversibleActions =
    0;

  let falsePromotions =
    0;

  for (
    const evaluationEpisode of
      episodes
  ) {
    const {
      controller,
    } =
      trainProfile(
        profile,
      );

    const encoded =
      encodeRepresentationObservation(
        profile,
        evaluationEpisode
          .observation,
      );

    const selection =
      controller.selectPolicy(
        encoded,
      );

    if (
      selection.decision ===
        "membership-abstention" ||
      selection.decision ===
        "capacity-abstention"
    ) {
      abstentions +=
        1;
    }

    const selectedOutcome =
      outcomeFor(
        evaluationEpisode
          .context,
        selection.policy.id,
      );

    const selectedUtility =
      scoreOutcome(
        selection.policy.id,
        selectedOutcome,
      );

    cumulativeUtility +=
      selectedUtility;

    if (
      selectedOutcome
        .unsafeIrreversibleAction
    ) {
      unsafeIrreversibleActions +=
        1;
    }

    if (
      selectedOutcome
        .falsePromotion
    ) {
      falsePromotions +=
        1;
    }

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
            evaluationEpisode
              .context,
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
        `Self-calibration episode ${evaluationEpisode.id} could not determine an oracle policy.`,
      );
    }

    if (
      selection.policy.id ===
        oraclePolicyId
    ) {
      oracleMatches +=
        1;
    }

    cumulativeRegret +=
      Math.max(
        0,
        oracleUtility -
          selectedUtility,
      );
  }

  return {
    profileId:
      profile.id,

    episodes:
      episodes.length,

    cumulativeUtility,

    cumulativeRegret,

    abstentions,

    oracleMatches,

    unsafeIrreversibleActions,

    falsePromotions,
  };
}

function toEvaluation(
  result:
    SelfCalibrationProfileResult,
): RepresentationEvaluation {
  return {
    profileId:
      result.profileId,

    episodes:
      result.episodes,

    cumulativeRegret:
      result.cumulativeRegret,

    unsafeIrreversibleActions:
      result
        .unsafeIrreversibleActions,

    falsePromotions:
      result.falsePromotions,
  };
}

export function runSelfCalibratingRepresentationBenchmark():
  SelfCalibratingRepresentationBenchmarkReport {
  const selector =
    new SelfCalibratingRepresentationSelector();

  const validationResults =
    DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES.map(
      (profile) =>
        evaluateProfile(
          profile,
          DEFAULT_REPRESENTATION_VALIDATION_EPISODES,
        ),
    );

  for (
    const result of
      validationResults
  ) {
    selector.recordEvaluation(
      toEvaluation(
        result,
      ),
    );
  }

  const calibrationDecision =
    selector.chooseChampion();

  const championProfile =
    selector.getChampionProfile();

  const archivedProfileId =
    calibrationDecision
      .previousChampionProfileId ??
    "raw-default";

  const archivedProfile =
    selector.getProfile(
      archivedProfileId,
    );

  if (
    !archivedProfile
  ) {
    throw new Error(
      "Self-calibration benchmark could not recover the archived representation champion.",
    );
  }

  const finalChampionResult =
    evaluateProfile(
      championProfile,
      DEFAULT_REPRESENTATION_FINAL_EPISODES,
    );

  const finalArchivedChampionResult =
    evaluateProfile(
      archivedProfile,
      DEFAULT_REPRESENTATION_FINAL_EPISODES,
    );

  const rollbackDecision =
    selector.considerRollback(
      finalChampionResult
        .cumulativeRegret,

      finalArchivedChampionResult
        .cumulativeRegret,
    );

  const finalChampionProfile =
    selector.getChampionProfile();

  const {
    revision:
      championRevision,
  } =
    trainProfile(
      finalChampionProfile,
    );

  return {
    validationResults,

    calibrationDecision,

    finalChampionResult,

    finalArchivedChampionResult,

    rollbackDecision,

    championProfileId:
      finalChampionProfile.id,

    championRevision,
  };
}

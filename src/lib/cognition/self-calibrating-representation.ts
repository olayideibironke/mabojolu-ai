import type {
  EnvironmentSignalObservation,
} from "./environment-family-induction";

export type RepresentationEncoderId =
  | "raw"
  | "drift-compressed"
  | "recurrence-compressed";

export interface SelfCalibratingRepresentationProfile {
  id: string;
  encoder: RepresentationEncoderId;
  assignmentDistanceThreshold: number;
  ambiguityMarginThreshold: number;
  minimumSplitUtilityGap: number;
  minimumSplitFeatureSeparation: number;
}

export interface RepresentationEvaluation {
  profileId: string;
  episodes: number;
  cumulativeRegret: number;
  unsafeIrreversibleActions: number;
  falsePromotions: number;
}

export interface RepresentationCalibrationDecision {
  championProfileId: string;
  previousChampionProfileId?: string;
  promoted: boolean;
  reason:
    | "initial-champion-retained"
    | "validated-improvement"
    | "no-safe-improvement";
  improvement: number;
}

export interface RepresentationRollbackDecision {
  championProfileId: string;
  rolledBack: boolean;
  reason:
    | "champion-retained"
    | "validation-regression";
}

export interface RepresentationCalibrationAudit {
  championProfileId: string;
  archivedChampionProfileIds: string[];
  quarantinedProfileIds: string[];
  evaluations: RepresentationEvaluation[];
}

export const DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES:
  readonly SelfCalibratingRepresentationProfile[] = [
    {
      id:
        "raw-default",

      encoder:
        "raw",

      assignmentDistanceThreshold:
        0.12,

      ambiguityMarginThreshold:
        0.008,

      minimumSplitUtilityGap:
        0.5,

      minimumSplitFeatureSeparation:
        0.15,
    },
    {
      id:
        "raw-tight",

      encoder:
        "raw",

      assignmentDistanceThreshold:
        0.08,

      ambiguityMarginThreshold:
        0.0075,

      minimumSplitUtilityGap:
        0.45,

      minimumSplitFeatureSeparation:
        0.12,
    },
    {
      id:
        "drift-compressed",

      encoder:
        "drift-compressed",

      assignmentDistanceThreshold:
        0.1,

      ambiguityMarginThreshold:
        0.0005,

      minimumSplitUtilityGap:
        0.45,

      minimumSplitFeatureSeparation:
        0.1,
    },
    {
      id:
        "recurrence-compressed",

      encoder:
        "recurrence-compressed",

      assignmentDistanceThreshold:
        0.1,

      ambiguityMarginThreshold:
        0.0075,

      minimumSplitUtilityGap:
        0.45,

      minimumSplitFeatureSeparation:
        0.1,
    },
  ] as const;

function clamp01(
  value:
    number,
): number {
  return Math.min(
    1,
    Math.max(
      0,
      value,
    ),
  );
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
}

function mean(
  values:
    readonly number[],
): number {
  return values.reduce(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  ) /
    values.length;
}

export function encodeRepresentationObservation(
  profile:
    SelfCalibratingRepresentationProfile,

  observation:
    EnvironmentSignalObservation,
): EnvironmentSignalObservation {
  validateObservation(
    observation,
  );

  if (
    profile.encoder ===
      "raw"
  ) {
    return {
      ...observation,
    };
  }

  const driftPressure =
    clamp01(
      mean([
        observation
          .recentErrorRate,
        observation
          .driftConfidence,
        observation
          .changePointStrength,
      ]),
    );

  const temporalInstability =
    clamp01(
      mean([
        observation
          .errorBurstiness,
        observation
          .trendPersistence,
        observation
          .changePointStrength,
      ]),
    );

  if (
    profile.encoder ===
      "drift-compressed"
  ) {
    return {
      recentErrorRate:
        driftPressure,

      errorBurstiness:
        temporalInstability,

      driftConfidence:
        driftPressure,

      changePointStrength:
        driftPressure,

      priorRegimeSimilarity:
        0.5,

      trendPersistence:
        temporalInstability,
    };
  }

  const recurrencePressure =
    clamp01(
      mean([
        observation
          .priorRegimeSimilarity,
        observation
          .driftConfidence,
        1 -
          observation
            .recentErrorRate,
      ]),
    );

  return {
    recentErrorRate:
      driftPressure,

    errorBurstiness:
      temporalInstability,

    driftConfidence:
      driftPressure,

    changePointStrength:
      temporalInstability,

    priorRegimeSimilarity:
      recurrencePressure,

    trendPersistence:
      recurrencePressure,
  };
}

function validateProfiles(
  profiles:
    readonly SelfCalibratingRepresentationProfile[],
): void {
  if (
    profiles.length <
      2
  ) {
    throw new Error(
      "Self-calibrating representation search requires at least two bounded profiles.",
    );
  }

  const seen =
    new Set<
      string
    >();

  for (
    const profile of
      profiles
  ) {
    if (
      !profile.id.trim()
    ) {
      throw new Error(
        "Representation profile id cannot be empty.",
      );
    }

    if (
      seen.has(
        profile.id,
      )
    ) {
      throw new Error(
        `Duplicate representation profile id: ${profile.id}`,
      );
    }

    seen.add(
      profile.id,
    );

    if (
      !Number.isFinite(
        profile.assignmentDistanceThreshold,
      ) ||
      profile.assignmentDistanceThreshold <=
        0 ||
      profile.assignmentDistanceThreshold >
        1
    ) {
      throw new Error(
        `Invalid assignment threshold for representation profile ${profile.id}.`,
      );
    }

    if (
      !Number.isFinite(
        profile.ambiguityMarginThreshold,
      ) ||
      profile.ambiguityMarginThreshold <
        0 ||
      profile.ambiguityMarginThreshold >
        profile.assignmentDistanceThreshold
    ) {
      throw new Error(
        `Invalid ambiguity threshold for representation profile ${profile.id}.`,
      );
    }
  }
}

export class SelfCalibratingRepresentationSelector {
  private readonly profileById =
    new Map<
      string,
      SelfCalibratingRepresentationProfile
    >();

  private championProfileId:
    string;

  private readonly archivedChampionProfileIds:
    string[] =
      [];

  private readonly quarantinedProfileIds =
    new Set<
      string
    >();

  private readonly evaluations =
    new Map<
      string,
      RepresentationEvaluation
    >();

  constructor(
    profiles:
      readonly SelfCalibratingRepresentationProfile[] =
        DEFAULT_SELF_CALIBRATING_REPRESENTATION_PROFILES,

    initialChampionProfileId =
      "raw-default",

    private readonly minimumPromotionImprovement =
      0.05,

    private readonly rollbackTolerance =
      0.05,
  ) {
    validateProfiles(
      profiles,
    );

    for (
      const profile of
        profiles
    ) {
      this.profileById.set(
        profile.id,
        {
          ...profile,
        },
      );
    }

    if (
      !this.profileById.has(
        initialChampionProfileId,
      )
    ) {
      throw new Error(
        `Unknown initial representation champion: ${initialChampionProfileId}`,
      );
    }

    this.championProfileId =
      initialChampionProfileId;
  }

  recordEvaluation(
    evaluation:
      RepresentationEvaluation,
  ): void {
    if (
      !this.profileById.has(
        evaluation.profileId,
      )
    ) {
      throw new Error(
        `Unknown representation profile: ${evaluation.profileId}`,
      );
    }

    if (
      !Number.isInteger(
        evaluation.episodes,
      ) ||
      evaluation.episodes <=
        0
    ) {
      throw new Error(
        "Representation evaluation episodes must be a positive integer.",
      );
    }

    if (
      !Number.isFinite(
        evaluation.cumulativeRegret,
      ) ||
      evaluation.cumulativeRegret <
        0
    ) {
      throw new Error(
        "Representation evaluation regret must be a non-negative finite number.",
      );
    }

    if (
      evaluation.unsafeIrreversibleActions >
        0 ||
      evaluation.falsePromotions >
        0
    ) {
      this.quarantinedProfileIds.add(
        evaluation.profileId,
      );
    }

    this.evaluations.set(
      evaluation.profileId,
      {
        ...evaluation,
      },
    );
  }

  chooseChampion():
    RepresentationCalibrationDecision {
    const championEvaluation =
      this.evaluations.get(
        this.championProfileId,
      );

    if (
      !championEvaluation
    ) {
      throw new Error(
        "The current representation champion must be evaluated before calibration.",
      );
    }

    let best:
      RepresentationEvaluation |
      undefined;

    for (
      const evaluation of
        this.evaluations.values()
    ) {
      if (
        this.quarantinedProfileIds.has(
          evaluation.profileId,
        )
      ) {
        continue;
      }

      if (
        !best ||
        evaluation.cumulativeRegret <
          best.cumulativeRegret -
            Number.EPSILON
      ) {
        best =
          evaluation;
      }
    }

    if (
      !best
    ) {
      throw new Error(
        "All evaluated representation profiles are quarantined; refusing unsafe self-calibration.",
      );
    }

    const championUnsafe =
      this.quarantinedProfileIds.has(
        this.championProfileId,
      );

    const improvement =
      championEvaluation
        .cumulativeRegret -
      best.cumulativeRegret;

    if (
      best.profileId ===
        this.championProfileId &&
      !championUnsafe
    ) {
      return {
        championProfileId:
          this.championProfileId,

        promoted:
          false,

        reason:
          "initial-champion-retained",

        improvement:
          0,
      };
    }

    if (
      !championUnsafe &&
      improvement <
        this.minimumPromotionImprovement
    ) {
      return {
        championProfileId:
          this.championProfileId,

        promoted:
          false,

        reason:
          "no-safe-improvement",

        improvement,
      };
    }

    const previousChampionProfileId =
      this.championProfileId;

    this.archivedChampionProfileIds.push(
      previousChampionProfileId,
    );

    this.championProfileId =
      best.profileId;

    return {
      championProfileId:
        this.championProfileId,

      previousChampionProfileId,

      promoted:
        true,

      reason:
        "validated-improvement",

      improvement,
    };
  }

  considerRollback(
    championFinalRegret:
      number,

    archivedFinalRegret:
      number,
  ): RepresentationRollbackDecision {
    const previousChampionProfileId =
      this.archivedChampionProfileIds[
        this.archivedChampionProfileIds.length -
          1
      ];

    if (
      !previousChampionProfileId
    ) {
      return {
        championProfileId:
          this.championProfileId,

        rolledBack:
          false,

        reason:
          "champion-retained",
      };
    }

    if (
      championFinalRegret <=
        archivedFinalRegret +
          this.rollbackTolerance
    ) {
      return {
        championProfileId:
          this.championProfileId,

        rolledBack:
          false,

        reason:
          "champion-retained",
      };
    }

    const failedChampion =
      this.championProfileId;

    this.quarantinedProfileIds.add(
      failedChampion,
    );

    this.championProfileId =
      previousChampionProfileId;

    return {
      championProfileId:
        this.championProfileId,

      rolledBack:
        true,

      reason:
        "validation-regression",
    };
  }

  getChampionProfile():
    SelfCalibratingRepresentationProfile {
    const profile =
      this.profileById.get(
        this.championProfileId,
      );

    if (
      !profile
    ) {
      throw new Error(
        "Representation champion store is inconsistent.",
      );
    }

    return {
      ...profile,
    };
  }

  getProfile(
    profileId:
      string,
  ):
    SelfCalibratingRepresentationProfile |
    undefined {
    const profile =
      this.profileById.get(
        profileId,
      );

    return profile
      ? {
          ...profile,
        }
      : undefined;
  }

  getAuditSummary():
    RepresentationCalibrationAudit {
    return {
      championProfileId:
        this.championProfileId,

      archivedChampionProfileIds: [
        ...this
          .archivedChampionProfileIds,
      ],

      quarantinedProfileIds:
        Array.from(
          this.quarantinedProfileIds,
        ),

      evaluations:
        Array.from(
          this.evaluations.values(),
        ).map(
          (evaluation) => ({
            ...evaluation,
          }),
        ),
    };
  }
}

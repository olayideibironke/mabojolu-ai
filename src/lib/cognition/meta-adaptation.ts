import {
  AdaptiveValidatedPredicateApplicabilityModel,
} from "./adaptive-predicate-champion";

export type MetaAdaptationEnvironmentFamily =
  | "stationary-noisy"
  | "gradual-drift"
  | "abrupt-drift"
  | "recurring-regime"
  | "unknown";

export interface MetaAdaptationPolicy {
  id: string;
  fitObservationTarget: number;
  validationObservationTarget: number;
  minimumValidationAccuracy: number;
  penaltyPerExtraOperation: number;
  driftMinimumEvidence: number;
  driftAccuracyThreshold: number;
  driftConfidenceThreshold: number;
  driftMaximumEvidence: number;
  sequentialEvidenceThreshold: number;
  maxChallengerAttemptsPerRegime: number;
  challengerValidationGrowthPerAttempt: number;
}

export interface MetaAdaptationEpisode {
  family: MetaAdaptationEnvironmentFamily;
  policyId: string;
  trueRegimeChange: boolean;
  changeDetected: boolean;
  detectionDelay?: number;
  recoverySucceeded: boolean;
  falsePromotion: boolean;
  validationEvidenceCost: number;
  unsafeIrreversibleAction?: boolean;
}

export interface MetaAdaptationPolicyEvidence {
  policyId: string;
  episodes: number;
  successes: number;
  failures: number;
  posteriorSuccessProbability: number;
  meanUtility: number;
  quarantined: boolean;
}

export interface MetaAdaptationSelection {
  family: MetaAdaptationEnvironmentFamily;
  policy: MetaAdaptationPolicy;
  reason:
    | "family-exploration"
    | "family-evidence"
    | "cross-family-transfer";
  score?: number;
}

export interface MetaAdaptationAuditSummary {
  totalEpisodes: number;
  quarantinedPolicyIds: string[];
  familyEvidence: Record<
    MetaAdaptationEnvironmentFamily,
    MetaAdaptationPolicyEvidence[]
  >;
  globalEvidence: MetaAdaptationPolicyEvidence[];
}

type MutablePolicyEvidence = {
  episodes: number;
  successes: number;
  failures: number;
  cumulativeUtility: number;
  quarantined: boolean;
};

const DEFAULT_BETA_PRIOR = 1;
const MINIMUM_TRANSFER_EPISODES = 3;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function emptyEvidence(): MutablePolicyEvidence {
  return {
    episodes: 0,
    successes: 0,
    failures: 0,
    cumulativeUtility: 0,
    quarantined: false,
  };
}

function validatePolicy(
  policy: MetaAdaptationPolicy,
): void {
  if (!policy.id.trim()) {
    throw new Error(
      "Meta-adaptation policy id cannot be empty.",
    );
  }

  if (
    !Number.isInteger(
      policy.fitObservationTarget,
    ) ||
    policy.fitObservationTarget < 4
  ) {
    throw new Error(
      "fitObservationTarget must be at least 4.",
    );
  }

  if (
    !Number.isInteger(
      policy.validationObservationTarget,
    ) ||
    policy.validationObservationTarget < 2
  ) {
    throw new Error(
      "validationObservationTarget must be at least 2.",
    );
  }

  if (
    !Number.isFinite(
      policy.minimumValidationAccuracy,
    ) ||
    policy.minimumValidationAccuracy <= 0.5 ||
    policy.minimumValidationAccuracy > 1
  ) {
    throw new Error(
      "minimumValidationAccuracy must be in (0.5, 1].",
    );
  }

  if (
    !Number.isFinite(
      policy.driftAccuracyThreshold,
    ) ||
    policy.driftAccuracyThreshold < 0 ||
    policy.driftAccuracyThreshold >=
      policy.minimumValidationAccuracy
  ) {
    throw new Error(
      "driftAccuracyThreshold must be below minimumValidationAccuracy.",
    );
  }

  if (
    !Number.isFinite(
      policy.driftConfidenceThreshold,
    ) ||
    policy.driftConfidenceThreshold <= 0.5 ||
    policy.driftConfidenceThreshold >= 1
  ) {
    throw new Error(
      "driftConfidenceThreshold must be in (0.5, 1).",
    );
  }

  if (
    !Number.isInteger(
      policy.driftMinimumEvidence,
    ) ||
    policy.driftMinimumEvidence < 2
  ) {
    throw new Error(
      "driftMinimumEvidence must be at least 2.",
    );
  }

  if (
    !Number.isInteger(
      policy.driftMaximumEvidence,
    ) ||
    policy.driftMaximumEvidence <
      policy.driftMinimumEvidence
  ) {
    throw new Error(
      "driftMaximumEvidence must be at least driftMinimumEvidence.",
    );
  }

  if (
    !Number.isFinite(
      policy.sequentialEvidenceThreshold,
    ) ||
    policy.sequentialEvidenceThreshold <= 0
  ) {
    throw new Error(
      "sequentialEvidenceThreshold must be positive.",
    );
  }

  if (
    !Number.isInteger(
      policy.maxChallengerAttemptsPerRegime,
    ) ||
    policy.maxChallengerAttemptsPerRegime < 1
  ) {
    throw new Error(
      "maxChallengerAttemptsPerRegime must be at least 1.",
    );
  }

  if (
    !Number.isInteger(
      policy.challengerValidationGrowthPerAttempt,
    ) ||
    policy.challengerValidationGrowthPerAttempt < 0
  ) {
    throw new Error(
      "challengerValidationGrowthPerAttempt must be non-negative.",
    );
  }
}

export const DEFAULT_META_ADAPTATION_POLICIES:
  readonly MetaAdaptationPolicy[] = [
    {
      id: "conservative",
      fitObservationTarget: 6,
      validationObservationTarget: 5,
      minimumValidationAccuracy: 0.8,
      penaltyPerExtraOperation: 0.05,
      driftMinimumEvidence: 5,
      driftAccuracyThreshold: 0.5,
      driftConfidenceThreshold: 0.95,
      driftMaximumEvidence: 16,
      sequentialEvidenceThreshold: Math.log(8),
      maxChallengerAttemptsPerRegime: 1,
      challengerValidationGrowthPerAttempt: 3,
    },
    {
      id: "balanced",
      fitObservationTarget: 6,
      validationObservationTarget: 3,
      minimumValidationAccuracy: 0.75,
      penaltyPerExtraOperation: 0.05,
      driftMinimumEvidence: 3,
      driftAccuracyThreshold: 0.5,
      driftConfidenceThreshold: 0.9,
      driftMaximumEvidence: 12,
      sequentialEvidenceThreshold: Math.log(4),
      maxChallengerAttemptsPerRegime: 2,
      challengerValidationGrowthPerAttempt: 2,
    },
    {
      id: "responsive",
      fitObservationTarget: 6,
      validationObservationTarget: 2,
      minimumValidationAccuracy: 0.7,
      penaltyPerExtraOperation: 0.05,
      driftMinimumEvidence: 2,
      driftAccuracyThreshold: 0.5,
      driftConfidenceThreshold: 0.8,
      driftMaximumEvidence: 8,
      sequentialEvidenceThreshold: Math.log(2),
      maxChallengerAttemptsPerRegime: 3,
      challengerValidationGrowthPerAttempt: 1,
    },
  ] as const;

const ENVIRONMENT_FAMILIES:
  readonly MetaAdaptationEnvironmentFamily[] = [
    "stationary-noisy",
    "gradual-drift",
    "abrupt-drift",
    "recurring-regime",
    "unknown",
  ];

export function createAdaptivePredicateModelForPolicy(
  policy: MetaAdaptationPolicy,
): AdaptiveValidatedPredicateApplicabilityModel {
  validatePolicy(
    policy,
  );

  return new AdaptiveValidatedPredicateApplicabilityModel(
    policy.fitObservationTarget,
    policy.validationObservationTarget,
    policy.minimumValidationAccuracy,
    policy.penaltyPerExtraOperation,
    policy.driftMinimumEvidence,
    policy.driftAccuracyThreshold,
    policy.driftConfidenceThreshold,
    policy.driftMaximumEvidence,
    policy.sequentialEvidenceThreshold,
    policy.maxChallengerAttemptsPerRegime,
    policy.challengerValidationGrowthPerAttempt,
  );
}

export class MetaAdaptationController {
  private readonly policies:
    readonly MetaAdaptationPolicy[];

  private readonly policyById =
    new Map<
      string,
      MetaAdaptationPolicy
    >();

  private readonly familyEvidence =
    new Map<
      MetaAdaptationEnvironmentFamily,
      Map<
        string,
        MutablePolicyEvidence
      >
    >();

  private readonly globalEvidence =
    new Map<
      string,
      MutablePolicyEvidence
    >();

  private totalEpisodes =
    0;

  constructor(
    policies:
      readonly MetaAdaptationPolicy[] =
        DEFAULT_META_ADAPTATION_POLICIES,
  ) {
    if (
      policies.length <
        2
    ) {
      throw new Error(
        "Meta-adaptation requires at least two bounded policies.",
      );
    }

    for (
      const policy of
        policies
    ) {
      validatePolicy(
        policy,
      );

      if (
        this.policyById.has(
          policy.id,
        )
      ) {
        throw new Error(
          `Duplicate meta-adaptation policy id: ${policy.id}`,
        );
      }

      this.policyById.set(
        policy.id,
        {
          ...policy,
        },
      );

      this.globalEvidence.set(
        policy.id,
        emptyEvidence(),
      );
    }

    this.policies =
      policies.map(
        (policy) => ({
          ...policy,
        }),
      );

    for (
      const family of
        ENVIRONMENT_FAMILIES
    ) {
      const evidence =
        new Map<
          string,
          MutablePolicyEvidence
        >();

      for (
        const policy of
          this.policies
      ) {
        evidence.set(
          policy.id,
          emptyEvidence(),
        );
      }

      this.familyEvidence.set(
        family,
        evidence,
      );
    }
  }

  selectPolicy(
    family:
      MetaAdaptationEnvironmentFamily,
  ): MetaAdaptationSelection {
    const familyStats =
      this.requireFamilyEvidence(
        family,
      );

    const safePolicies =
      this.policies.filter(
        (policy) =>
          !this.isQuarantined(
            policy.id,
          ),
      );

    if (
      safePolicies.length ===
        0
    ) {
      throw new Error(
        "All meta-adaptation policies are quarantined; refusing unsafe self-adaptation.",
      );
    }

    const untried =
      safePolicies.find(
        (policy) =>
          (
            familyStats.get(
              policy.id,
            )?.episodes ??
            0
          ) ===
          0,
      );

    const familyEpisodeCount =
      Array.from(
        familyStats.values(),
      ).reduce(
        (
          total,
          evidence,
        ) =>
          total +
          evidence.episodes,
        0,
      );

    if (
      untried &&
      familyEpisodeCount >
        0
    ) {
      return {
        family,
        policy: {
          ...untried,
        },
        reason:
          "family-exploration",
      };
    }

    if (
      familyEpisodeCount ===
        0 &&
      this.totalEpisodes >=
        MINIMUM_TRANSFER_EPISODES
    ) {
      const transferred =
        this.bestPolicyByEvidence(
          safePolicies,
          this.globalEvidence,
          this.totalEpisodes,
        );

      return {
        family,
        policy: {
          ...transferred.policy,
        },
        reason:
          "cross-family-transfer",
        score:
          transferred.score,
      };
    }

    if (
      untried
    ) {
      return {
        family,
        policy: {
          ...untried,
        },
        reason:
          "family-exploration",
      };
    }

    const selected =
      this.bestPolicyByEvidence(
        safePolicies,
        familyStats,
        familyEpisodeCount,
      );

    return {
      family,
      policy: {
        ...selected.policy,
      },
      reason:
        "family-evidence",
      score:
        selected.score,
    };
  }

  recordEpisode(
    episode:
      MetaAdaptationEpisode,
  ): number {
    const policy =
      this.policyById.get(
        episode.policyId,
      );

    if (
      !policy
    ) {
      throw new Error(
        `Unknown meta-adaptation policy: ${episode.policyId}`,
      );
    }

    if (
      !Number.isInteger(
        episode.validationEvidenceCost,
      ) ||
      episode.validationEvidenceCost <
        0
    ) {
      throw new Error(
        "validationEvidenceCost must be a non-negative integer.",
      );
    }

    if (
      episode.detectionDelay !==
        undefined &&
      (
        !Number.isInteger(
          episode.detectionDelay,
        ) ||
        episode.detectionDelay <
          0
      )
    ) {
      throw new Error(
        "detectionDelay must be a non-negative integer when provided.",
      );
    }

    const utility =
      this.episodeUtility(
        episode,
      );

    const success =
      utility >=
        0.2 &&
      !episode.falsePromotion &&
      !episode
        .unsafeIrreversibleAction;

    const familyStats =
      this.requireFamilyEvidence(
        episode.family,
      );

    const familyPolicyEvidence =
      familyStats.get(
        policy.id,
      );

    const globalPolicyEvidence =
      this.globalEvidence.get(
        policy.id,
      );

    if (
      !familyPolicyEvidence ||
      !globalPolicyEvidence
    ) {
      throw new Error(
        "Meta-adaptation evidence store is inconsistent.",
      );
    }

    this.updateEvidence(
      familyPolicyEvidence,
      utility,
      success,
      Boolean(
        episode
          .unsafeIrreversibleAction,
      ),
    );

    this.updateEvidence(
      globalPolicyEvidence,
      utility,
      success,
      Boolean(
        episode
          .unsafeIrreversibleAction,
      ),
    );

    this.totalEpisodes +=
      1;

    return utility;
  }

  getPolicy(
    policyId:
      string,
  ): MetaAdaptationPolicy |
    undefined {
    const policy =
      this.policyById.get(
        policyId,
      );

    return policy
      ? {
          ...policy,
        }
      : undefined;
  }

  getAuditSummary():
    MetaAdaptationAuditSummary {
    const familyEvidence =
      {} as Record<
        MetaAdaptationEnvironmentFamily,
        MetaAdaptationPolicyEvidence[]
      >;

    for (
      const family of
        ENVIRONMENT_FAMILIES
    ) {
      familyEvidence[
        family
      ] =
        this.policyEvidenceList(
          this.requireFamilyEvidence(
            family,
          ),
        );
    }

    return {
      totalEpisodes:
        this.totalEpisodes,

      quarantinedPolicyIds:
        this.policies
          .filter(
            (policy) =>
              this.isQuarantined(
                policy.id,
              ),
          )
          .map(
            (policy) =>
              policy.id,
          ),

      familyEvidence,

      globalEvidence:
        this.policyEvidenceList(
          this.globalEvidence,
        ),
    };
  }

  private requireFamilyEvidence(
    family:
      MetaAdaptationEnvironmentFamily,
  ): Map<
    string,
    MutablePolicyEvidence
  > {
    const evidence =
      this.familyEvidence.get(
        family,
      );

    if (
      !evidence
    ) {
      throw new Error(
        `Unknown environment family: ${family}`,
      );
    }

    return evidence;
  }

  private episodeUtility(
    episode:
      MetaAdaptationEpisode,
  ): number {
    if (
      episode
        .unsafeIrreversibleAction
    ) {
      return -1;
    }

    let utility =
      0;

    if (
      episode.trueRegimeChange
    ) {
      utility +=
        episode.changeDetected
          ? 0.35
          : -0.6;
    } else {
      utility +=
        episode.changeDetected
          ? -0.5
          : 0.3;
    }

    if (
      episode.recoverySucceeded
    ) {
      utility +=
        0.25;
    } else if (
      episode.trueRegimeChange
    ) {
      utility -=
        0.2;
    }

    if (
      episode.falsePromotion
    ) {
      utility -=
        0.5;
    }

    if (
      episode.changeDetected &&
      episode.trueRegimeChange
    ) {
      utility -=
        Math.min(
          0.25,
          (
            episode
              .detectionDelay ??
            0
          ) /
            40,
        );
    }

    utility -=
      Math.min(
        0.2,
        episode
          .validationEvidenceCost /
          100,
      );

    return clamp(
      utility,
      -1,
      1,
    );
  }

  private updateEvidence(
    evidence:
      MutablePolicyEvidence,

    utility:
      number,

    success:
      boolean,

    unsafe:
      boolean,
  ): void {
    evidence.episodes +=
      1;

    evidence.cumulativeUtility +=
      utility;

    if (
      success
    ) {
      evidence.successes +=
        1;
    } else {
      evidence.failures +=
        1;
    }

    if (
      unsafe
    ) {
      evidence.quarantined =
        true;
    }
  }

  private isQuarantined(
    policyId:
      string,
  ): boolean {
    return (
      this.globalEvidence.get(
        policyId,
      )?.quarantined ??
      false
    );
  }

  private bestPolicyByEvidence(
    policies:
      readonly MetaAdaptationPolicy[],

    evidenceByPolicy:
      ReadonlyMap<
        string,
        MutablePolicyEvidence
      >,

    totalEpisodeCount:
      number,
  ): {
    policy:
      MetaAdaptationPolicy;
    score:
      number;
  } {
    let best:
      {
        policy:
          MetaAdaptationPolicy;
        score:
          number;
      } |
      undefined;

    for (
      const policy of
        policies
    ) {
      const evidence =
        evidenceByPolicy.get(
          policy.id,
        ) ??
        emptyEvidence();

      const posteriorSuccessProbability =
        (
          evidence.successes +
          DEFAULT_BETA_PRIOR
        ) /
        (
          evidence.successes +
          evidence.failures +
          2 *
            DEFAULT_BETA_PRIOR
        );

      const meanUtility =
        evidence.episodes >
          0
          ? evidence
              .cumulativeUtility /
            evidence.episodes
          : 0;

      const normalizedUtility =
        (
          meanUtility +
          1
        ) /
        2;

      const explorationBonus =
        evidence.episodes >
          0
          ? 0.15 *
            Math.sqrt(
              Math.log(
                totalEpisodeCount +
                  2,
              ) /
                (
                  evidence.episodes +
                  1
                ),
            )
          : 0.15;

      const score =
        0.55 *
          posteriorSuccessProbability +
        0.45 *
          normalizedUtility +
        explorationBonus;

      if (
        !best ||
        score >
          best.score +
            Number.EPSILON
      ) {
        best = {
          policy,
          score,
        };
      }
    }

    if (
      !best
    ) {
      throw new Error(
        "No safe meta-adaptation policy could be selected.",
      );
    }

    return best;
  }

  private policyEvidenceList(
    evidenceByPolicy:
      ReadonlyMap<
        string,
        MutablePolicyEvidence
      >,
  ):
    MetaAdaptationPolicyEvidence[] {
    return this.policies.map(
      (policy) => {
        const evidence =
          evidenceByPolicy.get(
            policy.id,
          ) ??
          emptyEvidence();

        const posteriorSuccessProbability =
          (
            evidence.successes +
            DEFAULT_BETA_PRIOR
          ) /
          (
            evidence.successes +
            evidence.failures +
            2 *
              DEFAULT_BETA_PRIOR
          );

        return {
          policyId:
            policy.id,

          episodes:
            evidence.episodes,

          successes:
            evidence.successes,

          failures:
            evidence.failures,

          posteriorSuccessProbability,

          meanUtility:
            evidence.episodes >
              0
              ? evidence
                  .cumulativeUtility /
                evidence.episodes
              : 0,

          quarantined:
            evidence.quarantined,
        };
      },
    );
  }
}

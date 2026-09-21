import {
  DEFAULT_META_ADAPTATION_POLICIES,
  scoreMetaAdaptationEpisode,
  type MetaAdaptationEpisode,
  type MetaAdaptationPolicy,
} from "./meta-adaptation";

import type {
  AutonomousEpisodeOutcome,
  EnvironmentSignalObservation,
} from "./environment-family-induction";

export interface LatentRegimePolicyEvidence {
  policyId: string;
  episodes: number;
  successes: number;
  failures: number;
  posteriorSuccessProbability: number;
  meanUtility: number;
  quarantined: boolean;
}

export interface LatentRegimeSummary {
  id: string;
  centroid: EnvironmentSignalObservation;
  observationCount: number;
  activationCount: number;
  reactivationCount: number;
  lastSeenEpisode: number;
  policyEvidence: LatentRegimePolicyEvidence[];
}

export interface LatentRegimeAuditSummary {
  totalEpisodes: number;
  regimeCount: number;
  regimeCreationCount: number;
  totalReactivations: number;
  quarantinedPolicyIds: string[];
  regimes: LatentRegimeSummary[];
}

export interface LatentRegimeSelection {
  observation: EnvironmentSignalObservation;
  regimeId?: string;
  regimeDistance?: number;
  runnerUpDistance?: number;
  policy: MetaAdaptationPolicy;
  decision:
    | "new-regime"
    | "existing-regime"
    | "membership-abstention"
    | "capacity-abstention";
  policyReason:
    | "regime-exploration"
    | "regime-evidence"
    | "uncertainty-fallback";
  createdRegime: boolean;
  reactivatedRegime: boolean;
}

type MutablePolicyEvidence = {
  episodes: number;
  successes: number;
  failures: number;
  cumulativeUtility: number;
};

type MutableLatentRegime = {
  id: string;
  centroid: EnvironmentSignalObservation;
  observationCount: number;
  activationCount: number;
  reactivationCount: number;
  lastSeenEpisode: number;
  policyEvidence: Map<
    string,
    MutablePolicyEvidence
  >;
};

const FEATURE_WEIGHTS:
  Readonly<EnvironmentSignalObservation> = {
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

const DEFAULT_BETA_PRIOR =
  1;

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

function emptyEvidence():
  MutablePolicyEvidence {
  return {
    episodes:
      0,
    successes:
      0,
    failures:
      0,
    cumulativeUtility:
      0,
  };
}

function cloneObservation(
  observation:
    EnvironmentSignalObservation,
): EnvironmentSignalObservation {
  return {
    recentErrorRate:
      observation.recentErrorRate,
    errorBurstiness:
      observation.errorBurstiness,
    driftConfidence:
      observation.driftConfidence,
    changePointStrength:
      observation.changePointStrength,
    priorRegimeSimilarity:
      observation.priorRegimeSimilarity,
    trendPersistence:
      observation.trendPersistence,
  };
}

export function latentRegimeDistance(
  left:
    EnvironmentSignalObservation,

  right:
    EnvironmentSignalObservation,
): number {
  validateObservation(
    left,
  );

  validateObservation(
    right,
  );

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

    const difference =
      left[
        key
      ] -
      right[
        key
      ];

    weightedError +=
      weight *
      difference *
      difference;

    totalWeight +=
      weight;
  }

  return weightedError /
    totalWeight;
}

function updateCentroid(
  regime:
    MutableLatentRegime,

  observation:
    EnvironmentSignalObservation,
): void {
  const previousCount =
    regime.observationCount;

  const nextCount =
    previousCount +
    1;

  for (
    const key of
      Object.keys(
        FEATURE_WEIGHTS,
      ) as Array<
        keyof EnvironmentSignalObservation
      >
  ) {
    regime.centroid[
      key
    ] =
      (
        regime.centroid[
          key
        ] *
          previousCount +
        observation[
          key
        ]
      ) /
      nextCount;
  }

  regime.observationCount =
    nextCount;
}

export class LatentRegimeDiscoveryController {
  private readonly policies:
    readonly MetaAdaptationPolicy[];

  private readonly policyById =
    new Map<
      string,
      MetaAdaptationPolicy
    >();

  private readonly regimes:
    MutableLatentRegime[] =
      [];

  private readonly quarantinedPolicyIds =
    new Set<
      string
    >();

  private totalEpisodes =
    0;

  private nextRegimeNumber =
    1;

  private regimeCreationCount =
    0;

  private lastActivatedRegimeId:
    string |
    undefined;

  constructor(
    policies:
      readonly MetaAdaptationPolicy[] =
        DEFAULT_META_ADAPTATION_POLICIES,

    private readonly assignmentDistanceThreshold =
      0.055,

    private readonly ambiguityMarginThreshold =
      0.01,

    private readonly maxRegimes =
      8,

    private readonly fallbackPolicyIds:
      readonly string[] = [
        "balanced",
        "conservative",
      ],
  ) {
    if (
      policies.length <
        2
    ) {
      throw new Error(
        "Latent regime discovery requires at least two bounded policies.",
      );
    }

    if (
      !Number.isFinite(
        assignmentDistanceThreshold,
      ) ||
      assignmentDistanceThreshold <=
        0 ||
      assignmentDistanceThreshold >
        1
    ) {
      throw new Error(
        "assignmentDistanceThreshold must be in (0, 1].",
      );
    }

    if (
      !Number.isFinite(
        ambiguityMarginThreshold,
      ) ||
      ambiguityMarginThreshold <
        0 ||
      ambiguityMarginThreshold >
        assignmentDistanceThreshold
    ) {
      throw new Error(
        "ambiguityMarginThreshold must be in [0, assignmentDistanceThreshold].",
      );
    }

    if (
      !Number.isInteger(
        maxRegimes,
      ) ||
      maxRegimes <
        1
    ) {
      throw new Error(
        "maxRegimes must be a positive integer.",
      );
    }

    if (
      fallbackPolicyIds.length ===
        0
    ) {
      throw new Error(
        "Latent regime discovery requires at least one uncertainty fallback policy.",
      );
    }

    const seenPolicyIds =
      new Set<
        string
      >();

    for (
      const policy of
        policies
    ) {
      if (
        !policy.id.trim()
      ) {
        throw new Error(
          "Latent regime policy id cannot be empty.",
        );
      }

      if (
        seenPolicyIds.has(
          policy.id,
        )
      ) {
        throw new Error(
          `Duplicate latent regime policy id: ${policy.id}`,
        );
      }

      seenPolicyIds.add(
        policy.id,
      );

      this.policyById.set(
        policy.id,
        {
          ...policy,
        },
      );
    }

    for (
      const fallbackPolicyId of
        fallbackPolicyIds
    ) {
      if (
        !this.policyById.has(
          fallbackPolicyId,
        )
      ) {
        throw new Error(
          `Unknown latent regime fallback policy: ${fallbackPolicyId}`,
        );
      }
    }

    this.policies =
      policies.map(
        (policy) => ({
          ...policy,
        }),
      );
  }

  selectPolicy(
    observation:
      EnvironmentSignalObservation,
  ): LatentRegimeSelection {
    validateObservation(
      observation,
    );

    if (
      this.regimes.length ===
        0
    ) {
      const regime =
        this.createRegime(
          observation,
        );

      const selection =
        this.selectPolicyForRegime(
          regime,
        );

      this.activateRegime(
        regime,
      );

      return {
        observation:
          cloneObservation(
            observation,
          ),

        regimeId:
          regime.id,

        policy:
          selection.policy,

        decision:
          "new-regime",

        policyReason:
          selection.reason,

        createdRegime:
          true,

        reactivatedRegime:
          false,
      };
    }

    const ranked =
      this.regimes
        .map(
          (regime) => ({
            regime,

            distance:
              latentRegimeDistance(
                observation,
                regime.centroid,
              ),
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.distance -
            right.distance,
        );

    const nearest =
      ranked[
        0
      ];

    const runnerUp =
      ranked[
        1
      ];

    if (
      !nearest
    ) {
      throw new Error(
        "Latent regime discovery could not rank its learned regimes.",
      );
    }

    if (
      nearest.distance >
        this.assignmentDistanceThreshold
    ) {
      if (
        this.regimes.length <
          this.maxRegimes
      ) {
        const regime =
          this.createRegime(
            observation,
          );

        const selection =
          this.selectPolicyForRegime(
            regime,
          );

        this.activateRegime(
          regime,
        );

        return {
          observation:
            cloneObservation(
              observation,
            ),

          regimeId:
            regime.id,

          regimeDistance:
            nearest.distance,

          runnerUpDistance:
            runnerUp?.distance,

          policy:
            selection.policy,

          decision:
            "new-regime",

          policyReason:
            selection.reason,

          createdRegime:
            true,

          reactivatedRegime:
            false,
        };
      }

      return this.abstain(
        observation,
        "capacity-abstention",
        nearest.distance,
        runnerUp?.distance,
      );
    }

    if (
      runnerUp &&
      runnerUp.distance -
        nearest.distance <
        this.ambiguityMarginThreshold
    ) {
      return this.abstain(
        observation,
        "membership-abstention",
        nearest.distance,
        runnerUp.distance,
      );
    }

    const reactivatedRegime =
      this.lastActivatedRegimeId !==
        undefined &&
      this.lastActivatedRegimeId !==
        nearest.regime.id &&
      nearest.regime.activationCount >
        0;

    updateCentroid(
      nearest.regime,
      observation,
    );

    if (
      reactivatedRegime
    ) {
      nearest.regime.reactivationCount +=
        1;
    }

    const selection =
      this.selectPolicyForRegime(
        nearest.regime,
      );

    this.activateRegime(
      nearest.regime,
    );

    return {
      observation:
        cloneObservation(
          observation,
        ),

      regimeId:
        nearest.regime.id,

      regimeDistance:
        nearest.distance,

      runnerUpDistance:
        runnerUp?.distance,

      policy:
        selection.policy,

      decision:
        "existing-regime",

      policyReason:
        selection.reason,

      createdRegime:
        false,

      reactivatedRegime,
    };
  }

  recordEpisode(
    selection:
      LatentRegimeSelection,

    outcome:
      AutonomousEpisodeOutcome,
  ): number {
    const episode:
      MetaAdaptationEpisode = {
      family:
        "unknown",

      policyId:
        selection.policy.id,

      ...outcome,
    };

    const utility =
      scoreMetaAdaptationEpisode(
        episode,
      );

    if (
      outcome
        .unsafeIrreversibleAction
    ) {
      this.quarantinedPolicyIds.add(
        selection.policy.id,
      );
    }

    if (
      selection.regimeId &&
      (
        selection.decision ===
          "new-regime" ||
        selection.decision ===
          "existing-regime"
      )
    ) {
      const regime =
        this.regimes.find(
          (candidate) =>
            candidate.id ===
            selection.regimeId,
        );

      if (
        !regime
      ) {
        throw new Error(
          `Unknown latent regime selected for episode: ${selection.regimeId}`,
        );
      }

      const evidence =
        regime.policyEvidence.get(
          selection.policy.id,
        );

      if (
        !evidence
      ) {
        throw new Error(
          `Latent regime ${regime.id} has no evidence store for policy ${selection.policy.id}.`,
        );
      }

      const success =
        utility >=
          0.2 &&
        !outcome.falsePromotion &&
        !outcome
          .unsafeIrreversibleAction;

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
    }

    this.totalEpisodes +=
      1;

    return utility;
  }

  getAuditSummary():
    LatentRegimeAuditSummary {
    return {
      totalEpisodes:
        this.totalEpisodes,

      regimeCount:
        this.regimes.length,

      regimeCreationCount:
        this.regimeCreationCount,

      totalReactivations:
        this.regimes.reduce(
          (
            total,
            regime,
          ) =>
            total +
            regime.reactivationCount,
          0,
        ),

      quarantinedPolicyIds:
        Array.from(
          this.quarantinedPolicyIds,
        ),

      regimes:
        this.regimes.map(
          (regime) => ({
            id:
              regime.id,

            centroid:
              cloneObservation(
                regime.centroid,
              ),

            observationCount:
              regime.observationCount,

            activationCount:
              regime.activationCount,

            reactivationCount:
              regime.reactivationCount,

            lastSeenEpisode:
              regime.lastSeenEpisode,

            policyEvidence:
              this.policyEvidenceList(
                regime,
              ),
          }),
        ),
    };
  }

  private createRegime(
    observation:
      EnvironmentSignalObservation,
  ): MutableLatentRegime {
    const policyEvidence =
      new Map<
        string,
        MutablePolicyEvidence
      >();

    for (
      const policy of
        this.policies
    ) {
      policyEvidence.set(
        policy.id,
        emptyEvidence(),
      );
    }

    const id =
      `regime-${String(
        this.nextRegimeNumber,
      ).padStart(
        3,
        "0",
      )}`;

    this.nextRegimeNumber +=
      1;

    this.regimeCreationCount +=
      1;

    const regime:
      MutableLatentRegime = {
      id,

      centroid:
        cloneObservation(
          observation,
        ),

      observationCount:
        1,

      activationCount:
        0,

      reactivationCount:
        0,

      lastSeenEpisode:
        this.totalEpisodes,

      policyEvidence,
    };

    this.regimes.push(
      regime,
    );

    return regime;
  }

  private activateRegime(
    regime:
      MutableLatentRegime,
  ): void {
    regime.activationCount +=
      1;

    regime.lastSeenEpisode =
      this.totalEpisodes;

    this.lastActivatedRegimeId =
      regime.id;
  }

  private selectPolicyForRegime(
    regime:
      MutableLatentRegime,
  ): {
    policy:
      MetaAdaptationPolicy;
    reason:
      | "regime-exploration"
      | "regime-evidence";
  } {
    const safePolicies =
      this.policies.filter(
        (policy) =>
          !this.quarantinedPolicyIds.has(
            policy.id,
          ),
      );

    if (
      safePolicies.length ===
        0
    ) {
      throw new Error(
        "All latent-regime adaptation policies are quarantined; refusing unsafe self-adaptation.",
      );
    }

    const untried =
      safePolicies.find(
        (policy) =>
          (
            regime.policyEvidence.get(
              policy.id,
            )?.episodes ??
            0
          ) ===
          0,
      );

    if (
      untried
    ) {
      return {
        policy: {
          ...untried,
        },

        reason:
          "regime-exploration",
      };
    }

    let bestPolicy:
      MetaAdaptationPolicy |
      undefined;

    let bestScore =
      Number.NEGATIVE_INFINITY;

    const totalRegimeEpisodes =
      Array.from(
        regime
          .policyEvidence
          .values(),
      ).reduce(
        (
          total,
          evidence,
        ) =>
          total +
          evidence.episodes,
        0,
      );

    for (
      const policy of
        safePolicies
    ) {
      const evidence =
        regime.policyEvidence.get(
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
          ? evidence.cumulativeUtility /
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
                totalRegimeEpisodes +
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
        !bestPolicy ||
        score >
          bestScore +
            Number.EPSILON
      ) {
        bestPolicy =
          policy;

        bestScore =
          score;
      }
    }

    if (
      !bestPolicy
    ) {
      throw new Error(
        `Latent regime ${regime.id} could not select a safe policy.`,
      );
    }

    return {
      policy: {
        ...bestPolicy,
      },

      reason:
        "regime-evidence",
    };
  }

  private abstain(
    observation:
      EnvironmentSignalObservation,

    decision:
      | "membership-abstention"
      | "capacity-abstention",

    regimeDistance:
      number,

    runnerUpDistance:
      number |
      undefined,
  ): LatentRegimeSelection {
    for (
      const fallbackPolicyId of
        this.fallbackPolicyIds
    ) {
      if (
        this.quarantinedPolicyIds.has(
          fallbackPolicyId,
        )
      ) {
        continue;
      }

      const policy =
        this.policyById.get(
          fallbackPolicyId,
        );

      if (
        policy
      ) {
        return {
          observation:
            cloneObservation(
              observation,
            ),

          regimeDistance,

          runnerUpDistance,

          policy: {
            ...policy,
          },

          decision,

          policyReason:
            "uncertainty-fallback",

          createdRegime:
            false,

          reactivatedRegime:
            false,
        };
      }
    }

    throw new Error(
      "No safe latent-regime uncertainty fallback remains; refusing uncertain self-adaptation.",
    );
  }

  private policyEvidenceList(
    regime:
      MutableLatentRegime,
  ): LatentRegimePolicyEvidence[] {
    return this.policies.map(
      (policy) => {
        const evidence =
          regime.policyEvidence.get(
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
              ? evidence.cumulativeUtility /
                evidence.episodes
              : 0,

          quarantined:
            this.quarantinedPolicyIds.has(
              policy.id,
            ),
        };
      },
    );
  }
}

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

export type AdaptiveRegimeFeature =
  keyof EnvironmentSignalObservation;

export interface AdaptiveRegimePolicyEvidence {
  policyId: string;
  episodes: number;
  successes: number;
  failures: number;
  posteriorSuccessProbability: number;
  meanUtility: number;
  quarantined: boolean;
}

export interface AdaptiveRegimeSummary {
  id: string;
  centroid: EnvironmentSignalObservation;
  observationCount: number;
  activationCount: number;
  lastSeenEpisode: number;
  policyEvidence: AdaptiveRegimePolicyEvidence[];
}

export interface AdaptiveStructureSplitEvent {
  type: "split";
  parentRegimeId: string;
  childRegimeIds: [
    string,
    string,
  ];
  feature: AdaptiveRegimeFeature;
  threshold: number;
  policyId: string;
  utilityGap: number;
  featureSeparation: number;
}

export interface AdaptiveStructureMergeEvent {
  type: "merge";
  sourceRegimeIds: [
    string,
    string,
  ];
  targetRegimeId: string;
  centroidDistance: number;
  preferredPolicyId: string;
  policyProfileDistance: number;
}

export type AdaptiveStructureRevisionEvent =
  | AdaptiveStructureSplitEvent
  | AdaptiveStructureMergeEvent;

export interface AdaptiveStructureRevision {
  events: AdaptiveStructureRevisionEvent[];
  featureWeights: EnvironmentSignalObservation;
}

export interface AdaptiveStructureAuditSummary {
  totalEpisodes: number;
  regimeCount: number;
  splitCount: number;
  mergeCount: number;
  quarantinedPolicyIds: string[];
  featureWeights: EnvironmentSignalObservation;
  regimes: AdaptiveRegimeSummary[];
  revisions: AdaptiveStructureRevisionEvent[];
}

export interface AdaptiveStructureSelection {
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
}

type MutablePolicyEvidence = {
  episodes: number;
  successes: number;
  failures: number;
  cumulativeUtility: number;
};

type OutcomeRecord = {
  observation: EnvironmentSignalObservation;
  policyId: string;
  utility: number;
};

type MutableAdaptiveRegime = {
  id: string;
  centroid: EnvironmentSignalObservation;
  observationCount: number;
  activationCount: number;
  lastSeenEpisode: number;
  policyEvidence: Map<
    string,
    MutablePolicyEvidence
  >;
  records: OutcomeRecord[];
};

type SplitCandidate = {
  regime: MutableAdaptiveRegime;
  feature: AdaptiveRegimeFeature;
  threshold: number;
  policyId: string;
  utilityGap: number;
  featureSeparation: number;
  score: number;
};

type MergeCandidate = {
  left: MutableAdaptiveRegime;
  right: MutableAdaptiveRegime;
  centroidDistance: number;
  preferredPolicyId: string;
  policyProfileDistance: number;
  score: number;
};

const FEATURES:
  readonly AdaptiveRegimeFeature[] = [
    "recentErrorRate",
    "errorBurstiness",
    "driftConfidence",
    "changePointStrength",
    "priorRegimeSimilarity",
    "trendPersistence",
  ];

const DEFAULT_BETA_PRIOR =
  1;

function unitWeights():
  EnvironmentSignalObservation {
  return {
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
  };
}

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
    const feature of
      FEATURES
  ) {
    validateUnitInterval(
      feature,
      observation[
        feature
      ],
    );
  }
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

function mean(
  values:
    readonly number[],
): number {
  return values.length >
      0
    ? values.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      ) /
      values.length
    : 0;
}

function centroidFromRecords(
  records:
    readonly OutcomeRecord[],
): EnvironmentSignalObservation {
  if (
    records.length ===
      0
  ) {
    throw new Error(
      "Cannot compute a latent-regime centroid from zero records.",
    );
  }

  const centroid =
    unitWeights();

  for (
    const feature of
      FEATURES
  ) {
    centroid[
      feature
    ] =
      mean(
        records.map(
          (record) =>
            record
              .observation[
                feature
              ],
        ),
      );
  }

  return centroid;
}

export function adaptiveRegimeDistance(
  left:
    EnvironmentSignalObservation,

  right:
    EnvironmentSignalObservation,

  weights:
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
    const feature of
      FEATURES
  ) {
    const weight =
      weights[
        feature
      ];

    if (
      !Number.isFinite(
        weight,
      ) ||
      weight <=
        0
    ) {
      throw new Error(
        `Adaptive regime weight for ${feature} must be positive and finite.`,
      );
    }

    const difference =
      left[
        feature
      ] -
      right[
        feature
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
    MutableAdaptiveRegime,

  observation:
    EnvironmentSignalObservation,
): void {
  const previousCount =
    regime.observationCount;

  const nextCount =
    previousCount +
    1;

  for (
    const feature of
      FEATURES
  ) {
    regime.centroid[
      feature
    ] =
      (
        regime.centroid[
          feature
        ] *
          previousCount +
        observation[
          feature
        ]
      ) /
      nextCount;
  }

  regime.observationCount =
    nextCount;
}

export class AdaptiveLatentRegimeStructureController {
  private readonly policies:
    readonly MetaAdaptationPolicy[];

  private readonly policyById =
    new Map<
      string,
      MetaAdaptationPolicy
    >();

  private regimes:
    MutableAdaptiveRegime[] =
      [];

  private readonly quarantinedPolicyIds =
    new Set<
      string
    >();

  private featureWeights =
    unitWeights();

  private totalEpisodes =
    0;

  private nextRegimeNumber =
    1;

  private splitCount =
    0;

  private mergeCount =
    0;

  private readonly revisions:
    AdaptiveStructureRevisionEvent[] =
      [];

  constructor(
    policies:
      readonly MetaAdaptationPolicy[] =
        DEFAULT_META_ADAPTATION_POLICIES,

    private readonly assignmentDistanceThreshold =
      0.12,

    private readonly ambiguityMarginThreshold =
      0.008,

    private readonly maxRegimes =
      8,

    private readonly fallbackPolicyIds:
      readonly string[] = [
        "balanced",
        "conservative",
      ],

    private readonly minimumSplitRecords =
      9,

    private readonly minimumPolicySamplesPerSplitSide =
      2,

    private readonly minimumSplitUtilityGap =
      0.5,

    private readonly minimumSplitFeatureSeparation =
      0.15,

    private readonly mergeDistanceThreshold =
      0.04,

    private readonly mergePolicyProfileTolerance =
      0.2,

    private readonly featureWeightFloor =
      0.15,

    private readonly featureWeightCeiling =
      3,
  ) {
    if (
      policies.length <
        2
    ) {
      throw new Error(
        "Adaptive latent structure requires at least two bounded policies.",
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
        "Adaptive latent structure requires at least one uncertainty fallback policy.",
      );
    }

    if (
      !Number.isInteger(
        minimumSplitRecords,
      ) ||
      minimumSplitRecords <
        4
    ) {
      throw new Error(
        "minimumSplitRecords must be an integer of at least 4.",
      );
    }

    if (
      !Number.isInteger(
        minimumPolicySamplesPerSplitSide,
      ) ||
      minimumPolicySamplesPerSplitSide <
        1
    ) {
      throw new Error(
        "minimumPolicySamplesPerSplitSide must be a positive integer.",
      );
    }

    const seen =
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
          "Adaptive latent structure policy id cannot be empty.",
        );
      }

      if (
        seen.has(
          policy.id,
        )
      ) {
        throw new Error(
          `Duplicate adaptive latent structure policy id: ${policy.id}`,
        );
      }

      seen.add(
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
          `Unknown adaptive latent structure fallback policy: ${fallbackPolicyId}`,
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
  ): AdaptiveStructureSelection {
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

      const policySelection =
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
          policySelection.policy,

        decision:
          "new-regime",

        policyReason:
          policySelection.reason,

        createdRegime:
          true,
      };
    }

    const ranked =
      this.regimes
        .map(
          (regime) => ({
            regime,

            distance:
              adaptiveRegimeDistance(
                observation,
                regime.centroid,
                this.featureWeights,
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
        "Adaptive latent structure could not rank its regimes.",
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

        const policySelection =
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
            policySelection.policy,

          decision:
            "new-regime",

          policyReason:
            policySelection.reason,

          createdRegime:
            true,
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

    updateCentroid(
      nearest.regime,
      observation,
    );

    const policySelection =
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
        policySelection.policy,

      decision:
        "existing-regime",

      policyReason:
        policySelection.reason,

      createdRegime:
        false,
    };
  }

  recordEpisode(
    selection:
      AdaptiveStructureSelection,

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
          `Unknown adaptive latent regime selected for episode: ${selection.regimeId}`,
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
          `Adaptive latent regime ${regime.id} has no evidence for policy ${selection.policy.id}.`,
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

      regime.records.push({
        observation:
          cloneObservation(
            selection.observation,
          ),

        policyId:
          selection.policy.id,

        utility,
      });
    }

    this.totalEpisodes +=
      1;

    return utility;
  }

  reviseStructure():
    AdaptiveStructureRevision {
    const events:
      AdaptiveStructureRevisionEvent[] =
        [];

    const split =
      this.findBestSplit();

    if (
      split
    ) {
      const event =
        this.applySplit(
          split,
        );

      events.push(
        event,
      );

      this.revisions.push(
        event,
      );

      this.splitCount +=
        1;

      this.learnFeatureWeights();

      return {
        events,

        featureWeights:
          cloneObservation(
            this.featureWeights,
          ),
      };
    }

    const merge =
      this.findBestMerge();

    if (
      merge
    ) {
      const event =
        this.applyMerge(
          merge,
        );

      events.push(
        event,
      );

      this.revisions.push(
        event,
      );

      this.mergeCount +=
        1;
    }

    this.learnFeatureWeights();

    return {
      events,

      featureWeights:
        cloneObservation(
          this.featureWeights,
        ),
    };
  }

  getAuditSummary():
    AdaptiveStructureAuditSummary {
    return {
      totalEpisodes:
        this.totalEpisodes,

      regimeCount:
        this.regimes.length,

      splitCount:
        this.splitCount,

      mergeCount:
        this.mergeCount,

      quarantinedPolicyIds:
        Array.from(
          this.quarantinedPolicyIds,
        ),

      featureWeights:
        cloneObservation(
          this.featureWeights,
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

            lastSeenEpisode:
              regime.lastSeenEpisode,

            policyEvidence:
              this.policyEvidenceList(
                regime,
              ),
          }),
        ),

      revisions:
        this.revisions.map(
          (revision) => ({
            ...revision,
          }),
        ),
    };
  }

  private createRegime(
    observation:
      EnvironmentSignalObservation,
  ): MutableAdaptiveRegime {
    const regime:
      MutableAdaptiveRegime = {
      id:
        this.allocateRegimeId(),

      centroid:
        cloneObservation(
          observation,
        ),

      observationCount:
        1,

      activationCount:
        0,

      lastSeenEpisode:
        this.totalEpisodes,

      policyEvidence:
        this.emptyPolicyEvidenceMap(),

      records:
        [],
    };

    this.regimes.push(
      regime,
    );

    return regime;
  }

  private createRegimeFromRecords(
    records:
      readonly OutcomeRecord[],
  ): MutableAdaptiveRegime {
    return {
      id:
        this.allocateRegimeId(),

      centroid:
        centroidFromRecords(
          records,
        ),

      observationCount:
        records.length,

      activationCount:
        0,

      lastSeenEpisode:
        this.totalEpisodes,

      policyEvidence:
        this.emptyPolicyEvidenceMap(),

      records:
        records.map(
          (record) => ({
            observation:
              cloneObservation(
                record.observation,
              ),

            policyId:
              record.policyId,

            utility:
              record.utility,
          }),
        ),
    };
  }

  private allocateRegimeId():
    string {
    const id =
      `regime-${String(
        this.nextRegimeNumber,
      ).padStart(
        3,
        "0",
      )}`;

    this.nextRegimeNumber +=
      1;

    return id;
  }

  private emptyPolicyEvidenceMap():
    Map<
      string,
      MutablePolicyEvidence
    > {
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

    return evidence;
  }

  private activateRegime(
    regime:
      MutableAdaptiveRegime,
  ): void {
    regime.activationCount +=
      1;

    regime.lastSeenEpisode =
      this.totalEpisodes;
  }

  private selectPolicyForRegime(
    regime:
      MutableAdaptiveRegime,
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
        "All adaptive latent structure policies are quarantined; refusing unsafe self-adaptation.",
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

    const totalEpisodes =
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
                totalEpisodes +
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
        `Adaptive latent regime ${regime.id} could not select a safe policy.`,
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

  private findBestSplit():
    SplitCandidate |
    undefined {
    let best:
      SplitCandidate |
      undefined;

    for (
      const regime of
        this.regimes
    ) {
      if (
        regime.records.length <
          this.minimumSplitRecords
      ) {
        continue;
      }

      for (
        const feature of
          FEATURES
      ) {
        const sortedValues =
          Array.from(
            new Set(
              regime.records.map(
                (record) =>
                  record
                    .observation[
                      feature
                    ],
              ),
            ),
          ).sort(
            (
              left,
              right,
            ) =>
              left -
              right,
          );

        for (
          let index =
            0;
          index <
            sortedValues.length -
              1;
          index +=
            1
        ) {
          const leftValue =
            sortedValues[
              index
            ];

          const rightValue =
            sortedValues[
              index +
                1
            ];

          if (
            leftValue ===
              undefined ||
            rightValue ===
              undefined
          ) {
            continue;
          }

          const threshold =
            (
              leftValue +
              rightValue
            ) /
            2;

          const leftRecords =
            regime.records.filter(
              (record) =>
                record
                  .observation[
                    feature
                  ] <=
                threshold,
            );

          const rightRecords =
            regime.records.filter(
              (record) =>
                record
                  .observation[
                    feature
                  ] >
                threshold,
            );

          if (
            leftRecords.length <
              3 ||
            rightRecords.length <
              3
          ) {
            continue;
          }

          const featureSeparation =
            Math.abs(
              mean(
                leftRecords.map(
                  (record) =>
                    record
                      .observation[
                        feature
                      ],
                ),
              ) -
                mean(
                  rightRecords.map(
                    (record) =>
                      record
                        .observation[
                          feature
                        ],
                ),
            );

          if (
            featureSeparation <
              this.minimumSplitFeatureSeparation
          ) {
            continue;
          }

          for (
            const policy of
              this.policies
          ) {
            const leftPolicy =
              leftRecords.filter(
                (record) =>
                  record.policyId ===
                  policy.id,
              );

            const rightPolicy =
              rightRecords.filter(
                (record) =>
                  record.policyId ===
                  policy.id,
              );

            if (
              leftPolicy.length <
                this.minimumPolicySamplesPerSplitSide ||
              rightPolicy.length <
                this.minimumPolicySamplesPerSplitSide
            ) {
              continue;
            }

            const utilityGap =
              Math.abs(
                mean(
                  leftPolicy.map(
                    (record) =>
                      record.utility,
                  ),
                ) -
                  mean(
                    rightPolicy.map(
                      (record) =>
                        record.utility,
                    ),
                  ),
              );

            if (
              utilityGap <
                this.minimumSplitUtilityGap
            ) {
              continue;
            }

            const candidate:
              SplitCandidate = {
              regime,
              feature,
              threshold,
              policyId:
                policy.id,
              utilityGap,
              featureSeparation,
              score:
                utilityGap *
                featureSeparation,
            };

            if (
              !best ||
              candidate.score >
                best.score +
                  Number.EPSILON
            ) {
              best =
                candidate;
            }
          }
        }
      }
    }

    return best;
  }

  private applySplit(
    candidate:
      SplitCandidate,
  ): AdaptiveStructureSplitEvent {
    if (
      this.regimes.length +
        1 >
      this.maxRegimes
    ) {
      throw new Error(
        "Adaptive latent structure refuses a split that would exceed the regime budget.",
      );
    }

    const leftRecords =
      candidate
        .regime
        .records
        .filter(
          (record) =>
            record
              .observation[
                candidate.feature
              ] <=
            candidate.threshold,
        );

    const rightRecords =
      candidate
        .regime
        .records
        .filter(
          (record) =>
            record
              .observation[
                candidate.feature
              ] >
            candidate.threshold,
        );

    const left =
      this.createRegimeFromRecords(
        leftRecords,
      );

    const right =
      this.createRegimeFromRecords(
        rightRecords,
      );

    this.regimes =
      this.regimes.filter(
        (regime) =>
          regime.id !==
          candidate
            .regime
            .id,
      );

    this.regimes.push(
      left,
      right,
    );

    return {
      type:
        "split",

      parentRegimeId:
        candidate
          .regime
          .id,

      childRegimeIds: [
        left.id,
        right.id,
      ],

      feature:
        candidate.feature,

      threshold:
        candidate.threshold,

      policyId:
        candidate.policyId,

      utilityGap:
        candidate.utilityGap,

      featureSeparation:
        candidate.featureSeparation,
    };
  }

  private findBestMerge():
    MergeCandidate |
    undefined {
    let best:
      MergeCandidate |
      undefined;

    for (
      let leftIndex =
        0;
      leftIndex <
        this.regimes.length;
      leftIndex +=
        1
    ) {
      const left =
        this.regimes[
          leftIndex
        ];

      if (
        !left
      ) {
        continue;
      }

      for (
        let rightIndex =
          leftIndex +
          1;
        rightIndex <
          this.regimes.length;
        rightIndex +=
          1
      ) {
        const right =
          this.regimes[
            rightIndex
          ];

        if (
          !right
        ) {
          continue;
        }

        const leftPreferred =
          this.preferredPolicyFromEvidence(
            left,
          );

        const rightPreferred =
          this.preferredPolicyFromEvidence(
            right,
          );

        if (
          !leftPreferred ||
          !rightPreferred ||
          leftPreferred !==
            rightPreferred
        ) {
          continue;
        }

        const centroidDistance =
          adaptiveRegimeDistance(
            left.centroid,
            right.centroid,
            this.featureWeights,
          );

        if (
          centroidDistance >
            this.mergeDistanceThreshold
        ) {
          continue;
        }

        const profileDistance =
          this.policyProfileDistance(
            left,
            right,
          );

        if (
          profileDistance >
            this.mergePolicyProfileTolerance
        ) {
          continue;
        }

        const candidate:
          MergeCandidate = {
          left,
          right,
          centroidDistance,
          preferredPolicyId:
            leftPreferred,
          policyProfileDistance:
            profileDistance,
          score:
            centroidDistance +
            profileDistance,
        };

        if (
          !best ||
          candidate.score <
            best.score -
              Number.EPSILON
        ) {
          best =
            candidate;
        }
      }
    }

    return best;
  }

  private applyMerge(
    candidate:
      MergeCandidate,
  ): AdaptiveStructureMergeEvent {
    const mergedRecords = [
      ...candidate
        .left
        .records,
      ...candidate
        .right
        .records,
    ];

    const target =
      this.createRegimeFromRecords(
        mergedRecords,
      );

    target.policyEvidence =
      this.combineEvidence(
        candidate.left,
        candidate.right,
      );

    target.activationCount =
      candidate
        .left
        .activationCount +
      candidate
        .right
        .activationCount;

    this.regimes =
      this.regimes.filter(
        (regime) =>
          regime.id !==
            candidate
              .left
              .id &&
          regime.id !==
            candidate
              .right
              .id,
      );

    this.regimes.push(
      target,
    );

    return {
      type:
        "merge",

      sourceRegimeIds: [
        candidate
          .left
          .id,
        candidate
          .right
          .id,
      ],

      targetRegimeId:
        target.id,

      centroidDistance:
        candidate
          .centroidDistance,

      preferredPolicyId:
        candidate
          .preferredPolicyId,

      policyProfileDistance:
        candidate
          .policyProfileDistance,
    };
  }

  private combineEvidence(
    left:
      MutableAdaptiveRegime,

    right:
      MutableAdaptiveRegime,
  ):
    Map<
      string,
      MutablePolicyEvidence
    > {
    const combined =
      this.emptyPolicyEvidenceMap();

    for (
      const policy of
        this.policies
    ) {
      const leftEvidence =
        left.policyEvidence.get(
          policy.id,
        ) ??
        emptyEvidence();

      const rightEvidence =
        right.policyEvidence.get(
          policy.id,
        ) ??
        emptyEvidence();

      combined.set(
        policy.id,
        {
          episodes:
            leftEvidence.episodes +
            rightEvidence.episodes,

          successes:
            leftEvidence.successes +
            rightEvidence.successes,

          failures:
            leftEvidence.failures +
            rightEvidence.failures,

          cumulativeUtility:
            leftEvidence.cumulativeUtility +
            rightEvidence.cumulativeUtility,
        },
      );
    }

    return combined;
  }

  private preferredPolicyFromEvidence(
    regime:
      MutableAdaptiveRegime,
  ):
    string |
    undefined {
    let bestPolicyId:
      string |
      undefined;

    let bestUtility =
      Number.NEGATIVE_INFINITY;

    for (
      const policy of
        this.policies
    ) {
      const evidence =
        regime.policyEvidence.get(
          policy.id,
        );

      if (
        !evidence ||
        evidence.episodes ===
          0
      ) {
        continue;
      }

      const utility =
        evidence.cumulativeUtility /
        evidence.episodes;

      if (
        utility >
          bestUtility +
            Number.EPSILON
      ) {
        bestUtility =
          utility;

        bestPolicyId =
          policy.id;
      }
    }

    return bestPolicyId;
  }

  private policyProfileDistance(
    left:
      MutableAdaptiveRegime,

    right:
      MutableAdaptiveRegime,
  ): number {
    const differences:
      number[] =
        [];

    for (
      const policy of
        this.policies
    ) {
      const leftEvidence =
        left.policyEvidence.get(
          policy.id,
        );

      const rightEvidence =
        right.policyEvidence.get(
          policy.id,
        );

      if (
        !leftEvidence ||
        !rightEvidence ||
        leftEvidence.episodes ===
          0 ||
        rightEvidence.episodes ===
          0
      ) {
        continue;
      }

      const leftMean =
        leftEvidence.cumulativeUtility /
        leftEvidence.episodes;

      const rightMean =
        rightEvidence.cumulativeUtility /
        rightEvidence.episodes;

      differences.push(
        Math.abs(
          leftMean -
          rightMean,
        ),
      );
    }

    return differences.length >
        0
      ? mean(
          differences,
        )
      : Number.POSITIVE_INFINITY;
  }

  private learnFeatureWeights():
    void {
    if (
      this.regimes.length <
        2
    ) {
      this.featureWeights =
        unitWeights();

      return;
    }

    const rawScores =
      {} as Record<
        AdaptiveRegimeFeature,
        number
      >;

    for (
      const feature of
        FEATURES
    ) {
      rawScores[
        feature
      ] =
        0;
    }

    let informativePairs =
      0;

    for (
      let leftIndex =
        0;
      leftIndex <
        this.regimes.length;
      leftIndex +=
        1
    ) {
      const left =
        this.regimes[
          leftIndex
        ];

      if (
        !left
      ) {
        continue;
      }

      for (
        let rightIndex =
          leftIndex +
          1;
        rightIndex <
          this.regimes.length;
        rightIndex +=
          1
      ) {
        const right =
          this.regimes[
            rightIndex
          ];

        if (
          !right
        ) {
          continue;
        }

        const behaviorDifference =
          this.policyBehaviorDifference(
            left,
            right,
          );

        if (
          behaviorDifference <=
            0
        ) {
          continue;
        }

        informativePairs +=
          1;

        for (
          const feature of
            FEATURES
        ) {
          const featureDifference =
            left.centroid[
              feature
            ] -
            right.centroid[
              feature
            ];

          rawScores[
            feature
          ] +=
            featureDifference *
            featureDifference *
            behaviorDifference;
        }
      }
    }

    if (
      informativePairs ===
        0
    ) {
      this.featureWeights =
        unitWeights();

      return;
    }

    const averageRaw =
      mean(
        FEATURES.map(
          (feature) =>
            rawScores[
              feature
            ],
        ),
      );

    if (
      averageRaw <=
        Number.EPSILON
    ) {
      this.featureWeights =
        unitWeights();

      return;
    }

    const learned =
      unitWeights();

    for (
      const feature of
        FEATURES
    ) {
      learned[
        feature
      ] =
        Math.min(
          this.featureWeightCeiling,
          Math.max(
            this.featureWeightFloor,
            rawScores[
              feature
            ] /
              averageRaw,
          ),
        );
    }

    this.featureWeights =
      learned;
  }

  private policyBehaviorDifference(
    left:
      MutableAdaptiveRegime,

    right:
      MutableAdaptiveRegime,
  ): number {
    const differences:
      number[] =
        [];

    for (
      const policy of
        this.policies
    ) {
      const leftRecords =
        left.records.filter(
          (record) =>
            record.policyId ===
            policy.id,
        );

      const rightRecords =
        right.records.filter(
          (record) =>
            record.policyId ===
            policy.id,
        );

      if (
        leftRecords.length ===
          0 ||
        rightRecords.length ===
          0
      ) {
        continue;
      }

      differences.push(
        Math.abs(
          mean(
            leftRecords.map(
              (record) =>
                record.utility,
            ),
          ) -
            mean(
              rightRecords.map(
                (record) =>
                  record.utility,
            ),
          ),
        ),
      );
    }

    return differences.length >
        0
      ? mean(
          differences,
        )
      : 0;
  }

  private policyEvidenceList(
    regime:
      MutableAdaptiveRegime,
  ): AdaptiveRegimePolicyEvidence[] {
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
  ): AdaptiveStructureSelection {
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
        };
      }
    }

    throw new Error(
      "No safe adaptive-structure uncertainty fallback remains; refusing uncertain self-adaptation.",
    );
  }
}

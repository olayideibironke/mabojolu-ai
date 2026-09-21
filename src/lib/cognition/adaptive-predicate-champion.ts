import {
  SymbolicPredicateApplicabilityModel,
  type SymbolicPredicateApplicabilityEstimate,
  type SymbolicPredicateProgram,
  type SymbolicPredicateProjection,
} from "./context-predicate-search";

import type {
  InducedContextSignature,
} from "./principle-context-signature";

type Observation = {
  signature:
    InducedContextSignature;

  useful:
    boolean;
};

export type AdaptivePredicatePhase =
  | "bootstrap-fit"
  | "bootstrap-validation"
  | "champion"
  | "regime-recall-validation"
  | "challenger-fit"
  | "challenger-validation"
  | "bootstrap-rejected";

export interface AdaptivePredicateSummary {
  principleId:
    string;

  phase:
    AdaptivePredicatePhase;

  championGeneration:
    number;

  championProgramId?:
    string;

  championPredictsUsefulWhenPredicateIs?:
    boolean;

  replacementCount:
    number;

  archivedChampionCount:
    number;

  rollbackCount:
    number;

  regimeRecallValidationEvidenceCount:
    number;

  lastRegimeRecallAccuracy?:
    number;

  lastRegimeRecallGeneration?:
    number;

  lastRegimeRecallDecision?:
    "rolled-back" |
    "no-match";

  bootstrapFitEvidenceCount:
    number;

  bootstrapValidationEvidenceCount:
    number;

  championOperationalEvidenceCount:
    number;

  driftWindowEvidenceCount:
    number;

  driftWindowAccuracy?:
    number;

  driftPosteriorProbability?:
    number;

  driftConfidenceThreshold:
    number;

  changePointScore:
    number;

  changePointEvidenceCount:
    number;

  changePointOperationalEvidenceIndex?:
    number;

  sequentialEvidenceThreshold:
    number;

  lastDriftTriggerEvidenceCount?:
    number;

  lastDriftTriggerAccuracy?:
    number;

  lastDriftTriggerPosteriorProbability?:
    number;

  challengerFitEvidenceCount:
    number;

  challengerValidationEvidenceCount:
    number;

  challengerValidationTarget?:
    number;

  challengerAttemptCount:
    number;

  challengerAttemptBudget:
    number;

  challengerSearchExhausted:
    boolean;

  challengerProgramId?:
    string;

  lastChallengerValidationAccuracy?:
    number;

  lastChampionValidationAccuracy?:
    number;

  lastValidationBaselineAccuracy?:
    number;

  lastReplacementDecision?:
    "replaced" |
    "retained";

  lastRejectionReason?:
    "no-program" |
    "ambiguous-orientation" |
    "bootstrap-validation-failed" |
    "challenger-validation-failed";
}

export interface AdaptivePredicateApplicabilityEstimate
  extends
    SymbolicPredicateApplicabilityEstimate {
  adaptation:
    AdaptivePredicateSummary;
}

interface FrozenProgram {
  program:
    SymbolicPredicateProgram;

  predictsUsefulWhenPredicateIs:
    boolean;

  baseEvidence:
    Observation[];

  operationalEvidence:
    Observation[];

  generation:
    number;
}

interface ChallengerState {
  fitModel:
    SymbolicPredicateApplicabilityModel;

  fit:
    Observation[];

  validation:
    Observation[];

  attempt:
    number;

  validationTarget:
    number;

  program?:
    SymbolicPredicateProgram;

  predictsUsefulWhenPredicateIs?:
    boolean;
}

interface PrincipleState {
  phase:
    AdaptivePredicatePhase;

  bootstrapFitModel:
    SymbolicPredicateApplicabilityModel;

  bootstrapFit:
    Observation[];

  bootstrapValidation:
    Observation[];

  champion?:
    FrozenProgram;

  archivedChampions:
    FrozenProgram[];

  regimeRecallValidation:
    Observation[];

  recentChampionCorrectness:
    boolean[];

  changePointScore:
    number;

  changePointOperationalEvidenceIndex?:
    number;

  challenger?:
    ChallengerState;

  challengerAttemptCount:
    number;

  challengerSearchExhausted:
    boolean;

  replacementCount:
    number;

  rollbackCount:
    number;

  lastRegimeRecallAccuracy?:
    number;

  lastRegimeRecallGeneration?:
    number;

  lastRegimeRecallDecision?:
    "rolled-back" |
    "no-match";

  lastDriftTriggerEvidenceCount?:
    number;

  lastDriftTriggerAccuracy?:
    number;

  lastDriftTriggerPosteriorProbability?:
    number;

  lastChallengerValidationAccuracy?:
    number;

  lastChampionValidationAccuracy?:
    number;

  lastValidationBaselineAccuracy?:
    number;

  lastReplacementDecision?:
    "replaced" |
    "retained";

  lastRejectionReason?:
    AdaptivePredicateSummary[
      "lastRejectionReason"
    ];
}

const EPSILON =
  1e-12;

const MAX_ARCHIVED_CHAMPIONS =
  8;

/**
 * Exact Beta-Bernoulli posterior probability that a champion's true
 * correctness rate is at or below the configured drift threshold.
 *
 * A uniform Beta(1, 1) prior keeps the detector conservative when only a few
 * outcomes are available. For integer posterior parameters, the Beta CDF can
 * be evaluated exactly through the equivalent binomial tail, avoiding a
 * numerical integration dependency.
 */
function driftPosteriorProbability(
  correctness:
    readonly boolean[],

  accuracyThreshold:
    number,
):
  number {
  const successes =
    correctness.filter(
      Boolean,
    ).length;

  const failures =
    correctness.length -
    successes;

  const alpha =
    successes +
    1;

  const beta =
    failures +
    1;

  const trials =
    alpha +
    beta -
    1;

  function binomialCoefficient(
    n:
      number,

    k:
      number,
  ):
    number {
    if (
      k <
        0 ||
      k >
        n
    ) {
      return 0;
    }

    const reduced =
      Math.min(
        k,
        n -
          k,
      );

    let value =
      1;

    for (
      let index =
        1;
      index <=
        reduced;
      index +=
        1
    ) {
      value *=
        (
          n -
          reduced +
          index
        ) /
        index;
    }

    return value;
  }

  let probability =
    0;

  for (
    let successesInTail =
      alpha;
    successesInTail <=
      trials;
    successesInTail +=
      1
  ) {
    probability +=
      binomialCoefficient(
        trials,
        successesInTail,
      ) *
      accuracyThreshold **
        successesInTail *
      (
        1 -
        accuracyThreshold
      ) **
        (
          trials -
          successesInTail
        );
  }

  return Math.max(
    0,
    Math.min(
      1,
      probability,
    ),
  );
}

function cloneSignature(
  signature:
    InducedContextSignature,
):
  InducedContextSignature {
  return {
    key:
      signature.key,

    features: {
      ...signature.features,

      lastValueShapes: [
        ...signature
          .features
          .lastValueShapes,
      ],
    },
  };
}

function cloneObservation(
  observation:
    Observation,
):
  Observation {
  return {
    signature:
      cloneSignature(
        observation.signature,
      ),

    useful:
      observation.useful,
  };
}

function cloneFrozenProgram(
  frozen:
    FrozenProgram,
):
  FrozenProgram {
  return {
    program: {
      ...frozen.program,
    },

    predictsUsefulWhenPredicateIs:
      frozen
        .predictsUsefulWhenPredicateIs,

    baseEvidence:
      frozen
        .baseEvidence
        .map(
          cloneObservation,
        ),

    /*
     * Operational evidence belongs to the regime activation that produced it.
     * A recalled regime starts a fresh operational record so observations from
     * a later drift period do not contaminate the restored applicability score.
     */
    operationalEvidence: [],

    generation:
      frozen.generation,
  };
}

function sameFrozenProgram(
  left:
    FrozenProgram,

  right:
    FrozenProgram,
):
  boolean {
  return (
    left.program.id ===
      right.program.id &&
    left
      .predictsUsefulWhenPredicateIs ===
      right
        .predictsUsefulWhenPredicateIs
  );
}

function countValue(
  signature:
    InducedContextSignature,

  feature:
    SymbolicPredicateProgram[
      "left"
    ],
):
  number {
  const value =
    signature.features[
      feature
    ];

  if (
    value ===
      "0"
  ) {
    return 0;
  }

  if (
    value ===
      "1"
  ) {
    return 1;
  }

  if (
    value ===
      "2"
  ) {
    return 2;
  }

  return 3;
}

function predicateValue(
  program:
    SymbolicPredicateProgram,

  signature:
    InducedContextSignature,
):
  boolean {
  const left =
    countValue(
      signature,
      program.left,
    );

  const right =
    countValue(
      signature,
      program.right,
    );

  if (
    program.operator ===
      "equal"
  ) {
    return left ===
      right;
  }

  if (
    program.operator ===
      "less-than"
  ) {
    return left <
      right;
  }

  if (
    program.operator ===
      "greater-than"
  ) {
    return left >
      right;
  }

  if (
    program.operator ===
      "difference-equals"
  ) {
    return (
      left -
        right ===
      program.parameter
    );
  }

  return (
    Math.abs(
      left -
      right,
    ) <=
    (
      program.parameter ??
      0
    )
  );
}

function projectionFor(
  program:
    SymbolicPredicateProgram,

  signature:
    InducedContextSignature,
):
  SymbolicPredicateProjection {
  const value =
    predicateValue(
      program,
      signature,
    );

  return {
    programId:
      program.id,

    left:
      program.left,

    right:
      program.right,

    operator:
      program.operator,

    ...(program.parameter !==
      undefined
      ? {
          parameter:
            program.parameter,
        }
      : {}),

    predicateValue:
      value,

    projectionKey:
      JSON.stringify([
        program.id,
        value,
      ]),
  };
}

function usefulRate(
  observations:
    readonly Observation[],

  program:
    SymbolicPredicateProgram,

  predicateSide:
    boolean,
):
  number |
  undefined {
  const matching =
    observations.filter(
      (observation) =>
        predicateValue(
          program,
          observation
            .signature,
        ) ===
        predicateSide,
    );

  if (
    matching.length ===
      0
  ) {
    return undefined;
  }

  return (
    matching.filter(
      (observation) =>
        observation.useful,
    ).length /
    matching.length
  );
}

function inferOrientation(
  observations:
    readonly Observation[],

  program:
    SymbolicPredicateProgram,
):
  boolean |
  undefined {
  const whenTrue =
    usefulRate(
      observations,
      program,
      true,
    );

  const whenFalse =
    usefulRate(
      observations,
      program,
      false,
    );

  if (
    whenTrue ===
      undefined ||
    whenFalse ===
      undefined ||
    Math.abs(
      whenTrue -
        whenFalse,
    ) <=
      EPSILON
  ) {
    return undefined;
  }

  return whenTrue >
    whenFalse;
}

function predictionFor(
  frozen:
    Pick<
      FrozenProgram,
      "program" |
      "predictsUsefulWhenPredicateIs"
    >,

  signature:
    InducedContextSignature,
):
  boolean {
  return (
    predicateValue(
      frozen.program,
      signature,
    ) ===
    frozen
      .predictsUsefulWhenPredicateIs
  );
}

function accuracy(
  observations:
    readonly Observation[],

  frozen:
    Pick<
      FrozenProgram,
      "program" |
      "predictsUsefulWhenPredicateIs"
    >,
):
  number {
  if (
    observations.length ===
      0
  ) {
    return 0;
  }

  return (
    observations.filter(
      (observation) =>
        predictionFor(
          frozen,
          observation
            .signature,
        ) ===
        observation.useful,
    ).length /
    observations.length
  );
}

function majorityBaseline(
  observations:
    readonly Observation[],
):
  number {
  if (
    observations.length ===
      0
  ) {
    return 0;
  }

  const positive =
    observations.filter(
      (observation) =>
        observation.useful,
    ).length;

  return (
    Math.max(
      positive,
      observations.length -
        positive,
    ) /
    observations.length
  );
}

/**
 * Maintains a validated symbolic predicate as a champion and replaces it only
 * through fresh challenger fit and validation partitions after measured drift.
 *
 * Drift-trigger evidence remains champion operational evidence and is never
 * reused as challenger training data. Challenger validation evidence can approve
 * or reject the frozen challenger but is not reused as post-replacement
 * applicability evidence.
 */
export class AdaptiveValidatedPredicateApplicabilityModel {
  private readonly states =
    new Map<
      string,
      PrincipleState
    >();

  constructor(
    private readonly fitObservationTarget =
      6,

    private readonly validationObservationTarget =
      3,

    private readonly minimumValidationAccuracy =
      0.75,

    private readonly penaltyPerExtraOperation =
      0.05,

    private readonly driftMinimumEvidence =
      3,

    private readonly driftAccuracyThreshold =
      0.5,

    private readonly driftConfidenceThreshold =
      0.9,

    private readonly driftMaximumEvidence =
      12,

    private readonly sequentialEvidenceThreshold =
      Math.log(
        4,
      ),

    private readonly maxChallengerAttemptsPerRegime =
      2,

    private readonly challengerValidationGrowthPerAttempt =
      2,
  ) {
    if (
      !Number.isInteger(
        fitObservationTarget,
      ) ||
      fitObservationTarget <
        4
    ) {
      throw new Error(
        "fitObservationTarget must be at least 4.",
      );
    }

    if (
      !Number.isInteger(
        validationObservationTarget,
      ) ||
      validationObservationTarget <
        2
    ) {
      throw new Error(
        "validationObservationTarget must be at least 2.",
      );
    }

    if (
      !Number.isFinite(
        minimumValidationAccuracy,
      ) ||
      minimumValidationAccuracy <=
        0.5 ||
      minimumValidationAccuracy >
        1
    ) {
      throw new Error(
        "minimumValidationAccuracy must be in (0.5, 1].",
      );
    }

    if (
      !Number.isInteger(
        driftMinimumEvidence,
      ) ||
      driftMinimumEvidence <
        2
    ) {
      throw new Error(
        "driftMinimumEvidence must be at least 2.",
      );
    }

    if (
      !Number.isFinite(
        driftAccuracyThreshold,
      ) ||
      driftAccuracyThreshold <
        0 ||
      driftAccuracyThreshold >=
        minimumValidationAccuracy
    ) {
      throw new Error(
        "driftAccuracyThreshold must be below minimumValidationAccuracy.",
      );
    }

    if (
      !Number.isFinite(
        driftConfidenceThreshold,
      ) ||
      driftConfidenceThreshold <=
        0.5 ||
      driftConfidenceThreshold >=
        1
    ) {
      throw new Error(
        "driftConfidenceThreshold must be in (0.5, 1).",
      );
    }

    if (
      !Number.isInteger(
        driftMaximumEvidence,
      ) ||
      driftMaximumEvidence <
        driftMinimumEvidence
    ) {
      throw new Error(
        "driftMaximumEvidence must be at least driftMinimumEvidence.",
      );
    }

    if (
      !Number.isFinite(
        sequentialEvidenceThreshold,
      ) ||
      sequentialEvidenceThreshold <=
        0
    ) {
      throw new Error(
        "sequentialEvidenceThreshold must be positive.",
      );
    }

    if (
      !Number.isInteger(
        maxChallengerAttemptsPerRegime,
      ) ||
      maxChallengerAttemptsPerRegime <
        1
    ) {
      throw new Error(
        "maxChallengerAttemptsPerRegime must be at least 1.",
      );
    }

    if (
      !Number.isInteger(
        challengerValidationGrowthPerAttempt,
      ) ||
      challengerValidationGrowthPerAttempt <
        0
    ) {
      throw new Error(
        "challengerValidationGrowthPerAttempt must be non-negative.",
      );
    }
  }

  record(input: {
    principleId:
      string;

    signature:
      InducedContextSignature;

    useful:
      boolean;
  }):
    AdaptivePredicateApplicabilityEstimate |
    undefined {
    const state =
      this.getOrCreateState(
        input.principleId,
      );

    const observation:
      Observation = {
      signature:
        cloneSignature(
          input.signature,
        ),

      useful:
        input.useful,
    };

    if (
      state.phase ===
        "bootstrap-fit"
    ) {
      state.bootstrapFit
        .push(
          observation,
        );

      state.bootstrapFitModel
        .record({
          principleId:
            input.principleId,

          signature:
            observation
              .signature,

          useful:
            observation.useful,
        });

      if (
        state.bootstrapFit
          .length >=
          this.fitObservationTarget
      ) {
        this.freezeBootstrap(
          input.principleId,
          state,
        );
      }

      return this.estimate(
        input.principleId,
        input.signature,
      );
    }

    if (
      state.phase ===
        "bootstrap-validation"
    ) {
      state.bootstrapValidation
        .push(
          observation,
        );

      if (
        state.bootstrapValidation
          .length >=
          this.validationObservationTarget
      ) {
        this.finalizeBootstrap(
          state,
        );
      }

      return this.estimate(
        input.principleId,
        input.signature,
      );
    }

    if (
      state.phase ===
        "bootstrap-rejected"
    ) {
      return undefined;
    }

    if (
      state.phase ===
        "regime-recall-validation"
    ) {
      state.regimeRecallValidation
        .push(
          observation,
        );

      if (
        state.regimeRecallValidation
          .length >=
          this.validationObservationTarget
      ) {
        this.finalizeRegimeRecall(
          state,
        );
      }

      return this.estimate(
        input.principleId,
        input.signature,
      );
    }

    if (
      state.phase ===
        "challenger-fit"
    ) {
      const challenger =
        state.challenger;

      if (
        !challenger
      ) {
        throw new Error(
          "challenger-fit phase requires challenger state.",
        );
      }

      challenger.fit
        .push(
          observation,
        );

      challenger.fitModel
        .record({
          principleId:
            input.principleId,

          signature:
            observation
              .signature,

          useful:
            observation.useful,
        });

      if (
        challenger.fit
          .length >=
          this.fitObservationTarget
      ) {
        this.freezeChallenger(
          input.principleId,
          state,
        );
      }

      return this.estimate(
        input.principleId,
        input.signature,
      );
    }

    if (
      state.phase ===
        "challenger-validation"
    ) {
      const challenger =
        state.challenger;

      if (
        !challenger
      ) {
        throw new Error(
          "challenger-validation phase requires challenger state.",
        );
      }

      challenger.validation
        .push(
          observation,
        );

      if (
        challenger.validation
          .length >=
          challenger.validationTarget
      ) {
        this.finalizeChallenger(
          state,
        );
      }

      return this.estimate(
        input.principleId,
        input.signature,
      );
    }

    const champion =
      state.champion;

    if (
      !champion
    ) {
      return undefined;
    }

    champion.operationalEvidence
      .push(
        observation,
      );

    const championCorrect =
      predictionFor(
        champion,
        observation
          .signature,
      ) ===
        observation.useful;

    this.updateSequentialDriftEvidence(
      state,
      championCorrect,
      champion.operationalEvidence
        .length,
    );

    if (
      state.recentChampionCorrectness
        .length >
        this.driftMaximumEvidence
    ) {
      state.recentChampionCorrectness
        .shift();

      state.changePointOperationalEvidenceIndex =
        champion.operationalEvidence
          .length -
        state.recentChampionCorrectness
          .length +
        1;
    }

    if (
      !state.challengerSearchExhausted &&
      state.recentChampionCorrectness
        .length >=
        this.driftMinimumEvidence &&
      this.recentDriftPosteriorProbability(
        state,
      ) >=
        this.driftConfidenceThreshold &&
      state.changePointScore >=
        this.sequentialEvidenceThreshold
    ) {
      this.startAdaptation(
        state,
      );
    }

    return this.estimate(
      input.principleId,
      input.signature,
    );
  }

  estimate(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    AdaptivePredicateApplicabilityEstimate |
    undefined {
    const state =
      this.states.get(
        principleId,
      );

    const champion =
      state?.champion;

    if (
      !state ||
      !champion ||
      state.phase ===
        "bootstrap-fit" ||
      state.phase ===
        "bootstrap-validation" ||
      state.phase ===
        "bootstrap-rejected"
    ) {
      return undefined;
    }

    const projection =
      projectionFor(
        champion.program,
        signature,
      );

    const evidence =
      [
        ...champion
          .baseEvidence,
        ...champion
          .operationalEvidence,
      ]
        .filter(
          (observation) =>
            projectionFor(
              champion.program,
              observation
                .signature,
            )
              .projectionKey ===
            projection
              .projectionKey,
        );

    const successes =
      evidence.filter(
        (observation) =>
          observation.useful,
      ).length;

    const failures =
      evidence.length -
      successes;

    return {
      principleId,

      program: {
        ...champion.program,
      },

      projection,

      successes,

      failures,

      evidenceCount:
        evidence.length,

      applicability:
        (
          successes +
          1
        ) / (
          successes +
          failures +
          2
        ),

      adaptation:
        this.summaryFor(
          principleId,
          state,
        ),
    };
  }

  getSummary(
    principleId:
      string,
  ):
    AdaptivePredicateSummary {
    const state =
      this.states.get(
        principleId,
      );

    if (
      !state
    ) {
      return {
        principleId,

        phase:
          "bootstrap-fit",

        championGeneration:
          0,

        replacementCount:
          0,

        archivedChampionCount:
          0,

        rollbackCount:
          0,

        regimeRecallValidationEvidenceCount:
          0,

        bootstrapFitEvidenceCount:
          0,

        bootstrapValidationEvidenceCount:
          0,

        championOperationalEvidenceCount:
          0,

        driftWindowEvidenceCount:
          0,

        driftConfidenceThreshold:
          this.driftConfidenceThreshold,

        changePointScore:
          0,

        changePointEvidenceCount:
          0,

        sequentialEvidenceThreshold:
          this.sequentialEvidenceThreshold,

        challengerFitEvidenceCount:
          0,

        challengerValidationEvidenceCount:
          0,

        challengerAttemptCount:
          0,

        challengerAttemptBudget:
          this.maxChallengerAttemptsPerRegime,

        challengerSearchExhausted:
          false,
      };
    }

    return this.summaryFor(
      principleId,
      state,
    );
  }

  private getOrCreateState(
    principleId:
      string,
  ):
    PrincipleState {
    const existing =
      this.states.get(
        principleId,
      );

    if (
      existing
    ) {
      return existing;
    }

    const created:
      PrincipleState = {
      phase:
        "bootstrap-fit",

      bootstrapFitModel:
        new SymbolicPredicateApplicabilityModel(
          this.fitObservationTarget,
          this
            .penaltyPerExtraOperation,
        ),

      bootstrapFit: [],

      bootstrapValidation: [],

      archivedChampions: [],

      regimeRecallValidation: [],

      recentChampionCorrectness: [],

      changePointScore:
        0,

      challengerAttemptCount:
        0,

      challengerSearchExhausted:
        false,

      replacementCount:
        0,

      rollbackCount:
        0,
    };

    this.states.set(
      principleId,
      created,
    );

    return created;
  }

  private freezeBootstrap(
    principleId:
      string,

    state:
      PrincipleState,
  ): void {
    const program =
      state.bootstrapFitModel
        .rankPrograms(
          principleId,
        )[0];

    if (
      !program
    ) {
      state.phase =
        "bootstrap-rejected";

      state.lastRejectionReason =
        "no-program";

      return;
    }

    const orientation =
      inferOrientation(
        state.bootstrapFit,
        program,
      );

    if (
      orientation ===
        undefined
    ) {
      state.phase =
        "bootstrap-rejected";

      state.lastRejectionReason =
        "ambiguous-orientation";

      return;
    }

    state.champion = {
      program: {
        ...program,
      },

      predictsUsefulWhenPredicateIs:
        orientation,

      baseEvidence:
        state.bootstrapFit
          .map(
            cloneObservation,
          ),

      operationalEvidence: [],

      generation:
        1,
    };

    state.phase =
      "bootstrap-validation";
  }

  private finalizeBootstrap(
    state:
      PrincipleState,
  ): void {
    const champion =
      state.champion;

    if (
      !champion
    ) {
      state.phase =
        "bootstrap-rejected";

      state.lastRejectionReason =
        "no-program";

      return;
    }

    const validationAccuracy =
      accuracy(
        state.bootstrapValidation,
        champion,
      );

    const baseline =
      majorityBaseline(
        state.bootstrapValidation,
      );

    state.lastChampionValidationAccuracy =
      validationAccuracy;

    state.lastValidationBaselineAccuracy =
      baseline;

    if (
      validationAccuracy >=
        this.minimumValidationAccuracy &&
      validationAccuracy >
        baseline +
        EPSILON
    ) {
      state.phase =
        "champion";

      return;
    }

    state.champion =
      undefined;

    state.phase =
      "bootstrap-rejected";

    state.lastRejectionReason =
      "bootstrap-validation-failed";
  }

  private startAdaptation(
    state:
      PrincipleState,
  ): void {
    state.lastDriftTriggerEvidenceCount =
      state.recentChampionCorrectness
        .length;

    state.lastDriftTriggerAccuracy =
      this.recentAccuracy(
        state,
      );

    state.lastDriftTriggerPosteriorProbability =
      this.recentDriftPosteriorProbability(
        state,
      );

    this.resetSequentialDriftEvidence(
      state,
    );

    if (
      state.archivedChampions
        .length >
        0
    ) {
      state.phase =
        "regime-recall-validation";

      state.regimeRecallValidation =
        [];

      state.challenger =
        undefined;

      return;
    }

    this.startChallenger(
      state,
    );
  }

  private startChallenger(
    state:
      PrincipleState,
  ): void {
    state.regimeRecallValidation =
      [];

    if (
      state.challengerAttemptCount >=
        this.maxChallengerAttemptsPerRegime
    ) {
      state.challenger =
        undefined;

      state.challengerSearchExhausted =
        true;

      state.phase =
        state.champion
          ? "champion"
          : "bootstrap-rejected";

      this.resetSequentialDriftEvidence(
        state,
      );

      return;
    }

    state.challengerAttemptCount +=
      1;

    const attempt =
      state.challengerAttemptCount;

    state.challengerSearchExhausted =
      false;

    state.phase =
      "challenger-fit";

    state.challenger = {
      fitModel:
        new SymbolicPredicateApplicabilityModel(
          this.fitObservationTarget,
          this
            .penaltyPerExtraOperation,
        ),

      fit: [],

      validation: [],

      attempt,

      validationTarget:
        this.validationObservationTarget +
        (
          attempt -
          1
        ) *
          this.challengerValidationGrowthPerAttempt,
    };
  }

  private freezeChallenger(
    principleId:
      string,

    state:
      PrincipleState,
  ): void {
    const challenger =
      state.challenger;

    if (
      !challenger
    ) {
      return;
    }

    const program =
      challenger.fitModel
        .rankPrograms(
          principleId,
        )[0];

    if (
      !program
    ) {
      this.rejectChallenger(
        state,
        "no-program",
      );

      return;
    }

    const orientation =
      inferOrientation(
        challenger.fit,
        program,
      );

    if (
      orientation ===
        undefined
    ) {
      this.rejectChallenger(
        state,
        "ambiguous-orientation",
      );

      return;
    }

    challenger.program = {
      ...program,
    };

    challenger.predictsUsefulWhenPredicateIs =
      orientation;

    state.phase =
      "challenger-validation";
  }

  private rememberChampion(
    state:
      PrincipleState,

    champion:
      FrozenProgram,
  ): void {
    state.archivedChampions =
      state.archivedChampions
        .filter(
          (
            archived,
          ) =>
            !sameFrozenProgram(
              archived,
              champion,
            ),
        );

    state.archivedChampions
      .push(
        cloneFrozenProgram(
          champion,
        ),
      );

    if (
      state.archivedChampions
        .length >
        MAX_ARCHIVED_CHAMPIONS
    ) {
      state.archivedChampions
        .splice(
          0,
          state
            .archivedChampions
            .length -
            MAX_ARCHIVED_CHAMPIONS,
        );
    }
  }

  private finalizeRegimeRecall(
    state:
      PrincipleState,
  ): void {
    const champion =
      state.champion;

    if (
      !champion ||
      state.archivedChampions
        .length ===
        0
    ) {
      state.lastRegimeRecallDecision =
        "no-match";

      this.startChallenger(
        state,
      );

      return;
    }

    const baseline =
      majorityBaseline(
        state.regimeRecallValidation,
      );

    const championAccuracy =
      accuracy(
        state.regimeRecallValidation,
        champion,
      );

    const ranked =
      state.archivedChampions
        .map(
          (
            archived,
          ) => ({
            archived,

            accuracy:
              accuracy(
                state.regimeRecallValidation,
                archived,
              ),
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.accuracy -
            left.accuracy,
        );

    const best =
      ranked[0];

    const second =
      ranked[1];

    state.lastRegimeRecallAccuracy =
      best?.accuracy;

    state.lastRegimeRecallGeneration =
      best?.archived
        .generation;

    const uniquelyBest =
      Boolean(
        best &&
        (
          !second ||
          best.accuracy >
            second.accuracy +
              EPSILON
        ),
      );

    const qualifies =
      Boolean(
        best &&
        uniquelyBest &&
        best.accuracy >=
          this.minimumValidationAccuracy &&
        best.accuracy >
          championAccuracy +
            EPSILON &&
        best.accuracy >
          baseline +
            EPSILON,
      );

    if (
      !best ||
      !qualifies
    ) {
      state.lastRegimeRecallDecision =
        "no-match";

      this.startChallenger(
        state,
      );

      return;
    }

    const restored =
      cloneFrozenProgram(
        best.archived,
      );

    state.archivedChampions =
      state.archivedChampions
        .filter(
          (
            archived,
          ) =>
            archived !==
            best.archived,
        );

    this.rememberChampion(
      state,
      champion,
    );

    state.champion =
      restored;

    state.rollbackCount +=
      1;

    state.lastRegimeRecallDecision =
      "rolled-back";

    state.lastReplacementDecision =
      "retained";

    state.lastRejectionReason =
      undefined;

    state.regimeRecallValidation =
      [];

    state.challenger =
      undefined;

    state.challengerAttemptCount =
      0;

    state.challengerSearchExhausted =
      false;

    this.resetSequentialDriftEvidence(
      state,
    );

    state.phase =
      "champion";
  }

  private finalizeChallenger(
    state:
      PrincipleState,
  ): void {
    const champion =
      state.champion;

    const challenger =
      state.challenger;

    if (
      !champion ||
      !challenger?.program ||
      challenger
        .predictsUsefulWhenPredicateIs ===
        undefined
    ) {
      this.rejectChallenger(
        state,
        "challenger-validation-failed",
      );

      return;
    }

    const frozenChallenger = {
      program:
        challenger.program,

      predictsUsefulWhenPredicateIs:
        challenger
          .predictsUsefulWhenPredicateIs,
    };

    const challengerAccuracy =
      accuracy(
        challenger.validation,
        frozenChallenger,
      );

    const championAccuracy =
      accuracy(
        challenger.validation,
        champion,
      );

    const baseline =
      majorityBaseline(
        challenger.validation,
      );

    state.lastChallengerValidationAccuracy =
      challengerAccuracy;

    state.lastChampionValidationAccuracy =
      championAccuracy;

    state.lastValidationBaselineAccuracy =
      baseline;

    if (
      challengerAccuracy >=
        this.minimumValidationAccuracy &&
      challengerAccuracy >
        championAccuracy +
        EPSILON &&
      challengerAccuracy >
        baseline +
        EPSILON
    ) {
      this.rememberChampion(
        state,
        champion,
      );

      state.champion = {
        program: {
          ...challenger.program,
        },

        predictsUsefulWhenPredicateIs:
          challenger
            .predictsUsefulWhenPredicateIs,

        baseEvidence:
          challenger.fit
            .map(
              cloneObservation,
            ),

        operationalEvidence: [],

        generation:
          champion.generation +
          1,
      };

      state.replacementCount +=
        1;

      state.lastReplacementDecision =
        "replaced";

      state.lastRejectionReason =
        undefined;

      state.challenger =
        undefined;

      state.challengerAttemptCount =
        0;

      state.challengerSearchExhausted =
        false;

      this.resetSequentialDriftEvidence(
        state,
      );

      state.phase =
        "champion";

      return;
    }

    this.rejectChallenger(
      state,
      "challenger-validation-failed",
    );
  }

  private rejectChallenger(
    state:
      PrincipleState,

    reason:
      NonNullable<
        AdaptivePredicateSummary[
          "lastRejectionReason"
        ]
      >,
  ): void {
    state.lastReplacementDecision =
      "retained";

    state.lastRejectionReason =
      reason;

    state.challenger =
      undefined;

    state.challengerSearchExhausted =
      state.challengerAttemptCount >=
        this.maxChallengerAttemptsPerRegime;

    this.resetSequentialDriftEvidence(
      state,
    );

    state.phase =
      state.champion
        ? "champion"
        : "bootstrap-rejected";
  }

  private resetSequentialDriftEvidence(
    state:
      PrincipleState,
  ): void {
    state.recentChampionCorrectness =
      [];

    state.changePointScore =
      0;

    state.changePointOperationalEvidenceIndex =
      undefined;
  }

  private updateSequentialDriftEvidence(
    state:
      PrincipleState,

    correct:
      boolean,

    operationalEvidenceIndex:
      number,
  ): void {
    const stableAccuracy =
      this.minimumValidationAccuracy;

    const driftAccuracy =
      this.driftAccuracyThreshold;

    const increment =
      correct
        ? Math.log(
            driftAccuracy /
              stableAccuracy,
          )
        : Math.log(
            (
              1 -
              driftAccuracy
            ) /
              (
                1 -
                stableAccuracy
              ),
          );

    const nextScore =
      state.changePointScore +
      increment;

    if (
      nextScore <=
        EPSILON
    ) {
      this.resetSequentialDriftEvidence(
        state,
      );

      return;
    }

    if (
      state.changePointScore <=
        EPSILON
    ) {
      state.recentChampionCorrectness =
        [];

      state.changePointOperationalEvidenceIndex =
        operationalEvidenceIndex;
    }

    state.changePointScore =
      nextScore;

    state.recentChampionCorrectness
      .push(
        correct,
      );
  }

  private recentDriftPosteriorProbability(
    state:
      PrincipleState,
  ):
    number {
    return driftPosteriorProbability(
      state.recentChampionCorrectness,
      this.driftAccuracyThreshold,
    );
  }

  private recentAccuracy(
    state:
      PrincipleState,
  ):
    number {
    if (
      state.recentChampionCorrectness
        .length ===
        0
    ) {
      return 1;
    }

    return (
      state.recentChampionCorrectness
        .filter(
          Boolean,
        )
        .length /
      state.recentChampionCorrectness
        .length
    );
  }

  private summaryFor(
    principleId:
      string,

    state:
      PrincipleState,
  ):
    AdaptivePredicateSummary {
    return {
      principleId,

      phase:
        state.phase,

      championGeneration:
        state.champion
          ?.generation ??
        0,

      ...(state.champion
        ? {
            championProgramId:
              state.champion
                .program
                .id,

            championPredictsUsefulWhenPredicateIs:
              state.champion
                .predictsUsefulWhenPredicateIs,
          }
        : {}),

      replacementCount:
        state.replacementCount,

      archivedChampionCount:
        state.archivedChampions
          .length,

      rollbackCount:
        state.rollbackCount,

      regimeRecallValidationEvidenceCount:
        state.regimeRecallValidation
          .length,

      ...(state
          .lastRegimeRecallAccuracy !==
        undefined
        ? {
            lastRegimeRecallAccuracy:
              state
                .lastRegimeRecallAccuracy,
          }
        : {}),

      ...(state
          .lastRegimeRecallGeneration !==
        undefined
        ? {
            lastRegimeRecallGeneration:
              state
                .lastRegimeRecallGeneration,
          }
        : {}),

      ...(state
          .lastRegimeRecallDecision
        ? {
            lastRegimeRecallDecision:
              state
                .lastRegimeRecallDecision,
          }
        : {}),

      bootstrapFitEvidenceCount:
        state.bootstrapFit
          .length,

      bootstrapValidationEvidenceCount:
        state.bootstrapValidation
          .length,

      championOperationalEvidenceCount:
        state.champion
          ?.operationalEvidence
          .length ??
        0,

      driftWindowEvidenceCount:
        state.recentChampionCorrectness
          .length,

      ...(state.recentChampionCorrectness
          .length >
        0
        ? {
            driftWindowAccuracy:
              this.recentAccuracy(
                state,
              ),

            driftPosteriorProbability:
              this.recentDriftPosteriorProbability(
                state,
              ),
          }
        : {}),

      driftConfidenceThreshold:
        this.driftConfidenceThreshold,

      changePointScore:
        state.changePointScore,

      changePointEvidenceCount:
        state.recentChampionCorrectness
          .length,

      ...(state
          .changePointOperationalEvidenceIndex !==
        undefined
        ? {
            changePointOperationalEvidenceIndex:
              state
                .changePointOperationalEvidenceIndex,
          }
        : {}),

      sequentialEvidenceThreshold:
        this.sequentialEvidenceThreshold,

      ...(state
          .lastDriftTriggerEvidenceCount !==
        undefined
        ? {
            lastDriftTriggerEvidenceCount:
              state
                .lastDriftTriggerEvidenceCount,
          }
        : {}),

      ...(state
          .lastDriftTriggerAccuracy !==
        undefined
        ? {
            lastDriftTriggerAccuracy:
              state
                .lastDriftTriggerAccuracy,
          }
        : {}),

      ...(state
          .lastDriftTriggerPosteriorProbability !==
        undefined
        ? {
            lastDriftTriggerPosteriorProbability:
              state
                .lastDriftTriggerPosteriorProbability,
          }
        : {}),

      challengerFitEvidenceCount:
        state.challenger
          ?.fit
          .length ??
        0,

      challengerValidationEvidenceCount:
        state.challenger
          ?.validation
          .length ??
        0,

      ...(state.challenger
        ? {
            challengerValidationTarget:
              state.challenger
                .validationTarget,
          }
        : {}),

      challengerAttemptCount:
        state.challengerAttemptCount,

      challengerAttemptBudget:
        this.maxChallengerAttemptsPerRegime,

      challengerSearchExhausted:
        state.challengerSearchExhausted,

      ...(state.challenger
          ?.program
        ? {
            challengerProgramId:
              state.challenger
                .program
                .id,
          }
        : {}),

      ...(state
          .lastChallengerValidationAccuracy !==
        undefined
        ? {
            lastChallengerValidationAccuracy:
              state
                .lastChallengerValidationAccuracy,
          }
        : {}),

      ...(state
          .lastChampionValidationAccuracy !==
        undefined
        ? {
            lastChampionValidationAccuracy:
              state
                .lastChampionValidationAccuracy,
          }
        : {}),

      ...(state
          .lastValidationBaselineAccuracy !==
        undefined
        ? {
            lastValidationBaselineAccuracy:
              state
                .lastValidationBaselineAccuracy,
          }
        : {}),

      ...(state
          .lastReplacementDecision
        ? {
            lastReplacementDecision:
              state
                .lastReplacementDecision,
          }
        : {}),

      ...(state
          .lastRejectionReason
        ? {
            lastRejectionReason:
              state
                .lastRejectionReason,
          }
        : {}),
    };
  }
}

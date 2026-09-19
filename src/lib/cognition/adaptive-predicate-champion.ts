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

  replacementCount:
    number;

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

  lastDriftTriggerEvidenceCount?:
    number;

  lastDriftTriggerAccuracy?:
    number;

  challengerFitEvidenceCount:
    number;

  challengerValidationEvidenceCount:
    number;

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

  recentChampionCorrectness:
    boolean[];

  challenger?:
    ChallengerState;

  replacementCount:
    number;

  lastDriftTriggerEvidenceCount?:
    number;

  lastDriftTriggerAccuracy?:
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

    private readonly driftWindowSize =
      3,

    private readonly driftAccuracyThreshold =
      0.5,
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
        driftWindowSize,
      ) ||
      driftWindowSize <
        2
    ) {
      throw new Error(
        "driftWindowSize must be at least 2.",
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
          this.validationObservationTarget
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

    state.recentChampionCorrectness
      .push(
        predictionFor(
          champion,
          observation
            .signature,
        ) ===
          observation.useful,
      );

    if (
      state.recentChampionCorrectness
        .length >
        this.driftWindowSize
    ) {
      state.recentChampionCorrectness
        .shift();
    }

    if (
      state.recentChampionCorrectness
        .length ===
        this.driftWindowSize &&
      this.recentAccuracy(
        state,
      ) <=
        this.driftAccuracyThreshold
    ) {
      this.startChallenger(
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

        bootstrapFitEvidenceCount:
          0,

        bootstrapValidationEvidenceCount:
          0,

        championOperationalEvidenceCount:
          0,

        driftWindowEvidenceCount:
          0,

        challengerFitEvidenceCount:
          0,

        challengerValidationEvidenceCount:
          0,
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

      recentChampionCorrectness: [],

      replacementCount:
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

  private startChallenger(
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
    };

    state.recentChampionCorrectness =
      [];
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

      state.recentChampionCorrectness =
        [];

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

    state.recentChampionCorrectness =
      [];

    state.phase =
      state.champion
        ? "champion"
        : "bootstrap-rejected";
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
          }
        : {}),

      replacementCount:
        state.replacementCount,

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
          }
        : {}),

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

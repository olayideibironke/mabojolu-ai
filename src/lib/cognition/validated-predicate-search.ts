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

export type PredicateValidationStatus =
  | "fitting"
  | "validating"
  | "validated"
  | "rejected";

export interface PredicateValidationSummary {
  principleId:
    string;

  status:
    PredicateValidationStatus;

  fitEvidenceCount:
    number;

  validationEvidenceCount:
    number;

  operationalEvidenceCount:
    number;

  programId?:
    string;

  predictsUsefulWhenPredicateIs?:
    boolean;

  validationAccuracy?:
    number;

  validationBaselineAccuracy?:
    number;

  rejectionReason?:
    "no-fit-program" |
    "ambiguous-fit-orientation" |
    "insufficient-validation-diversity" |
    "failed-held-out-validation";
}

export interface ValidatedPredicateApplicabilityEstimate
  extends
    SymbolicPredicateApplicabilityEstimate {
  validation:
    PredicateValidationSummary;
}

interface PrincipleValidationState {
  fitModel:
    SymbolicPredicateApplicabilityModel;

  fit:
    Observation[];

  validation:
    Observation[];

  operational:
    Observation[];

  status:
    PredicateValidationStatus;

  program?:
    SymbolicPredicateProgram;

  predictsUsefulWhenPredicateIs?:
    boolean;

  validationAccuracy?:
    number;

  validationBaselineAccuracy?:
    number;

  rejectionReason?:
    PredicateValidationSummary[
      "rejectionReason"
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

function evaluateProgram(
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
    evaluateProgram(
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
):
  number |
  undefined {
  if (
    observations.length ===
      0
  ) {
    return undefined;
  }

  return (
    observations.filter(
      (observation) =>
        observation.useful,
    ).length /
    observations.length
  );
}

/**
 * Adds a one-shot held-out validation barrier in front of symbolic predicates.
 *
 * Fit observations choose and freeze the program. Validation observations are
 * then sequestered: they can approve or reject that frozen program, but they
 * cannot change which program was selected. Validation outcomes are not reused
 * as applicability evidence after approval.
 */
export class ValidatedSymbolicPredicateApplicabilityModel {
  private readonly states =
    new Map<
      string,
      PrincipleValidationState
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
  }

  record(input: {
    principleId:
      string;

    signature:
      InducedContextSignature;

    useful:
      boolean;
  }):
    ValidatedPredicateApplicabilityEstimate |
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
      state.status ===
        "fitting"
    ) {
      state.fit.push(
        observation,
      );

      state.fitModel.record({
        principleId:
          input.principleId,

        signature:
          observation
            .signature,

        useful:
          observation.useful,
      });

      if (
        state.fit.length >=
          this.fitObservationTarget
      ) {
        this.freezeProgram(
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
      state.status ===
        "validating"
    ) {
      state.validation.push(
        observation,
      );

      if (
        state.validation.length >=
          this.validationObservationTarget
      ) {
        this.finalizeValidation(
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
      state.status ===
        "validated"
    ) {
      state.operational.push(
        observation,
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
    ValidatedPredicateApplicabilityEstimate |
    undefined {
    const state =
      this.states.get(
        principleId,
      );

    if (
      !state ||
      state.status !==
        "validated" ||
      !state.program
    ) {
      return undefined;
    }

    const projection =
      projectionFor(
        state.program,
        signature,
      );

    const evidence =
      [
        ...state.fit,
        ...state.operational,
      ]
        .filter(
          (observation) =>
            projectionFor(
              state.program as
                SymbolicPredicateProgram,
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
        ...state.program,
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

      validation:
        this.summaryFor(
          principleId,
          state,
        ),
    };
  }

  getValidationSummary(
    principleId:
      string,
  ):
    PredicateValidationSummary {
    const state =
      this.states.get(
        principleId,
      );

    if (
      !state
    ) {
      return {
        principleId,

        status:
          "fitting",

        fitEvidenceCount:
          0,

        validationEvidenceCount:
          0,

        operationalEvidenceCount:
          0,
      };
    }

    return this.summaryFor(
      principleId,
      state,
    );
  }

  getObservationCount(
    principleId?:
      string,
  ):
    number {
    if (
      principleId
    ) {
      const state =
        this.states.get(
          principleId,
        );

      return state
        ? state.fit.length +
            state.validation.length +
            state.operational.length
        : 0;
    }

    let total =
      0;

    for (
      const state of
        this.states.values()
    ) {
      total +=
        state.fit.length +
        state.validation.length +
        state.operational.length;
    }

    return total;
  }

  private getOrCreateState(
    principleId:
      string,
  ):
    PrincipleValidationState {
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
      PrincipleValidationState = {
      fitModel:
        new SymbolicPredicateApplicabilityModel(
          this.fitObservationTarget,
          this
            .penaltyPerExtraOperation,
        ),

      fit: [],

      validation: [],

      operational: [],

      status:
        "fitting",
    };

    this.states.set(
      principleId,
      created,
    );

    return created;
  }

  private freezeProgram(
    principleId:
      string,

    state:
      PrincipleValidationState,
  ): void {
    const program =
      state.fitModel
        .rankPrograms(
          principleId,
        )[0];

    if (
      !program
    ) {
      state.status =
        "rejected";

      state.rejectionReason =
        "no-fit-program";

      return;
    }

    const trueObservations =
      state.fit.filter(
        (observation) =>
          evaluateProgram(
            program,
            observation
              .signature,
          ),
      );

    const falseObservations =
      state.fit.filter(
        (observation) =>
          !evaluateProgram(
            program,
            observation
              .signature,
          ),
      );

    const trueUsefulRate =
      usefulRate(
        trueObservations,
      );

    const falseUsefulRate =
      usefulRate(
        falseObservations,
      );

    if (
      trueUsefulRate ===
        undefined ||
      falseUsefulRate ===
        undefined ||
      Math.abs(
        trueUsefulRate -
        falseUsefulRate,
      ) <=
        EPSILON
    ) {
      state.status =
        "rejected";

      state.rejectionReason =
        "ambiguous-fit-orientation";

      return;
    }

    state.program = {
      ...program,
    };

    state.predictsUsefulWhenPredicateIs =
      trueUsefulRate >
      falseUsefulRate;

    state.status =
      "validating";
  }

  private finalizeValidation(
    principleId:
      string,

    state:
      PrincipleValidationState,
  ): void {
    if (
      !state.program ||
      state
        .predictsUsefulWhenPredicateIs ===
        undefined
    ) {
      state.status =
        "rejected";

      state.rejectionReason =
        "no-fit-program";

      return;
    }

    const outcomes =
      new Set(
        state.validation
          .map(
            (observation) =>
              observation.useful,
          ),
      );

    if (
      outcomes.size <
        2
    ) {
      state.status =
        "rejected";

      state.rejectionReason =
        "insufficient-validation-diversity";

      return;
    }

    const correct =
      state.validation
        .filter(
          (observation) => {
            const prediction =
              evaluateProgram(
                state.program as
                  SymbolicPredicateProgram,
                observation
                  .signature,
              ) ===
              state
                .predictsUsefulWhenPredicateIs;

            return prediction ===
              observation.useful;
          },
        )
        .length;

    const validationAccuracy =
      correct /
      state.validation.length;

    const positives =
      state.validation
        .filter(
          (observation) =>
            observation.useful,
        )
        .length;

    const negatives =
      state.validation.length -
      positives;

    const baselineAccuracy =
      Math.max(
        positives,
        negatives,
      ) /
      state.validation.length;

    state.validationAccuracy =
      validationAccuracy;

    state.validationBaselineAccuracy =
      baselineAccuracy;

    if (
      validationAccuracy >=
        this.minimumValidationAccuracy &&
      validationAccuracy >
        baselineAccuracy +
        EPSILON
    ) {
      state.status =
        "validated";

      return;
    }

    state.status =
      "rejected";

    state.rejectionReason =
      "failed-held-out-validation";
  }

  private summaryFor(
    principleId:
      string,

    state:
      PrincipleValidationState,
  ):
    PredicateValidationSummary {
    return {
      principleId,

      status:
        state.status,

      fitEvidenceCount:
        state.fit.length,

      validationEvidenceCount:
        state.validation.length,

      operationalEvidenceCount:
        state.operational.length,

      ...(state.program
        ? {
            programId:
              state.program.id,
          }
        : {}),

      ...(state
          .predictsUsefulWhenPredicateIs !==
        undefined
        ? {
            predictsUsefulWhenPredicateIs:
              state
                .predictsUsefulWhenPredicateIs,
          }
        : {}),

      ...(state.validationAccuracy !==
        undefined
        ? {
            validationAccuracy:
              state
                .validationAccuracy,
          }
        : {}),

      ...(state
          .validationBaselineAccuracy !==
        undefined
        ? {
            validationBaselineAccuracy:
              state
                .validationBaselineAccuracy,
          }
        : {}),

      ...(state.rejectionReason
        ? {
            rejectionReason:
              state.rejectionReason,
          }
        : {}),
    };
  }
}

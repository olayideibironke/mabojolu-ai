import {
  ValidatedSymbolicPredicateApplicabilityModel,
  type PredicateValidationSummary,
  type ValidatedPredicateApplicabilityEstimate,
} from "./validated-predicate-search";

import type {
  InducedContextSignature,
} from "./principle-context-signature";

type Observation = {
  signature:
    InducedContextSignature;

  useful:
    boolean;
};

type GenerationDecision =
  | "initial-champion-accepted"
  | "initial-candidate-rejected"
  | "challenger-promoted"
  | "challenger-rejected"
  | "challenger-not-better";

interface GenerationState {
  generation:
    number;

  model:
    ValidatedSymbolicPredicateApplicabilityModel;

  observations:
    Observation[];
}

interface ChampionState {
  generation:
    number;

  model:
    ValidatedSymbolicPredicateApplicabilityModel;
}

interface PrincipleAdaptiveState {
  champion?:
    ChampionState;

  active:
    GenerationState;

  replacementCount:
    number;

  completedGenerationCount:
    number;

  totalObservationCount:
    number;

  lastDecision?:
    GenerationDecision;

  lastIncumbentReserveAccuracy?:
    number;

  lastChallengerReserveAccuracy?:
    number;
}

export type AdaptivePredicateStatus =
  | "initial-fitting"
  | "initial-validating"
  | "challenger-fitting"
  | "challenger-validating";

export interface AdaptivePredicateValidationSummary {
  principleId:
    string;

  status:
    AdaptivePredicateStatus;

  activeGeneration:
    number;

  championGeneration?:
    number;

  championProgramId?:
    string;

  championPredictsUsefulWhenPredicateIs?:
    boolean;

  activeProgramId?:
    string;

  activeValidationStatus:
    PredicateValidationSummary[
      "status"
    ];

  activeFitEvidenceCount:
    number;

  activeValidationEvidenceCount:
    number;

  replacementCount:
    number;

  completedGenerationCount:
    number;

  totalObservationCount:
    number;

  lastDecision?:
    GenerationDecision;

  lastIncumbentReserveAccuracy?:
    number;

  lastChallengerReserveAccuracy?:
    number;
}

export interface AdaptiveValidatedPredicateApplicabilityEstimate
  extends
    ValidatedPredicateApplicabilityEstimate {
  adaptiveValidation:
    AdaptivePredicateValidationSummary;
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

/**
 * Continual challenger/champion validation for symbolic predicates.
 *
 * Every generation receives fresh evidence. The active generation first fits a
 * frozen v0.9 predicate and then validates it on its own sequestered reserve.
 * Once a champion exists, that same reserve is used only to SCORE the incumbent
 * and challenger. It is never added to either model's applicability evidence.
 *
 * A challenger is promoted only when it:
 * 1. independently passes the v0.9 held-out gate; and
 * 2. strictly outperforms the incumbent champion on the challenger's fresh
 *    reserve.
 *
 * Ties keep the incumbent to avoid replacement churn.
 */
export class AdaptiveValidatedSymbolicPredicateApplicabilityModel
  extends
    ValidatedSymbolicPredicateApplicabilityModel {
  private readonly adaptiveStates =
    new Map<
      string,
      PrincipleAdaptiveState
    >();

  constructor(
    private readonly adaptiveFitObservationTarget =
      6,

    private readonly adaptiveValidationObservationTarget =
      3,

    private readonly adaptiveMinimumValidationAccuracy =
      0.75,

    private readonly adaptivePenaltyPerExtraOperation =
      0.05,
  ) {
    super(
      adaptiveFitObservationTarget,
      adaptiveValidationObservationTarget,
      adaptiveMinimumValidationAccuracy,
      adaptivePenaltyPerExtraOperation,
    );
  }

  override record(input: {
    principleId:
      string;

    signature:
      InducedContextSignature;

    useful:
      boolean;
  }):
    AdaptiveValidatedPredicateApplicabilityEstimate |
    undefined {
    const state =
      this.getOrCreateAdaptiveState(
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

    state.active
      .observations
      .push(
        observation,
      );

    state.totalObservationCount +=
      1;

    state.active
      .model
      .record({
        principleId:
          input.principleId,

        signature:
          observation.signature,

        useful:
          observation.useful,
      });

    this.maybeCompleteGeneration(
      input.principleId,
      state,
    );

    return this.estimate(
      input.principleId,
      input.signature,
    );
  }

  override estimate(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    AdaptiveValidatedPredicateApplicabilityEstimate |
    undefined {
    const state =
      this.adaptiveStates.get(
        principleId,
      );

    if (
      !state?.champion
    ) {
      return undefined;
    }

    const estimate =
      state.champion
        .model
        .estimate(
          principleId,
          signature,
        );

    if (
      !estimate
    ) {
      return undefined;
    }

    return {
      ...estimate,

      program: {
        ...estimate.program,
      },

      projection: {
        ...estimate.projection,
      },

      validation: {
        ...estimate.validation,
      },

      adaptiveValidation:
        this.summaryFor(
          principleId,
          state,
        ),
    };
  }

  override getValidationSummary(
    principleId:
      string,
  ):
    PredicateValidationSummary {
    const state =
      this.adaptiveStates.get(
        principleId,
      );

    if (
      !state
    ) {
      return super
        .getValidationSummary(
          principleId,
        );
    }

    if (
      state.champion
    ) {
      return state.champion
        .model
        .getValidationSummary(
          principleId,
        );
    }

    return state.active
      .model
      .getValidationSummary(
        principleId,
      );
  }

  getAdaptiveValidationSummary(
    principleId:
      string,
  ):
    AdaptivePredicateValidationSummary {
    const state =
      this.getOrCreateAdaptiveState(
        principleId,
      );

    return this.summaryFor(
      principleId,
      state,
    );
  }

  override getObservationCount(
    principleId?:
      string,
  ):
    number {
    if (
      principleId
    ) {
      return (
        this.adaptiveStates
          .get(
            principleId,
          )
          ?.totalObservationCount ??
        0
      );
    }

    let total =
      0;

    for (
      const state of
        this.adaptiveStates
          .values()
    ) {
      total +=
        state.totalObservationCount;
    }

    return total;
  }

  private createGeneration(
    generation:
      number,
  ):
    GenerationState {
    return {
      generation,

      model:
        new ValidatedSymbolicPredicateApplicabilityModel(
          this
            .adaptiveFitObservationTarget,
          this
            .adaptiveValidationObservationTarget,
          this
            .adaptiveMinimumValidationAccuracy,
          this
            .adaptivePenaltyPerExtraOperation,
        ),

      observations: [],
    };
  }

  private getOrCreateAdaptiveState(
    principleId:
      string,
  ):
    PrincipleAdaptiveState {
    const existing =
      this.adaptiveStates.get(
        principleId,
      );

    if (
      existing
    ) {
      return existing;
    }

    const created:
      PrincipleAdaptiveState = {
      active:
        this.createGeneration(
          1,
        ),

      replacementCount:
        0,

      completedGenerationCount:
        0,

      totalObservationCount:
        0,
    };

    this.adaptiveStates.set(
      principleId,
      created,
    );

    return created;
  }

  private maybeCompleteGeneration(
    principleId:
      string,

    state:
      PrincipleAdaptiveState,
  ): void {
    const activeSummary =
      state.active
        .model
        .getValidationSummary(
          principleId,
        );

    if (
      activeSummary.status !==
        "validated" &&
      activeSummary.status !==
        "rejected"
    ) {
      return;
    }

    state.completedGenerationCount +=
      1;

    if (
      !state.champion
    ) {
      if (
        activeSummary.status ===
          "validated"
      ) {
        state.champion = {
          generation:
            state.active
              .generation,

          model:
            state.active
              .model,
        };

        state.lastDecision =
          "initial-champion-accepted";
      } else {
        state.lastDecision =
          "initial-candidate-rejected";
      }

      this.startNextGeneration(
        state,
      );

      return;
    }

    if (
      activeSummary.status ===
        "rejected"
    ) {
      state.lastDecision =
        "challenger-rejected";

      state.lastIncumbentReserveAccuracy =
        undefined;

      state.lastChallengerReserveAccuracy =
        undefined;

      this.startNextGeneration(
        state,
      );

      return;
    }

    const reserve =
      state.active
        .observations
        .slice(
          this
            .adaptiveFitObservationTarget,
          this
            .adaptiveFitObservationTarget +
          this
            .adaptiveValidationObservationTarget,
        );

    const incumbentReserveAccuracy =
      this.accuracyOnReserve(
        state.champion
          .model,
        principleId,
        reserve,
      );

    const challengerReserveAccuracy =
      this.accuracyOnReserve(
        state.active
          .model,
        principleId,
        reserve,
      );

    state.lastIncumbentReserveAccuracy =
      incumbentReserveAccuracy;

    state.lastChallengerReserveAccuracy =
      challengerReserveAccuracy;

    if (
      challengerReserveAccuracy !==
        undefined &&
      incumbentReserveAccuracy !==
        undefined &&
      challengerReserveAccuracy >
        incumbentReserveAccuracy +
          EPSILON
    ) {
      state.champion = {
        generation:
          state.active
            .generation,

        model:
          state.active
            .model,
      };

      state.replacementCount +=
        1;

      state.lastDecision =
        "challenger-promoted";
    } else {
      state.lastDecision =
        "challenger-not-better";
    }

    this.startNextGeneration(
      state,
    );
  }

  private startNextGeneration(
    state:
      PrincipleAdaptiveState,
  ): void {
    state.active =
      this.createGeneration(
        state.active
          .generation +
          1,
      );
  }

  private accuracyOnReserve(
    model:
      ValidatedSymbolicPredicateApplicabilityModel,

    principleId:
      string,

    reserve:
      readonly Observation[],
  ):
    number |
    undefined {
    if (
      reserve.length ===
        0
    ) {
      return undefined;
    }

    let correct =
      0;

    for (
      const observation of
        reserve
    ) {
      const estimate =
        model.estimate(
          principleId,
          observation
            .signature,
        );

      if (
        !estimate ||
        estimate
          .validation
          .predictsUsefulWhenPredicateIs ===
          undefined
      ) {
        return undefined;
      }

      const predictedUseful =
        estimate
          .projection
          .predicateValue ===
        estimate
          .validation
          .predictsUsefulWhenPredicateIs;

      if (
        predictedUseful ===
          observation.useful
      ) {
        correct +=
          1;
      }
    }

    return (
      correct /
      reserve.length
    );
  }

  private summaryFor(
    principleId:
      string,

    state:
      PrincipleAdaptiveState,
  ):
    AdaptivePredicateValidationSummary {
    const activeSummary =
      state.active
        .model
        .getValidationSummary(
          principleId,
        );

    const championSummary =
      state.champion
        ?.model
        .getValidationSummary(
          principleId,
        );

    const status:
      AdaptivePredicateStatus =
      state.champion
        ? activeSummary.status ===
            "validating"
          ? "challenger-validating"
          : "challenger-fitting"
        : activeSummary.status ===
              "validating"
          ? "initial-validating"
          : "initial-fitting";

    return {
      principleId,

      status,

      activeGeneration:
        state.active
          .generation,

      ...(state.champion
        ? {
            championGeneration:
              state.champion
                .generation,
          }
        : {}),

      ...(championSummary
          ?.programId
        ? {
            championProgramId:
              championSummary
                .programId,
          }
        : {}),

      ...(championSummary
          ?.predictsUsefulWhenPredicateIs !==
        undefined
        ? {
            championPredictsUsefulWhenPredicateIs:
              championSummary
                .predictsUsefulWhenPredicateIs,
          }
        : {}),

      ...(activeSummary.programId
        ? {
            activeProgramId:
              activeSummary
                .programId,
          }
        : {}),

      activeValidationStatus:
        activeSummary.status,

      activeFitEvidenceCount:
        activeSummary
          .fitEvidenceCount,

      activeValidationEvidenceCount:
        activeSummary
          .validationEvidenceCount,

      replacementCount:
        state.replacementCount,

      completedGenerationCount:
        state
          .completedGenerationCount,

      totalObservationCount:
        state.totalObservationCount,

      ...(state.lastDecision
        ? {
            lastDecision:
              state.lastDecision,
          }
        : {}),

      ...(state
          .lastIncumbentReserveAccuracy !==
        undefined
        ? {
            lastIncumbentReserveAccuracy:
              state
                .lastIncumbentReserveAccuracy,
          }
        : {}),

      ...(state
          .lastChallengerReserveAccuracy !==
        undefined
        ? {
            lastChallengerReserveAccuracy:
              state
                .lastChallengerReserveAccuracy,
          }
        : {}),
    };
  }
}

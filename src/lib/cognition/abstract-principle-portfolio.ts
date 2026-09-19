import type {
  EnvironmentSnapshot,
} from "./environment";

import type {
  ComposedContextFeatureApplicabilityModel,
  ComposedContextProjection,
} from "./context-feature-composition";

import type {
  RelationalContextFeatureApplicabilityModel,
  RelationalContextProjection,
} from "./context-feature-relation";

import type {
  SymbolicPredicateApplicabilityModel,
  SymbolicPredicateProjection,
} from "./context-predicate-search";

import type {
  PredicateValidationSummary,
  ValidatedSymbolicPredicateApplicabilityModel,
} from "./validated-predicate-search";

import type {
  AdaptivePredicateSummary,
  AdaptiveValidatedPredicateApplicabilityModel,
} from "./adaptive-predicate-champion";

import type {
  LearnedContextFeatureApplicabilityModel,
  LearnedContextProjection,
} from "./context-feature-learning";

import {
  StructuralContextSignatureEncoder,
  type InducedContextApplicabilityModel,
  type InducedContextSignature,
} from "./principle-context-signature";

import type {
  PrincipleApplicabilityContext,
  PrincipleApplicabilityModel,
} from "./principle-applicability-model";

import {
  AbstractPrincipleController,
  CrossFamilyPrincipleLibrary,
  type AbstractPrinciple,
  type AbstractPrincipleEpisode,
} from "./abstract-principle";

import {
  MonotonicProgressPrincipleController,
  MonotonicProgressPrincipleLibrary,
  type MonotonicProgressPrinciple,
} from "./monotonic-principle";

export type PortfolioPrinciple =
  | AbstractPrinciple
  | MonotonicProgressPrinciple;

export interface PrincipleSelection {
  action:
    string;

  principleId:
    string;

  principleKind:
    PortfolioPrinciple[
      "kind"
    ];

  confidence:
    number;

  applicability:
    number;

  score:
    number;

  applicabilitySource:
    "static" |
    "model-prior" |
    "learned" |
    "induced-prior" |
    "induced-learned" |
    "feature-prior" |
    "feature-learned" |
    "composed-prior" |
    "composed-learned" |
    "relational-prior" |
    "relational-learned" |
    "predicate-prior" |
    "predicate-learned" |
    "validated-predicate-learned" |
    "adaptive-predicate-champion";

  applicabilityEvidenceCount:
    number;

  applicabilityContext:
    PrincipleApplicabilityContext;

  inducedContextSignature?:
    InducedContextSignature;

  learnedContextProjection?:
    LearnedContextProjection;

  composedContextProjection?:
    ComposedContextProjection;

  relationalContextProjection?:
    RelationalContextProjection;

  symbolicPredicateProjection?:
    SymbolicPredicateProjection;

  predicateValidation?:
    PredicateValidationSummary;

  predicateAdaptation?:
    AdaptivePredicateSummary;
}

export interface AbstractPrinciplePortfolioSnapshot {
  principles:
    PortfolioPrinciple[];

  selections:
    PrincipleSelection[];
}

function clonePrinciple(
  principle:
    PortfolioPrinciple,
):
  PortfolioPrinciple {
  return {
    ...principle,

    supportFamilies: [
      ...principle
        .supportFamilies,
    ],

    supportFamilyKinds: [
      ...principle
        .supportFamilyKinds,
    ],

    supportEpisodeIds: [
      ...principle
        .supportEpisodeIds,
    ],
  };
}

function selectionScore(input: {
  confidence:
    number;

  applicability:
    number;
}):
  number {
  return (
    input.confidence *
    input.applicability
  );
}

/**
 * Persistent evidence store for multiple higher-order principles.
 *
 * It intentionally contains no target-episode binding state. Every runtime
 * creates a fresh AbstractPrinciplePortfolioController from this evidence.
 */
export class AbstractPrinciplePortfolio {
  readonly deferred:
    CrossFamilyPrincipleLibrary;

  readonly monotonic:
    MonotonicProgressPrincipleLibrary;

  constructor(input?: {
    deferred?:
      CrossFamilyPrincipleLibrary;

    monotonic?:
      MonotonicProgressPrincipleLibrary;
  }) {
    this.deferred =
      input?.deferred ??
      new CrossFamilyPrincipleLibrary();

    this.monotonic =
      input?.monotonic ??
      new MonotonicProgressPrincipleLibrary();
  }

  learnFromEpisode(
    episode:
      AbstractPrincipleEpisode,
  ): void {
    this.deferred
      .learnFromEpisode(
        episode,
      );

    this.monotonic
      .learnFromEpisode(
        episode,
      );
  }

  createController(input?: {
    applicabilityModel?:
      PrincipleApplicabilityModel;

    inducedContextApplicabilityModel?:
      InducedContextApplicabilityModel;

    learnedContextFeatureApplicabilityModel?:
      LearnedContextFeatureApplicabilityModel;

    composedContextFeatureApplicabilityModel?:
      ComposedContextFeatureApplicabilityModel;

    relationalContextFeatureApplicabilityModel?:
      RelationalContextFeatureApplicabilityModel;

    symbolicPredicateApplicabilityModel?:
      SymbolicPredicateApplicabilityModel;

    validatedSymbolicPredicateApplicabilityModel?:
      ValidatedSymbolicPredicateApplicabilityModel;

    adaptiveValidatedPredicateApplicabilityModel?:
      AdaptiveValidatedPredicateApplicabilityModel;
  }):
    AbstractPrinciplePortfolioController {
    return new AbstractPrinciplePortfolioController(
      this,
      input?.applicabilityModel,
      input
        ?.inducedContextApplicabilityModel,
      input
        ?.learnedContextFeatureApplicabilityModel,
      input
        ?.composedContextFeatureApplicabilityModel,
      input
        ?.relationalContextFeatureApplicabilityModel,
      input
        ?.symbolicPredicateApplicabilityModel,
      input
        ?.validatedSymbolicPredicateApplicabilityModel,
      input
        ?.adaptiveValidatedPredicateApplicabilityModel,
    );
  }

  getPrinciples():
    PortfolioPrinciple[] {
    const principles:
      PortfolioPrinciple[] =
      [];

    const deferred =
      this.deferred
        .getPrinciple();

    const monotonic =
      this.monotonic
        .getPrinciple();

    if (
      deferred
    ) {
      principles.push(
        clonePrinciple(
          deferred,
        ),
      );
    }

    if (
      monotonic
    ) {
      principles.push(
        clonePrinciple(
          monotonic,
        ),
      );
    }

    return principles.sort(
      (
        left,
        right,
      ) =>
        left.id.localeCompare(
          right.id,
        ),
    );
  }
}

/**
 * Per-episode contextual selector.
 *
 * Applicability observations and selection history are local to one runtime.
 * Learned principle evidence stays in the persistent portfolio.
 */
export class AbstractPrinciplePortfolioController {
  private readonly deferredController:
    AbstractPrincipleController;

  private readonly monotonicController:
    MonotonicProgressPrincipleController;

  private readonly selections:
    PrincipleSelection[] = [];

  private readonly signatureEncoder =
    new StructuralContextSignatureEncoder();

  private lastProgressKind:
    PrincipleApplicabilityContext[
      "progressKind"
    ] = "none";

  private pendingSelection:
    {
      selection:
        PrincipleSelection;

      action:
        string;
    } |
    undefined;

  constructor(
    private readonly portfolio:
      AbstractPrinciplePortfolio,

    private readonly applicabilityModel?:
      PrincipleApplicabilityModel,

    private readonly inducedContextApplicabilityModel?:
      InducedContextApplicabilityModel,

    private readonly learnedContextFeatureApplicabilityModel?:
      LearnedContextFeatureApplicabilityModel,

    private readonly composedContextFeatureApplicabilityModel?:
      ComposedContextFeatureApplicabilityModel,

    private readonly relationalContextFeatureApplicabilityModel?:
      RelationalContextFeatureApplicabilityModel,

    private readonly symbolicPredicateApplicabilityModel?:
      SymbolicPredicateApplicabilityModel,

    private readonly validatedSymbolicPredicateApplicabilityModel?:
      ValidatedSymbolicPredicateApplicabilityModel,

    private readonly adaptiveValidatedPredicateApplicabilityModel?:
      AdaptiveValidatedPredicateApplicabilityModel,
  ) {
    this.deferredController =
      new AbstractPrincipleController(
        portfolio.deferred,
      );

    this.monotonicController =
      new MonotonicProgressPrincipleController(
        portfolio.monotonic,
      );
  }

  observeTransition(input: {
    action:
      string;

    accepted:
      boolean;

    before:
      EnvironmentSnapshot;

    after:
      EnvironmentSnapshot;

    changedKeys:
      readonly string[];

    goalSatisfied?:
      boolean;
  }): void {
    const transitionProgressKind =
      this.progressKindFor(
        input,
      );

    if (
      this.pendingSelection &&
      this.pendingSelection
        .action ===
        input.action
    ) {
      const useful =
        this.pendingSelection
          .selection
          .principleKind ===
          "repeat-monotonic-progress-once"
          ? input.accepted &&
            transitionProgressKind ===
              "numeric"
          : input.accepted &&
            input.goalSatisfied ===
              true;

      if (
        this.applicabilityModel
      ) {
        this.applicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            context:
              this.pendingSelection
                .selection
                .applicabilityContext,

            useful,
          });
      }

      if (
        this.inducedContextApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.inducedContextApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.learnedContextFeatureApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.learnedContextFeatureApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.composedContextFeatureApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.composedContextFeatureApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.relationalContextFeatureApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.relationalContextFeatureApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.symbolicPredicateApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.symbolicPredicateApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.validatedSymbolicPredicateApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.validatedSymbolicPredicateApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      if (
        this.adaptiveValidatedPredicateApplicabilityModel &&
        this.pendingSelection
          .selection
          .inducedContextSignature
      ) {
        this.adaptiveValidatedPredicateApplicabilityModel
          .record({
            principleId:
              this.pendingSelection
                .selection
                .principleId,

            signature:
              this.pendingSelection
                .selection
                .inducedContextSignature,

            useful,
          });
      }

      this.pendingSelection =
        undefined;
    }

    this.lastProgressKind =
      transitionProgressKind;

    this.signatureEncoder
      .observe(
        input,
      );

    this.deferredController
      .observeTransition({
        action:
          input.action,

        accepted:
          input.accepted,

        changedKeys:
          input.changedKeys,
      });

    this.monotonicController
      .observeTransition(
        input,
      );
  }

  recommend(
    availableActions:
      readonly string[],
  ):
    PrincipleSelection |
    undefined {
    const deferred =
      this.deferredController
        .recommend(
          availableActions,
        );

    const monotonic =
      this.monotonicController
        .recommend(
          availableActions,
        );

    const candidates:
      PrincipleSelection[] =
      [];

    if (
      deferred
    ) {
      const principle =
        this.portfolio
          .deferred
          .getPrinciple();

      if (
        principle
      ) {
        const context:
          PrincipleApplicabilityContext = {
          progressKind:
            this.lastProgressKind,

          candidateRelation:
            "deferred-action",
        };

        const signature =
          this.signatureEncoder
            .encodeCandidate(
              deferred.action,
            );

        const adaptiveChampion =
          this.adaptiveValidatedPredicateApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const validatedPredicate =
          this.validatedSymbolicPredicateApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const predicate =
          this.symbolicPredicateApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const relational =
          this.relationalContextFeatureApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const composed =
          this.composedContextFeatureApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const featureLearned =
          this.learnedContextFeatureApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const induced =
          this.inducedContextApplicabilityModel
            ?.estimate(
              deferred
                .principleId,
              signature,
            );

        const learned =
          this.applicabilityModel
            ?.estimate(
              deferred
                .principleId,
              context,
            );

        const applicability =
          adaptiveChampion
            ?.applicability ??
          validatedPredicate
            ?.applicability ??
          predicate
            ?.applicability ??
          relational
            ?.applicability ??
          composed
            ?.applicability ??
          featureLearned
            ?.applicability ??
          induced
            ?.applicability ??
          learned
            ?.applicability ??
          deferred.applicability;

        candidates.push({
          action:
            deferred.action,

          principleId:
            deferred.principleId,

          principleKind:
            principle.kind,

          confidence:
            deferred.confidence,

          applicability,

          score:
            selectionScore({
              confidence:
                deferred.confidence,

              applicability,
            }),

          applicabilitySource:
            adaptiveChampion
              ? "adaptive-predicate-champion"
              : validatedPredicate
                ? "validated-predicate-learned"
                : predicate
                ? predicate.evidenceCount >
                    0
                  ? "predicate-learned"
                  : "predicate-prior"
                : relational
                ? relational.evidenceCount >
                    0
                  ? "relational-learned"
                  : "relational-prior"
                : composed
                ? composed.evidenceCount >
                    0
                  ? "composed-learned"
                  : "composed-prior"
                : featureLearned
                ? featureLearned.evidenceCount >
                    0
                  ? "feature-learned"
                  : "feature-prior"
                : induced
                ? induced.evidenceCount >
                    0
                  ? "induced-learned"
                  : "induced-prior"
                : learned
                  ? learned.evidenceCount >
                      0
                    ? "learned"
                    : "model-prior"
                  : "static",

          applicabilityEvidenceCount:
            adaptiveChampion
              ?.evidenceCount ??
            validatedPredicate
              ?.evidenceCount ??
            predicate
              ?.evidenceCount ??
            relational
              ?.evidenceCount ??
            composed
              ?.evidenceCount ??
            featureLearned
              ?.evidenceCount ??
            induced
              ?.evidenceCount ??
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,

          ...(adaptiveChampion
            ? {
                predicateAdaptation: {
                  ...adaptiveChampion
                    .adaptation,
                },

                symbolicPredicateProjection: {
                  programId:
                    adaptiveChampion
                      .projection
                      .programId,

                  left:
                    adaptiveChampion
                      .projection
                      .left,

                  right:
                    adaptiveChampion
                      .projection
                      .right,

                  operator:
                    adaptiveChampion
                      .projection
                      .operator,

                  ...(adaptiveChampion
                      .projection
                      .parameter !==
                    undefined
                    ? {
                        parameter:
                          adaptiveChampion
                            .projection
                            .parameter,
                      }
                    : {}),

                  predicateValue:
                    adaptiveChampion
                      .projection
                      .predicateValue,

                  projectionKey:
                    adaptiveChampion
                      .projection
                      .projectionKey,
                },
              }
            : validatedPredicate
            ? {
                predicateValidation: {
                  ...validatedPredicate
                    .validation,
                },

                symbolicPredicateProjection: {
                  programId:
                    validatedPredicate
                      .projection
                      .programId,

                  left:
                    validatedPredicate
                      .projection
                      .left,

                  right:
                    validatedPredicate
                      .projection
                      .right,

                  operator:
                    validatedPredicate
                      .projection
                      .operator,

                  ...(validatedPredicate
                      .projection
                      .parameter !==
                    undefined
                    ? {
                        parameter:
                          validatedPredicate
                            .projection
                            .parameter,
                      }
                    : {}),

                  predicateValue:
                    validatedPredicate
                      .projection
                      .predicateValue,

                  projectionKey:
                    validatedPredicate
                      .projection
                      .projectionKey,
                },
              }
            : predicate
              ? {
                  symbolicPredicateProjection: {
                    programId:
                      predicate
                        .projection
                        .programId,

                    left:
                      predicate
                        .projection
                        .left,

                    right:
                      predicate
                        .projection
                        .right,

                    operator:
                      predicate
                        .projection
                        .operator,

                    ...(predicate
                        .projection
                        .parameter !==
                      undefined
                      ? {
                          parameter:
                            predicate
                              .projection
                              .parameter,
                        }
                      : {}),

                    predicateValue:
                      predicate
                        .projection
                        .predicateValue,

                    projectionKey:
                      predicate
                        .projection
                        .projectionKey,
                  },
                }
              : {}),

          ...(relational
            ? {
                relationalContextProjection: {
                  featureId:
                    relational
                      .projection
                      .featureId,

                  left:
                    relational
                      .projection
                      .left,

                  right:
                    relational
                      .projection
                      .right,

                  operator:
                    relational
                      .projection
                      .operator,

                  relationValue:
                    relational
                      .projection
                      .relationValue,

                  projectionKey:
                    relational
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(composed
            ? {
                composedContextProjection: {
                  featureId:
                    composed
                      .projection
                      .featureId,

                  components: [
                    composed
                      .projection
                      .components[0],
                    composed
                      .projection
                      .components[1],
                  ],

                  projectionKey:
                    composed
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(featureLearned
            ? {
                learnedContextProjection: {
                  selectedFeatures: [
                    ...featureLearned
                      .projection
                      .selectedFeatures,
                  ],

                  projectionKey:
                    featureLearned
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(this.inducedContextApplicabilityModel ||
              this.learnedContextFeatureApplicabilityModel ||
              this.composedContextFeatureApplicabilityModel ||
              this.relationalContextFeatureApplicabilityModel ||
              this.symbolicPredicateApplicabilityModel ||
              this.validatedSymbolicPredicateApplicabilityModel ||
              this.adaptiveValidatedPredicateApplicabilityModel
            ? {
                inducedContextSignature:
                  signature,
              }
            : {}),
        });
      }
    }

    if (
      monotonic
    ) {
      const principle =
        this.portfolio
          .monotonic
          .getPrinciple();

      if (
        principle
      ) {
        const context:
          PrincipleApplicabilityContext = {
          progressKind:
            "numeric",

          candidateRelation:
            "productive-repeat",
        };

        const signature =
          this.signatureEncoder
            .encodeCandidate(
              monotonic.action,
            );

        const adaptiveChampion =
          this.adaptiveValidatedPredicateApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const validatedPredicate =
          this.validatedSymbolicPredicateApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const predicate =
          this.symbolicPredicateApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const relational =
          this.relationalContextFeatureApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const composed =
          this.composedContextFeatureApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const featureLearned =
          this.learnedContextFeatureApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const induced =
          this.inducedContextApplicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              signature,
            );

        const learned =
          this.applicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              context,
            );

        const applicability =
          adaptiveChampion
            ?.applicability ??
          validatedPredicate
            ?.applicability ??
          predicate
            ?.applicability ??
          relational
            ?.applicability ??
          composed
            ?.applicability ??
          featureLearned
            ?.applicability ??
          induced
            ?.applicability ??
          learned
            ?.applicability ??
          monotonic.applicability;

        candidates.push({
          action:
            monotonic.action,

          principleId:
            monotonic.principleId,

          principleKind:
            principle.kind,

          confidence:
            monotonic.confidence,

          applicability,

          score:
            selectionScore({
              confidence:
                monotonic.confidence,

              applicability,
            }),

          applicabilitySource:
            adaptiveChampion
              ? "adaptive-predicate-champion"
              : validatedPredicate
                ? "validated-predicate-learned"
                : predicate
                ? predicate.evidenceCount >
                    0
                  ? "predicate-learned"
                  : "predicate-prior"
                : relational
                ? relational.evidenceCount >
                    0
                  ? "relational-learned"
                  : "relational-prior"
                : composed
                ? composed.evidenceCount >
                    0
                  ? "composed-learned"
                  : "composed-prior"
                : featureLearned
                ? featureLearned.evidenceCount >
                    0
                  ? "feature-learned"
                  : "feature-prior"
                : induced
                ? induced.evidenceCount >
                    0
                  ? "induced-learned"
                  : "induced-prior"
                : learned
                  ? learned.evidenceCount >
                      0
                    ? "learned"
                    : "model-prior"
                  : "static",

          applicabilityEvidenceCount:
            adaptiveChampion
              ?.evidenceCount ??
            validatedPredicate
              ?.evidenceCount ??
            predicate
              ?.evidenceCount ??
            relational
              ?.evidenceCount ??
            composed
              ?.evidenceCount ??
            featureLearned
              ?.evidenceCount ??
            induced
              ?.evidenceCount ??
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,

          ...(adaptiveChampion
            ? {
                predicateAdaptation: {
                  ...adaptiveChampion
                    .adaptation,
                },

                symbolicPredicateProjection: {
                  programId:
                    adaptiveChampion
                      .projection
                      .programId,

                  left:
                    adaptiveChampion
                      .projection
                      .left,

                  right:
                    adaptiveChampion
                      .projection
                      .right,

                  operator:
                    adaptiveChampion
                      .projection
                      .operator,

                  ...(adaptiveChampion
                      .projection
                      .parameter !==
                    undefined
                    ? {
                        parameter:
                          adaptiveChampion
                            .projection
                            .parameter,
                      }
                    : {}),

                  predicateValue:
                    adaptiveChampion
                      .projection
                      .predicateValue,

                  projectionKey:
                    adaptiveChampion
                      .projection
                      .projectionKey,
                },
              }
            : validatedPredicate
            ? {
                predicateValidation: {
                  ...validatedPredicate
                    .validation,
                },

                symbolicPredicateProjection: {
                  programId:
                    validatedPredicate
                      .projection
                      .programId,

                  left:
                    validatedPredicate
                      .projection
                      .left,

                  right:
                    validatedPredicate
                      .projection
                      .right,

                  operator:
                    validatedPredicate
                      .projection
                      .operator,

                  ...(validatedPredicate
                      .projection
                      .parameter !==
                    undefined
                    ? {
                        parameter:
                          validatedPredicate
                            .projection
                            .parameter,
                      }
                    : {}),

                  predicateValue:
                    validatedPredicate
                      .projection
                      .predicateValue,

                  projectionKey:
                    validatedPredicate
                      .projection
                      .projectionKey,
                },
              }
            : predicate
              ? {
                  symbolicPredicateProjection: {
                    programId:
                      predicate
                        .projection
                        .programId,

                    left:
                      predicate
                        .projection
                        .left,

                    right:
                      predicate
                        .projection
                        .right,

                    operator:
                      predicate
                        .projection
                        .operator,

                    ...(predicate
                        .projection
                        .parameter !==
                      undefined
                      ? {
                          parameter:
                            predicate
                              .projection
                              .parameter,
                        }
                      : {}),

                    predicateValue:
                      predicate
                        .projection
                        .predicateValue,

                    projectionKey:
                      predicate
                        .projection
                        .projectionKey,
                  },
                }
              : {}),

          ...(relational
            ? {
                relationalContextProjection: {
                  featureId:
                    relational
                      .projection
                      .featureId,

                  left:
                    relational
                      .projection
                      .left,

                  right:
                    relational
                      .projection
                      .right,

                  operator:
                    relational
                      .projection
                      .operator,

                  relationValue:
                    relational
                      .projection
                      .relationValue,

                  projectionKey:
                    relational
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(composed
            ? {
                composedContextProjection: {
                  featureId:
                    composed
                      .projection
                      .featureId,

                  components: [
                    composed
                      .projection
                      .components[0],
                    composed
                      .projection
                      .components[1],
                  ],

                  projectionKey:
                    composed
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(featureLearned
            ? {
                learnedContextProjection: {
                  selectedFeatures: [
                    ...featureLearned
                      .projection
                      .selectedFeatures,
                  ],

                  projectionKey:
                    featureLearned
                      .projection
                      .projectionKey,
                },
              }
            : {}),

          ...(this.inducedContextApplicabilityModel ||
              this.learnedContextFeatureApplicabilityModel ||
              this.composedContextFeatureApplicabilityModel ||
              this.relationalContextFeatureApplicabilityModel ||
              this.symbolicPredicateApplicabilityModel ||
              this.validatedSymbolicPredicateApplicabilityModel ||
              this.adaptiveValidatedPredicateApplicabilityModel
            ? {
                inducedContextSignature:
                  signature,
              }
            : {}),
        });
      }
    }

    candidates.sort(
      (
        left,
        right,
      ) => {
        if (
          right.score !==
          left.score
        ) {
          return (
            right.score -
            left.score
          );
        }

        if (
          right.applicability !==
          left.applicability
        ) {
          return (
            right.applicability -
            left.applicability
          );
        }

        if (
          right.confidence !==
          left.confidence
        ) {
          return (
            right.confidence -
            left.confidence
          );
        }

        return left
          .principleId
          .localeCompare(
            right.principleId,
          );
      },
    );

    const selected =
      candidates[0];

    if (
      !selected
    ) {
      return undefined;
    }

    if (
      selected.principleKind ===
        "repeat-monotonic-progress-once"
    ) {
      this.monotonicController
        .consumeRecommendation(
          selected.action,
        );
    }

    this.selections.push({
      ...selected,

      applicabilityContext: {
        ...selected
          .applicabilityContext,
      },
    });

    if (
      this.applicabilityModel ||
      this.inducedContextApplicabilityModel ||
      this.learnedContextFeatureApplicabilityModel ||
      this.composedContextFeatureApplicabilityModel ||
      this.relationalContextFeatureApplicabilityModel ||
      this.symbolicPredicateApplicabilityModel ||
      this.validatedSymbolicPredicateApplicabilityModel ||
      this.adaptiveValidatedPredicateApplicabilityModel
    ) {
      this.pendingSelection = {
        selection: {
          ...selected,

          applicabilityContext: {
            ...selected
              .applicabilityContext,
          },

          ...(selected
              .predicateValidation
            ? {
                predicateValidation: {
                  ...selected
                    .predicateValidation,
                },
              }
            : {}),

          ...(selected
              .symbolicPredicateProjection
            ? {
                symbolicPredicateProjection: {
                  programId:
                    selected
                      .symbolicPredicateProjection
                      .programId,

                  left:
                    selected
                      .symbolicPredicateProjection
                      .left,

                  right:
                    selected
                      .symbolicPredicateProjection
                      .right,

                  operator:
                    selected
                      .symbolicPredicateProjection
                      .operator,

                  ...(selected
                      .symbolicPredicateProjection
                      .parameter !==
                    undefined
                    ? {
                        parameter:
                          selected
                            .symbolicPredicateProjection
                            .parameter,
                      }
                    : {}),

                  predicateValue:
                    selected
                      .symbolicPredicateProjection
                      .predicateValue,

                  projectionKey:
                    selected
                      .symbolicPredicateProjection
                      .projectionKey,
                },
              }
            : {}),

          ...(selected
              .relationalContextProjection
            ? {
                relationalContextProjection: {
                  featureId:
                    selected
                      .relationalContextProjection
                      .featureId,

                  left:
                    selected
                      .relationalContextProjection
                      .left,

                  right:
                    selected
                      .relationalContextProjection
                      .right,

                  operator:
                    selected
                      .relationalContextProjection
                      .operator,

                  relationValue:
                    selected
                      .relationalContextProjection
                      .relationValue,

                  projectionKey:
                    selected
                      .relationalContextProjection
                      .projectionKey,
                },
              }
            : {}),

          ...(selected
              .composedContextProjection
            ? {
                composedContextProjection: {
                  featureId:
                    selected
                      .composedContextProjection
                      .featureId,

                  components: [
                    selected
                      .composedContextProjection
                      .components[0],
                    selected
                      .composedContextProjection
                      .components[1],
                  ],

                  projectionKey:
                    selected
                      .composedContextProjection
                      .projectionKey,
                },
              }
            : {}),

          ...(selected
              .learnedContextProjection
            ? {
                learnedContextProjection: {
                  selectedFeatures: [
                    ...selected
                      .learnedContextProjection
                      .selectedFeatures,
                  ],

                  projectionKey:
                    selected
                      .learnedContextProjection
                      .projectionKey,
                },
              }
            : {}),

          ...(selected
              .inducedContextSignature
            ? {
                inducedContextSignature: {
                  key:
                    selected
                      .inducedContextSignature
                      .key,

                  features: {
                    ...selected
                      .inducedContextSignature
                      .features,

                    lastValueShapes: [
                      ...selected
                        .inducedContextSignature
                        .features
                        .lastValueShapes,
                    ],
                  },
                },
              }
            : {}),
        },

        action:
          selected.action,
      };
    }

    return {
      ...selected,

      applicabilityContext: {
        ...selected
          .applicabilityContext,
      },

      ...(selected
          .predicateValidation
        ? {
            predicateValidation: {
              ...selected
                .predicateValidation,
            },
          }
        : {}),

      ...(selected
          .symbolicPredicateProjection
        ? {
            symbolicPredicateProjection: {
              programId:
                selected
                  .symbolicPredicateProjection
                  .programId,

              left:
                selected
                  .symbolicPredicateProjection
                  .left,

              right:
                selected
                  .symbolicPredicateProjection
                  .right,

              operator:
                selected
                  .symbolicPredicateProjection
                  .operator,

              ...(selected
                  .symbolicPredicateProjection
                  .parameter !==
                undefined
                ? {
                    parameter:
                      selected
                        .symbolicPredicateProjection
                        .parameter,
                  }
                : {}),

              predicateValue:
                selected
                  .symbolicPredicateProjection
                  .predicateValue,

              projectionKey:
                selected
                  .symbolicPredicateProjection
                  .projectionKey,
            },
          }
        : {}),

      ...(selected
          .relationalContextProjection
        ? {
            relationalContextProjection: {
              featureId:
                selected
                  .relationalContextProjection
                  .featureId,

              left:
                selected
                  .relationalContextProjection
                  .left,

              right:
                selected
                  .relationalContextProjection
                  .right,

              operator:
                selected
                  .relationalContextProjection
                  .operator,

              relationValue:
                selected
                  .relationalContextProjection
                  .relationValue,

              projectionKey:
                selected
                  .relationalContextProjection
                  .projectionKey,
            },
          }
        : {}),

      ...(selected
          .composedContextProjection
        ? {
            composedContextProjection: {
              featureId:
                selected
                  .composedContextProjection
                  .featureId,

              components: [
                selected
                  .composedContextProjection
                  .components[0],
                selected
                  .composedContextProjection
                  .components[1],
              ],

              projectionKey:
                selected
                  .composedContextProjection
                  .projectionKey,
            },
          }
        : {}),

      ...(selected
          .learnedContextProjection
        ? {
            learnedContextProjection: {
              selectedFeatures: [
                ...selected
                  .learnedContextProjection
                  .selectedFeatures,
              ],

              projectionKey:
                selected
                  .learnedContextProjection
                  .projectionKey,
            },
          }
        : {}),

      ...(selected
          .inducedContextSignature
        ? {
            inducedContextSignature: {
              key:
                selected
                  .inducedContextSignature
                  .key,

              features: {
                ...selected
                  .inducedContextSignature
                  .features,

                lastValueShapes: [
                  ...selected
                    .inducedContextSignature
                    .features
                    .lastValueShapes,
                ],
              },
            },
          }
        : {}),
    };
  }

  getSnapshot():
    AbstractPrinciplePortfolioSnapshot {
    return {
      principles:
        this.portfolio
          .getPrinciples(),

      selections:
        this.selections.map(
          (selection) => ({
            ...selection,

            applicabilityContext: {
              ...selection
                .applicabilityContext,
            },

            ...(selection
                .predicateValidation
              ? {
                  predicateValidation: {
                    ...selection
                      .predicateValidation,
                  },
                }
              : {}),

            ...(selection
                .symbolicPredicateProjection
              ? {
                  symbolicPredicateProjection: {
                    programId:
                      selection
                        .symbolicPredicateProjection
                        .programId,

                    left:
                      selection
                        .symbolicPredicateProjection
                        .left,

                    right:
                      selection
                        .symbolicPredicateProjection
                        .right,

                    operator:
                      selection
                        .symbolicPredicateProjection
                        .operator,

                    ...(selection
                        .symbolicPredicateProjection
                        .parameter !==
                      undefined
                      ? {
                          parameter:
                            selection
                              .symbolicPredicateProjection
                              .parameter,
                        }
                      : {}),

                    predicateValue:
                      selection
                        .symbolicPredicateProjection
                        .predicateValue,

                    projectionKey:
                      selection
                        .symbolicPredicateProjection
                        .projectionKey,
                  },
                }
              : {}),

            ...(selection
                .relationalContextProjection
              ? {
                  relationalContextProjection: {
                    featureId:
                      selection
                        .relationalContextProjection
                        .featureId,

                    left:
                      selection
                        .relationalContextProjection
                        .left,

                    right:
                      selection
                        .relationalContextProjection
                        .right,

                    operator:
                      selection
                        .relationalContextProjection
                        .operator,

                    relationValue:
                      selection
                        .relationalContextProjection
                        .relationValue,

                    projectionKey:
                      selection
                        .relationalContextProjection
                        .projectionKey,
                  },
                }
              : {}),

            ...(selection
                .composedContextProjection
              ? {
                  composedContextProjection: {
                    featureId:
                      selection
                        .composedContextProjection
                        .featureId,

                    components: [
                      selection
                        .composedContextProjection
                        .components[0],
                      selection
                        .composedContextProjection
                        .components[1],
                    ],

                    projectionKey:
                      selection
                        .composedContextProjection
                        .projectionKey,
                  },
                }
              : {}),

            ...(selection
                .learnedContextProjection
              ? {
                  learnedContextProjection: {
                    selectedFeatures: [
                      ...selection
                        .learnedContextProjection
                        .selectedFeatures,
                    ],

                    projectionKey:
                      selection
                        .learnedContextProjection
                        .projectionKey,
                  },
                }
              : {}),

            ...(selection
                .inducedContextSignature
              ? {
                  inducedContextSignature: {
                    key:
                      selection
                        .inducedContextSignature
                        .key,

                    features: {
                      ...selection
                        .inducedContextSignature
                        .features,

                      lastValueShapes: [
                        ...selection
                          .inducedContextSignature
                          .features
                          .lastValueShapes,
                      ],
                    },
                  },
                }
              : {}),
          }),
        ),
    };
  }

  private progressKindFor(input: {
    before:
      EnvironmentSnapshot;

    after:
      EnvironmentSnapshot;

    changedKeys:
      readonly string[];
  }):
    PrincipleApplicabilityContext[
      "progressKind"
    ] {
    if (
      input.changedKeys
        .length ===
        0
    ) {
      return "none";
    }

    const hasNumericIncrease =
      input.changedKeys.some(
        (key) => {
          const before =
            input.before[
              key
            ];

          const after =
            input.after[
              key
            ];

          return (
            typeof before ===
              "number" &&
            typeof after ===
              "number" &&
            after >
              before
          );
        },
      );

    return hasNumericIncrease
      ? "numeric"
      : "nonnumeric";
  }
}

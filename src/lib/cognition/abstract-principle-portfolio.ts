import type {
  EnvironmentSnapshot,
} from "./environment";

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
    "feature-learned";

  applicabilityEvidenceCount:
    number;

  applicabilityContext:
    PrincipleApplicabilityContext;

  inducedContextSignature?:
    InducedContextSignature;

  learnedContextProjection?:
    LearnedContextProjection;
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
  }):
    AbstractPrinciplePortfolioController {
    return new AbstractPrinciplePortfolioController(
      this,
      input?.applicabilityModel,
      input
        ?.inducedContextApplicabilityModel,
      input
        ?.learnedContextFeatureApplicabilityModel,
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
            induced
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
            induced
              ?.evidenceCount ??
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,

          ...(this.inducedContextApplicabilityModel
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
            induced
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
            induced
              ?.evidenceCount ??
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,

          ...(this.inducedContextApplicabilityModel
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
      this.inducedContextApplicabilityModel
    ) {
      this.pendingSelection = {
        selection: {
          ...selected,

          applicabilityContext: {
            ...selected
              .applicabilityContext,
          },

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

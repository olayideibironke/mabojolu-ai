import type {
  EnvironmentSnapshot,
} from "./environment";

import {
  PrincipleApplicabilityModel,
  type PrincipleApplicabilityContext,
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
    "learned";

  applicabilityEvidenceCount:
    number;

  applicabilityContext:
    PrincipleApplicabilityContext;
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
  }):
    AbstractPrinciplePortfolioController {
    return new AbstractPrinciplePortfolioController(
      this,
      input?.applicabilityModel,
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
  }): void {
    if (
      this.pendingSelection &&
      this.pendingSelection
        .action ===
        input.action &&
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

          useful:
            input.accepted &&
            input.changedKeys
              .length >
              0,
        });

      this.pendingSelection =
        undefined;
    }

    this.lastProgressKind =
      this.progressKindFor(
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

        const learned =
          this.applicabilityModel
            ?.estimate(
              deferred
                .principleId,
              context,
            );

        const applicability =
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
            learned
              ? learned.evidenceCount >
                  0
                ? "learned"
                : "model-prior"
              : "static",

          applicabilityEvidenceCount:
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,
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

        const learned =
          this.applicabilityModel
            ?.estimate(
              monotonic
                .principleId,
              context,
            );

        const applicability =
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
            learned
              ? learned.evidenceCount >
                  0
                ? "learned"
                : "model-prior"
              : "static",

          applicabilityEvidenceCount:
            learned
              ?.evidenceCount ??
            0,

          applicabilityContext:
            context,
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
      this.applicabilityModel
    ) {
      this.pendingSelection = {
        selection: {
          ...selected,

          applicabilityContext: {
            ...selected
              .applicabilityContext,
          },
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

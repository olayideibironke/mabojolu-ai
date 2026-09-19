import type {
  EnvironmentSnapshot,
} from "./environment";

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

  createController():
    AbstractPrinciplePortfolioController {
    return new AbstractPrinciplePortfolioController(
      this,
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

  constructor(
    private readonly portfolio:
      AbstractPrinciplePortfolio,
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
        candidates.push({
          action:
            deferred.action,

          principleId:
            deferred.principleId,

          principleKind:
            principle.kind,

          confidence:
            deferred.confidence,

          applicability:
            deferred.applicability,

          score:
            selectionScore(
              deferred,
            ),
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
        candidates.push({
          action:
            monotonic.action,

          principleId:
            monotonic.principleId,

          principleKind:
            principle.kind,

          confidence:
            monotonic.confidence,

          applicability:
            monotonic.applicability,

          score:
            selectionScore(
              monotonic,
            ),
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
    });

    return {
      ...selected,
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
          }),
        ),
    };
  }
}

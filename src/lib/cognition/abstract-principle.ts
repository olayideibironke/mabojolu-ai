import type {
  EnvironmentSnapshot,
} from "./environment";

import type {
  EpisodeTransition,
} from "./memory";

export type AbstractPrincipleStatus =
  | "candidate"
  | "active"
  | "retired";

export interface AbstractPrinciple {
  id:
    string;

  kind:
    "deferred-goal-retry-after-progress";

  statement:
    string;

  supportFamilies:
    string[];

  supportFamilyKinds:
    string[];

  supportEpisodeIds:
    string[];

  supportCount:
    number;

  contradictionCount:
    number;

  confidence:
    number;

  status:
    AbstractPrincipleStatus;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface AbstractPrincipleEpisode {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  solved:
    boolean;

  goalConditions:
    EnvironmentSnapshot;

  transitions:
    EpisodeTransition[];

  observedAt:
    string;
}

export interface AbstractPrincipleRecommendation {
  action:
    string;

  principleId:
    string;

  confidence:
    number;
}

interface PrincipleSupport {
  family:
    string;

  familyKind:
    string;

  episodeId:
    string;

  observedAt:
    string;
}

const PRINCIPLE_ID =
  "principle-deferred-goal-retry-after-progress";

function confidenceFor(
  familyCount:
    number,

  contradictionCount:
    number,
): number {
  return (
    familyCount + 1
  ) / (
    familyCount +
    contradictionCount +
    2
  );
}

function findSupport(
  episode:
    AbstractPrincipleEpisode,
):
  boolean {
  if (
    !episode.solved
  ) {
    return false;
  }

  for (
    const [
      goalKey,
      goalValue,
    ] of Object.entries(
      episode.goalConditions,
    )
  ) {
    const successIndex =
      episode.transitions
        .findIndex(
          (transition) =>
            Object.is(
              transition
                .after[
                  goalKey
                ],
              goalValue,
            ) &&
            !Object.is(
              transition
                .before[
                  goalKey
                ],
              goalValue,
            ),
        );

    if (
      successIndex <=
        0
    ) {
      continue;
    }

    const success =
      episode.transitions[
        successIndex
      ];

    const earlierNoEffectIndex =
      episode.transitions
        .slice(
          0,
          successIndex,
        )
        .findIndex(
          (transition) =>
            transition.action ===
              success.action &&
            transition.accepted &&
            transition
              .changedKeys
              .length ===
              0,
        );

    if (
      earlierNoEffectIndex <
        0
    ) {
      continue;
    }

    const interveningProgress =
      episode.transitions
        .slice(
          earlierNoEffectIndex +
            1,
          successIndex,
        )
        .some(
          (transition) =>
            transition.accepted &&
            transition
              .changedKeys
              .length >
              0 &&
            transition.action !==
              success.action,
        );

    if (
      interveningProgress
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Learns a higher-order causal-control principle from multiple task families.
 *
 * The principle deliberately stores no source action labels or source state
 * variable names. Evidence is only retained at the family/episode level:
 *
 *   an action that initially had no observable effect later achieved the goal
 *   after other actions produced observable progress.
 *
 * Activation requires support from at least two distinct family kinds, so
 * relabeling one causal structure as multiple families is insufficient.
 */
export class CrossFamilyPrincipleLibrary {
  private readonly supports:
    PrincipleSupport[] = [];

  private contradictionCount =
    0;

  private createdAt:
    string |
    undefined;

  private updatedAt:
    string |
    undefined;

  learnFromEpisode(
    episode:
      AbstractPrincipleEpisode,
  ):
    AbstractPrinciple |
    undefined {
    if (
      !findSupport(
        episode,
      )
    ) {
      return this.getPrinciple();
    }

    if (
      this.supports.some(
        (support) =>
          support.episodeId ===
            episode.episodeId,
      )
    ) {
      return this.getPrinciple();
    }

    this.supports.push({
      family:
        episode.family,

      familyKind:
        episode.familyKind,

      episodeId:
        episode.episodeId,

      observedAt:
        episode.observedAt,
    });

    this.createdAt ??=
      episode.observedAt;

    this.updatedAt =
      episode.observedAt;

    return this.getPrinciple();
  }

  recordContradiction(
    observedAt:
      string,
  ):
    AbstractPrinciple |
    undefined {
    if (
      this.supports.length ===
        0
    ) {
      return undefined;
    }

    this.contradictionCount +=
      1;

    this.updatedAt =
      observedAt;

    return this.getPrinciple();
  }

  getPrinciple():
    AbstractPrinciple |
    undefined {
    if (
      this.supports.length ===
        0 ||
      !this.createdAt ||
      !this.updatedAt
    ) {
      return undefined;
    }

    const supportFamilies = [
      ...new Set(
        this.supports.map(
          (support) =>
            support.family,
        ),
      ),
    ].sort();

    const supportFamilyKinds = [
      ...new Set(
        this.supports.map(
          (support) =>
            support.familyKind,
        ),
      ),
    ].sort();

    const familyKindCount =
      supportFamilyKinds.length;

    const status:
      AbstractPrincipleStatus =
        this.contradictionCount >=
          Math.max(
            2,
            familyKindCount,
          )
          ? "retired"
          : familyKindCount >=
              2
            ? "active"
            : "candidate";

    return {
      id:
        PRINCIPLE_ID,

      kind:
        "deferred-goal-retry-after-progress",

      statement:
        "An action with no observable effect may become goal-effective after other actions produce observable progress; retry the deferred action after progress before exhausting unrelated alternatives.",

      supportFamilies,

      supportFamilyKinds,

      supportEpisodeIds:
        this.supports.map(
          (support) =>
            support.episodeId,
        ),

      supportCount:
        this.supports.length,

      contradictionCount:
        this.contradictionCount,

      confidence:
        confidenceFor(
          familyKindCount,
          this.contradictionCount,
        ),

      status,

      createdAt:
        this.createdAt,

      updatedAt:
        this.updatedAt,
    };
  }
}

/**
 * Online application of an active cross-family principle.
 *
 * It never predicts which target action is special before evidence. Instead it
 * remembers accepted no-effect actions observed in the target and, after a
 * different action changes state, recommends retrying the earliest deferred
 * action before generic exploration consumes unrelated alternatives.
 */
export class AbstractPrincipleController {
  private readonly deferredActions:
    string[] = [];

  private progressSinceDeferral =
    false;

  constructor(
    private readonly library:
      CrossFamilyPrincipleLibrary,
  ) {}

  observeTransition(input: {
    action:
      string;

    accepted:
      boolean;

    changedKeys:
      readonly string[];
  }): void {
    const principle =
      this.library
        .getPrinciple();

    if (
      !principle ||
      principle.status !==
        "active" ||
      !input.accepted
    ) {
      return;
    }

    if (
      input.changedKeys
        .length ===
        0
    ) {
      if (
        !this.deferredActions
          .includes(
            input.action,
          )
      ) {
        this.deferredActions
          .push(
            input.action,
          );
      }

      this.progressSinceDeferral =
        false;

      return;
    }

    if (
      this.deferredActions
        .some(
          (action) =>
            action !==
            input.action,
        )
    ) {
      this.progressSinceDeferral =
        true;
    }

    const matchedDeferred =
      this.deferredActions
        .indexOf(
          input.action,
        );

    if (
      matchedDeferred >=
        0
    ) {
      this.deferredActions
        .splice(
          matchedDeferred,
          1,
        );

      this.progressSinceDeferral =
        false;
    }
  }

  recommend(
    availableActions:
      readonly string[],
  ):
    AbstractPrincipleRecommendation |
    undefined {
    const principle =
      this.library
        .getPrinciple();

    if (
      !principle ||
      principle.status !==
        "active" ||
      !this.progressSinceDeferral
    ) {
      return undefined;
    }

    const action =
      this.deferredActions
        .find(
          (candidate) =>
            availableActions.includes(
              candidate,
            ),
        );

    if (
      !action
    ) {
      return undefined;
    }

    this.progressSinceDeferral =
      false;

    return {
      action,

      principleId:
        principle.id,

      confidence:
        principle.confidence,
    };
  }
}

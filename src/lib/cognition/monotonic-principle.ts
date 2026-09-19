import type {
  EnvironmentSnapshot,
} from "./environment";

import type {
  EpisodeTransition,
} from "./memory";

import type {
  AbstractPrincipleStatus,
} from "./abstract-principle";

export interface MonotonicProgressPrinciple {
  id:
    string;

  kind:
    "repeat-monotonic-progress-once";

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

export interface MonotonicPrincipleEpisode {
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
  "principle-repeat-monotonic-progress-once";

function confidenceFor(
  familyKindCount:
    number,

  contradictionCount:
    number,
): number {
  return (
    familyKindCount + 1
  ) / (
    familyKindCount +
    contradictionCount +
    2
  );
}

function numericIncrease(
  transition:
    EpisodeTransition,
):
  {
    key:
      string;

    before:
      number;

    after:
      number;
  } |
  undefined {
  if (
    !transition.accepted ||
    transition
      .changedKeys
      .length !==
      1
  ) {
    return undefined;
  }

  const key =
    transition
      .changedKeys[0];

  const before =
    transition.before[
      key
    ];

  const after =
    transition.after[
      key
    ];

  if (
    typeof before !==
      "number" ||
    typeof after !==
      "number" ||
    after <=
      before
  ) {
    return undefined;
  }

  return {
    key,
    before,
    after,
  };
}

function supportsPrinciple(
  episode:
    MonotonicPrincipleEpisode,
): boolean {
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
            !Object.is(
              transition
                .before[
                  goalKey
                ],
              goalValue,
            ) &&
            Object.is(
              transition
                .after[
                  goalKey
                ],
              goalValue,
            ),
        );

    if (
      successIndex <
        2
    ) {
      continue;
    }

    const beforeGoal =
      episode.transitions
        .slice(
          0,
          successIndex,
        );

    for (
      let index = 0;
      index <
        beforeGoal.length -
          1;
      index +=
        1
    ) {
      const first =
        beforeGoal[
          index
        ];

      const firstIncrease =
        numericIncrease(
          first,
        );

      if (
        !firstIncrease
      ) {
        continue;
      }

      for (
        let secondIndex =
          index + 1;
        secondIndex <
          beforeGoal.length;
        secondIndex +=
          1
      ) {
        const second =
          beforeGoal[
            secondIndex
          ];

        const secondIncrease =
          numericIncrease(
            second,
          );

        if (
          second.action ===
            first.action &&
          secondIncrease &&
          secondIncrease.key ===
            firstIncrease.key &&
          secondIncrease.before >=
            firstIncrease.after
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Learns a numeric-progress abstraction independently from the broader deferred
 * goal retry principle.
 *
 * Activation requires supporting episodes from at least two distinct structural
 * family kinds. Stored evidence contains no source action labels or state keys.
 */
export class MonotonicProgressPrincipleLibrary {
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
      MonotonicPrincipleEpisode,
  ):
    MonotonicProgressPrinciple |
    undefined {
    if (
      !supportsPrinciple(
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
    MonotonicProgressPrinciple |
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
    MonotonicProgressPrinciple |
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
        "repeat-monotonic-progress-once",

      statement:
        "When an action produces monotonic numeric progress without reaching the goal, repeat that productive action once before returning to a deferred goal attempt.",

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

export interface MonotonicProgressRecommendation {
  action:
    string;

  principleId:
    string;

  confidence:
    number;

  applicability:
    number;
}

/**
 * Target-world applicability binding for the numeric-progress principle.
 *
 * The controller only becomes eligible after directly observing a numeric
 * increase caused by some target action. It recommends one repeat, then waits
 * for other principles or ordinary reasoning rather than looping blindly.
 */
export class MonotonicProgressPrincipleController {
  private candidateAction:
    string |
    undefined;

  private repeatConsumed =
    false;

  constructor(
    private readonly library:
      MonotonicProgressPrincipleLibrary,
  ) {}

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

    if (
      hasNumericIncrease
    ) {
      this.candidateAction =
        input.action;

      return;
    }

    if (
      this.candidateAction ===
      input.action
    ) {
      this.candidateAction =
        undefined;
    }
  }

  recommend(
    availableActions:
      readonly string[],
  ):
    MonotonicProgressRecommendation |
    undefined {
    const principle =
      this.library
        .getPrinciple();

    if (
      !principle ||
      principle.status !==
        "active" ||
      this.repeatConsumed ||
      !this.candidateAction ||
      !availableActions.includes(
        this.candidateAction,
      )
    ) {
      return undefined;
    }

    return {
      action:
        this.candidateAction,

      principleId:
        principle.id,

      confidence:
        principle.confidence,

      applicability:
        0.95,
    };
  }

  consumeRecommendation(
    action:
      string,
  ): void {
    if (
      this.candidateAction ===
      action
    ) {
      this.repeatConsumed =
        true;
    }
  }
}

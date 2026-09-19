export interface CompetenceObservation {
  taskId:
    string;

  family:
    string;

  difficulty:
    number;

  success:
    boolean;

  cycles:
    number;

  observedAt:
    string;
}

export interface CompetenceSnapshot {
  family:
    string;

  attempts:
    number;

  successes:
    number;

  failures:
    number;

  successRate:
    number;

  confidence:
    number;

  uncertainty:
    number;

  mastery:
    number;

  learningProgress:
    number;

  averageCycles:
    number |
    null;

  bestCycles:
    number |
    null;

  hardestSuccessfulDifficulty:
    number;

  lastObservedAt:
    string |
    null;
}

interface FamilyEvidence {
  observations:
    CompetenceObservation[];
}

function clamp01(
  value:
    number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

function validateDifficulty(
  value:
    number,
): number {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0 ||
    value >
      1
  ) {
    throw new Error(
      "Task difficulty must be between 0 and 1.",
    );
  }

  return value;
}

function recentSuccessRate(
  observations:
    CompetenceObservation[],

  count:
    number,
): number {
  const recent =
    observations.slice(
      -count,
    );

  if (
    recent.length ===
      0
  ) {
    return 0.5;
  }

  return (
    recent.filter(
      (observation) =>
        observation.success,
    ).length /
    recent.length
  );
}

/**
 * Mabojolu G explicit competence model v0.1.
 *
 * Competence is evidence, not self-description. Every family-level estimate is
 * derived from observed task outcomes. Beta priors prevent one lucky success or
 * one failure from becoming certainty.
 */
export class CompetenceModel {
  private readonly families =
    new Map<
      string,
      FamilyEvidence
    >();

  record(
    observation:
      CompetenceObservation,
  ):
    CompetenceSnapshot {
    validateDifficulty(
      observation.difficulty,
    );

    if (
      !Number.isInteger(
        observation.cycles,
      ) ||
      observation.cycles <
        0
    ) {
      throw new Error(
        "Task cycles must be a non-negative integer.",
      );
    }

    const evidence =
      this.families.get(
        observation.family,
      ) ?? {
        observations: [],
      };

    if (
      evidence
        .observations
        .some(
          (existing) =>
            existing.taskId ===
              observation.taskId &&
            existing.observedAt ===
              observation.observedAt,
        )
    ) {
      return this.snapshot(
        observation.family,
      );
    }

    evidence.observations.push({
      ...observation,
    });

    this.families.set(
      observation.family,
      evidence,
    );

    return this.snapshot(
      observation.family,
    );
  }

  snapshot(
    family:
      string,
  ):
    CompetenceSnapshot {
    const observations =
      this.families.get(
        family,
      )?.observations ??
      [];

    const attempts =
      observations.length;

    const successes =
      observations.filter(
        (observation) =>
          observation.success,
      ).length;

    const failures =
      attempts -
      successes;

    /*
     * Beta(1, 1) posterior mean.
     */
    const successRate =
      (
        successes +
        1
      ) /
      (
        attempts +
        2
      );

    const confidence =
      clamp01(
        attempts /
          (
            attempts +
            3
          ),
      );

    const uncertainty =
      1 -
      confidence;

    const successful =
      observations.filter(
        (observation) =>
          observation.success,
      );

    const hardestSuccessfulDifficulty =
      successful.length >
        0
        ? Math.max(
            ...successful.map(
              (observation) =>
                observation
                  .difficulty,
            ),
          )
        : 0;

    /*
     * Mastery requires both reliability and evidence at non-trivial difficulty.
     * A family with no successful task therefore cannot become "mastered" from
     * confidence alone.
     */
    const mastery =
      clamp01(
        successRate *
        (
          0.45 +
          0.55 *
            hardestSuccessfulDifficulty
        ) *
        (
          0.55 +
          0.45 *
            confidence
        ),
      );

    const recentRate =
      recentSuccessRate(
        observations,
        3,
      );

    const earlier =
      observations.slice(
        0,
        Math.max(
          0,
          observations.length -
            3,
        ),
      );

    const earlierRate =
      earlier.length >
        0
        ? earlier.filter(
            (observation) =>
              observation
                .success,
          ).length /
          earlier.length
        : 0.5;

    const learningProgress =
      clamp01(
        0.5 +
        (
          recentRate -
          earlierRate
        ) /
          2,
      );

    const successfulCycles =
      successful.map(
        (observation) =>
          observation.cycles,
      );

    return {
      family,

      attempts,

      successes,

      failures,

      successRate,

      confidence,

      uncertainty,

      mastery,

      learningProgress,

      averageCycles:
        successfulCycles.length >
          0
          ? successfulCycles.reduce(
              (
                total,
                cycles,
              ) =>
                total +
                cycles,
              0,
            ) /
            successfulCycles
              .length
          : null,

      bestCycles:
        successfulCycles.length >
          0
          ? Math.min(
              ...successfulCycles,
            )
          : null,

      hardestSuccessfulDifficulty,

      lastObservedAt:
        observations.at(
          -1,
        )?.observedAt ??
        null,
    };
  }

  getFamilies():
    readonly CompetenceSnapshot[] {
    return [
      ...this.families.keys(),
    ]
      .sort()
      .map(
        (family) =>
          this.snapshot(
            family,
          ),
      );
  }
}

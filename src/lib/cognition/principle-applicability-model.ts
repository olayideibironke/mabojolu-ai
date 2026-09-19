export type ApplicabilityProgressKind =
  | "numeric"
  | "nonnumeric"
  | "none";

export type ApplicabilityCandidateRelation =
  | "deferred-action"
  | "productive-repeat";

export interface PrincipleApplicabilityContext {
  progressKind:
    ApplicabilityProgressKind;

  candidateRelation:
    ApplicabilityCandidateRelation;
}

export interface PrincipleApplicabilityObservation {
  principleId:
    string;

  context:
    PrincipleApplicabilityContext;

  useful:
    boolean;

  observedAt:
    string;
}

export interface PrincipleApplicabilityEstimate {
  principleId:
    string;

  context:
    PrincipleApplicabilityContext;

  successes:
    number;

  failures:
    number;

  evidenceCount:
    number;

  applicability:
    number;
}

interface EvidenceBucket {
  successes:
    number;

  failures:
    number;
}

/**
 * Evidence-based applicability learner for abstract principles.
 *
 * Context features are generic and symbol-free:
 * - whether the observed progress was numeric, nonnumeric, or absent;
 * - whether the candidate repeats productive progress or revisits a deferred
 *   no-effect action.
 *
 * Each principle/context pair uses a Beta(1, 1) prior. No source action labels,
 * state-variable names, or environment ids are stored.
 */
export class PrincipleApplicabilityModel {
  private readonly evidence =
    new Map<
      string,
      EvidenceBucket
    >();

  record(
    observation:
      PrincipleApplicabilityObservation,
  ):
    PrincipleApplicabilityEstimate {
    const key =
      this.key(
        observation
          .principleId,

        observation
          .context,
      );

    const current =
      this.evidence.get(
        key,
      ) ?? {
        successes:
          0,

        failures:
          0,
      };

    const next:
      EvidenceBucket = {
      successes:
        current.successes +
        (
          observation.useful
            ? 1
            : 0
        ),

      failures:
        current.failures +
        (
          observation.useful
            ? 0
            : 1
        ),
    };

    this.evidence.set(
      key,
      next,
    );

    return this.estimate(
      observation
        .principleId,

      observation
        .context,
    );
  }

  estimate(
    principleId:
      string,

    context:
      PrincipleApplicabilityContext,
  ):
    PrincipleApplicabilityEstimate {
    const evidence =
      this.evidence.get(
        this.key(
          principleId,
          context,
        ),
      ) ?? {
        successes:
          0,

        failures:
          0,
      };

    const applicability =
      (
        evidence.successes +
        1
      ) / (
        evidence.successes +
        evidence.failures +
        2
      );

    return {
      principleId,

      context: {
        ...context,
      },

      successes:
        evidence.successes,

      failures:
        evidence.failures,

      evidenceCount:
        evidence.successes +
        evidence.failures,

      applicability,
    };
  }

  getEvidenceCount():
    number {
    let count =
      0;

    for (
      const bucket of
        this.evidence.values()
    ) {
      count +=
        bucket.successes +
        bucket.failures;
    }

    return count;
  }

  private key(
    principleId:
      string,

    context:
      PrincipleApplicabilityContext,
  ):
    string {
    return JSON.stringify({
      principleId,

      progressKind:
        context.progressKind,

      candidateRelation:
        context
          .candidateRelation,
    });
  }
}

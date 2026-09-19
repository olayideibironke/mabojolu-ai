import {
  challengeFingerprint,
  challengeInstanceFingerprint,
  type GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

import {
  thresholdChallengeFingerprint,
  thresholdChallengeInstanceFingerprint,
  type ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

export type SyntheticChallengeSpec =
  | GatedSequenceChallengeSpec
  | ThresholdAccumulationChallengeSpec;

export function syntheticChallengeFingerprint(
  spec:
    SyntheticChallengeSpec,
): string {
  switch (
    spec.kind
  ) {
    case "gated-sequence":
      return challengeFingerprint(
        spec,
      );

    case "threshold-accumulation":
      return thresholdChallengeFingerprint(
        spec,
      );
  }
}

export function syntheticChallengeInstanceFingerprint(
  spec:
    SyntheticChallengeSpec,
): string {
  switch (
    spec.kind
  ) {
    case "gated-sequence":
      return challengeInstanceFingerprint(
        spec,
      );

    case "threshold-accumulation":
      return thresholdChallengeInstanceFingerprint(
        spec,
      );
  }
}

/**
 * Shared train/evaluation isolation across all currently approved synthetic
 * challenge families.
 */
export class MultiFamilyEvaluationIsolationGuard {
  private readonly practiceFingerprints =
    new Set<string>();

  private readonly practiceIds =
    new Set<string>();

  registerPractice(
    spec:
      SyntheticChallengeSpec,
  ): void {
    if (
      spec.partition !==
        "practice"
    ) {
      throw new Error(
        "Only practice challenges may be registered as training exposure.",
      );
    }

    this.practiceFingerprints
      .add(
        syntheticChallengeFingerprint(
          spec,
        ),
      );

    this.practiceIds
      .add(
        spec.id,
      );
  }

  assertHeldOut(
    spec:
      SyntheticChallengeSpec,
  ): void {
    if (
      spec.partition !==
        "evaluation"
    ) {
      throw new Error(
        "Held-out evaluation requires an evaluation-partition challenge.",
      );
    }

    if (
      this.practiceFingerprints
        .has(
          syntheticChallengeFingerprint(
            spec,
          ),
        )
    ) {
      throw new Error(
        "Evaluation challenge duplicates practiced task content.",
      );
    }
  }

  getPracticeCount():
    number {
    return this
      .practiceIds
      .size;
  }
}

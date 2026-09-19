import type {
  EnvironmentScalar,
  EnvironmentSnapshot,
} from "./environment";

export interface ContextTransitionEvidence {
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
}

export interface InducedContextFeatures {
  historyLength:
    "0" |
    "1" |
    "2" |
    "3+";

  distinctActionsSeen:
    "0" |
    "1" |
    "2" |
    "3+";

  lastChangeArity:
    "none" |
    "one" |
    "many";

  lastValueShapes:
    string[];

  candidateAttempts:
    "0" |
    "1" |
    "2+";

  candidateNoEffectAttempts:
    "0" |
    "1" |
    "2+";

  candidateEffectAttempts:
    "0" |
    "1" |
    "2+";

  candidateMatchesLastAction:
    boolean;

  candidateMatchesLastProductiveAction:
    boolean;

  stepsSinceCandidateAttempt:
    "never" |
    "0" |
    "1" |
    "2+";
}

export interface InducedContextSignature {
  key:
    string;

  features:
    InducedContextFeatures;
}

export interface InducedContextApplicabilityObservation {
  principleId:
    string;

  signature:
    InducedContextSignature;

  useful:
    boolean;
}

export interface InducedContextApplicabilityEstimate {
  principleId:
    string;

  signature:
    InducedContextSignature;

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

function bucketCount(
  count:
    number,
):
  "0" |
  "1" |
  "2+" {
  if (
    count <=
      0
  ) {
    return "0";
  }

  if (
    count ===
      1
  ) {
    return "1";
  }

  return "2+";
}

function historyCountBucket(
  count:
    number,
):
  "0" |
  "1" |
  "2" |
  "3+" {
  if (
    count <=
      0
  ) {
    return "0";
  }

  if (
    count ===
      1
  ) {
    return "1";
  }

  if (
    count ===
      2
  ) {
    return "2";
  }

  return "3+";
}

function valueType(
  value:
    EnvironmentScalar |
    undefined,
):
  string {
  if (
    value ===
      undefined
  ) {
    return "missing";
  }

  if (
    value ===
      null
  ) {
    return "null";
  }

  return typeof value;
}

function valueShape(
  before:
    EnvironmentScalar |
    undefined,

  after:
    EnvironmentScalar |
    undefined,
):
  string {
  const beforeType =
    valueType(
      before,
    );

  const afterType =
    valueType(
      after,
    );

  if (
    typeof before ===
      "number" &&
    typeof after ===
      "number"
  ) {
    if (
      after >
        before
    ) {
      return "number:increase";
    }

    if (
      after <
        before
    ) {
      return "number:decrease";
    }

    return "number:same";
  }

  if (
    typeof before ===
      "boolean" &&
    typeof after ===
      "boolean"
  ) {
    return before
      ? "boolean:true-to-false"
      : "boolean:false-to-true";
  }

  if (
    beforeType ===
      afterType
  ) {
    return (
      beforeType +
      ":changed"
    );
  }

  return (
    beforeType +
    "-to-" +
    afterType
  );
}

function changeArity(
  changedKeys:
    readonly string[],
):
  InducedContextFeatures[
    "lastChangeArity"
  ] {
  if (
    changedKeys.length ===
      0
  ) {
    return "none";
  }

  if (
    changedKeys.length ===
      1
  ) {
    return "one";
  }

  return "many";
}

function stepsSinceBucket(
  steps:
    number |
    undefined,
):
  InducedContextFeatures[
    "stepsSinceCandidateAttempt"
  ] {
  if (
    steps ===
      undefined
  ) {
    return "never";
  }

  if (
    steps <=
      0
  ) {
    return "0";
  }

  if (
    steps ===
      1
  ) {
    return "1";
  }

  return "2+";
}

/**
 * Derives a compact, symbol-independent structural signature from raw target
 * transitions.
 *
 * The signature never stores action labels or state-variable names. Action
 * identity is used only relationally: whether the candidate matches an earlier
 * action. State keys are used only to retrieve before/after values and are then
 * discarded.
 */
export class StructuralContextSignatureEncoder {
  private readonly transitions:
    ContextTransitionEvidence[] =
    [];

  observe(
    transition:
      ContextTransitionEvidence,
  ): void {
    this.transitions.push({
      action:
        transition.action,

      accepted:
        transition.accepted,

      before: {
        ...transition.before,
      },

      after: {
        ...transition.after,
      },

      changedKeys: [
        ...transition
          .changedKeys,
      ],
    });
  }

  encodeCandidate(
    candidateAction:
      string,
  ):
    InducedContextSignature {
    const last =
      this.transitions.at(
        -1,
      );

    const candidateTransitions =
      this.transitions.filter(
        (transition) =>
          transition.action ===
          candidateAction,
      );

    const noEffectAttempts =
      candidateTransitions.filter(
        (transition) =>
          transition.accepted &&
          transition
            .changedKeys
            .length ===
            0,
      ).length;

    const effectAttempts =
      candidateTransitions.filter(
        (transition) =>
          transition.accepted &&
          transition
            .changedKeys
            .length >
            0,
      ).length;

    const lastProductive =
      [
        ...this.transitions,
      ]
        .reverse()
        .find(
          (transition) =>
            transition.accepted &&
            transition
              .changedKeys
              .length >
              0,
        );

    const lastCandidateIndex =
      this.transitions
        .map(
          (transition) =>
            transition.action,
        )
        .lastIndexOf(
          candidateAction,
        );

    const stepsSinceCandidate =
      lastCandidateIndex <
        0
        ? undefined
        : this.transitions
            .length -
          1 -
          lastCandidateIndex;

    const lastValueShapes =
      last
        ? last.changedKeys
            .map(
              (key) =>
                valueShape(
                  last.before[
                    key
                  ],

                  last.after[
                    key
                  ],
                ),
            )
            .sort()
        : [];

    const features:
      InducedContextFeatures = {
      historyLength:
        historyCountBucket(
          this.transitions
            .length,
        ),

      distinctActionsSeen:
        historyCountBucket(
          new Set(
            this.transitions.map(
              (transition) =>
                transition.action,
            ),
          ).size,
        ),

      lastChangeArity:
        last
          ? changeArity(
              last.changedKeys,
            )
          : "none",

      lastValueShapes,

      candidateAttempts:
        bucketCount(
          candidateTransitions
            .length,
        ),

      candidateNoEffectAttempts:
        bucketCount(
          noEffectAttempts,
        ),

      candidateEffectAttempts:
        bucketCount(
          effectAttempts,
        ),

      candidateMatchesLastAction:
        last
          ?.action ===
        candidateAction,

      candidateMatchesLastProductiveAction:
        lastProductive
          ?.action ===
        candidateAction,

      stepsSinceCandidateAttempt:
        stepsSinceBucket(
          stepsSinceCandidate,
        ),
    };

    return {
      key:
        JSON.stringify(
          features,
        ),

      features: {
        ...features,

        lastValueShapes: [
          ...features
            .lastValueShapes,
        ],
      },
    };
  }
}

/**
 * Beta-evidence applicability learner keyed by induced structural signatures.
 */
export class InducedContextApplicabilityModel {
  private readonly evidence =
    new Map<
      string,
      EvidenceBucket
    >();

  record(
    observation:
      InducedContextApplicabilityObservation,
  ):
    InducedContextApplicabilityEstimate {
    const key =
      this.key(
        observation
          .principleId,

        observation
          .signature,
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
        .signature,
    );
  }

  estimate(
    principleId:
      string,

    signature:
      InducedContextSignature,
  ):
    InducedContextApplicabilityEstimate {
    const evidence =
      this.evidence.get(
        this.key(
          principleId,
          signature,
        ),
      ) ?? {
        successes:
          0,

        failures:
          0,
      };

    return {
      principleId,

      signature: {
        key:
          signature.key,

        features: {
          ...signature
            .features,

          lastValueShapes: [
            ...signature
              .features
              .lastValueShapes,
          ],
        },
      },

      successes:
        evidence.successes,

      failures:
        evidence.failures,

      evidenceCount:
        evidence.successes +
        evidence.failures,

      applicability:
        (
          evidence.successes +
          1
        ) / (
          evidence.successes +
          evidence.failures +
          2
        ),
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

    signature:
      InducedContextSignature,
  ):
    string {
    return JSON.stringify({
      principleId,

      signature:
        signature.key,
    });
  }
}

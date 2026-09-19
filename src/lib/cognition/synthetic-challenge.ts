import type {
  EnvironmentSnapshot,
} from "./environment";

export type ChallengePartition =
  | "practice"
  | "evaluation";

export interface GatedSequenceChallengeSpec {
  id:
    string;

  family:
    string;

  kind:
    "gated-sequence";

  partition:
    ChallengePartition;

  difficulty:
    number;

  context:
    string;

  actionLabels:
    readonly [
      string,
      string,
      string,
    ];

  stateKeys:
    readonly [
      string,
      string,
      string,
    ];

  actionRoleOrder:
    readonly [
      0 | 1 | 2,
      0 | 1 | 2,
      0 | 1 | 2,
    ];

  /**
   * Optional order in which the three action labels are exposed to the agent.
   * This changes exploration difficulty without changing the hidden causal skill.
   */
  actionPresentationOrder?:
    readonly [
      0 | 1 | 2,
      0 | 1 | 2,
      0 | 1 | 2,
    ];
}

function validateUnique(
  values:
    readonly string[],

  label:
    string,
): void {
  if (
    new Set(
      values,
    ).size !==
    values.length
  ) {
    throw new Error(
      label +
        " must contain unique values.",
    );
  }
}

export function validateChallengeSpec(
  spec:
    GatedSequenceChallengeSpec,
): void {
  if (
    !Number.isFinite(
      spec.difficulty,
    ) ||
    spec.difficulty <
      0 ||
    spec.difficulty >
      1
  ) {
    throw new Error(
      "Challenge difficulty must be between 0 and 1.",
    );
  }

  validateUnique(
    spec.actionLabels,
    "Challenge action labels",
  );

  validateUnique(
    spec.stateKeys,
    "Challenge state keys",
  );

  const roles = [
    ...spec.actionRoleOrder,
  ].sort();

  if (
    roles[0] !==
      0 ||
    roles[1] !==
      1 ||
    roles[2] !==
      2
  ) {
    throw new Error(
      "Challenge action roles must be a permutation of 0, 1, and 2.",
    );
  }

  if (
    spec.actionPresentationOrder
  ) {
    const presentation = [
      ...spec
        .actionPresentationOrder,
    ].sort();

    if (
      presentation[0] !==
        0 ||
      presentation[1] !==
        1 ||
      presentation[2] !==
        2
    ) {
      throw new Error(
        "Challenge action presentation order must be a permutation of 0, 1, and 2.",
      );
    }
  }
}

function normalizedPresentationOrder(
  spec:
    GatedSequenceChallengeSpec,
):
  readonly [
    0 | 1 | 2,
    0 | 1 | 2,
    0 | 1 | 2,
  ] {
  if (
    spec.actionPresentationOrder
  ) {
    return spec
      .actionPresentationOrder;
  }

  return [
    0,
    1,
    2,
  ];
}

export function challengeFingerprint(
  spec:
    GatedSequenceChallengeSpec,
): string {
  validateChallengeSpec(
    spec,
  );

  /*
   * Content fingerprint for evaluation isolation.
   *
   * Metadata such as id, partition, family label, difficulty label, and context
   * are deliberately excluded. Renaming metadata must not turn a practiced
   * causal task into a supposedly held-out evaluation.
   */
  return JSON.stringify({
    kind:
      spec.kind,

    actionLabels: [
      ...spec.actionLabels,
    ],

    stateKeys: [
      ...spec.stateKeys,
    ],

    actionRoleOrder: [
      ...spec.actionRoleOrder,
    ],

    actionPresentationOrder: [
      ...normalizedPresentationOrder(
        spec,
      ),
    ],
  });
}

export function challengeInstanceFingerprint(
  spec:
    GatedSequenceChallengeSpec,
): string {
  validateChallengeSpec(
    spec,
  );

  /*
   * Exact-instance fingerprint for trusted training evidence.
   */
  return JSON.stringify({
    id:
      spec.id,

    family:
      spec.family,

    kind:
      spec.kind,

    partition:
      spec.partition,

    difficulty:
      spec.difficulty,

    context:
      spec.context,

    actionLabels: [
      ...spec.actionLabels,
    ],

    stateKeys: [
      ...spec.stateKeys,
    ],

    actionRoleOrder: [
      ...spec.actionRoleOrder,
    ],

    actionPresentationOrder: [
      ...normalizedPresentationOrder(
        spec,
      ),
    ],
  });
}

export function initialChallengeSnapshot(
  spec:
    GatedSequenceChallengeSpec,
):
  EnvironmentSnapshot {
  validateChallengeSpec(
    spec,
  );

  return {
    [spec.stateKeys[0]]:
      false,

    [spec.stateKeys[1]]:
      false,

    [spec.stateKeys[2]]:
      false,

    context:
      spec.context,
  };
}

/**
 * Tracks practice fingerprints independently from the challenge generator.
 *
 * Evaluation tasks are rejected when they are merely the same generated task
 * relabeled as "evaluation". Structural similarity is allowed because transfer
 * itself can be the capability under evaluation; exact task leakage is not.
 */
export class EvaluationIsolationGuard {
  private readonly practiceFingerprints =
    new Set<string>();

  private readonly practiceIds =
    new Set<string>();

  registerPractice(
    spec:
      GatedSequenceChallengeSpec,
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
        challengeFingerprint(
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
      GatedSequenceChallengeSpec,
  ): void {
    if (
      spec.partition !==
        "evaluation"
    ) {
      throw new Error(
        "Held-out evaluation requires an evaluation-partition challenge.",
      );
    }

    const fingerprint =
      challengeFingerprint(
        spec,
      );

    if (
      this.practiceFingerprints
        .has(
          fingerprint,
        )
    ) {
      throw new Error(
        "Evaluation challenge duplicates a practice challenge.",
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

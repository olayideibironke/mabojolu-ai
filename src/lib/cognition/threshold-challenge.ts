import type {
  ChallengePartition,
} from "./synthetic-challenge";

export interface ThresholdAccumulationChallengeSpec {
  id:
    string;

  family:
    string;

  kind:
    "threshold-accumulation";

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
    ];

  stateKeys:
    readonly [
      string,
      string,
    ];

  /**
   * action role 0 increments progress; role 1 attempts completion.
   */
  actionRoleOrder:
    readonly [
      0 | 1,
      0 | 1,
    ];

  target:
    number;

  actionPresentationOrder?:
    readonly [
      0 | 1,
      0 | 1,
    ];
}

function normalizedPresentationOrder(
  spec:
    ThresholdAccumulationChallengeSpec,
):
  readonly [
    0 | 1,
    0 | 1,
  ] {
  return spec
    .actionPresentationOrder ??
    [
      0,
      1,
    ];
}

export function validateThresholdChallengeSpec(
  spec:
    ThresholdAccumulationChallengeSpec,
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
      "Threshold challenge difficulty must be between 0 and 1.",
    );
  }

  if (
    !Number.isInteger(
      spec.target,
    ) ||
    spec.target <
      2 ||
    spec.target >
      4
  ) {
    throw new Error(
      "Threshold challenge target must be an integer between 2 and 4.",
    );
  }

  if (
    new Set(
      spec.actionLabels,
    ).size !==
      2
  ) {
    throw new Error(
      "Threshold challenge action labels must be unique.",
    );
  }

  if (
    new Set(
      spec.stateKeys,
    ).size !==
      2
  ) {
    throw new Error(
      "Threshold challenge state keys must be unique.",
    );
  }

  const roles = [
    ...spec.actionRoleOrder,
  ].sort();

  if (
    roles[0] !==
      0 ||
    roles[1] !==
      1
  ) {
    throw new Error(
      "Threshold action roles must be a permutation of 0 and 1.",
    );
  }

  const presentation = [
    ...normalizedPresentationOrder(
      spec,
    ),
  ].sort();

  if (
    presentation[0] !==
      0 ||
    presentation[1] !==
      1
  ) {
    throw new Error(
      "Threshold action presentation order must be a permutation of 0 and 1.",
    );
  }
}

export function thresholdChallengeFingerprint(
  spec:
    ThresholdAccumulationChallengeSpec,
): string {
  validateThresholdChallengeSpec(
    spec,
  );

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

    target:
      spec.target,

    actionPresentationOrder: [
      ...normalizedPresentationOrder(
        spec,
      ),
    ],
  });
}

export function thresholdChallengeInstanceFingerprint(
  spec:
    ThresholdAccumulationChallengeSpec,
): string {
  validateThresholdChallengeSpec(
    spec,
  );

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

    target:
      spec.target,

    actionPresentationOrder: [
      ...normalizedPresentationOrder(
        spec,
      ),
    ],
  });
}

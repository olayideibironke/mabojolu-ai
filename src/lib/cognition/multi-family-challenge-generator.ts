import {
  AutonomousCurriculumPlanner,
  type CurriculumTask,
} from "./autonomous-curriculum";

import {
  type GatedSequenceChallengeBlueprint,
} from "./autonomous-challenge-generator";

import {
  CompetenceModel,
  type CompetenceObservation,
  type CompetenceSnapshot,
} from "./competence-model";

import {
  MultiFamilyEvaluationIsolationGuard,
  syntheticChallengeInstanceFingerprint,
  type SyntheticChallengeSpec,
} from "./multi-family-challenge";

import type {
  GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

import type {
  ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

export interface ThresholdChallengeBlueprint {
  family:
    string;

  kind:
    "threshold-accumulation";

  minDifficulty:
    number;

  maxDifficulty:
    number;

  estimatedCost:
    number;

  prerequisiteFamilies?:
    string[];

  practiceActionLabels:
    readonly [
      string,
      string,
    ];

  practiceStateKeys:
    readonly [
      string,
      string,
    ];

  practiceActionRoleOrder:
    readonly [
      0 | 1,
      0 | 1,
    ];

  target:
    number;
}

export type MultiFamilyChallengeBlueprint =
  | GatedSequenceChallengeBlueprint
  | ThresholdChallengeBlueprint;

export interface GeneratedMultiFamilyChallenge {
  spec:
    SyntheticChallengeSpec;

  curriculumScore:
    number;

  reasons:
    string[];

  familyCompetence:
    CompetenceSnapshot;
}

function clamp(
  value:
    number,

  minimum:
    number,

  maximum:
    number,
): number {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function safeFamilyId(
  family:
    string,
): string {
  const normalized =
    family
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return normalized ||
    "challenge";
}

function validateCommonBlueprint(
  blueprint:
    MultiFamilyChallengeBlueprint,
): void {
  if (
    !blueprint.family
      .trim()
  ) {
    throw new Error(
      "Challenge family must be non-empty.",
    );
  }

  for (
    const [
      label,
      value,
    ] of [
      [
        "minDifficulty",
        blueprint.minDifficulty,
      ],
      [
        "maxDifficulty",
        blueprint.maxDifficulty,
      ],
    ] as const
  ) {
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
        "Challenge blueprint " +
        label +
        " must be between 0 and 1.",
      );
    }
  }

  if (
    blueprint.minDifficulty >
    blueprint.maxDifficulty
  ) {
    throw new Error(
      "Challenge blueprint minimum difficulty cannot exceed maximum difficulty.",
    );
  }

  if (
    !Number.isFinite(
      blueprint.estimatedCost,
    ) ||
    blueprint.estimatedCost <
      0
  ) {
    throw new Error(
      "Challenge blueprint estimated cost must be non-negative.",
    );
  }

  if (
    blueprint.kind ===
      "threshold-accumulation" &&
    (
      !Number.isInteger(
        blueprint.target,
      ) ||
      blueprint.target <
        2 ||
      blueprint.target >
        4
    )
  ) {
    throw new Error(
      "Threshold blueprint target must be an integer between 2 and 4.",
    );
  }
}

function gatedPresentationOrder(
  blueprint:
    GatedSequenceChallengeBlueprint,

  difficulty:
    number,
):
  readonly [
    0 | 1 | 2,
    0 | 1 | 2,
    0 | 1 | 2,
  ] {
  const roleIndex =
    (
      role:
        0 | 1 | 2,
    ):
      0 | 1 | 2 => {
      const index =
        blueprint
          .practiceActionRoleOrder
          .indexOf(
            role,
          );

      if (
        index !==
          0 &&
        index !==
          1 &&
        index !==
          2
      ) {
        throw new Error(
          "Gated-sequence role mapping is invalid.",
        );
      }

      return index as
        0 | 1 | 2;
    };

  const first =
    roleIndex(
      0,
    );

  const second =
    roleIndex(
      1,
    );

  const goal =
    roleIndex(
      2,
    );

  if (
    difficulty <
      0.4
  ) {
    return [
      first,
      second,
      goal,
    ];
  }

  if (
    difficulty <
      0.6
  ) {
    return [
      0,
      1,
      2,
    ];
  }

  return [
    goal,
    second,
    first,
  ];
}

function thresholdPresentationOrder(
  blueprint:
    ThresholdChallengeBlueprint,

  difficulty:
    number,
):
  readonly [
    0 | 1,
    0 | 1,
  ] {
  const incrementIndex =
    blueprint
      .practiceActionRoleOrder
      .indexOf(
        0,
      );

  const finishIndex =
    blueprint
      .practiceActionRoleOrder
      .indexOf(
        1,
      );

  if (
    (
      incrementIndex !==
        0 &&
      incrementIndex !==
        1
    ) ||
    (
      finishIndex !==
        0 &&
      finishIndex !==
        1
    )
  ) {
    throw new Error(
      "Threshold role mapping is invalid.",
    );
  }

  if (
    difficulty <
      0.6
  ) {
    return [
      incrementIndex as
        0 | 1,

      finishIndex as
        0 | 1,
    ];
  }

  return [
    finishIndex as
      0 | 1,

    incrementIndex as
      0 | 1,
  ];
}

function makeGatedSpec(input: {
  blueprint:
    GatedSequenceChallengeBlueprint;

  generation:
    number;

  difficulty:
    number;
}):
  GatedSequenceChallengeSpec {
  const familyId =
    safeFamilyId(
      input
        .blueprint
        .family,
    );

  return {
    id:
      "practice-" +
      familyId +
      "-" +
      input.generation,

    family:
      input
        .blueprint
        .family,

    kind:
      "gated-sequence",

    partition:
      "practice",

    difficulty:
      input.difficulty,

    context:
      "generated-practice-" +
      familyId +
      "-" +
      input.generation,

    actionLabels: [
      input
        .blueprint
        .practiceActionLabels[0],
      input
        .blueprint
        .practiceActionLabels[1],
      input
        .blueprint
        .practiceActionLabels[2],
    ],

    stateKeys: [
      input
        .blueprint
        .practiceStateKeys[0],
      input
        .blueprint
        .practiceStateKeys[1],
      input
        .blueprint
        .practiceStateKeys[2],
    ],

    actionRoleOrder: [
      input
        .blueprint
        .practiceActionRoleOrder[0],
      input
        .blueprint
        .practiceActionRoleOrder[1],
      input
        .blueprint
        .practiceActionRoleOrder[2],
    ],

    actionPresentationOrder:
      gatedPresentationOrder(
        input.blueprint,
        input.difficulty,
      ),
  };
}

function makeThresholdSpec(input: {
  blueprint:
    ThresholdChallengeBlueprint;

  generation:
    number;

  difficulty:
    number;
}):
  ThresholdAccumulationChallengeSpec {
  const familyId =
    safeFamilyId(
      input
        .blueprint
        .family,
    );

  return {
    id:
      "practice-" +
      familyId +
      "-" +
      input.generation,

    family:
      input
        .blueprint
        .family,

    kind:
      "threshold-accumulation",

    partition:
      "practice",

    difficulty:
      input.difficulty,

    context:
      "generated-practice-" +
      familyId +
      "-" +
      input.generation,

    actionLabels: [
      input
        .blueprint
        .practiceActionLabels[0],
      input
        .blueprint
        .practiceActionLabels[1],
    ],

    stateKeys: [
      input
        .blueprint
        .practiceStateKeys[0],
      input
        .blueprint
        .practiceStateKeys[1],
    ],

    actionRoleOrder: [
      input
        .blueprint
        .practiceActionRoleOrder[0],
      input
        .blueprint
        .practiceActionRoleOrder[1],
    ],

    target:
      input
        .blueprint
        .target,

    actionPresentationOrder:
      thresholdPresentationOrder(
        input.blueprint,
        input.difficulty,
      ),
  };
}

/**
 * Mabojolu G multi-family autonomous challenge generator v0.1.
 *
 * Competence is tracked independently per family. The generator chooses the
 * next practice family from evidence, then delegates to family-specific safe
 * mechanics. Successful experience in one family cannot directly raise the
 * competence estimate of another family.
 */
export class MultiFamilyChallengeGenerator {
  private readonly planner:
    AutonomousCurriculumPlanner;

  private readonly generationCounts =
    new Map<
      string,
      number
    >();

  private readonly generatedFingerprints =
    new Map<
      string,
      string
    >();

  private readonly completedIds =
    new Set<string>();

  constructor(
    private readonly competence:
      CompetenceModel,

    private readonly isolation:
      MultiFamilyEvaluationIsolationGuard,

    private readonly blueprints:
      readonly MultiFamilyChallengeBlueprint[],
  ) {
    if (
      blueprints.length ===
        0
    ) {
      throw new Error(
        "At least one multi-family challenge blueprint is required.",
      );
    }

    for (
      const blueprint of
        blueprints
    ) {
      validateCommonBlueprint(
        blueprint,
      );
    }

    this.planner =
      new AutonomousCurriculumPlanner(
        competence,
      );
  }

  generateNextPractice():
    GeneratedMultiFamilyChallenge |
    undefined {
    const candidates:
      CurriculumTask[] =
      this.blueprints.map(
        (blueprint) => {
          const snapshot =
            this.competence
              .snapshot(
                blueprint.family,
              );

          const difficulty =
            clamp(
              snapshot.mastery +
                0.2,

              blueprint
                .minDifficulty,

              blueprint
                .maxDifficulty,
            );

          const generatedCount =
            this.generationCounts
              .get(
                blueprint.family,
              ) ??
            0;

          return {
            id:
              "generate::" +
              blueprint.kind +
              "::" +
              blueprint.family,

            family:
              blueprint.family,

            difficulty,

            novelty:
              Math.max(
                0.5,
                1 -
                  generatedCount *
                    0.08,
              ),

            estimatedCost:
              blueprint
                .estimatedCost,

            ...(blueprint
                .prerequisiteFamilies
              ? {
                  prerequisiteFamilies: [
                    ...blueprint
                      .prerequisiteFamilies,
                  ],
                }
              : {}),
          };
        },
      );

    const recommendation =
      this.planner
        .chooseNext(
          candidates,
        );

    if (
      !recommendation
    ) {
      return undefined;
    }

    const blueprint =
      this.blueprints.find(
        (candidate) =>
          candidate.family ===
          recommendation
            .task
            .family,
      );

    if (
      !blueprint
    ) {
      return undefined;
    }

    const generation =
      (
        this.generationCounts
          .get(
            blueprint.family,
          ) ??
        0
      ) +
      1;

    this.generationCounts
      .set(
        blueprint.family,
        generation,
      );

    const spec =
      blueprint.kind ===
        "gated-sequence"
        ? makeGatedSpec({
            blueprint,
            generation,
            difficulty:
              recommendation
                .task
                .difficulty,
          })
        : makeThresholdSpec({
            blueprint,
            generation,
            difficulty:
              recommendation
                .task
                .difficulty,
          });

    this.isolation
      .registerPractice(
        spec,
      );

    this.generatedFingerprints
      .set(
        spec.id,
        syntheticChallengeInstanceFingerprint(
          spec,
        ),
      );

    return {
      spec,

      curriculumScore:
        recommendation.score,

      reasons: [
        ...recommendation
          .reasons,
      ],

      familyCompetence:
        recommendation
          .familyCompetence,
    };
  }

  recordPracticeOutcome(input: {
    challenge:
      SyntheticChallengeSpec;

    success:
      boolean;

    cycles:
      number;

    observedAt:
      string;
  }):
    CompetenceSnapshot {
    if (
      input.challenge
        .partition !==
      "practice"
    ) {
      throw new Error(
        "Only practice challenges may update multi-family competence.",
      );
    }

    const expected =
      this.generatedFingerprints
        .get(
          input.challenge.id,
        );

    if (
      !expected ||
      expected !==
        syntheticChallengeInstanceFingerprint(
          input.challenge,
        )
    ) {
      throw new Error(
        "Practice outcome does not match a generated multi-family challenge.",
      );
    }

    if (
      this.completedIds
        .has(
          input.challenge.id,
        )
    ) {
      throw new Error(
        "Multi-family practice outcome has already been recorded.",
      );
    }

    const observation:
      CompetenceObservation = {
      taskId:
        input.challenge.id,

      family:
        input.challenge.family,

      difficulty:
        input.challenge
          .difficulty,

      success:
        input.success,

      cycles:
        input.cycles,

      observedAt:
        input.observedAt,
    };

    const snapshot =
      this.planner
        .recordOutcome(
          observation,
        );

    this.completedIds
      .add(
        input.challenge.id,
      );

    return snapshot;
  }

  getGenerationCount(
    family:
      string,
  ):
    number {
    return this
      .generationCounts
      .get(
        family,
      ) ??
      0;
  }
}

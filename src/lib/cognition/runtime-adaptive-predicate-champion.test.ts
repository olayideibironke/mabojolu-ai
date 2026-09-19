import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AbstractPrinciplePortfolio,
} from "./abstract-principle-portfolio";

import type {
  AbstractPrincipleEpisode,
} from "./abstract-principle";

import {
  AdaptiveValidatedPredicateApplicabilityModel,
} from "./adaptive-predicate-champion";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import type {
  InducedContextFeatures,
  InducedContextSignature,
} from "./principle-context-signature";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  ValidatedSymbolicPredicateApplicabilityModel,
} from "./validated-predicate-search";

const PRINCIPLE_ID =
  "principle-repeat-monotonic-progress-once";

function deferredEpisode(
  episodeId:
    string,

  family:
    string,

  familyKind:
    string,
):
  AbstractPrincipleEpisode {
  return {
    episodeId,
    family,
    familyKind,

    solved:
      true,

    goalConditions: {
      done:
        true,
    },

    transitions: [
      {
        action:
          "TRY",

        before: {
          ready:
            false,

          done:
            false,
        },

        after: {
          ready:
            false,

          done:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          "PREP",

        before: {
          ready:
            false,

          done:
            false,
        },

        after: {
          ready:
            true,

          done:
            false,
        },

        changedKeys: [
          "ready",
        ],

        accepted:
          true,
      },

      {
        action:
          "TRY",

        before: {
          ready:
            true,

          done:
            false,
        },

        after: {
          ready:
            true,

          done:
            true,
        },

        changedKeys: [
          "done",
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T20:00:00.000Z",
  };
}

function monotonicEpisode(
  episodeId:
    string,

  family:
    string,

  familyKind:
    string,

  action:
    string,

  key:
    string,
):
  AbstractPrincipleEpisode {
  return {
    episodeId,
    family,
    familyKind,

    solved:
      true,

    goalConditions: {
      done:
        true,
    },

    transitions: [
      {
        action,

        before: {
          [key]:
            0,

          done:
            false,
        },

        after: {
          [key]:
            1,

          done:
            false,
        },

        changedKeys: [
          key,
        ],

        accepted:
          true,
      },

      {
        action,

        before: {
          [key]:
            1,

          done:
            false,
        },

        after: {
          [key]:
            2,

          done:
            false,
        },

        changedKeys: [
          key,
        ],

        accepted:
          true,
      },

      {
        action:
          "FINISH",

        before: {
          [key]:
            2,

          done:
            false,
        },

        after: {
          [key]:
            2,

          done:
            true,
        },

        changedKeys: [
          "done",
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T21:00:00.000Z",
  };
}

function activePortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredEpisode(
      "deferred-a",
      "gated-family",
      "gated-sequence",
    ),
  );

  portfolio.learnFromEpisode(
    deferredEpisode(
      "deferred-b",
      "mode-family",
      "categorical-mode",
    ),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode(
      "monotonic-a",
      "threshold-family",
      "threshold-accumulation",
      "STEP",
      "counter",
    ),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode(
      "monotonic-b",
      "charge-family",
      "resource-charge",
      "CHARGE",
      "energy",
    ),
  );

  return portfolio;
}

function signature(
  historyLength:
    InducedContextFeatures[
      "historyLength"
    ],

  distinctActionsSeen:
    InducedContextFeatures[
      "distinctActionsSeen"
    ],
):
  InducedContextSignature {
  const features:
    InducedContextFeatures = {
    historyLength,

    distinctActionsSeen,

    lastChangeArity:
      "one",

    lastValueShapes: [
      "number:increase",
    ],

    candidateAttempts:
      "1",

    candidateNoEffectAttempts:
      "0",

    candidateEffectAttempts:
      "1",

    candidateMatchesLastAction:
      true,

    candidateMatchesLastProductiveAction:
      true,

    stepsSinceCandidateAttempt:
      "0",
  };

  return {
    key:
      JSON.stringify(
        features,
      ),

    features,
  };
}

const initialFit = [
  {
    history:
      "1" as const,

    distinct:
      "1" as const,

    useful:
      true,
  },

  {
    history:
      "2" as const,

    distinct:
      "2" as const,

    useful:
      true,
  },

  {
    history:
      "3+" as const,

    distinct:
      "3+" as const,

    useful:
      true,
  },

  {
    history:
      "1" as const,

    distinct:
      "2" as const,

    useful:
      false,
  },

  {
    history:
      "2" as const,

    distinct:
      "1" as const,

    useful:
      false,
  },

  {
    history:
      "3+" as const,

    distinct:
      "2" as const,

    useful:
      false,
  },
] as const;

const initialValidation = [
  {
    history:
      "1" as const,

    distinct:
      "1" as const,

    useful:
      true,
  },

  {
    history:
      "3+" as const,

    distinct:
      "2" as const,

    useful:
      false,
  },

  {
    history:
      "2" as const,

    distinct:
      "2" as const,

    useful:
      true,
  },
] as const;

function recordInto(
  model:
    {
      record(input: {
        principleId:
          string;

        signature:
          InducedContextSignature;

        useful:
          boolean;
      }): unknown;
    },

  input: {
    history:
      InducedContextFeatures[
        "historyLength"
      ];

    distinct:
      InducedContextFeatures[
        "distinctActionsSeen"
      ];

    useful:
      boolean;
  },
): void {
  model.record({
    principleId:
      PRINCIPLE_ID,

    signature:
      signature(
        input.history,
        input.distinct,
      ),

    useful:
      input.useful,
  });
}

function frozenEqualityChampion():
  ValidatedSymbolicPredicateApplicabilityModel {
  const model =
    new ValidatedSymbolicPredicateApplicabilityModel();

  for (
    const input of
      initialFit
  ) {
    recordInto(
      model,
      input,
    );
  }

  for (
    const input of
      initialValidation
  ) {
    recordInto(
      model,
      input,
    );
  }

  expect(
    model
      .getValidationSummary(
        PRINCIPLE_ID,
      )
      .status,
  ).toBe(
    "validated",
  );

  expect(
    model.estimate(
      PRINCIPLE_ID,
      signature(
        "3+",
        "2",
      ),
    )
      ?.program
      .operator,
  ).toBe(
    "equal",
  );

  return model;
}

function adaptedChampion():
  AdaptiveValidatedPredicateApplicabilityModel {
  const model =
    new AdaptiveValidatedPredicateApplicabilityModel();

  for (
    const input of
      initialFit
  ) {
    recordInto(
      model,
      input,
    );
  }

  for (
    const input of
      initialValidation
  ) {
    recordInto(
      model,
      input,
    );
  }

  expect(
    model.getSummary(
      PRINCIPLE_ID,
    ),
  ).toMatchObject({
    phase:
      "champion",

    championGeneration:
      1,
  });

  for (
    const input of [
      {
        history:
          "3+" as const,

        distinct:
          "2" as const,

        useful:
          true,
      },

      {
        history:
          "2" as const,

        distinct:
          "1" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "3+" as const,

        useful:
          false,
      },
    ]
  ) {
    recordInto(
      model,
      input,
    );
  }

  expect(
    model.getSummary(
      PRINCIPLE_ID,
    )
      .phase,
  ).toBe(
    "challenger-fit",
  );

  for (
    const input of [
      {
        history:
          "1" as const,

        distinct:
          "1" as const,

        useful:
          true,
      },

      {
        history:
          "2" as const,

        distinct:
          "1" as const,

        useful:
          true,
      },

      {
        history:
          "2" as const,

        distinct:
          "2" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "3+" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "1" as const,

        useful:
          false,
      },

      {
        history:
          "3+" as const,

        distinct:
          "1" as const,

        useful:
          false,
      },
    ]
  ) {
    recordInto(
      model,
      input,
    );
  }

  expect(
    model.getSummary(
      PRINCIPLE_ID,
    )
      .phase,
  ).toBe(
    "challenger-validation",
  );

  for (
    const input of [
      {
        history:
          "3+" as const,

        distinct:
          "2" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "1" as const,

        useful:
          false,
      },

      {
        history:
          "2" as const,

        distinct:
          "2" as const,

        useful:
          true,
      },
    ]
  ) {
    recordInto(
      model,
      input,
    );
  }

  expect(
    model.getSummary(
      PRINCIPLE_ID,
    ),
  ).toMatchObject({
    phase:
      "champion",

    championGeneration:
      2,

    replacementCount:
      1,

    lastChallengerValidationAccuracy:
      1,

    lastChampionValidationAccuracy:
      2 / 3,

    lastValidationBaselineAccuracy:
      2 / 3,

    lastReplacementDecision:
      "replaced",
  });

  expect(
    model.estimate(
      PRINCIPLE_ID,
      signature(
        "3+",
        "2",
      ),
    )
      ?.program,
  ).toMatchObject({
    operator:
      "absolute-difference-at-most",

    parameter:
      1,
  });

  return model;
}

class DriftedHeldOutWorld
  implements CognitiveEnvironment
{
  readonly id =
    "adaptive-champion-held-out";

  readonly goalDescription =
    "Open the post-drift held-out gate.";

  private phase =
    0;

  private prepared =
    false;

  private level =
    0;

  private open =
    false;

  getAvailableActions():
    readonly string[] {
    if (
      this.phase ===
        0
    ) {
      return [
        "TRY-GOAL",
      ];
    }

    if (
      this.phase ===
        1 ||
      this.phase ===
        2
    ) {
      return [
        "ADVANCE",
      ];
    }

    if (
      this.level >=
        2
    ) {
      return [
        "TRY-GOAL",
      ];
    }

    return [
      "TRY-GOAL",
      "ADVANCE",
      "DISTRACT",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      prepared:
        this.prepared,

      level:
        this.level,

      open:
        this.open,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      open:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      this.phase ===
        0 &&
      action ===
        "TRY-GOAL"
    ) {
      this.phase =
        1;

      return {
        accepted:
          true,

        summary:
          "Initial goal attempt had no effect.",
      };
    }

    if (
      this.phase ===
        1 &&
      action ===
        "ADVANCE"
    ) {
      this.prepared =
        true;

      this.phase =
        2;

      return {
        accepted:
          true,

        summary:
          "Same progress action prepared the system.",
      };
    }

    if (
      this.phase ===
        2 &&
      action ===
        "ADVANCE"
    ) {
      this.level =
        1;

      this.phase =
        3;

      return {
        accepted:
          true,

        summary:
          "Numeric progress observed.",
      };
    }

    if (
      action ===
        "ADVANCE" &&
      this.level <
        2
    ) {
      this.level =
        2;

      return {
        accepted:
          true,

        summary:
          "Second numeric progress observed.",
      };
    }

    if (
      action ===
        "TRY-GOAL" &&
      this.level >=
        2
    ) {
      this.open =
        true;

      return {
        accepted:
          true,

        summary:
          "Post-drift goal achieved.",
      };
    }

    return {
      accepted:
        true,

      summary:
        "Action had no observable effect.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.open;
  }
}

function makeClock(
  hour:
    number,
):
  () => string {
  let milliseconds =
    0;

  return () => {
    const value =
      new Date(
        Date.UTC(
          2026,
          8,
          19,
          hour,
          0,
          0,
          milliseconds,
        ),
      ).toISOString();

    milliseconds +=
      1;

    return value;
  };
}

describe(
  "Mabojolu G runtime fresh-reserve challenger champion adaptation",
  () => {
    it(
      "replaces a drifted validated champion and improves the same held-out runtime decision",
      () => {
        const frozenRun =
          new CognitiveRuntime(
            new DriftedHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                activePortfolio(),

              validatedSymbolicPredicateApplicabilityModel:
                frozenEqualityChampion(),

              maxCycles:
                10,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        const adaptive =
          adaptedChampion();

        const adaptiveRun =
          new CognitiveRuntime(
            new DriftedHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                activePortfolio(),

              adaptiveValidatedPredicateApplicabilityModel:
                adaptive,

              maxCycles:
                10,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        expect(
          frozenRun.solved,
        ).toBe(true);

        expect(
          adaptiveRun.solved,
        ).toBe(true);

        expect(
          frozenRun.cycles,
        ).toBe(6);

        expect(
          adaptiveRun.cycles,
        ).toBe(5);

        expect(
          adaptiveRun.cycles,
        ).toBeLessThan(
          frozenRun.cycles,
        );

        expect(
          frozenRun
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.principleKind,
        ).toBe(
          "deferred-goal-retry-after-progress",
        );

        const selected =
          adaptiveRun
            .abstractPrinciplePortfolio
            ?.selections[0];

        expect(
          selected,
        ).toMatchObject({
          action:
            "ADVANCE",

          principleKind:
            "repeat-monotonic-progress-once",

          applicabilitySource:
            "adaptive-predicate-champion",

          predicateAdaptation: {
            championGeneration:
              2,

            replacementCount:
              1,

            lastReplacementDecision:
              "replaced",
          },

          symbolicPredicateProjection: {
            operator:
              "absolute-difference-at-most",

            parameter:
              1,

            predicateValue:
              true,
          },
        });
      },
    );
  },
);

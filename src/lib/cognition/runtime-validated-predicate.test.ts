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

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  PrincipleApplicabilityModel,
} from "./principle-applicability-model";

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
      "2026-09-19T18:00:00.000Z",
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
      "2026-09-19T19:00:00.000Z",
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

function recordFit(
  model:
    ValidatedSymbolicPredicateApplicabilityModel,
): void {
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
    model.record({
      principleId:
        "principle-repeat-monotonic-progress-once",

      signature:
        signature(
          input.history,
          input.distinct,
        ),

      useful:
        input.useful,
    });
  }
}

function stillValidatingModel():
  ValidatedSymbolicPredicateApplicabilityModel {
  const model =
    new ValidatedSymbolicPredicateApplicabilityModel();

  recordFit(
    model,
  );

  model.record({
    principleId:
      "principle-repeat-monotonic-progress-once",

    signature:
      signature(
        "3+",
        "2",
      ),

    useful:
      true,
  });

  return model;
}

function validatedModel():
  ValidatedSymbolicPredicateApplicabilityModel {
  const model =
    new ValidatedSymbolicPredicateApplicabilityModel();

  recordFit(
    model,
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
    model.record({
      principleId:
        "principle-repeat-monotonic-progress-once",

      signature:
        signature(
          input.history,
          input.distinct,
        ),

      useful:
        input.useful,
    });
  }

  return model;
}

function olderSemanticPreference():
  PrincipleApplicabilityModel {
  const model =
    new PrincipleApplicabilityModel();

  for (
    let index = 0;
    index <
      3;
    index +=
      1
  ) {
    model.record({
      principleId:
        "principle-deferred-goal-retry-after-progress",

      context: {
        progressKind:
          "numeric",

        candidateRelation:
          "deferred-action",
      },

      useful:
        true,
    });

    model.record({
      principleId:
        "principle-repeat-monotonic-progress-once",

      context: {
        progressKind:
          "numeric",

        candidateRelation:
          "productive-repeat",
      },

      useful:
        false,
    });
  }

  return model;
}

class HeldOutValidationWorld
  implements CognitiveEnvironment
{
  readonly id =
    "held-out-validation-world";

  readonly goalDescription =
    "Open the held-out validation gate.";

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
          "Initial goal attempt had no observable effect.",
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
          "Same progress action produced nonnumeric setup.",
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
          "Held-out goal achieved.",
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
  "Mabojolu G runtime held-out predicate validation",
  () => {
    it(
      "blocks a fitted predicate from influencing selection until held-out validation passes",
      () => {
        const model =
          stillValidatingModel();

        expect(
          model
            .getValidationSummary(
              "principle-repeat-monotonic-progress-once",
            )
            .status,
        ).toBe(
          "validating",
        );

        const result =
          new CognitiveRuntime(
            new HeldOutValidationWorld(),
            {
              abstractPrinciplePortfolio:
                activePortfolio(),

              principleApplicabilityModel:
                olderSemanticPreference(),

              validatedSymbolicPredicateApplicabilityModel:
                model,

              maxCycles:
                10,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(6);

        expect(
          result
            .abstractPrinciplePortfolio
            ?.selections[0],
        ).toMatchObject({
          action:
            "TRY-GOAL",

          principleKind:
            "deferred-goal-retry-after-progress",

          applicabilitySource:
            "learned",
        });
      },
    );

    it(
      "lets the same frozen predicate override older evidence only after held-out approval",
      () => {
        const model =
          validatedModel();

        expect(
          model.getValidationSummary(
            "principle-repeat-monotonic-progress-once",
          ),
        ).toMatchObject({
          status:
            "validated",

          fitEvidenceCount:
            6,

          validationEvidenceCount:
            3,

          validationAccuracy:
            1,

          validationBaselineAccuracy:
            2 / 3,
        });

        const result =
          new CognitiveRuntime(
            new HeldOutValidationWorld(),
            {
              abstractPrinciplePortfolio:
                activePortfolio(),

              principleApplicabilityModel:
                olderSemanticPreference(),

              validatedSymbolicPredicateApplicabilityModel:
                model,

              maxCycles:
                10,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(5);

        const firstSelection =
          result
            .abstractPrinciplePortfolio
            ?.selections[0];

        expect(
          firstSelection,
        ).toMatchObject({
          action:
            "ADVANCE",

          principleKind:
            "repeat-monotonic-progress-once",

          applicabilitySource:
            "validated-predicate-learned",

          applicabilityEvidenceCount:
            4,

          predicateValidation: {
            status:
              "validated",

            fitEvidenceCount:
              6,

            validationEvidenceCount:
              3,

            validationAccuracy:
              1,

            validationBaselineAccuracy:
              2 / 3,
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

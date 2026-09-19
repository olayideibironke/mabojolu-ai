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

import {
  CognitiveRuntime,
} from "./runtime";

function deferredSupportEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  progressKey:
    string;

  goalKey:
    string;

  prepAction:
    string;

  goalAction:
    string;
}):
  AbstractPrincipleEpisode {
  const {
    episodeId,
    family,
    familyKind,
    progressKey,
    goalKey,
    prepAction,
    goalAction,
  } = input;

  return {
    episodeId,
    family,
    familyKind,

    solved:
      true,

    goalConditions: {
      [goalKey]:
        true,
    },

    transitions: [
      {
        action:
          goalAction,

        before: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        changedKeys: [],

        accepted:
          true,
      },

      {
        action:
          prepAction,

        before: {
          [progressKey]:
            false,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            true,

          [goalKey]:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          goalAction,

        before: {
          [progressKey]:
            true,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            true,

          [goalKey]:
            true,
        },

        changedKeys: [
          goalKey,
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T17:00:00.000Z",
  };
}

function monotonicSupportEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  progressKey:
    string;

  goalKey:
    string;

  progressAction:
    string;

  goalAction:
    string;
}):
  AbstractPrincipleEpisode {
  const {
    episodeId,
    family,
    familyKind,
    progressKey,
    goalKey,
    progressAction,
    goalAction,
  } = input;

  return {
    episodeId,
    family,
    familyKind,

    solved:
      true,

    goalConditions: {
      [goalKey]:
        true,
    },

    transitions: [
      {
        action:
          progressAction,

        before: {
          [progressKey]:
            0,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            1,

          [goalKey]:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          progressAction,

        before: {
          [progressKey]:
            1,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            2,

          [goalKey]:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          goalAction,

        before: {
          [progressKey]:
            2,

          [goalKey]:
            false,
        },

        after: {
          [progressKey]:
            2,

          [goalKey]:
            true,
        },

        changedKeys: [
          goalKey,
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T18:00:00.000Z",
  };
}

function activePortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredSupportEpisode({
      episodeId:
        "deferred-a",

      family:
        "gated-family",

      familyKind:
        "gated-sequence",

      progressKey:
        "ready",

      goalKey:
        "open",

      prepAction:
        "PREP",

      goalAction:
        "OPEN",
    }),
  );

  portfolio.learnFromEpisode(
    deferredSupportEpisode({
      episodeId:
        "deferred-b",

      family:
        "mode-family",

      familyKind:
        "categorical-mode",

      progressKey:
        "prepared",

      goalKey:
        "complete",

      prepAction:
        "ARM",

      goalAction:
        "COMMIT",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicSupportEpisode({
      episodeId:
        "monotonic-a",

      family:
        "threshold-family",

      familyKind:
        "threshold-accumulation",

      progressKey:
        "counter",

      goalKey:
        "done",

      progressAction:
        "STEP",

      goalAction:
        "FINISH",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicSupportEpisode({
      episodeId:
        "monotonic-b",

      family:
        "charge-family",

      familyKind:
        "resource-charge",

      progressKey:
        "energy",

      goalKey:
        "released",

      progressAction:
        "CHARGE",

      goalAction:
        "RELEASE",
    }),
  );

  return portfolio;
}

class NumericApplicabilityPracticeWorld
  implements CognitiveEnvironment
{
  readonly id =
    "applicability-numeric-practice";

  readonly goalDescription =
    "Complete numeric practice.";

  private level =
    0;

  private done =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "ADVANCE",
      "FINISH",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      level:
        this.level,

      done:
        this.done,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      done:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
        "ADVANCE" &&
      this.level <
        2
    ) {
      this.level +=
        1;
    }

    if (
      action ===
        "FINISH" &&
      this.level >=
        2
    ) {
      this.done =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Numeric applicability action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.done;
  }
}

class CategoricalApplicabilityPracticeWorld
  implements CognitiveEnvironment
{
  readonly id =
    "applicability-categorical-practice";

  readonly goalDescription =
    "Complete categorical practice.";

  private mode =
    "cold";

  private done =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "TRY",
      "PREPARE",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      mode:
        this.mode,

      done:
        this.done,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      done:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
      "PREPARE"
    ) {
      this.mode =
        "ready";
    }

    if (
      action ===
        "TRY" &&
      this.mode ===
        "ready"
    ) {
      this.done =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Categorical applicability action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.done;
  }
}

class HeldOutApplicabilityWorld
  implements CognitiveEnvironment
{
  readonly id =
    "applicability-held-out";

  readonly goalDescription =
    "Open the held-out gate.";

  private level =
    0;

  private open =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "TRY-GOAL",
      "ADVANCE",
      "DISTRACT",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
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
      action ===
        "ADVANCE" &&
      this.level <
        2
    ) {
      this.level +=
        1;
    }

    if (
      action ===
        "TRY-GOAL" &&
      this.level >=
        2
    ) {
      this.open =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Held-out applicability action executed.",
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
    const timestamp =
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

    return timestamp;
  };
}

describe(
  "Mabojolu G runtime learned abstraction applicability",
  () => {
    it(
      "learns applicability from prior applications and improves later principle selection",
      () => {
        const portfolio =
          activePortfolio();

        const learnedModel =
          new PrincipleApplicabilityModel();

        const numericPractice =
          new CognitiveRuntime(
            new NumericApplicabilityPracticeWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                learnedModel,

              maxCycles:
                8,

              now:
                makeClock(
                  19,
                ),
            },
          ).run();

        expect(
          numericPractice.solved,
        ).toBe(true);

        expect(
          numericPractice.cycles,
        ).toBe(3);

        const categoricalPractice =
          new CognitiveRuntime(
            new CategoricalApplicabilityPracticeWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                learnedModel,

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        expect(
          categoricalPractice.solved,
        ).toBe(true);

        expect(
          categoricalPractice.cycles,
        ).toBe(3);

        expect(
          learnedModel
            .getEvidenceCount(),
        ).toBe(2);

        const learnedNumeric =
          learnedModel.estimate(
            "principle-repeat-monotonic-progress-once",
            {
              progressKind:
                "numeric",

              candidateRelation:
                "productive-repeat",
            },
          );

        expect(
          learnedNumeric.evidenceCount,
        ).toBe(1);

        expect(
          learnedNumeric.applicability,
        ).toBeCloseTo(
          2 / 3,
        );

        const uncalibrated =
          new CognitiveRuntime(
            new HeldOutApplicabilityWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                new PrincipleApplicabilityModel(),

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        const learned =
          new CognitiveRuntime(
            new HeldOutApplicabilityWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                learnedModel,

              maxCycles:
                8,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        expect(
          uncalibrated.solved,
        ).toBe(true);

        expect(
          learned.solved,
        ).toBe(true);

        expect(
          uncalibrated.cycles,
        ).toBe(5);

        expect(
          learned.cycles,
        ).toBe(4);

        expect(
          learned.cycles,
        ).toBeLessThan(
          uncalibrated.cycles,
        );

        expect(
          learned
            .abstractPrinciplePortfolio
            ?.selections[0],
        ).toMatchObject({
          action:
            "ADVANCE",

          principleKind:
            "repeat-monotonic-progress-once",

          applicabilitySource:
            "learned",

          applicabilityEvidenceCount:
            1,

          applicabilityContext: {
            progressKind:
              "numeric",

            candidateRelation:
              "productive-repeat",
          },
        });

        expect(
          learned
            .abstractPrinciplePortfolio
            ?.selections[1],
        ).toMatchObject({
          action:
            "TRY-GOAL",

          principleKind:
            "deferred-goal-retry-after-progress",

          applicabilitySource:
            "model-prior",

          applicabilityEvidenceCount:
            0,
        });
      },
    );

    it(
      "persists applicability evidence across episodes while keeping contextual bindings fresh",
      () => {
        const portfolio =
          activePortfolio();

        const model =
          new PrincipleApplicabilityModel();

        new CognitiveRuntime(
          new NumericApplicabilityPracticeWorld(),
          {
            abstractPrinciplePortfolio:
              portfolio,

            principleApplicabilityModel:
              model,

            maxCycles:
              8,

            now:
              makeClock(
                19,
              ),
          },
        ).run();

        expect(
          model.getEvidenceCount(),
        ).toBe(1);

        const first =
          new CognitiveRuntime(
            new HeldOutApplicabilityWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                model,

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const evidenceAfterFirst =
          model.getEvidenceCount();

        const second =
          new CognitiveRuntime(
            new HeldOutApplicabilityWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              principleApplicabilityModel:
                model,

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          first.cycles,
        ).toBe(4);

        expect(
          second.cycles,
        ).toBe(4);

        expect(
          evidenceAfterFirst,
        ).toBeGreaterThan(1);

        expect(
          model.getEvidenceCount(),
        ).toBeGreaterThan(
          evidenceAfterFirst,
        );
      },
    );
  },
);

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
  ComposedContextFeatureApplicabilityModel,
} from "./context-feature-composition";

import {
  RelationalContextFeatureApplicabilityModel,
} from "./context-feature-relation";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

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
      "2026-09-19T15:00:00.000Z",
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

  progressKey:
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
          [progressKey]:
            0,

          done:
            false,
        },

        after: {
          [progressKey]:
            1,

          done:
            false,
        },

        changedKeys: [
          progressKey,
        ],

        accepted:
          true,
      },

      {
        action,

        before: {
          [progressKey]:
            1,

          done:
            false,
        },

        after: {
          [progressKey]:
            2,

          done:
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
          "FINISH",

        before: {
          [progressKey]:
            2,

          done:
            false,
        },

        after: {
          [progressKey]:
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
      "2026-09-19T16:00:00.000Z",
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

type PreludeMode =
  | "direct"
  | "same-prime-one"
  | "setup-one"
  | "same-prime-two"
  | "setup-repeat-two";

interface CalibrationConfig {
  id:
    string;

  mode:
    PreludeMode;

  progressAction:
    string;

  setupAction:
    string;

  progressKey:
    string;

  repeatUseful:
    boolean;
}

class RelationalCalibrationWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Complete relational calibration.";

  private progress =
    0;

  private preludeCount =
    0;

  private setupOne =
    false;

  private setupTwo =
    false;

  private repeatAttempted =
    false;

  private done =
    false;

  constructor(
    private readonly config:
      CalibrationConfig,
  ) {}

  get id():
    string {
    return this
      .config
      .id;
  }

  getAvailableActions():
    readonly string[] {
    if (
      !this.preludeComplete()
    ) {
      return [
        this.preludeUsesProgressAction()
          ? this.config
              .progressAction
          : this.config
              .setupAction,
      ];
    }

    if (
      this.repeatAttempted
    ) {
      return [
        "FINISH",
      ];
    }

    return [
      this.config
        .progressAction,
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      [this.config
        .progressKey]:
        this.progress,

      setupOne:
        this.setupOne,

      setupTwo:
        this.setupTwo,

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
      !this.preludeComplete()
    ) {
      if (
        this.preludeUsesProgressAction() &&
        action ===
          this.config
            .progressAction
      ) {
        this.preludeCount +=
          1;

        if (
          this.preludeCount ===
            1
        ) {
          this.setupOne =
            true;
        } else {
          this.setupTwo =
            true;
        }

        return {
          accepted:
            true,

          summary:
            "Observable same-action priming completed.",
        };
      }

      if (
        !this.preludeUsesProgressAction() &&
        action ===
          this.config
            .setupAction
      ) {
        this.preludeCount +=
          1;

        if (
          this.preludeCount ===
            1
        ) {
          this.setupOne =
            true;
        } else {
          this.setupTwo =
            true;
        }

        return {
          accepted:
            true,

          summary:
            "Observable setup completed.",
        };
      }
    }

    if (
      action ===
        this.config
          .progressAction
    ) {
      if (
        this.progress ===
          0
      ) {
        this.progress =
          1;

        return {
          accepted:
            true,

          summary:
            "Initial numeric progress observed.",
        };
      }

      if (
        !this.repeatAttempted
      ) {
        this.repeatAttempted =
          true;

        if (
          this.config
            .repeatUseful
        ) {
          this.progress =
            2;
        }

        return {
          accepted:
            true,

          summary:
            "Repeat progress attempt observed.",
        };
      }
    }

    if (
      action ===
        "FINISH" &&
      this.repeatAttempted
    ) {
      this.done =
        true;

      return {
        accepted:
          true,

        summary:
          "Calibration completed.",
      };
    }

    return {
      accepted:
        true,

      summary:
        "Action had no additional effect.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.done;
  }

  private preludeUsesProgressAction():
    boolean {
    return (
      this.config
        .mode ===
        "same-prime-one" ||
      this.config
        .mode ===
        "same-prime-two"
    );
  }

  private preludeComplete():
    boolean {
    if (
      this.config
        .mode ===
        "direct"
    ) {
      return true;
    }

    if (
      this.config
        .mode ===
        "same-prime-one" ||
      this.config
        .mode ===
        "setup-one"
    ) {
      return (
        this.preludeCount >=
        1
      );
    }

    return (
      this.preludeCount >=
      2
    );
  }
}

class RelationalHeldOutWorld
  implements CognitiveEnvironment
{
  readonly id =
    "relational-held-out";

  readonly goalDescription =
    "Open the relational held-out gate.";

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
        1
    ) {
      return [
        "PREPARE",
      ];
    }

    if (
      this.level ===
        0
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
          "Goal attempt had no observable effect.",
      };
    }

    if (
      this.phase ===
        1 &&
      action ===
        "PREPARE"
    ) {
      this.prepared =
        true;

      this.phase =
        2;

      return {
        accepted:
          true,

        summary:
          "Preparation observed.",
      };
    }

    if (
      action ===
        "ADVANCE" &&
      this.level <
        2
    ) {
      this.level +=
        1;

      return {
        accepted:
          true,

        summary:
          "Numeric progress observed.",
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

function calibrationConfigs():
  CalibrationConfig[] {
  return [
    {
      id:
        "history-one-distinct-one",

      mode:
        "direct",

      progressAction:
        "BOOST",

      setupAction:
        "UNUSED",

      progressKey:
        "charge",

      repeatUseful:
        true,
    },

    {
      id:
        "history-two-distinct-one",

      mode:
        "same-prime-one",

      progressAction:
        "CLIMB",

      setupAction:
        "UNUSED",

      progressKey:
        "height",

      repeatUseful:
        false,
    },

    {
      id:
        "history-two-distinct-two",

      mode:
        "setup-one",

      progressAction:
        "PULSE",

      setupAction:
        "ARM",

      progressKey:
        "signal",

      repeatUseful:
        true,
    },

    {
      id:
        "history-three-distinct-one",

      mode:
        "same-prime-two",

      progressAction:
        "FILL",

      setupAction:
        "UNUSED",

      progressKey:
        "volume",

      repeatUseful:
        false,
    },

    {
      id:
        "history-three-distinct-two",

      mode:
        "setup-repeat-two",

      progressAction:
        "RAISE",

      setupAction:
        "PRIME",

      progressKey:
        "meter",

      repeatUseful:
        false,
    },
  ];
}

function calibrate(input: {
  portfolio:
    AbstractPrinciplePortfolio;

  pair:
    ComposedContextFeatureApplicabilityModel;

  relational:
    RelationalContextFeatureApplicabilityModel;
}): void {
  calibrationConfigs()
    .forEach(
      (
        config,
        index,
      ) => {
        const result =
          new CognitiveRuntime(
            new RelationalCalibrationWorld(
              config,
            ),
            {
              abstractPrinciplePortfolio:
                input.portfolio,

              composedContextFeatureApplicabilityModel:
                input.pair,

              relationalContextFeatureApplicabilityModel:
                input.relational,

              maxCycles:
                10,

              now:
                makeClock(
                  14 +
                  index,
                ),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.principleKind,
        ).toBe(
          "repeat-monotonic-progress-once",
        );
      },
    );
}

describe(
  "Mabojolu G runtime autonomous relational context synthesis",
  () => {
    it(
      "learns a relational rule that captures calibration outcomes beyond atomic dimensions",
      () => {
        const portfolio =
          activePortfolio();

        const pair =
          new ComposedContextFeatureApplicabilityModel();

        const relational =
          new RelationalContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          pair,
          relational,
        });

        const principleId =
          "principle-repeat-monotonic-progress-once";

        const best =
          relational.rankRelations(
            principleId,
          )[0];

        expect(
          best,
        ).toMatchObject({
          left:
            "historyLength",

          right:
            "distinctActionsSeen",

          operator:
            "equal",
        });

        expect(
          best
            ?.gainOverBestAtomic,
        ).toBeGreaterThan(
          0,
        );

        expect(
          relational.getObservationCount(
            principleId,
          ),
        ).toBe(5);

        expect(
          pair.getObservationCount(
            principleId,
          ),
        ).toBe(5);
      },
    );

    it(
      "generalizes the synthesized relation to an unseen value pair that exact pair composition cannot reuse",
      () => {
        const portfolio =
          activePortfolio();

        const pair =
          new ComposedContextFeatureApplicabilityModel();

        const relational =
          new RelationalContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          pair,
          relational,
        });

        const pairRun =
          new CognitiveRuntime(
            new RelationalHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              composedContextFeatureApplicabilityModel:
                pair,

              maxCycles:
                10,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const relationalRun =
          new CognitiveRuntime(
            new RelationalHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              relationalContextFeatureApplicabilityModel:
                relational,

              maxCycles:
                10,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          pairRun.solved,
        ).toBe(true);

        expect(
          relationalRun.solved,
        ).toBe(true);

        expect(
          pairRun.cycles,
        ).toBe(6);

        expect(
          relationalRun.cycles,
        ).toBe(5);

        expect(
          relationalRun.cycles,
        ).toBeLessThan(
          pairRun.cycles,
        );

        const firstSelection =
          relationalRun
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
            "relational-learned",

          applicabilityEvidenceCount:
            2,

          relationalContextProjection: {
            left:
              "historyLength",

            right:
              "distinctActionsSeen",

            operator:
              "equal",

            relationValue:
              true,
          },
        });

        const pairFirstSelection =
          pairRun
            .abstractPrinciplePortfolio
            ?.selections[0];

        expect(
          pairFirstSelection
            ?.principleKind,
        ).toBe(
          "deferred-goal-retry-after-progress",
        );

        const serialized =
          JSON.stringify(
            firstSelection
              ?.relationalContextProjection,
          );

        for (
          const sourceSymbol of [
            "BOOST",
            "CLIMB",
            "PULSE",
            "FILL",
            "RAISE",
            "ADVANCE",
            "charge",
            "height",
            "signal",
            "volume",
            "meter",
            "level",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            sourceSymbol,
          );
        }
      },
    );

    it(
      "persists the synthesized relation while keeping target bindings episode-local",
      () => {
        const portfolio =
          activePortfolio();

        const pair =
          new ComposedContextFeatureApplicabilityModel();

        const relational =
          new RelationalContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          pair,
          relational,
        });

        const before =
          relational
            .getObservationCount();

        const first =
          new CognitiveRuntime(
            new RelationalHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              relationalContextFeatureApplicabilityModel:
                relational,

              maxCycles:
                10,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new RelationalHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              relationalContextFeatureApplicabilityModel:
                relational,

              maxCycles:
                10,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          first.cycles,
        ).toBe(5);

        expect(
          second.cycles,
        ).toBe(5);

        expect(
          first
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.relationalContextProjection
            ?.featureId,
        ).toBe(
          second
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.relationalContextProjection
            ?.featureId,
        );

        expect(
          relational
            .getObservationCount(),
        ).toBeGreaterThan(
          before,
        );
      },
    );
  },
);

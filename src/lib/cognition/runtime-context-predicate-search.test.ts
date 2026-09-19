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
  RelationalContextFeatureApplicabilityModel,
} from "./context-feature-relation";

import {
  SymbolicPredicateApplicabilityModel,
} from "./context-predicate-search";

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
  | "same-one"
  | "same-two"
  | "same-one-setup-two-distinct";

interface CalibrationConfig {
  id:
    string;

  mode:
    PreludeMode;

  progressAction:
    string;

  setupActionOne:
    string;

  setupActionTwo:
    string;

  progressKey:
    string;

  repeatUseful:
    boolean;
}

class PredicateCalibrationWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Complete predicate calibration.";

  private preludeCount =
    0;

  private setupOne =
    false;

  private setupTwo =
    false;

  private setupThree =
    false;

  private progress =
    0;

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
    const preludeAction =
      this.nextPreludeAction();

    if (
      preludeAction
    ) {
      return [
        preludeAction,
      ];
    }

    if (
      this.progress ===
        0 ||
      !this.repeatAttempted
    ) {
      return [
        this.config
          .progressAction,
      ];
    }

    return [
      "FINISH",
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

      setupThree:
        this.setupThree,

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
    const preludeAction =
      this.nextPreludeAction();

    if (
      preludeAction &&
      action ===
        preludeAction
    ) {
      this.preludeCount +=
        1;

      if (
        this.preludeCount ===
          1
      ) {
        this.setupOne =
          true;
      } else if (
        this.preludeCount ===
          2
      ) {
        this.setupTwo =
          true;
      } else {
        this.setupThree =
          true;
      }

      return {
        accepted:
          true,

        summary:
          "Observable predicate calibration setup completed.",
      };
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
            "Repeat progress experiment observed.",
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
          "Predicate calibration completed.",
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

  private nextPreludeAction():
    string |
    undefined {
    if (
      this.config
        .mode ===
        "direct"
    ) {
      return undefined;
    }

    if (
      this.config
        .mode ===
        "same-one"
    ) {
      return this.preludeCount <
        1
        ? this.config
            .progressAction
        : undefined;
    }

    if (
      this.config
        .mode ===
        "same-two"
    ) {
      return this.preludeCount <
        2
        ? this.config
            .progressAction
        : undefined;
    }

    if (
      this.preludeCount ===
        0
    ) {
      return this.config
        .progressAction;
    }

    if (
      this.preludeCount ===
        1
    ) {
      return this.config
        .setupActionOne;
    }

    return this.preludeCount ===
      2
      ? this.config
          .setupActionTwo
      : undefined;
  }
}

class PredicateHeldOutWorld
  implements CognitiveEnvironment
{
  readonly id =
    "predicate-held-out";

  readonly goalDescription =
    "Open the symbolic-predicate held-out gate.";

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
        "ADVANCE",
      ];
    }

    if (
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
          "Goal attempt produced no observable effect.",
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
          "Held-out predicate goal achieved.",
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
        "one-one-useful",

      mode:
        "direct",

      progressAction:
        "BOOST",

      setupActionOne:
        "UNUSED-A",

      setupActionTwo:
        "UNUSED-B",

      progressKey:
        "charge",

      repeatUseful:
        true,
    },

    {
      id:
        "two-one-useful",

      mode:
        "same-one",

      progressAction:
        "CLIMB",

      setupActionOne:
        "UNUSED-C",

      setupActionTwo:
        "UNUSED-D",

      progressKey:
        "height",

      repeatUseful:
        true,
    },

    {
      id:
        "three-three-useful-a",

      mode:
        "same-one-setup-two-distinct",

      progressAction:
        "PULSE",

      setupActionOne:
        "ARM",

      setupActionTwo:
        "STAGE",

      progressKey:
        "signal",

      repeatUseful:
        true,
    },

    {
      id:
        "three-three-useful-b",

      mode:
        "same-one-setup-two-distinct",

      progressAction:
        "FILL",

      setupActionOne:
        "PRIME",

      setupActionTwo:
        "READY",

      progressKey:
        "volume",

      repeatUseful:
        true,
    },

    {
      id:
        "three-one-failed-a",

      mode:
        "same-two",

      progressAction:
        "RAISE",

      setupActionOne:
        "UNUSED-E",

      setupActionTwo:
        "UNUSED-F",

      progressKey:
        "meter",

      repeatUseful:
        false,
    },

    {
      id:
        "three-one-failed-b",

      mode:
        "same-two",

      progressAction:
        "LIFT",

      setupActionOne:
        "UNUSED-G",

      setupActionTwo:
        "UNUSED-H",

      progressKey:
        "altitude",

      repeatUseful:
        false,
    },
  ];
}

function calibrate(input: {
  portfolio:
    AbstractPrinciplePortfolio;

  relational:
    RelationalContextFeatureApplicabilityModel;

  predicate:
    SymbolicPredicateApplicabilityModel;
}): void {
  calibrationConfigs()
    .forEach(
      (
        config,
        index,
      ) => {
        const result =
          new CognitiveRuntime(
            new PredicateCalibrationWorld(
              config,
            ),
            {
              abstractPrinciplePortfolio:
                input.portfolio,

              relationalContextFeatureApplicabilityModel:
                input.relational,

              symbolicPredicateApplicabilityModel:
                input.predicate,

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
  "Mabojolu G runtime complexity-regularized symbolic predicate search",
  () => {
    it(
      "learns a regularized predicate that explains application outcomes beyond the basic relation grammar",
      () => {
        const portfolio =
          activePortfolio();

        const relational =
          new RelationalContextFeatureApplicabilityModel(
            6,
          );

        const predicate =
          new SymbolicPredicateApplicabilityModel();

        calibrate({
          portfolio,
          relational,
          predicate,
        });

        const principleId =
          "principle-repeat-monotonic-progress-once";

        const learnedRelation =
          relational.rankRelations(
            principleId,
          )[0];

        expect(
          learnedRelation,
        ).toBeDefined();

        expect(
          learnedRelation
            ?.gainOverBestAtomic,
        ).toBeGreaterThan(
          0,
        );

        const best =
          predicate.rankPrograms(
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
            "absolute-difference-at-most",

          parameter:
            1,

          complexity:
            2,
        });

        expect(
          best
            ?.regularizedScore,
        ).toBeGreaterThan(
          best
            ?.bestAtomicInformationGain ??
            0,
        );

        expect(
          relational.getObservationCount(
            principleId,
          ),
        ).toBe(6);

        expect(
          predicate.getObservationCount(
            principleId,
          ),
        ).toBe(6);
      },
    );

    it(
      "uses the symbolic predicate to beat the v0.7 relation learner on an unseen three-plus over two context",
      () => {
        const portfolio =
          activePortfolio();

        const relational =
          new RelationalContextFeatureApplicabilityModel(
            6,
          );

        const predicate =
          new SymbolicPredicateApplicabilityModel();

        calibrate({
          portfolio,
          relational,
          predicate,
        });

        const relationRun =
          new CognitiveRuntime(
            new PredicateHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              relationalContextFeatureApplicabilityModel:
                relational,

              maxCycles:
                10,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        const predicateRun =
          new CognitiveRuntime(
            new PredicateHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              symbolicPredicateApplicabilityModel:
                predicate,

              maxCycles:
                10,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        expect(
          relationRun.solved,
        ).toBe(true);

        expect(
          predicateRun.solved,
        ).toBe(true);

        expect(
          relationRun.cycles,
        ).toBe(6);

        expect(
          predicateRun.cycles,
        ).toBe(5);

        expect(
          predicateRun.cycles,
        ).toBeLessThan(
          relationRun.cycles,
        );

        expect(
          relationRun
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.principleKind,
        ).toBe(
          "deferred-goal-retry-after-progress",
        );

        const firstSelection =
          predicateRun
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
            "predicate-learned",

          applicabilityEvidenceCount:
            4,

          symbolicPredicateProjection: {
            left:
              "historyLength",

            right:
              "distinctActionsSeen",

            operator:
              "absolute-difference-at-most",

            parameter:
              1,

            predicateValue:
              true,
          },
        });

        const serialized =
          JSON.stringify(
            firstSelection
              ?.symbolicPredicateProjection,
          );

        for (
          const sourceSymbol of [
            "BOOST",
            "CLIMB",
            "PULSE",
            "FILL",
            "RAISE",
            "LIFT",
            "ADVANCE",
            "charge",
            "height",
            "signal",
            "volume",
            "meter",
            "altitude",
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
      "persists the learned predicate while keeping target bindings episode-local",
      () => {
        const portfolio =
          activePortfolio();

        const relational =
          new RelationalContextFeatureApplicabilityModel(
            6,
          );

        const predicate =
          new SymbolicPredicateApplicabilityModel();

        calibrate({
          portfolio,
          relational,
          predicate,
        });

        const before =
          predicate
            .getObservationCount();

        const first =
          new CognitiveRuntime(
            new PredicateHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              symbolicPredicateApplicabilityModel:
                predicate,

              maxCycles:
                10,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new PredicateHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              symbolicPredicateApplicabilityModel:
                predicate,

              maxCycles:
                10,

              now:
                makeClock(
                  23,
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
            ?.symbolicPredicateProjection
            ?.programId,
        ).toBe(
          second
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.symbolicPredicateProjection
            ?.programId,
        );

        expect(
          predicate
            .getObservationCount(),
        ).toBeGreaterThan(
          before,
        );
      },
    );
  },
);

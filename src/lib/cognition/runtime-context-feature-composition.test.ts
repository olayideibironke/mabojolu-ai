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
  LearnedContextFeatureApplicabilityModel,
} from "./context-feature-learning";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

function deferredEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;
}):
  AbstractPrincipleEpisode {
  return {
    episodeId:
      input.episodeId,

    family:
      input.family,

    familyKind:
      input.familyKind,

    solved:
      true,

    goalConditions: {
      goal:
        true,
    },

    transitions: [
      {
        action:
          "GOAL",

        before: {
          ready:
            false,

          goal:
            false,
        },

        after: {
          ready:
            false,

          goal:
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

          goal:
            false,
        },

        after: {
          ready:
            true,

          goal:
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
          "GOAL",

        before: {
          ready:
            true,

          goal:
            false,
        },

        after: {
          ready:
            true,

          goal:
            true,
        },

        changedKeys: [
          "goal",
        ],

        accepted:
          true,
      },
    ],

    observedAt:
      "2026-09-19T16:00:00.000Z",
  };
}

function monotonicEpisode(input: {
  episodeId:
    string;

  family:
    string;

  familyKind:
    string;

  action:
    string;

  progressKey:
    string;
}):
  AbstractPrincipleEpisode {
  return {
    episodeId:
      input.episodeId,

    family:
      input.family,

    familyKind:
      input.familyKind,

    solved:
      true,

    goalConditions: {
      done:
        true,
    },

    transitions: [
      {
        action:
          input.action,

        before: {
          [input.progressKey]:
            0,

          done:
            false,
        },

        after: {
          [input.progressKey]:
            1,

          done:
            false,
        },

        changedKeys: [
          input.progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          input.action,

        before: {
          [input.progressKey]:
            1,

          done:
            false,
        },

        after: {
          [input.progressKey]:
            2,

          done:
            false,
        },

        changedKeys: [
          input.progressKey,
        ],

        accepted:
          true,
      },

      {
        action:
          "COMPLETE",

        before: {
          [input.progressKey]:
            2,

          done:
            false,
        },

        after: {
          [input.progressKey]:
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
      "2026-09-19T17:00:00.000Z",
  };
}

function activePortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredEpisode({
      episodeId:
        "deferred-a",

      family:
        "gated-family",

      familyKind:
        "gated-sequence",
    }),
  );

  portfolio.learnFromEpisode(
    deferredEpisode({
      episodeId:
        "deferred-b",

      family:
        "mode-family",

      familyKind:
        "categorical-mode",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode({
      episodeId:
        "monotonic-a",

      family:
        "threshold-family",

      familyKind:
        "threshold-accumulation",

      action:
        "STEP",

      progressKey:
        "counter",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode({
      episodeId:
        "monotonic-b",

      family:
        "charge-family",

      familyKind:
        "resource-charge",

      action:
        "CHARGE",

      progressKey:
        "energy",
    }),
  );

  return portfolio;
}

interface CompositionCalibrationConfig {
  id:
    string;

  progressAction:
    string;

  finishAction:
    string;

  progressKey:
    string;

  flagKey:
    string;

  setupAction?:
    string;

  setupKey?:
    string;

  multiChange:
    boolean;

  repeatUseful:
    boolean;
}

class CompositionCalibrationWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Complete composition calibration.";

  private progress =
    0;

  private flag =
    false;

  private setupDone:
    boolean;

  private repeatAttempted =
    false;

  private done =
    false;

  constructor(
    private readonly config:
      CompositionCalibrationConfig,
  ) {
    this.setupDone =
      !config.setupAction;
  }

  get id():
    string {
    return this
      .config
      .id;
  }

  getAvailableActions():
    readonly string[] {
    if (
      !this.setupDone &&
      this.config
        .setupAction
    ) {
      return [
        this.config
          .setupAction,
      ];
    }

    if (
      this.repeatAttempted
    ) {
      return [
        this.config
          .finishAction,
      ];
    }

    return [
      this.config
        .progressAction,
      this.config
        .finishAction,
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      [this.config
        .progressKey]:
        this.progress,

      [this.config
        .flagKey]:
        this.flag,

      ...(this.config
          .setupKey
        ? {
            [this.config
              .setupKey]:
              this.setupDone,
          }
        : {}),

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
      this.config
        .setupAction &&
      action ===
        this.config
          .setupAction
    ) {
      this.setupDone =
        true;

      return {
        accepted:
          true,

        summary:
          "Setup completed.",
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

        if (
          this.config
            .multiChange
        ) {
          this.flag =
            true;
        }

        return {
          accepted:
            true,

          summary:
            "Initial progress observed.",
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
        this.config
          .finishAction &&
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
}

class CompositionHeldOutWorld
  implements CognitiveEnvironment
{
  readonly id =
    "composition-held-out";

  readonly goalDescription =
    "Open the composed-feature gate.";

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
        "Held-out composition action executed.",
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
  CompositionCalibrationConfig[] {
  const base:
    CompositionCalibrationConfig[] = [
    {
      id:
        "short-one-negative",

      progressAction:
        "BOOST",

      finishAction:
        "RELEASE",

      progressKey:
        "charge",

      flagKey:
        "stable",

      multiChange:
        false,

      repeatUseful:
        false,
    },

    {
      id:
        "long-one-positive",

      progressAction:
        "CLIMB",

      finishAction:
        "ARRIVE",

      progressKey:
        "height",

      flagKey:
        "marker",

      setupAction:
        "PREPARE",

      setupKey:
        "prepared",

      multiChange:
        false,

      repeatUseful:
        true,
    },

    {
      id:
        "short-many-positive",

      progressAction:
        "PULSE",

      finishAction:
        "COMMIT",

      progressKey:
        "signal",

      flagKey:
        "armed",

      multiChange:
        true,

      repeatUseful:
        true,
    },

    {
      id:
        "long-many-negative",

      progressAction:
        "FILL",

      finishAction:
        "SEAL",

      progressKey:
        "volume",

      flagKey:
        "latched",

      setupAction:
        "PRIME",

      setupKey:
        "primed",

      multiChange:
        true,

      repeatUseful:
        false,
    },
  ];

  return [
    ...base,

    ...base.map(
      (
        config,
        index,
      ) => ({
        ...config,

        id:
          config.id +
          "-renamed",

        progressAction:
          [
            "RAISE",
            "ASCEND",
            "PING",
            "LOAD",
          ][index],

        finishAction:
          [
            "UNLOCK",
            "LAND",
            "CONFIRM",
            "CLOSE",
          ][index],

        progressKey:
          [
            "meter",
            "altitude",
            "strength",
            "capacity",
          ][index],

        flagKey:
          [
            "steady",
            "tagged",
            "enabled",
            "secured",
          ][index],

        ...(config.setupAction
          ? {
              setupAction:
                [
                  "IGNITE",
                  "READY",
                  "ARM",
                  "STAGE",
                ][index],

              setupKey:
                [
                  "ignited",
                  "readied",
                  "armedSetup",
                  "staged",
                ][index],
            }
          : {}),
      }),
    ),
  ];
}

function calibrate(input: {
  portfolio:
    AbstractPrinciplePortfolio;

  atomic:
    LearnedContextFeatureApplicabilityModel;

  composed:
    ComposedContextFeatureApplicabilityModel;
}): void {
  calibrationConfigs()
    .forEach(
      (
        config,
        index,
      ) => {
        const result =
          new CognitiveRuntime(
            new CompositionCalibrationWorld(
              config,
            ),
            {
              abstractPrinciplePortfolio:
                input.portfolio,

              learnedContextFeatureApplicabilityModel:
                input.atomic,

              composedContextFeatureApplicabilityModel:
                input.composed,

              maxCycles:
                8,

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
          result.cycles,
        ).toBe(
          config.setupAction
            ? 4
            : 3,
        );

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
  "Mabojolu G runtime autonomous context feature composition",
  () => {
    it(
      "constructs a predictive higher-order feature when atomic context dimensions are individually uninformative",
      () => {
        const portfolio =
          activePortfolio();

        const atomic =
          new LearnedContextFeatureApplicabilityModel();

        const composed =
          new ComposedContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          atomic,
          composed,
        });

        const principleId =
          "principle-repeat-monotonic-progress-once";

        expect(
          atomic.rankFeatures(
            principleId,
          ),
        ).toEqual([]);

        const best =
          composed.rankCompositions(
            principleId,
          )[0];

        expect(
          best,
        ).toBeDefined();

        expect(
          best
            ?.components,
        ).toHaveLength(2);

        expect(
          best
            ?.bestAtomicInformationGain,
        ).toBe(0);

        expect(
          best
            ?.gainOverBestAtomic,
        ).toBeGreaterThan(
          0,
        );

        expect(
          best
            ?.informationGain,
        ).toBe(1);
      },
    );

    it(
      "uses the composed feature to beat the atomic learner on a renamed held-out conflict",
      () => {
        const portfolio =
          activePortfolio();

        const atomic =
          new LearnedContextFeatureApplicabilityModel();

        const composed =
          new ComposedContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          atomic,
          composed,
        });

        const atomicOnly =
          new CognitiveRuntime(
            new CompositionHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              learnedContextFeatureApplicabilityModel:
                atomic,

              maxCycles:
                8,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        const composedRun =
          new CognitiveRuntime(
            new CompositionHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              composedContextFeatureApplicabilityModel:
                composed,

              maxCycles:
                8,

              now:
                makeClock(
                  24,
                ),
            },
          ).run();

        expect(
          atomicOnly.solved,
        ).toBe(true);

        expect(
          composedRun.solved,
        ).toBe(true);

        expect(
          atomicOnly.cycles,
        ).toBe(5);

        expect(
          composedRun.cycles,
        ).toBe(4);

        const firstSelection =
          composedRun
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
            "composed-learned",

          applicabilityEvidenceCount:
            2,
        });

        expect(
          firstSelection
            ?.composedContextProjection
            ?.components,
        ).toHaveLength(2);

        expect(
          firstSelection
            ?.composedContextProjection
            ?.projectionKey,
        ).toBeDefined();

        const serialized =
          JSON.stringify(
            firstSelection
              ?.composedContextProjection,
          );

        for (
          const sourceSymbol of [
            "BOOST",
            "CLIMB",
            "PULSE",
            "FILL",
            "ADVANCE",
            "charge",
            "height",
            "signal",
            "volume",
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
      "persists the learned composition while keeping episode bindings fresh",
      () => {
        const portfolio =
          activePortfolio();

        const atomic =
          new LearnedContextFeatureApplicabilityModel();

        const composed =
          new ComposedContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          atomic,
          composed,
        });

        const before =
          composed.getObservationCount();

        const first =
          new CognitiveRuntime(
            new CompositionHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              composedContextFeatureApplicabilityModel:
                composed,

              maxCycles:
                8,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new CompositionHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              composedContextFeatureApplicabilityModel:
                composed,

              maxCycles:
                8,

              now:
                makeClock(
                  24,
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
          first
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.composedContextProjection
            ?.featureId,
        ).toBe(
          second
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.composedContextProjection
            ?.featureId,
        );

        expect(
          composed
            .getObservationCount(),
        ).toBeGreaterThan(
          before,
        );
      },
    );
  },
);

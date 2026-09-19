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
  LearnedContextFeatureApplicabilityModel,
} from "./context-feature-learning";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  InducedContextApplicabilityModel,
} from "./principle-context-signature";

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
      "2026-09-19T17:00:00.000Z",
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
      "2026-09-19T18:00:00.000Z",
  };
}

function activePortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredEpisode({
      episodeId:
        "deferred-one",

      family:
        "gated-family",

      familyKind:
        "gated-sequence",
    }),
  );

  portfolio.learnFromEpisode(
    deferredEpisode({
      episodeId:
        "deferred-two",

      family:
        "mode-family",

      familyKind:
        "categorical-mode",
    }),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode({
      episodeId:
        "monotonic-one",

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
        "monotonic-two",

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

interface CalibrationConfig {
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

  repeatUseful:
    boolean;
}

class FeatureCalibrationWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Complete feature calibration.";

  private progress =
    0;

  private flag =
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
    const target =
      this.config
        .repeatUseful
        ? 2
        : 1;

    if (
      this.progress >=
        target
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
          !this.config
            .repeatUseful
        ) {
          this.flag =
            true;
        }
      } else if (
        this.config
          .repeatUseful &&
        this.progress <
          2
      ) {
        this.progress +=
          1;
      }
    }

    const target =
      this.config
        .repeatUseful
        ? 2
        : 1;

    if (
      action ===
        this.config
          .finishAction &&
      this.progress >=
        target
    ) {
      this.done =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Feature calibration action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.done;
  }
}

class FeatureHeldOutWorld
  implements CognitiveEnvironment
{
  readonly id =
    "feature-held-out";

  readonly goalDescription =
    "Open the feature-held-out gate.";

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
        "Held-out feature action executed.",
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

function calibrate(input: {
  portfolio:
    AbstractPrinciplePortfolio;

  exact:
    InducedContextApplicabilityModel;

  feature:
    LearnedContextFeatureApplicabilityModel;
}):
  string {
  const configs:
    CalibrationConfig[] = [
    {
      id:
        "positive-alpha",

      progressAction:
        "BOOST",

      finishAction:
        "RELEASE",

      progressKey:
        "charge",

      flagKey:
        "stable",

      repeatUseful:
        true,
    },

    {
      id:
        "positive-beta",

      progressAction:
        "CLIMB",

      finishAction:
        "ARRIVE",

      progressKey:
        "height",

      flagKey:
        "marker",

      repeatUseful:
        true,
    },

    {
      id:
        "negative-alpha",

      progressAction:
        "PULSE",

      finishAction:
        "COMMIT",

      progressKey:
        "signal",

      flagKey:
        "armed",

      repeatUseful:
        false,
    },

    {
      id:
        "negative-beta",

      progressAction:
        "FILL",

      finishAction:
        "SEAL",

      progressKey:
        "volume",

      flagKey:
        "latched",

      repeatUseful:
        false,
    },
  ];

  let firstPositiveSignature =
    "";

  configs.forEach(
    (
      config,
      index,
    ) => {
      const result =
        new CognitiveRuntime(
          new FeatureCalibrationWorld(
            config,
          ),
          {
            abstractPrinciplePortfolio:
              input.portfolio,

            inducedContextApplicabilityModel:
              input.exact,

            learnedContextFeatureApplicabilityModel:
              input.feature,

            maxCycles:
              8,

            now:
              makeClock(
                18 +
                index,
              ),
          },
        ).run();

      expect(
        result.solved,
      ).toBe(true);

      expect(
        result.cycles,
      ).toBe(3);

      const selection =
        result
          .abstractPrinciplePortfolio
          ?.selections[0];

      expect(
        selection
          ?.principleKind,
      ).toBe(
        "repeat-monotonic-progress-once",
      );

      if (
        index ===
        0
      ) {
        firstPositiveSignature =
          selection
            ?.inducedContextSignature
            ?.key ??
          "";
      }
    },
  );

  return firstPositiveSignature;
}

describe(
  "Mabojolu G runtime learned structural context features",
  () => {
    it(
      "learns predictive context dimensions and outperforms exact-signature applicability on a nuisance-shifted held-out task",
      () => {
        const portfolio =
          activePortfolio();

        const exact =
          new InducedContextApplicabilityModel();

        const feature =
          new LearnedContextFeatureApplicabilityModel();

        const calibrationSignature =
          calibrate({
            portfolio,
            exact,
            feature,
          });

        expect(
          exact.getEvidenceCount(),
        ).toBe(4);

        expect(
          feature
            .getObservationCount(
              "principle-repeat-monotonic-progress-once",
            ),
        ).toBe(4);

        expect(
          feature
            .rankFeatures(
              "principle-repeat-monotonic-progress-once",
            )[0]
            ?.feature,
        ).toBe(
          "lastChangeArity",
        );

        const exactOnly =
          new CognitiveRuntime(
            new FeatureHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
                exact,

              maxCycles:
                8,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        const learned =
          new CognitiveRuntime(
            new FeatureHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              learnedContextFeatureApplicabilityModel:
                feature,

              maxCycles:
                8,

              now:
                makeClock(
                  24,
                ),
            },
          ).run();

        expect(
          exactOnly.solved,
        ).toBe(true);

        expect(
          learned.solved,
        ).toBe(true);

        expect(
          exactOnly.cycles,
        ).toBe(5);

        expect(
          learned.cycles,
        ).toBe(4);

        const firstSelection =
          learned
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
            "feature-learned",

          applicabilityEvidenceCount:
            2,

          learnedContextProjection: {
            selectedFeatures: [
              "lastChangeArity",
            ],
          },
        });

        expect(
          firstSelection
            ?.inducedContextSignature
            ?.key,
        ).not.toBe(
          calibrationSignature,
        );

        expect(
          feature.project(
            "principle-repeat-monotonic-progress-once",
            {
              key:
                calibrationSignature,

              features:
                firstSelection
                  ?.inducedContextSignature
                  ?.features ??
                {
                  historyLength:
                    "0",

                  distinctActionsSeen:
                    "0",

                  lastChangeArity:
                    "none",

                  lastValueShapes: [],

                  candidateAttempts:
                    "0",

                  candidateNoEffectAttempts:
                    "0",

                  candidateEffectAttempts:
                    "0",

                  candidateMatchesLastAction:
                    false,

                  candidateMatchesLastProductiveAction:
                    false,

                  stepsSinceCandidateAttempt:
                    "never",
                },
            },
          )
            .selectedFeatures,
        ).toEqual([
          "lastChangeArity",
        ]);
      },
    );

    it(
      "persists learned feature relevance while keeping raw episode signatures local to each runtime",
      () => {
        const portfolio =
          activePortfolio();

        const exact =
          new InducedContextApplicabilityModel();

        const feature =
          new LearnedContextFeatureApplicabilityModel();

        calibrate({
          portfolio,
          exact,
          feature,
        });

        const before =
          feature.getObservationCount();

        const first =
          new CognitiveRuntime(
            new FeatureHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              learnedContextFeatureApplicabilityModel:
                feature,

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
            new FeatureHeldOutWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              learnedContextFeatureApplicabilityModel:
                feature,

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
            ?.learnedContextProjection
            ?.projectionKey,
        ).toBe(
          second
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.learnedContextProjection
            ?.projectionKey,
        );

        expect(
          feature
            .getObservationCount(),
        ).toBeGreaterThan(
          before,
        );
      },
    );
  },
);

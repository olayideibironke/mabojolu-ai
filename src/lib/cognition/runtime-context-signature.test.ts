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
  InducedContextApplicabilityModel,
} from "./principle-context-signature";

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

function monotonicEpisode(
  episodeId:
    string,

  family:
    string,

  familyKind:
    string,

  progressAction:
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
        action:
          progressAction,

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
        action:
          progressAction,

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
          "COMPLETE",

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
      "2026-09-19T18:00:00.000Z",
  };
}

function activePortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  portfolio.learnFromEpisode(
    deferredEpisode(
      "deferred-one",
      "gated-family",
      "gated-sequence",
    ),
  );

  portfolio.learnFromEpisode(
    deferredEpisode(
      "deferred-two",
      "mode-family",
      "categorical-mode",
    ),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode(
      "monotonic-one",
      "threshold-family",
      "threshold-accumulation",
      "STEP",
      "counter",
    ),
  );

  portfolio.learnFromEpisode(
    monotonicEpisode(
      "monotonic-two",
      "charge-family",
      "resource-charge",
      "CHARGE",
      "energy",
    ),
  );

  return portfolio;
}

class RenamedCalibrationWorld
  implements CognitiveEnvironment
{
  readonly id =
    "signature-calibration";

  readonly goalDescription =
    "Finish calibration.";

  private charge =
    10;

  private complete =
    false;

  getAvailableActions():
    readonly string[] {
    return this.charge >=
      12
      ? [
          "RELEASE",
        ]
      : [
          "BOOST",
          "RELEASE",
        ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      charge:
        this.charge,

      complete:
        this.complete,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      complete:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
        "BOOST" &&
      this.charge <
        12
    ) {
      this.charge +=
        1;
    }

    if (
      action ===
        "RELEASE" &&
      this.charge >=
        12
    ) {
      this.complete =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Calibration action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.complete;
  }
}

class HeldOutSignatureWorld
  implements CognitiveEnvironment
{
  readonly id =
    "signature-held-out";

  readonly goalDescription =
    "Open held-out gate.";

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
        "Held-out signature action executed.",
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
  "Mabojolu G runtime induced context applicability",
  () => {
    it(
      "transfers applicability across renamed actions and state variables using an induced structural signature",
      () => {
        const portfolio =
          activePortfolio();

        const learnedModel =
          new InducedContextApplicabilityModel();

        const calibration =
          new CognitiveRuntime(
            new RenamedCalibrationWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
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
          calibration.solved,
        ).toBe(true);

        expect(
          calibration.cycles,
        ).toBe(3);

        expect(
          learnedModel
            .getEvidenceCount(),
        ).toBe(1);

        const uncalibrated =
          new CognitiveRuntime(
            new HeldOutSignatureWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
                new InducedContextApplicabilityModel(),

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const learned =
          new CognitiveRuntime(
            new HeldOutSignatureWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
                learnedModel,

              maxCycles:
                8,

              now:
                makeClock(
                  21,
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
            "induced-learned",

          applicabilityEvidenceCount:
            1,
        });

        const signatureText =
          JSON.stringify(
            firstSelection
              ?.inducedContextSignature,
          );

        expect(
          signatureText,
        ).not.toContain(
          "BOOST",
        );

        expect(
          signatureText,
        ).not.toContain(
          "ADVANCE",
        );

        expect(
          signatureText,
        ).not.toContain(
          "charge",
        );

        expect(
          signatureText,
        ).not.toContain(
          "level",
        );
      },
    );

    it(
      "keeps learned signature evidence persistent while runtime encoders remain episode-local",
      () => {
        const portfolio =
          activePortfolio();

        const model =
          new InducedContextApplicabilityModel();

        new CognitiveRuntime(
          new RenamedCalibrationWorld(),
          {
            abstractPrinciplePortfolio:
              portfolio,

            inducedContextApplicabilityModel:
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
            new HeldOutSignatureWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
                model,

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new HeldOutSignatureWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              inducedContextApplicabilityModel:
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
          first
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.inducedContextSignature
            ?.key,
        ).toBe(
          second
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.inducedContextSignature
            ?.key,
        );

        expect(
          model.getEvidenceCount(),
        ).toBeGreaterThan(1);
      },
    );
  },
);

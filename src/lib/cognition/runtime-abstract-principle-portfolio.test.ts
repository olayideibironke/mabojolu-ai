import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AbstractPrinciplePortfolio,
} from "./abstract-principle-portfolio";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  SyntheticGatedSequenceEnvironment,
} from "./synthetic-challenge-environment";

import type {
  GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

import {
  ThresholdAccumulationEnvironment,
} from "./threshold-challenge-environment";

import type {
  ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

const GATED_TRAINING:
  GatedSequenceChallengeSpec = {
  id:
    "portfolio-training-gated",

  family:
    "gated-family",

  kind:
    "gated-sequence",

  partition:
    "practice",

  difficulty:
    0.5,

  context:
    "portfolio-gated",

  actionLabels: [
    "A",
    "B",
    "C",
  ],

  stateKeys: [
    "power",
    "latch",
    "open",
  ],

  actionRoleOrder: [
    0,
    2,
    1,
  ],

  actionPresentationOrder: [
    0,
    1,
    2,
  ],
};

const THRESHOLD_TRAINING:
  ThresholdAccumulationChallengeSpec = {
  id:
    "portfolio-training-threshold",

  family:
    "threshold-family",

  kind:
    "threshold-accumulation",

  partition:
    "practice",

  difficulty:
    0.7,

  context:
    "portfolio-threshold",

  actionLabels: [
    "FINISH",
    "INC",
  ],

  stateKeys: [
    "progress",
    "done",
  ],

  actionRoleOrder: [
    1,
    0,
  ],

  target:
    2,

  actionPresentationOrder: [
    0,
    1,
  ],
};

class ResourceChargeWorld
  implements CognitiveEnvironment
{
  readonly id =
    "portfolio-training-resource";

  readonly goalDescription =
    "Release stored energy.";

  private energy =
    0;

  private released =
    false;

  getAvailableActions():
    readonly string[] {
    if (
      this.energy <
        2
    ) {
      return [
        "CHARGE",
      ];
    }

    return [
      "RELEASE",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      energy:
        this.energy,

      released:
        this.released,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      released:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
        "CHARGE" &&
      this.energy <
        2
    ) {
      this.energy +=
        1;
    }

    if (
      action ===
        "RELEASE" &&
      this.energy >=
        2
    ) {
      this.released =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Resource action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.released;
  }
}

class CompetingFourthFamilyWorld
  implements CognitiveEnvironment
{
  readonly id =
    "portfolio-held-out-fourth-family";

  readonly goalDescription =
    "Open the calibrated gate.";

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
        "Fourth-family action executed.",
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

function trainPortfolio():
  AbstractPrinciplePortfolio {
  const portfolio =
    new AbstractPrinciplePortfolio();

  const gated =
    new CognitiveRuntime(
      new SyntheticGatedSequenceEnvironment(
        GATED_TRAINING,
      ),
      {
        abstractPrinciplePortfolio:
          portfolio,

        taskFamily:
          "gated-family",

        taskFamilyKind:
          "gated-sequence",

        maxCycles:
          8,

        now:
          makeClock(
            17,
          ),
      },
    ).run();

  expect(
    gated.solved,
  ).toBe(true);

  const threshold =
    new CognitiveRuntime(
      new ThresholdAccumulationEnvironment(
        THRESHOLD_TRAINING,
      ),
      {
        abstractPrinciplePortfolio:
          portfolio,

        taskFamily:
          "threshold-family",

        taskFamilyKind:
          "threshold-accumulation",

        maxCycles:
          8,

        now:
          makeClock(
            18,
          ),
      },
    ).run();

  expect(
    threshold.solved,
  ).toBe(true);

  const resource =
    new CognitiveRuntime(
      new ResourceChargeWorld(),
      {
        abstractPrinciplePortfolio:
          portfolio,

        taskFamily:
          "resource-family",

        taskFamilyKind:
          "resource-charge",

        maxCycles:
          8,

        now:
          makeClock(
            19,
          ),
      },
    ).run();

  expect(
    resource.solved,
  ).toBe(true);

  return portfolio;
}

describe(
  "Mabojolu G runtime competing abstraction selection",
  () => {
    it(
      "selects between two active abstractions and improves a fourth unfamiliar family",
      () => {
        const portfolio =
          trainPortfolio();

        const learnedPrinciples =
          portfolio.getPrinciples();

        expect(
          learnedPrinciples,
        ).toHaveLength(2);

        expect(
          learnedPrinciples
            .every(
              (principle) =>
                principle.status ===
                  "active",
            ),
        ).toBe(true);

        const baseline =
          new CognitiveRuntime(
            new CompetingFourthFamilyWorld(),
            {
              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        const broadOnly =
          new CognitiveRuntime(
            new CompetingFourthFamilyWorld(),
            {
              abstractPrincipleLibrary:
                portfolio.deferred,

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        const selected =
          new CognitiveRuntime(
            new CompetingFourthFamilyWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

              maxCycles:
                8,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        expect(
          baseline.solved,
        ).toBe(true);

        expect(
          broadOnly.solved,
        ).toBe(true);

        expect(
          selected.solved,
        ).toBe(true);

        expect(
          baseline.cycles,
        ).toBe(6);

        expect(
          broadOnly.cycles,
        ).toBe(6);

        expect(
          selected.cycles,
        ).toBe(4);

        expect(
          selected.cycles,
        ).toBeLessThan(
          broadOnly.cycles,
        );

        expect(
          selected
            .abstractPrinciplePortfolio
            ?.selections
            .map(
              (selection) =>
                selection.principleKind,
            ),
        ).toEqual([
          "repeat-monotonic-progress-once",
          "deferred-goal-retry-after-progress",
        ]);

        expect(
          selected
            .abstractPrinciplePortfolio
            ?.selections[0]
            ?.action,
        ).toBe(
          "ADVANCE",
        );

        expect(
          selected
            .abstractPrinciplePortfolio
            ?.selections[1]
            ?.action,
        ).toBe(
          "TRY-GOAL",
        );

        expect(
          selected.state
            .actions[2]
            ?.proposal
            .kind,
        ).toBe(
          "abstract-principle",
        );

        expect(
          selected.state
            .actions[3]
            ?.proposal
            .kind,
        ).toBe(
          "abstract-principle",
        );
      },
    );

    it(
      "creates a fresh contextual selector for each new runtime episode",
      () => {
        const portfolio =
          trainPortfolio();

        const first =
          new CognitiveRuntime(
            new CompetingFourthFamilyWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

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
            new CompetingFourthFamilyWorld(),
            {
              abstractPrinciplePortfolio:
                portfolio,

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
            ?.selections,
        ).toEqual(
          second
            .abstractPrinciplePortfolio
            ?.selections,
        );

        expect(
          portfolio.getPrinciples(),
        ).toHaveLength(2);
      },
    );
  },
);

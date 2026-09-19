import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CognitiveEnvironment,
  EnvironmentSnapshot,
} from "./environment";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

function makeClock():
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
          22,
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

function trainOneStepSkill(input: {
  library:
    AutonomousSkillLibrary;

  action:
    string;

  before:
    EnvironmentSnapshot;

  after:
    EnvironmentSnapshot;

  goalConditions:
    EnvironmentSnapshot;

  prefix:
    string;
}):
  void {
  for (
    let index = 0;
    index <
      2;
    index +=
      1
  ) {
    input.library
      .learnFromEpisode({
        episodeId:
          input.prefix +
          "-episode-" +
          index,

        environmentId:
          input.prefix +
          "-world-" +
          index,

        solved:
          true,

        goalConditions:
          input
            .goalConditions,

        transitions: [
          {
            action:
              input.action,

            before: {
              ...input.before,
            },

            after: {
              ...input.after,
            },

            changedKeys:
              Object.keys(
                input.after,
              ).filter(
                (key) =>
                  !Object.is(
                    input
                      .before[
                        key
                      ],
                    input
                      .after[
                        key
                      ],
                  ),
              ),

            accepted:
              true,
          },
        ],

        observedAt:
          index ===
            0
            ? "2026-09-19T20:00:00.000Z"
            : "2026-09-19T21:00:00.000Z",
      });
  }
}

class CompositionWorld
  implements CognitiveEnvironment
{
  readonly id =
    "composition-target";

  readonly goalDescription =
    "Complete the task.";

  private prepared =
    false;

  private complete =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "P",
      "Q",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      prepared:
        this.prepared,

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
      "P"
    ) {
      this.prepared =
        true;
    }

    if (
      action ===
        "Q" &&
      this.prepared
    ) {
      this.complete =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.complete;
  }
}

function trainedCompositionSkills():
  AutonomousSkillLibrary {
  const library =
    new AutonomousSkillLibrary();

  trainOneStepSkill({
    library,

    action:
      "P",

    before: {
      prepared:
        false,
    },

    after: {
      prepared:
        true,
    },

    goalConditions: {
      prepared:
        true,
    },

    prefix:
      "prepare",
  });

  trainOneStepSkill({
    library,

    action:
      "Q",

    before: {
      prepared:
        true,

      complete:
        false,
    },

    after: {
      prepared:
        true,

      complete:
        true,
    },

    goalConditions: {
      complete:
        true,
    },

    prefix:
      "complete",
  });

  return library;
}

function trainStructuralSkill():
  AutonomousSkillLibrary {
  const library =
    new AutonomousSkillLibrary();

  for (
    const [
      index,
      context,
    ] of [
      [
        0,
        "alpha",
      ],
      [
        1,
        "beta",
      ],
    ] as const
  ) {
    library.learnFromEpisode({
      episodeId:
        "vault-episode-" +
        index,

      environmentId:
        "vault-source-" +
        index,

      solved:
        true,

      goalConditions: {
        vaultOpen:
          true,
      },

      transitions: [
        {
          action:
            "A",

          before: {
            power:
              false,

            latch:
              false,

            vaultOpen:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              false,

            vaultOpen:
              false,

            context,
          },

          changedKeys: [
            "power",
          ],

          accepted:
            true,
        },

        {
          action:
            "C",

          before: {
            power:
              true,

            latch:
              false,

            vaultOpen:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              true,

            vaultOpen:
              false,

            context,
          },

          changedKeys: [
            "latch",
          ],

          accepted:
            true,
        },

        {
          action:
            "B",

          before: {
            power:
              true,

            latch:
              true,

            vaultOpen:
              false,

            context,
          },

          after: {
            power:
              true,

            latch:
              true,

            vaultOpen:
              true,

            context,
          },

          changedKeys: [
            "vaultOpen",
          ],

          accepted:
            true,
        },
      ],

      observedAt:
        index ===
          0
          ? "2026-09-19T20:00:00.000Z"
          : "2026-09-19T21:00:00.000Z",
    });
  }

  return library;
}

class RenamedSkillWorld
  implements CognitiveEnvironment
{
  readonly id =
    "renamed-skill-target";

  readonly goalDescription =
    "Open the relay gate.";

  private engineReady =
    false;

  private sealReleased =
    false;

  private gateOpen =
    false;

  getAvailableActions():
    readonly string[] {
    /*
     * Deliberately hostile order for ordinary exploration.
     * Structural skill transfer sorts probes and reasons from role evidence.
     */
    return [
      "Y",
      "Z",
      "X",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      engineReady:
        this.engineReady,

      sealReleased:
        this.sealReleased,

      gateOpen:
        this.gateOpen,

      context:
        "target",
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      gateOpen:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    if (
      action ===
      "X"
    ) {
      this.engineReady =
        true;
    }

    if (
      action ===
        "Z" &&
      this.engineReady
    ) {
      this.sealReleased =
        true;
    }

    if (
      action ===
        "Y" &&
      this.engineReady &&
      this.sealReleased
    ) {
      this.gateOpen =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.gateOpen;
  }
}

describe(
  "Mabojolu G runtime skill composition and structural skill transfer",
  () => {
    it(
      "composes separately learned skills to solve a goal never learned as one trajectory",
      () => {
        const result =
          new CognitiveRuntime(
            new CompositionWorld(),
            {
              skillLibrary:
                trainedCompositionSkills(),

              maxCycles:
                6,

              now:
                makeClock(),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(2);

        expect(
          result
            .skillComposition
            ?.actions
            .map(
              (action) =>
                action.action,
            ),
        ).toEqual([
          "P",
          "Q",
        ]);

        expect(
          result
            .skillComposition
            ?.skillIds,
        ).toHaveLength(2);

        expect(
          result.state
            .actions
            .every(
              (action) =>
                action
                  .proposal
                  .kind ===
                "skill-composition",
            ),
        ).toBe(true);

        expect(
          result.recalledSkill,
        ).toBeUndefined();
      },
    );

    it(
      "uses a learned skill structure under renamed actions and variables and improves over blind exploration",
      () => {
        const baseline =
          new CognitiveRuntime(
            new RenamedSkillWorld(),
            {
              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        const transferred =
          new CognitiveRuntime(
            new RenamedSkillWorld(),
            {
              skillLibrary:
                trainStructuralSkill(),

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          baseline.solved,
        ).toBe(true);

        expect(
          baseline.cycles,
        ).toBe(6);

        expect(
          transferred.solved,
        ).toBe(true);

        expect(
          transferred.cycles,
        ).toBe(4);

        expect(
          transferred.cycles,
        ).toBeLessThan(
          baseline.cycles,
        );

        expect(
          transferred.state
            .actions
            .every(
              (action) =>
                action
                  .proposal
                  .kind ===
                "structural-skill",
            ),
        ).toBe(true);

        expect(
          transferred
            .structuralSkillTransfer
            ?.mappedRoles,
        ).toEqual([
          {
            sourceStepIndex:
              0,

            targetAction:
              "X",

            targetEffectKey:
              "engineReady",
          },

          {
            sourceStepIndex:
              1,

            targetAction:
              "Z",

            targetEffectKey:
              "sealReleased",
          },

          {
            sourceStepIndex:
              2,

            targetAction:
              "Y",

            targetEffectKey:
              "gateOpen",
          },
        ]);

        expect(
          transferred
            .recalledSkill,
        ).toBeUndefined();
      },
    );
  },
);

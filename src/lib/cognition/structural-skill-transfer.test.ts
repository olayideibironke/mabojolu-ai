import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

import {
  StructuralSkillTransferEngine,
} from "./structural-skill-transfer";

function trainVaultSkill():
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
        "episode-" +
        index,

      environmentId:
        "source-world-" +
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

describe(
  "Mabojolu G structural transfer of learned skills",
  () => {
    it(
      "maps renamed target actions and renamed state variables into learned skill roles",
      () => {
        const engine =
          new StructuralSkillTransferEngine(
            trainVaultSkill(),
          );

        const session =
          engine.createSession({
            initialState: {
              engineReady:
                false,

              sealReleased:
                false,

              gateOpen:
                false,

              context:
                "new",
            },

            goalConditions: {
              gateOpen:
                true,
            },

            availableActions: [
              "X",
              "Y",
              "Z",
            ],
          });

        expect(
          session,
        ).toBeDefined();

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]),
        ).toMatchObject({
          action:
            "X",

          expectedRole:
            "setup",

          sourceStepIndex:
            0,
        });

        session?.observeTransition({
          action:
            "X",

          before: {
            engineReady:
              false,

            sealReleased:
              false,

            gateOpen:
              false,
          },

          after: {
            engineReady:
              true,

            sealReleased:
              false,

            gateOpen:
              false,
          },

          accepted:
            true,
        });

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]),
        ).toMatchObject({
          action:
            "Y",

          expectedRole:
            "setup",

          sourceStepIndex:
            1,
        });

        session?.observeTransition({
          action:
            "Y",

          before: {
            engineReady:
              true,

            sealReleased:
              false,

            gateOpen:
              false,
          },

          after: {
            engineReady:
              true,

            sealReleased:
              false,

            gateOpen:
              false,
          },

          accepted:
            true,
        });

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]),
        ).toMatchObject({
          action:
            "Z",

          expectedRole:
            "setup",

          sourceStepIndex:
            1,
        });

        session?.observeTransition({
          action:
            "Z",

          before: {
            engineReady:
              true,

            sealReleased:
              false,

            gateOpen:
              false,
          },

          after: {
            engineReady:
              true,

            sealReleased:
              true,

            gateOpen:
              false,
          },

          accepted:
            true,
        });

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]),
        ).toMatchObject({
          action:
            "Y",

          expectedRole:
            "goal",

          sourceStepIndex:
            2,
        });

        const final =
          session?.observeTransition({
            action:
              "Y",

            before: {
              engineReady:
                true,

              sealReleased:
                true,

              gateOpen:
                false,
            },

            after: {
              engineReady:
                true,

              sealReleased:
                true,

              gateOpen:
                true,
            },

            accepted:
              true,
          });

        expect(
          final,
        ).toMatchObject({
          advanced:
            true,

          completed:
            true,

          invalidated:
            false,
        });

        expect(
          session
            ?.getState()
            .mappedRoles,
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
      },
    );

    it(
      "treats a no-effect action as stage-local evidence instead of permanently rejecting it",
      () => {
        const session =
          new StructuralSkillTransferEngine(
            trainVaultSkill(),
          ).createSession({
            initialState: {
              first:
                false,

              second:
                false,

              done:
                false,
            },

            goalConditions: {
              done:
                true,
            },

            availableActions: [
              "X",
              "Y",
              "Z",
            ],
          });

        session?.recommend([
          "X",
          "Y",
          "Z",
        ]);

        session?.observeTransition({
          action:
            "X",

          before: {
            first:
              false,

            second:
              false,

            done:
              false,
          },

          after: {
            first:
              false,

            second:
              false,

            done:
              false,
          },

          accepted:
            true,
        });

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ])?.action,
        ).toBe(
          "Y",
        );

        session?.observeTransition({
          action:
            "Y",

          before: {
            first:
              false,

            second:
              false,

            done:
              false,
          },

          after: {
            first:
              true,

            second:
              false,

            done:
              false,
          },

          accepted:
            true,
        });

        /*
         * Stage advanced. X is allowed to be reconsidered because its earlier
         * no-effect result may have reflected a missing prerequisite.
         */
        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ])?.action,
        ).toBe(
          "X",
        );
      },
    );

    it(
      "refuses target worlds whose observable shape cannot support the learned skill",
      () => {
        const engine =
          new StructuralSkillTransferEngine(
            trainVaultSkill(),
          );

        expect(
          engine.createSession({
            initialState: {
              first:
                false,

              done:
                false,
            },

            goalConditions: {
              done:
                true,
            },

            availableActions: [
              "X",
              "Y",
              "Z",
            ],
          }),
        ).toBeUndefined();

        expect(
          engine.createSession({
            initialState: {
              first:
                false,

              second:
                false,

              done:
                false,
            },

            goalConditions: {
              done:
                true,
            },

            availableActions: [
              "W",
              "X",
              "Y",
              "Z",
            ],
          }),
        ).toBeUndefined();
      },
    );

    it(
      "invalidates the skill analogy when a mapped stage produces incompatible evidence",
      () => {
        const session =
          new StructuralSkillTransferEngine(
            trainVaultSkill(),
          ).createSession({
            initialState: {
              first:
                false,

              second:
                false,

              done:
                false,
            },

            goalConditions: {
              done:
                true,
            },

            availableActions: [
              "X",
              "Y",
              "Z",
            ],
          });

        session?.recommend([
          "X",
          "Y",
          "Z",
        ]);

        const update =
          session?.observeTransition({
            action:
              "X",

            before: {
              first:
                false,

              second:
                false,

              done:
                false,
            },

            after: {
              first:
                true,

              second:
                true,

              done:
                false,
            },

            accepted:
              true,
          });

        expect(
          update
            ?.invalidated,
        ).toBe(true);

        expect(
          session
            ?.getState()
            .active,
        ).toBe(false);
      },
    );
  },
);

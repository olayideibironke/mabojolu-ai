import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  EpisodeTransition,
} from "./memory";

import {
  StructuralTransferLibrary,
} from "./structural-transfer";

function sourceTransitions():
  EpisodeTransition[] {
  return [
    {
      action: "A",
      before: {
        power: false,
        latch: false,
        vaultOpen: false,
      },
      after: {
        power: true,
        latch: false,
        vaultOpen: false,
      },
      changedKeys: [
        "power",
      ],
      accepted: true,
    },
    {
      action: "B",
      before: {
        power: true,
        latch: false,
        vaultOpen: false,
      },
      after: {
        power: true,
        latch: false,
        vaultOpen: false,
      },
      changedKeys: [],
      accepted: true,
    },
    {
      action: "C",
      before: {
        power: true,
        latch: false,
        vaultOpen: false,
      },
      after: {
        power: true,
        latch: true,
        vaultOpen: false,
      },
      changedKeys: [
        "latch",
      ],
      accepted: true,
    },
    {
      action: "B",
      before: {
        power: true,
        latch: true,
        vaultOpen: false,
      },
      after: {
        power: true,
        latch: true,
        vaultOpen: true,
      },
      changedKeys: [
        "vaultOpen",
      ],
      accepted: true,
    },
  ];
}

function trainedLibrary():
  StructuralTransferLibrary {
  const library =
    new StructuralTransferLibrary();

  const template =
    library.learnFromEpisode({
      environmentId:
        "vault-world-source",
      solved: true,
      goalConditions: {
        vaultOpen: true,
      },
      availableActions: [
        "A",
        "B",
        "C",
      ],
      transitions:
        sourceTransitions(),
    });

  expect(
    template,
  ).toBeDefined();

  return library;
}

describe(
  "Mabojolu G structural transfer",
  () => {
    it(
      "extracts a symbol-free gated-goal structure from a solved source episode",
      () => {
        const library =
          trainedLibrary();

        const [
          template,
        ] =
          library.getTemplates();

        expect(
          template,
        ).toMatchObject({
          sourceEnvironmentId:
            "vault-world-source",
          prerequisiteCount:
            2,
          actionCount:
            3,
          confidence:
            0.65,
        });

        expect(
          Object.keys(
            template,
          ).sort(),
        ).toEqual([
          "actionCount",
          "confidence",
          "id",
          "prerequisiteCount",
          "sourceEnvironmentId",
        ]);
      },
    );

    it(
      "maps renamed target actions into structural roles from target evidence",
      () => {
        const library =
          trainedLibrary();

        const session =
          library.createSession({
            environmentId:
              "relay-world-target",
            initialState: {
              engineReady:
                false,
              sealReleased:
                false,
              gateOpen:
                false,
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
          session?.getState()
            .hypothesisCount,
        ).toBe(3);

        const firstProbe =
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]);

        expect(
          firstProbe,
        ).toMatchObject({
          action:
            "X",
          expectedRole:
            "probe",
        });

        expect(
          firstProbe
            ?.informationGain,
        ).toBeGreaterThan(0);

        session?.observeTransition({
          action: "X",
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
          session?.getState()
            .hypothesisCount,
        ).toBe(2);

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
            "probe",
        });

        session?.observeTransition({
          action: "Y",
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
        });

        session?.observeTransition({
          action: "Z",
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
        });
      },
    );

    it(
      "refuses structurally incompatible target worlds before transferring",
      () => {
        const library =
          trainedLibrary();

        expect(
          library.createSession({
            environmentId:
              "four-action-world",
            initialState: {
              first: false,
              second: false,
              complete: false,
            },
            goalConditions: {
              complete: true,
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
      "invalidates the analogy when the inferred goal role fails after all setup roles",
      () => {
        const library =
          trainedLibrary();

        const session =
          library.createSession({
            environmentId:
              "deceptive-target",
            initialState: {
              alpha: false,
              beta: false,
              complete: false,
            },
            goalConditions: {
              complete: true,
            },
            availableActions: [
              "X",
              "Y",
              "Z",
            ],
          });

        session?.observeTransition({
          action: "X",
          before: {
            alpha: false,
            beta: false,
            complete: false,
          },
          after: {
            alpha: true,
            beta: false,
            complete: false,
          },
          accepted: true,
        });

        session?.observeTransition({
          action: "Y",
          before: {
            alpha: true,
            beta: false,
            complete: false,
          },
          after: {
            alpha: true,
            beta: false,
            complete: false,
          },
          accepted: true,
        });

        session?.observeTransition({
          action: "Z",
          before: {
            alpha: true,
            beta: false,
            complete: false,
          },
          after: {
            alpha: true,
            beta: true,
            complete: false,
          },
          accepted: true,
        });

        const update =
          session?.observeTransition({
            action: "Y",
            before: {
              alpha: true,
              beta: true,
              complete: false,
            },
            after: {
              alpha: true,
              beta: true,
              complete: false,
            },
            accepted: true,
          });

        expect(
          update?.invalidated,
        ).toBe(true);

        expect(
          session?.getState()
            .active,
        ).toBe(false);

        expect(
          session?.recommend([
            "X",
            "Y",
            "Z",
          ]),
        ).toBeUndefined();
      },
    );
  },
);

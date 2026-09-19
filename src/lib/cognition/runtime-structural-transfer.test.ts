import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "./environment";

import {
  VaultWorld,
} from "./environments/vault-world";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  StructuralTransferLibrary,
} from "./structural-transfer";

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
          11,
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

class RenamedGateWorld
  implements CognitiveEnvironment
{
  readonly id =
    "relay-world-v0.1";

  readonly goalDescription =
    "Release the barrier.";

  private engineReady =
    false;

  private sealReleased =
    false;

  private gateOpen =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "X",
      "Y",
      "Z",
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
    action: string,
  ):
    EnvironmentActionResult {
    switch (
      action
    ) {
      case "X":
        this.engineReady =
          true;
        break;

      case "Y":
        if (
          this.engineReady &&
          this.sealReleased
        ) {
          this.gateOpen =
            true;
        }
        break;

      case "Z":
        this.sealReleased =
          true;
        break;

      default:
        return {
          accepted:
            false,

          summary:
            "Action rejected.",
        };
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

class DeceptiveGateWorld
  implements CognitiveEnvironment
{
  readonly id =
    "deceptive-gate-v0.1";

  readonly goalDescription =
    "Complete the target.";

  private alpha =
    false;

  private beta =
    false;

  private complete =
    false;

  getAvailableActions():
    readonly string[] {
    return [
      "X",
      "Y",
      "Z",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      alpha:
        this.alpha,

      beta:
        this.beta,

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
    action: string,
  ):
    EnvironmentActionResult {
    switch (
      action
    ) {
      case "X":
        if (
          this.beta
        ) {
          this.complete =
            true;
        } else {
          this.alpha =
            true;
        }
        break;

      case "Y":
        break;

      case "Z":
        this.beta =
          true;
        break;

      default:
        return {
          accepted:
            false,

          summary:
            "Action rejected.",
        };
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

function trainSource(
  library:
    StructuralTransferLibrary,
): void {
  const source =
    new CognitiveRuntime(
      new VaultWorld(),
      {
        structuralTransfer:
          library,

        maxCycles:
          8,

        now:
          makeClock(),
      },
    ).run();

  expect(
    source.solved,
  ).toBe(true);

  expect(
    library
      .getTemplates(),
  ).toHaveLength(1);
}

describe(
  "Mabojolu G runtime structural transfer",
  () => {
    it(
      "transfers relational structure across a new environment id, new state names, new goal description, and new action labels",
      () => {
        const library =
          new StructuralTransferLibrary();

        trainSource(
          library,
        );

        const target =
          new CognitiveRuntime(
            new RenamedGateWorld(),
            {
              structuralTransfer:
                library,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          target.solved,
        ).toBe(true);

        expect(
          target.cycles,
        ).toBe(4);

        expect(
          target.actionHistory,
        ).toEqual([
          "Execute action X and observe the environment.",
          "Execute action Y and observe the environment.",
          "Execute action Z and observe the environment.",
          "Execute action Y and observe the environment.",
        ]);

        expect(
          target.state
            .actions
            .map(
              (action) =>
                action.proposal
                  .kind,
            ),
        ).toEqual([
          "experiment",
          "experiment",
          "structural-transfer",
          "structural-transfer",
        ]);

        expect(
          target.recalledPlan,
        ).toBeUndefined();
      },
    );

    it(
      "abandons a false structural analogy and recovers through target-world exploration",
      () => {
        const library =
          new StructuralTransferLibrary();

        trainSource(
          library,
        );

        const target =
          new CognitiveRuntime(
            new DeceptiveGateWorld(),
            {
              structuralTransfer:
                library,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          target.solved,
        ).toBe(true);

        expect(
          target.cycles,
        ).toBe(5);

        expect(
          target.actionHistory,
        ).toEqual([
          "Execute action X and observe the environment.",
          "Execute action Y and observe the environment.",
          "Execute action Z and observe the environment.",
          "Execute action Y and observe the environment.",
          "Execute action X and observe the environment.",
        ]);

        expect(
          target.state
            .learnings
            .some(
              (learning) =>
                learning.kind ===
                  "correction" &&
                learning.statement.includes(
                  "cross-environment analogy was abandoned",
                ),
            ),
        ).toBe(true);

        expect(
          target.state
            .actions[3]
            ?.proposal
            .kind,
        ).toBe(
          "structural-transfer",
        );

        expect(
          target.state
            .actions[4]
            ?.proposal
            .kind,
        ).toBe(
          "experiment",
        );
      },
    );
  },
);

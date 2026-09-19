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
  InMemoryCognitiveMemory,
} from "./memory";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  VaultWorld,
  type VaultActionMapping,
  type VaultActionRole,
} from "./environments/vault-world";

function makeClock():
  () => string {
  let milliseconds = 0;

  return () => {
    const timestamp =
      new Date(
        Date.UTC(
          2026,
          8,
          19,
          4,
          0,
          0,
          milliseconds,
        ),
      ).toISOString();

    milliseconds += 1;

    return timestamp;
  };
}

function permutations<T>(
  values: T[],
): T[][] {
  if (
    values.length <= 1
  ) {
    return [
      values,
    ];
  }

  const result:
    T[][] = [];

  for (
    let index = 0;
    index <
    values.length;
    index += 1
  ) {
    const current =
      values[index];

    const remaining = [
      ...values.slice(
        0,
        index,
      ),
      ...values.slice(
        index + 1,
      ),
    ];

    for (
      const tail of
        permutations(
          remaining,
        )
    ) {
      result.push([
        current,
        ...tail,
      ]);
    }
  }

  return result;
}

describe(
  "Mabojolu G cognitive runtime",
  () => {
    it(
      "solves the default unknown vault by retrying a previously ineffective action after the world changes",
      () => {
        const runtime =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              maxCycles: 8,
              now:
                makeClock(),
            },
          );

        const result =
          runtime.run();

        expect(
          result.solved,
        ).toBe(true);

        expect(
          result.cycles,
        ).toBe(4);

        expect(
          result.actionHistory,
        ).toEqual([
          "Execute action A and observe the environment.",
          "Execute action B and observe the environment.",
          "Execute action C and observe the environment.",
          "Execute action B and observe the environment.",
        ]);

        expect(
          result.state
            .hypotheses
            .some(
              (hypothesis) =>
                hypothesis
                  .statement ===
                  "Action B may require a different environment state to produce an observable effect." &&
                hypothesis
                  .status ===
                  "supported",
            ),
        ).toBe(true);

        expect(
          result.state
            .learnings
            .some(
              (learning) =>
                learning
                  .statement ===
                  "Action B has state-dependent effects.",
            ),
        ).toBe(true);
      },
    );

    it(
      "solves every hidden assignment of power, latch, and open across actions A, B, and C",
      () => {
        const roles:
          VaultActionRole[] = [
          "power",
          "latch",
          "open",
        ];

        const mappings =
          permutations(
            roles,
          );

        expect(
          mappings,
        ).toHaveLength(6);

        for (
          const mappingValues
          of mappings
        ) {
          const mapping:
            VaultActionMapping = {
            A:
              mappingValues[0],

            B:
              mappingValues[1],

            C:
              mappingValues[2],
          };

          const result =
            new CognitiveRuntime(
              new VaultWorld(
                mapping,
              ),
              {
                maxCycles: 8,
                now:
                  makeClock(),
              },
            ).run();

          expect(
            result.solved,
          ).toBe(true);

          expect(
            result.cycles,
          ).toBeLessThanOrEqual(
            4,
          );
        }
      },
    );

    it(
      "does not fabricate success when an environment offers no path to its goal",
      () => {
        class ImpossibleWorld
          implements CognitiveEnvironment
        {
          readonly id =
            "impossible-world";

          readonly goalDescription =
            "Make solved become true.";

          getAvailableActions():
            readonly string[] {
            return [
              "X",
            ];
          }

          observe():
            EnvironmentSnapshot {
            return {
              solved:
                false,
            };
          }

          act() {
            return {
              accepted:
                true,

              summary:
                "Action X executed.",
            };
          }

          isGoalSatisfied():
            boolean {
            return false;
          }
        }

        const result =
          new CognitiveRuntime(
            new ImpossibleWorld(),
            {
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        expect(
          result.solved,
        ).toBe(false);

        expect(
          result.state
            .goals[0]
            .status,
        ).toBe(
          "active",
        );

        expect(
          result.state
            .hypotheses,
        ).toHaveLength(1);

        expect(
          result.state
            .learnings,
        ).toHaveLength(0);
      },
    );

    it(
      "produces reproducible cognition when environment and clock are identical",
      () => {
        const first =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              now:
                makeClock(),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              now:
                makeClock(),
            },
          ).run();

        expect(
          second,
        ).toEqual(
          first,
        );
      },
    );

    it(
      "uses prior successful experience to solve the same hidden world with less exploration",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        const first =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              memory,
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              memory,
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        expect(
          first.solved,
        ).toBe(true);

        expect(
          first.cycles,
        ).toBe(4);

        expect(
          second.solved,
        ).toBe(true);

        expect(
          second.cycles,
        ).toBe(3);

        expect(
          second
            .recalledPlan
            ?.actions,
        ).toEqual([
          "A",
          "C",
          "B",
        ]);

        expect(
          second.state
            .actions
            .every(
              (action) =>
                action.proposal
                  .kind ===
                "transfer",
            ),
        ).toBe(true);
      },
    );

    it(
      "detects bad transfer, corrects itself, and stores the revised experience",
      () => {
        const memory =
          new InMemoryCognitiveMemory();

        /*
         * Episode 1:
         *
         * A = power
         * C = latch
         * B = open
         *
         * Learned compact plan:
         * A -> C -> B
         */
        const original =
          new CognitiveRuntime(
            new VaultWorld(),
            {
              memory,
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        expect(
          original.solved,
        ).toBe(true);

        const changedMapping:
          VaultActionMapping = {
          A: "power",

          B: "latch",

          C: "open",
        };

        /*
         * Episode 2 receives the old plan A -> C -> B.
         *
         * C now fails when tried too early. Mabojolu must detect that
         * contradiction, continue experimentation, retry C after B changes the
         * world, and solve.
         */
        const changed =
          new CognitiveRuntime(
            new VaultWorld(
              changedMapping,
            ),
            {
              memory,
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        expect(
          changed
            .recalledPlan
            ?.actions,
        ).toEqual([
          "A",
          "C",
          "B",
        ]);

        expect(
          changed.solved,
        ).toBe(true);

        expect(
          changed.cycles,
        ).toBe(4);

        expect(
          changed.state
            .learnings
            .some(
              (learning) =>
                learning.kind ===
                  "correction" &&
                learning.statement.includes(
                  "Transferred action C produced no observable effect",
                ),
            ),
        ).toBe(true);

        /*
         * Episode 2's effective transitions are A -> B -> C.
         *
         * Because memory prefers the newest successful episode, Episode 3
         * should now use the corrected plan directly.
         */
        const corrected =
          new CognitiveRuntime(
            new VaultWorld(
              changedMapping,
            ),
            {
              memory,
              maxCycles: 8,
              now:
                makeClock(),
            },
          ).run();

        expect(
          corrected
            .recalledPlan
            ?.actions,
        ).toEqual([
          "A",
          "B",
          "C",
        ]);

        expect(
          corrected.solved,
        ).toBe(true);

        expect(
          corrected.cycles,
        ).toBe(3);
      },
    );
  },
);
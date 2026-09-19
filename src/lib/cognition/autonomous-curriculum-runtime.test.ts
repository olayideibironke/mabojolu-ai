import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousCurriculumPlanner,
  type CurriculumTask,
} from "./autonomous-curriculum";

import {
  CompetenceModel,
} from "./competence-model";

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

interface Mapping {
  A:
    "power" |
    "latch" |
    "open";

  B:
    "power" |
    "latch" |
    "open";

  C:
    "power" |
    "latch" |
    "open";
}

const TRAINING_MAPPING:
  Mapping = {
  A:
    "power",

  B:
    "open",

  C:
    "latch",
};

class CurriculumVaultWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Open the vault.";

  private power =
    false;

  private latch =
    false;

  private open =
    false;

  constructor(
    readonly id:
      string,

    private readonly context:
      string,
  ) {}

  getAvailableActions():
    readonly string[] {
    return [
      "A",
      "B",
      "C",
    ];
  }

  observe():
    EnvironmentSnapshot {
    return {
      power:
        this.power,

      latch:
        this.latch,

      vaultOpen:
        this.open,

      context:
        this.context,
    };
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      vaultOpen:
        true,
    };
  }

  act(
    action:
      string,
  ) {
    const role =
      TRAINING_MAPPING[
        action as
          keyof Mapping
      ];

    if (
      role ===
      "power"
    ) {
      this.power =
        true;
    } else if (
      role ===
        "latch" &&
      this.power
    ) {
      this.latch =
        true;
    } else if (
      role ===
        "open" &&
      this.power &&
      this.latch
    ) {
      this.open =
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
    return this.open;
  }
}

class CurriculumRenamedWorld
  implements CognitiveEnvironment
{
  readonly id =
    "advanced-renamed-world";

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
        "advanced",
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
  "Mabojolu G autonomous curriculum with real cognitive learning",
  () => {
    it(
      "selects prerequisite practice, unlocks a harder transfer challenge, and improves held-out performance",
      () => {
        const competence =
          new CompetenceModel();

        const curriculum =
          new AutonomousCurriculumPlanner(
            competence,
          );

        const skills =
          new AutonomousSkillLibrary();

        const tasks:
          CurriculumTask[] = [
          {
            id:
              "practice-alpha",

            family:
              "gated-sequence",

            difficulty:
              0.4,

            novelty:
              0.7,

            estimatedCost:
              1,
          },

          {
            id:
              "practice-beta",

            family:
              "gated-sequence",

            difficulty:
              0.4,

            novelty:
              0.8,

            estimatedCost:
              1,
          },

          {
            id:
              "advanced-renamed",

            family:
              "renamed-transfer",

            difficulty:
              0.8,

            novelty:
              1,

            estimatedCost:
              1,

            prerequisiteFamilies: [
              "gated-sequence",
            ],
          },
        ];

        const remaining =
          new Map(
            tasks.map(
              (task) => [
                task.id,
                task,
              ],
            ),
          );

        const first =
          curriculum.chooseNext(
            [
              ...remaining.values(),
            ],
          );

        expect(
          first
            ?.task
            .family,
        ).toBe(
          "gated-sequence",
        );

        expect(
          first
            ?.task
            .id,
        ).toBe(
          "practice-beta",
        );

        const firstRun =
          new CognitiveRuntime(
            new CurriculumVaultWorld(
              first.task.id,
              "beta",
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  20,
                ),
            },
          ).run();

        expect(
          firstRun.solved,
        ).toBe(true);

        curriculum.recordOutcome({
          taskId:
            first.task.id,

          family:
            first.task.family,

          difficulty:
            first.task
              .difficulty,

          success:
            firstRun.solved,

          cycles:
            firstRun.cycles,

          observedAt:
            "2026-09-19T20:30:00.000Z",
        });

        remaining.delete(
          first.task.id,
        );

        const second =
          curriculum.chooseNext(
            [
              ...remaining.values(),
            ],
          );

        expect(
          second
            ?.task
            .id,
        ).toBe(
          "practice-alpha",
        );

        const secondRun =
          new CognitiveRuntime(
            new CurriculumVaultWorld(
              second.task.id,
              "alpha",
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  21,
                ),
            },
          ).run();

        expect(
          secondRun.solved,
        ).toBe(true);

        curriculum.recordOutcome({
          taskId:
            second.task.id,

          family:
            second.task.family,

          difficulty:
            second.task
              .difficulty,

          success:
            secondRun.solved,

          cycles:
            secondRun.cycles,

          observedAt:
            "2026-09-19T21:30:00.000Z",
        });

        remaining.delete(
          second.task.id,
        );

        const third =
          curriculum.chooseNext(
            [
              ...remaining.values(),
            ],
          );

        expect(
          third
            ?.task
            .id,
        ).toBe(
          "advanced-renamed",
        );

        expect(
          competence
            .snapshot(
              "gated-sequence",
            )
            .mastery,
        ).toBeGreaterThanOrEqual(
          0.35,
        );

        const baseline =
          new CognitiveRuntime(
            new CurriculumRenamedWorld(),
            {
              maxCycles:
                8,

              now:
                makeClock(
                  22,
                ),
            },
          ).run();

        const learned =
          new CognitiveRuntime(
            new CurriculumRenamedWorld(),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(
                  23,
                ),
            },
          ).run();

        expect(
          baseline.solved,
        ).toBe(true);

        expect(
          learned.solved,
        ).toBe(true);

        expect(
          learned.cycles,
        ).toBeLessThan(
          baseline.cycles,
        );

        expect(
          baseline.cycles,
        ).toBe(6);

        expect(
          learned.cycles,
        ).toBe(4);

        expect(
          learned
            .structuralSkillTransfer
            ?.mappedRoles,
        ).toHaveLength(3);

        curriculum.recordOutcome({
          taskId:
            third.task.id,

          family:
            third.task.family,

          difficulty:
            third.task
              .difficulty,

          success:
            learned.solved,

          cycles:
            learned.cycles,

          observedAt:
            "2026-09-19T23:30:00.000Z",
        });

        expect(
          competence
            .snapshot(
              "renamed-transfer",
            )
            .successes,
        ).toBe(1);
      },
    );
  },
);

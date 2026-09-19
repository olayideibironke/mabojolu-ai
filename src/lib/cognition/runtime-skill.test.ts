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

type ActionRole =
  | "power"
  | "latch"
  | "open";

interface Mapping {
  A:
    ActionRole;

  B:
    ActionRole;

  C:
    ActionRole;
}

const DEFAULT_MAPPING:
  Mapping = {
  A:
    "power",

  B:
    "open",

  C:
    "latch",
};

const CHANGED_MAPPING:
  Mapping = {
  A:
    "power",

  B:
    "latch",

  C:
    "open",
};

class SkillVaultWorld
  implements CognitiveEnvironment
{
  readonly goalDescription =
    "Make the secure chamber accessible.";

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

    private readonly mapping:
      Mapping =
        DEFAULT_MAPPING,
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
      this.mapping[
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
          20,
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
  "Mabojolu G runtime autonomous skill formation",
  () => {
    it(
      "learns a reusable skill from repeated experience and solves a new environment faster",
      () => {
        const skills =
          new AutonomousSkillLibrary();

        const first =
          new CognitiveRuntime(
            new SkillVaultWorld(
              "training-world-alpha",
              "alpha",
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        const second =
          new CognitiveRuntime(
            new SkillVaultWorld(
              "training-world-beta",
              "beta",
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        const target =
          new CognitiveRuntime(
            new SkillVaultWorld(
              "unseen-world-gamma",
              "gamma",
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          first.solved,
        ).toBe(true);

        expect(
          second.solved,
        ).toBe(true);

        expect(
          first.cycles,
        ).toBe(4);

        expect(
          second.cycles,
        ).toBe(4);

        expect(
          target.solved,
        ).toBe(true);

        expect(
          target.cycles,
        ).toBe(3);

        expect(
          target
            .recalledSkill
            ?.actions,
        ).toEqual([
          "A",
          "C",
          "B",
        ]);

        expect(
          target.state
            .actions
            .every(
              (action) =>
                action
                  .proposal
                  .kind ===
                "skill",
            ),
        ).toBe(true);

        expect(
          target
            .recalledSkill
            ?.skill
            .sourceEnvironmentIds,
        ).toEqual([
          "training-world-alpha",
          "training-world-beta",
        ]);
      },
    );

    it(
      "abandons contradicted skills, recovers through exploration, and replaces repeatedly contradicted competence",
      () => {
        const skills =
          new AutonomousSkillLibrary();

        for (
          const [
            id,
            context,
          ] of [
            [
              "training-one",
              "alpha",
            ],
            [
              "training-two",
              "beta",
            ],
          ] as const
        ) {
          new CognitiveRuntime(
            new SkillVaultWorld(
              id,
              context,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();
        }

        const firstChanged =
          new CognitiveRuntime(
            new SkillVaultWorld(
              "changed-world-one",
              "delta",
              CHANGED_MAPPING,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          firstChanged.solved,
        ).toBe(true);

        expect(
          firstChanged.cycles,
        ).toBe(4);

        expect(
          firstChanged.state
            .learnings
            .some(
              (learning) =>
                learning.kind ===
                  "correction" &&
                learning.statement.includes(
                  "abandoned the skill",
                ),
            ),
        ).toBe(true);

        const secondChanged =
          new CognitiveRuntime(
            new SkillVaultWorld(
              "changed-world-two",
              "epsilon",
              CHANGED_MAPPING,
            ),
            {
              skillLibrary:
                skills,

              maxCycles:
                8,

              now:
                makeClock(),
            },
          ).run();

        expect(
          secondChanged.solved,
        ).toBe(true);

        const learned =
          skills.getSkills();

        const oldSkill =
          learned.find(
            (skill) =>
              skill.steps
                .map(
                  (step) =>
                    step.action,
                )
                .join(",") ===
              "A,C,B",
          );

        const revisedSkill =
          learned.find(
            (skill) =>
              skill.steps
                .map(
                  (step) =>
                    step.action,
                )
                .join(",") ===
              "A,B,C",
          );

        expect(
          oldSkill?.status,
        ).toBe(
          "retired",
        );

        expect(
          revisedSkill
            ?.status,
        ).toBe(
          "active",
        );

        expect(
          revisedSkill
            ?.supportCount,
        ).toBe(2);
      },
    );
  },
);

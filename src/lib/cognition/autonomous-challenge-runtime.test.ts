import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AutonomousChallengeGenerator,
  type GatedSequenceChallengeBlueprint,
} from "./autonomous-challenge-generator";

import {
  CompetenceModel,
} from "./competence-model";

import {
  CognitiveRuntime,
} from "./runtime";

import {
  AutonomousSkillLibrary,
} from "./skill-library";

import {
  SyntheticGatedSequenceEnvironment,
} from "./synthetic-challenge-environment";

import {
  EvaluationIsolationGuard,
  type GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

const BLUEPRINT:
  GatedSequenceChallengeBlueprint = {
  family:
    "generated-gated-sequence",

  kind:
    "gated-sequence",

  minDifficulty:
    0.3,

  maxDifficulty:
    0.75,

  estimatedCost:
    1,

  practiceActionLabels: [
    "A",
    "B",
    "C",
  ],

  practiceStateKeys: [
    "power",
    "latch",
    "vaultOpen",
  ],

  practiceActionRoleOrder: [
    0,
    2,
    1,
  ],
};

const HELD_OUT_EVALUATION:
  GatedSequenceChallengeSpec = {
  id:
    "evaluation-renamed-001",

  family:
    "generated-gated-sequence",

  kind:
    "gated-sequence",

  partition:
    "evaluation",

  difficulty:
    0.85,

  context:
    "held-out-evaluation-only",

  actionLabels: [
    "Y",
    "Z",
    "X",
  ],

  stateKeys: [
    "engineReady",
    "sealReleased",
    "gateOpen",
  ],

  actionRoleOrder: [
    2,
    1,
    0,
  ],
};

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
  "Mabojolu G autonomous challenge generation with isolated evaluation",
  () => {
    it(
      "generates its own practice, learns from it, and improves on a held-out renamed task",
      () => {
        const competence =
          new CompetenceModel();

        const isolation =
          new EvaluationIsolationGuard();

        const generator =
          new AutonomousChallengeGenerator(
            competence,
            isolation,
            [
              BLUEPRINT,
            ],
          );

        const skills =
          new AutonomousSkillLibrary();

        const first =
          generator.generateNextPractice();

        expect(
          first,
        ).toBeDefined();

        if (
          !first
        ) {
          return;
        }

        const firstRun =
          new CognitiveRuntime(
            new SyntheticGatedSequenceEnvironment(
              first.spec,
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

        generator.recordPracticeOutcome({
          challenge:
            first.spec,

          success:
            firstRun.solved,

          cycles:
            firstRun.cycles,

          observedAt:
            "2026-09-19T20:30:00.000Z",
        });

        const second =
          generator.generateNextPractice();

        expect(
          second,
        ).toBeDefined();

        if (
          !second
        ) {
          return;
        }

        expect(
          second
            .spec
            .difficulty,
        ).toBeGreaterThan(
          first
            .spec
            .difficulty,
        );

        const secondRun =
          new CognitiveRuntime(
            new SyntheticGatedSequenceEnvironment(
              second.spec,
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

        generator.recordPracticeOutcome({
          challenge:
            second.spec,

          success:
            secondRun.solved,

          cycles:
            secondRun.cycles,

          observedAt:
            "2026-09-19T21:30:00.000Z",
        });

        expect(
          isolation.getPracticeCount(),
        ).toBe(2);

        expect(
          competence
            .snapshot(
              BLUEPRINT.family,
            )
            .attempts,
        ).toBe(2);

        const activeSkills =
          skills
            .getSkills()
            .filter(
              (skill) =>
                skill.status ===
                  "active",
            );

        expect(
          activeSkills,
        ).toHaveLength(1);

        expect(
          () =>
            isolation.assertHeldOut(
              HELD_OUT_EVALUATION,
            ),
        ).not.toThrow();

        const baseline =
          new CognitiveRuntime(
            new SyntheticGatedSequenceEnvironment(
              HELD_OUT_EVALUATION,
            ),
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
            new SyntheticGatedSequenceEnvironment(
              HELD_OUT_EVALUATION,
            ),
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
          baseline.cycles,
        ).toBe(6);

        expect(
          learned.cycles,
        ).toBe(4);

        expect(
          learned.cycles,
        ).toBeLessThan(
          baseline.cycles,
        );

        expect(
          learned
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
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runProbabilisticRepairActivePrerequisiteBenchmark,
} from "./probabilistic-repair-active-prerequisite-benchmark";

describe(
  "probabilistic repair and active prerequisite benchmark",
  () => {
    it(
      "starts with unresolved joint uncertainty over repair structures and prerequisite thresholds",
      () => {
        const report =
          runProbabilisticRepairActivePrerequisiteBenchmark();

        expect(
          Object.keys(
            report
              .initialBelief
              .jointProbabilities,
          ),
        ).toHaveLength(
          6,
        );

        expect(
          report
            .initialBelief
            .sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          report
            .initialBelief
            .normalizedEntropy,
        ).toBeCloseTo(
          1,
        );
      },
    );

    it(
      "actively resolves the hidden joint hypothesis using only safe reversible experiments",
      () => {
        const report =
          runProbabilisticRepairActivePrerequisiteBenchmark();

        expect(
          report
            .experimentIds,
        ).toEqual(
          expect.arrayContaining([
            "probe-readiness-0.6",
            "probe-repair-y-only",
          ]),
        );

        expect(
          report
            .experimentIds,
        ).not.toContain(
          "unsafe-joint-probe",
        );

        expect(
          report
            .maximumExperimentRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );

        expect(
          report
            .totalExperimentCost,
        ).toBeLessThanOrEqual(
          0.08,
        );

        expect(
          report
            .finalBelief
            .sufficientlyCertain,
        ).toBe(
          true,
        );

        expect(
          report
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.999,
        );
      },
    );

    it(
      "still requires protected validation before installing the posterior-leading repair",
      () => {
        const report =
          runProbabilisticRepairActivePrerequisiteBenchmark();

        expect(
          report
            .finalBelief
            .topRepairCandidateId,
        ).toBe(
          "bad-linear-y+structure:interaction(y,z)",
        );

        expect(
          report
            .protectedRepairDecision,
        ).toMatchObject({
          decision:
            "repaired",

          synthesizedFragmentId:
            "bad-linear-y+structure:interaction(y,z)",

          topologyChanged:
            true,

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-structural-repair",
        });
      },
    );

    it(
      "uses the resolved prerequisite posterior to change the vector plan",
      () => {
        const report =
          runProbabilisticRepairActivePrerequisiteBenchmark();

        expect(
          report
            .finalBelief
            .topPrerequisiteHypothesisId,
        ).toContain(
          "readiness>=0.700000",
        );

        expect(
          report
            .initialActionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        expect(
          report
            .resolvedActionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);
      },
    );

    it(
      "retires the stale plan branch while preserving the terminal goal contract",
      () => {
        const report =
          runProbabilisticRepairActivePrerequisiteBenchmark();

        expect(
          report
            .planRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          reason:
            "prerequisites-changed-plan",
        });

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );

        const terminal =
          report
            .hierarchy
            .goals
            .find(
              (goal) =>
                goal.id ===
                "terminal-vector-goal",
            );

        expect(
          terminal
            ?.constraints,
        ).toEqual([
          "Use only safe reversible actions.",
          "Honor learned prerequisites.",
        ]);
      },
    );
  },
);

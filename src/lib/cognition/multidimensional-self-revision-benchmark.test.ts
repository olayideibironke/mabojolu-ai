import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runMultidimensionalSelfRevisionBenchmark,
} from "./multidimensional-self-revision-benchmark";

describe(
  "multidimensional self-revision benchmark",
  () => {
    it(
      "synthesizes its own replacement coefficient and validates it on protected evidence",
      () => {
        const report =
          runMultidimensionalSelfRevisionBenchmark();

        expect(
          report
            .synthesizedRepairCoefficient,
        ).toBeCloseTo(
          0.3,
        );

        expect(
          report
            .repairDecision,
        ).toMatchObject({
          decision:
            "repaired",

          damagedFragmentId:
            "bad-yz-fragment",

          synthesizedFragmentId:
            "bad-yz-fragment+synthesized-repair",

          revisedProtectedMeanSquaredError:
            0,

          reason:
            "protected-synthesized-repair",
        });

        expect(
          report
            .repairDecision
            .program
            .fragments[
              1
            ]!
            .terms[
              0
            ]!
            .coefficient,
        ).toBeCloseTo(
          0.3,
        );
      },
    );

    it(
      "keeps repair-fitting evidence separate from protected installation evidence",
      () => {
        const report =
          runMultidimensionalSelfRevisionBenchmark();

        expect(
          report
            .repairEvidenceIds,
        ).toHaveLength(
          2,
        );

        expect(
          report
            .protectedEvidenceIds,
        ).toHaveLength(
          5,
        );

        expect(
          report
            .repairEvidenceIds
            .some(
              (id) =>
                report
                  .protectedEvidenceIds
                  .includes(
                    id,
                  ),
            ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "uses a safe epistemic goal to collapse decision-relevant model uncertainty before progress goals become actionable",
      () => {
        const report =
          runMultidimensionalSelfRevisionBenchmark();

        expect(
          report
            .priorEpistemicSelection,
        ).toMatchObject({
          decision:
            "selected",

          subgoal: {
            experimentId:
              "probe-route",

            diagnosticDimension:
              "progress",
          },

          reason:
            "model-uncertainty-requires-information",
        });

        expect(
          report
            .posteriorModelBProbability,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          report
            .nextActionableBeforeEpistemicCompletion,
        ).toBe(
          "epistemic-subgoal-1",
        );

        expect(
          report
            .nextActionableAfterEpistemicCompletion,
        ).toBe(
          "vector-subgoal-1",
        );
      },
    );

    it(
      "creates a vector-state plan that satisfies progress and exposure simultaneously",
      () => {
        const report =
          runMultidimensionalSelfRevisionBenchmark();

        expect(
          report
            .vectorPlan,
        ).toMatchObject({
          decision:
            "planned",

          actionIds: [
            "01-a",
            "02-b",
          ],

          goalSuccessProbability:
            1,

          totalCost:
            0.2,

          maximumRisk:
            0.1,

          reason:
            "posterior-supported-vector-plan",
        });

        expect(
          report
            .vectorPlan
            .expectedFinalState
            .progress,
        ).toBeCloseTo(
          1,
        );

        expect(
          report
            .vectorPlan
            .expectedFinalState
            .exposure,
        ).toBeLessThanOrEqual(
          0.3,
        );

        expect(
          report
            .vectorPlan
            .subgoals[
              0
            ]!
            .targetState,
        ).toEqual(
          expect.objectContaining({
            progress:
              expect.any(
                Number,
              ),

            exposure:
              expect.any(
                Number,
              ),
          }),
        );
      },
    );

    it(
      "inherits terminal safety constraints across both epistemic and task-progress goals",
      () => {
        const report =
          runMultidimensionalSelfRevisionBenchmark();

        const epistemic =
          report
            .hierarchy
            .goals
            .find(
              (goal) =>
                goal.id ===
                "epistemic-subgoal-1",
            );

        const vector =
          report
            .hierarchy
            .goals
            .find(
              (goal) =>
                goal.id ===
                "vector-subgoal-1",
            );

        expect(
          epistemic
            ?.constraints,
        ).toEqual(
          expect.arrayContaining([
            "Use only safe reversible actions and experiments.",
            "Use only reversible information-gathering experiments within the approved risk ceiling.",
          ]),
        );

        expect(
          vector
            ?.constraints,
        ).toEqual(
          expect.arrayContaining([
            "Use only safe reversible actions and experiments.",
            "Preserve all multidimensional terminal constraints and hard safety limits.",
          ]),
        );
      },
    );
  },
);

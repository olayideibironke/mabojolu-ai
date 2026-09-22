import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runProbabilisticRevisionCompositionValidationBenchmark,
} from "./probabilistic-revision-composition-validation-benchmark";

describe(
  "probabilistic revision composition and active validation benchmark",
  () => {
    it(
      "finds a bounded composition when different historical revisions explain different causal regions",
      () => {
        const report =
          runProbabilisticRevisionCompositionValidationBenchmark();

        expect(
          report.proposal,
        ).toMatchObject({
          decision:
            "compose",

          sourceRevisionIds: [
            "rev-y",
            "rev-z",
          ],

          reason:
            "multiple-regions-require-composition",
        });

        expect(
          report
            .proposal
            .candidate
            ?.fragments,
        ).toHaveLength(
          2,
        );

        expect(
          report
            .proposal
            .candidateDiscoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "uses a two-step protected validation policy that lowers expected terminal explanation entropy",
      () => {
        const report =
          runProbabilisticRevisionCompositionValidationBenchmark();

        expect(
          report.oneStepPlan.decision,
        ).toBe(
          "plan",
        );

        expect(
          report.twoStepPlan.decision,
        ).toBe(
          "plan",
        );

        expect(
          report
            .twoStepPlan
            .expectedTerminalNormalizedEntropy,
        ).toBeLessThan(
          report
            .oneStepPlan
            .expectedTerminalNormalizedEntropy,
        );

        expect(
          report
            .twoStepPlan
            .branches
            .some(
              (branch) =>
                branch
                  .secondProbeId !==
                undefined,
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .twoStepPlan
            .maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );

    it(
      "concentrates protected explanation belief on the composition before independent protected installation",
      () => {
        const report =
          runProbabilisticRevisionCompositionValidationBenchmark();

        expect(
          report
            .finalCompositionBelief,
        ).toMatchObject({
          topExplanationId:
            "composite",

          sufficientlyCertain:
            true,
        });

        expect(
          report
            .finalCompositionBelief
            .confidence,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          report
            .protectedDecision,
        ).toMatchObject({
          decision:
            "installed",

          compositeProtectedMeanSquaredError:
            0,

          reason:
            "protected-composition-installed",
        });
      },
    );

    it(
      "appends the composite revision with the stricter compatible prerequisite and replaces the live goal branch",
      () => {
        const report =
          runProbabilisticRevisionCompositionValidationBenchmark();

        expect(
          report.installation,
        ).toMatchObject({
          decision:
            "installed",

          sourceRevisionIds: [
            "rev-y",
            "rev-z",
          ],

          lineage: {
            activeRevisionId:
              "rev-composite",
          },

          prerequisite: {
            threshold:
              0.7,
          },

          hypothesis: {
            id:
              "hypothesis:rev-composite",

            prerequisiteHypothesisId:
              "finish:readiness>=0.700",
          },
        });

        expect(
          report.oldActionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        expect(
          report
            .compositeActionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );
      },
    );

    it(
      "feeds the protected composite directly into receding-horizon control",
      () => {
        const report =
          runProbabilisticRevisionCompositionValidationBenchmark();

        expect(
          report
            .nextRecedingDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "prep-strong",

          reason:
            "direct-action-best",
        });

        expect(
          report
            .nextRecedingDecision
            .maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAutonomousExperimentSynthesisBenchmark,
} from "./autonomous-experiment-synthesis-benchmark";

describe(
  "autonomous experiment synthesis and epistemic planning benchmark",
  () => {
    it(
      "generates the active discovery catalog from the competing hypotheses rather than receiving named probes",
      () => {
        const report =
          runAutonomousExperimentSynthesisBenchmark();

        expect(
          report
            .repairExperimentIds,
        ).toEqual([
          "synth-repair:y",
          "synth-repair:y+z",
          "synth-repair:z",
        ]);

        expect(
          report
            .prerequisiteExperimentIds,
        ).toEqual([
          "synth-prerequisite:finish:progress:readiness:0.450000",
          "synth-prerequisite:finish:progress:readiness:0.625000",
        ]);

        expect(
          report
            .synthesizedExperimentIds,
        ).toHaveLength(
          5,
        );
      },
    );

    it(
      "gets lower expected terminal joint entropy from bounded two-step epistemic lookahead than one-step probing",
      () => {
        const report =
          runAutonomousExperimentSynthesisBenchmark();

        expect(
          report
            .oneStepEntropyPlan
            .decision,
        ).toBe(
          "plan",
        );

        expect(
          report
            .twoStepEntropyPlan
            .decision,
        ).toBe(
          "plan",
        );

        expect(
          report
            .twoStepEntropyPlan
            .expectedTerminalNormalizedEntropy,
        ).toBeLessThan(
          report
            .oneStepEntropyPlan
            .expectedTerminalNormalizedEntropy,
        );

        expect(
          report
            .twoStepEntropyPlan
            .branches
            .some(
              (branch) =>
                Boolean(
                  branch.secondExperimentId,
                ),
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .twoStepEntropyPlan
            .maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );

    it(
      "chooses a synthesized prerequisite probe first when action-plan uncertainty is the uncertainty that matters",
      () => {
        const report =
          runAutonomousExperimentSynthesisBenchmark();

        expect(
          report
            .initialDecisionAwareChoice,
        ).toMatchObject({
          decision:
            "experiment",

          reason:
            "safe-decision-relevant-experiment",
        });

        expect(
          report
            .executedDecisionExperimentId,
        ).toContain(
          "synth-prerequisite:",
        );

        expect(
          report
            .executedDecisionExperimentCost,
        ).toBeCloseTo(
          0.04,
        );
      },
    );

    it(
      "stops after one decision-relevant probe even though repair identity remains unresolved",
      () => {
        const report =
          runAutonomousExperimentSynthesisBenchmark();

        expect(
          report
            .beliefAfterDecisionProbe
            .sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          report
            .repairProbabilityAfterStop,
        ).toBeCloseTo(
          0.5,
        );

        expect(
          report
            .finalDecisionAwareChoice,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "plan-invariant-under-posterior",

          assessment: {
            decision:
              "stop",

            dominantPlanSignature:
              "prep-strong->finish",
          },
        });

        expect(
          report
            .finalDecisionAwareChoice
            .assessment
            .supportingProbability,
        ).toBeGreaterThan(
          0.95,
        );
      },
    );

    it(
      "distinguishes scientific identification from decision sufficiency",
      () => {
        const report =
          runAutonomousExperimentSynthesisBenchmark();

        expect(
          report
            .twoStepEntropyPlan
            .branches
            .some(
              (branch) =>
                Boolean(
                  branch.secondExperimentId,
                ),
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .finalDecisionAwareChoice
            .decision,
        ).toBe(
          "stop",
        );

        expect(
          report
            .repairProbabilityAfterStop,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .repairProbabilityAfterStop,
        ).toBeLessThan(
          1,
        );
      },
    );
  },
);

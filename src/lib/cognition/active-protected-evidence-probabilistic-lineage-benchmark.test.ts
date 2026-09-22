import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runActiveProtectedEvidenceProbabilisticLineageBenchmark,
} from "./active-protected-evidence-probabilistic-lineage-benchmark";

describe(
  "active protected evidence and probabilistic revision ancestry benchmark",
  () => {
    it(
      "starts from protected evidence that rejects the root but keeps the two interaction revisions unresolved",
      () => {
        const report =
          runActiveProtectedEvidenceProbabilisticLineageBenchmark();

        expect(
          report
            .acquisition
            .initialBelief
            .sufficientlyCertain,
        ).toBe(
          false,
        );

        expect(
          report
            .acquisition
            .initialBelief
            .probabilities[
              "rev-0"
            ],
        ).toBeLessThan(
          1e-10,
        );

        expect(
          report
            .acquisition
            .initialBelief
            .probabilities[
              "rev-1"
            ],
        ).toBeCloseTo(
          0.5,
          4,
        );

        expect(
          report
            .acquisition
            .initialBelief
            .probabilities[
              "rev-2"
            ],
        ).toBeCloseTo(
          0.5,
          4,
        );
      },
    );

    it(
      "actively fills both the missing intervention region and the adaptive protected sample budget",
      () => {
        const report =
          runActiveProtectedEvidenceProbabilisticLineageBenchmark();

        expect(
          report
            .acquisition
            .initialGap,
        ).toMatchObject({
          decision:
            "acquire",

          currentEvidenceCount:
            2,

          missingEvidenceCount:
            4,

          missingUniqueInterventionSignatures:
            1,
        });

        expect(
          report
            .acquisition
            .steps[
              0
            ]
            ?.probeId,
        ).toBe(
          "protected-probe:y+z",
        );

        expect(
          report
            .acquisition
            .acquiredEvidence,
        ).toHaveLength(
          4,
        );

        expect(
          report
            .acquisition
            .finalGap,
        ).toMatchObject({
          decision:
            "ready",

          currentEvidenceCount:
            6,
        });

        expect(
          report
            .acquisition
            .finalGap
            .currentUniqueInterventionSignatures
            .length,
        ).toBeGreaterThanOrEqual(
          3,
        );
      },
    );

    it(
      "concentrates probability on rev-1 without using posterior confidence as installation authority",
      () => {
        const report =
          runActiveProtectedEvidenceProbabilisticLineageBenchmark();

        expect(
          report
            .acquisition
            .finalBelief,
        ).toMatchObject({
          topRevisionId:
            "rev-1",

          sufficientlyCertain:
            true,
        });

        expect(
          report
            .acquisition
            .finalBelief
            .confidence,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          report
            .acquisition
            .finalBelief
            .probabilities[
              "rev-2"
            ],
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .acquisition
            .lineageAssessment,
        ).toMatchObject({
          decision:
            "rollback-parent",

          selectedRevisionId:
            "rev-1",

          reason:
            "direct-parent-materially-better",
        });
      },
    );

    it(
      "activates the protected-selected parent and replaces the materialized rev-2 goal branch",
      () => {
        const report =
          runActiveProtectedEvidenceProbabilisticLineageBenchmark();

        expect(
          report
            .initialActionIds,
        ).toEqual([
          "prep-ultra",
          "finish",
        ]);

        expect(
          report
            .activatedActionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);

        expect(
          report.activation,
        ).toMatchObject({
          decision:
            "activated",

          lineage: {
            activeRevisionId:
              "rev-1",
          },

          goalRevision: {
            decision:
              "revised",

            terminalGoalPreserved:
              true,

            replacementGoalIds: [
              "prerequisite-revised-3-1",
              "prerequisite-revised-3-2",
            ],
          },
        });

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-3-1",
        );
      },
    );

    it(
      "feeds the protected-selected probabilistic ancestor directly into receding-horizon control",
      () => {
        const report =
          runActiveProtectedEvidenceProbabilisticLineageBenchmark();

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

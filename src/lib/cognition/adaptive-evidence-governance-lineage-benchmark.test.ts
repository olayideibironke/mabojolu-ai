import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAdaptiveEvidenceGovernanceLineageBenchmark,
} from "./adaptive-evidence-governance-lineage-benchmark";

describe(
  "adaptive evidence governance and revision lineage benchmark",
  () => {
    it(
      "raises protected evidence and coverage requirements for the complex uncertain active revision",
      () => {
        const report =
          runAdaptiveEvidenceGovernanceLineageBenchmark();

        expect(
          report.simpleRequirement,
        ).toMatchObject({
          minimumProtectedEvidence:
            2,

          minimumUniqueInterventionSignatures:
            1,
        });

        expect(
          report.complexRequirement,
        ).toMatchObject({
          minimumProtectedEvidence:
            6,

          minimumUniqueInterventionSignatures:
            3,
        });

        expect(
          report
            .complexRequirement
            .minimumProtectedEvidence,
        ).toBeGreaterThan(
          report
            .simpleRequirement
            .minimumProtectedEvidence,
        );
      },
    );

    it(
      "distinguishes retain, direct-parent rollback, older-ancestor branch, and reopen-search from fresh protected reserves",
      () => {
        const report =
          runAdaptiveEvidenceGovernanceLineageBenchmark();

        expect(
          report.retainAssessment,
        ).toMatchObject({
          decision:
            "retain",

          selectedRevisionId:
            "rev-2",
        });

        expect(
          report.parentAssessment,
        ).toMatchObject({
          decision:
            "rollback-parent",

          selectedRevisionId:
            "rev-1",
        });

        expect(
          report.ancestorAssessment,
        ).toMatchObject({
          decision:
            "branch-ancestor",

          selectedRevisionId:
            "rev-0",
        });

        expect(
          report.reopenAssessment,
        ).toMatchObject({
          decision:
            "reopen-search",
        });
      },
    );

    it(
      "compares all retained generations on the same adequate protected reserve",
      () => {
        const report =
          runAdaptiveEvidenceGovernanceLineageBenchmark();

        expect(
          report
            .ancestorAssessment
            .scores
            .map(
              (score) =>
                score.revisionId,
            )
            .sort(),
        ).toEqual([
          "rev-0",
          "rev-1",
          "rev-2",
        ]);

        expect(
          report
            .ancestorAssessment
            .requirement
            .minimumProtectedEvidence,
        ).toBe(
          6,
        );

        expect(
          report
            .ancestorAssessment
            .selectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "activates an older ancestor and replaces the current materialized goal branch without changing the terminal contract",
      () => {
        const report =
          runAdaptiveEvidenceGovernanceLineageBenchmark();

        expect(
          report.ancestorActivation,
        ).toMatchObject({
          decision:
            "activated",

          reason:
            "lineage-revision-activated",

          lineage: {
            activeRevisionId:
              "rev-0",
          },

          activatedPlan: {
            actionIds: [
              "prep-light",
              "finish",
            ],
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
      "feeds the selected ancestor directly into receding-horizon control",
      () => {
        const report =
          runAdaptiveEvidenceGovernanceLineageBenchmark();

        expect(
          report
            .nextRecedingDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "prep-light",

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

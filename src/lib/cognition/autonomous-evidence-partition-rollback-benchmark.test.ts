import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAutonomousEvidencePartitionRollbackBenchmark,
} from "./autonomous-evidence-partition-rollback-benchmark";

describe(
  "autonomous evidence partitioning and rollback benchmark",
  () => {
    it(
      "autonomously separates installation fitting evidence from the protected reserve",
      () => {
        const report =
          runAutonomousEvidencePartitionRollbackBenchmark();

        expect(
          report
            .installationPartition
            .decision,
        ).toBe(
          "ready",
        );

        expect(
          report
            .installationPartition
            .repairFitEvidenceIds
            .some(
              (id) =>
                report
                  .installationPartition
                  .protectedEvidenceIds
                  .includes(id),
            ),
        ).toBe(
          false,
        );

        expect(
          report
            .installationPartition
            .reason,
        ).toBe(
          "outcome-blind-deterministic-partition",
        );
      },
    );

    it(
      "installs the interaction repair only after the autonomously protected installation reserve approves it",
      () => {
        const report =
          runAutonomousEvidencePartitionRollbackBenchmark();

        expect(
          report
            .installationCoevolution
            .repairDecision,
        ).toMatchObject({
          decision:
            "repaired",

          topologyChanged:
            true,

          synthesizedFragmentId:
            "bad-linear-y+structure:interaction(y,z)",

          revisedProtectedMeanSquaredError:
            0,
        });

        expect(
          report
            .installedActionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);
      },
    );

    it(
      "creates a fresh rollback reserve from a later independently partitioned evidence epoch",
      () => {
        const report =
          runAutonomousEvidencePartitionRollbackBenchmark();

        expect(
          report
            .freshPartition
            .decision,
        ).toBe(
          "ready",
        );

        expect(
          report
            .freshPartition
            .protectedEvidenceIds
            .every(
              (id) =>
                !report
                  .installationPartition
                  .protectedEvidenceIds
                  .includes(id),
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .rollbackAssessment,
        ).toMatchObject({
          decision:
            "rolled-back",

          archivedMeanSquaredError:
            0,

          reason:
            "archived-model-wins-fresh-protected",
        });

        expect(
          report
            .rollbackAssessment
            .installedMeanSquaredError,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "restores the archived hypothesis and rolls the goal branch back from strong preparation to light preparation",
      () => {
        const report =
          runAutonomousEvidencePartitionRollbackBenchmark();

        expect(
          report
            .rollbackExecution,
        ).toMatchObject({
          decision:
            "rolled-back",

          reason:
            "archived-model-restored",

          rollbackPlan: {
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
              "prerequisite-revised-2-1",
              "prerequisite-revised-2-2",
            ],
          },
        });

        expect(
          report
            .rollbackActionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-2-1",
        );
      },
    );

    it(
      "feeds the restored archived model directly back into receding-horizon control",
      () => {
        const report =
          runAutonomousEvidencePartitionRollbackBenchmark();

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

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runOnlineBeliefModelCoevolutionBenchmark,
} from "./online-belief-model-coevolution-benchmark";

describe(
  "online belief-model coevolution benchmark",
  () => {
    it(
      "requires repeated live mismatch before model revision begins",
      () => {
        const report =
          runOnlineBeliefModelCoevolutionBenchmark();

        expect(
          report
            .mismatchTriggered,
        ).toBe(
          true,
        );

        expect(
          report
            .mismatchCount,
        ).toBe(
          3,
        );

        expect(
          report
            .coevolution
            .mismatchStatus
            .consecutiveMismatchCount,
        ).toBe(
          3,
        );
      },
    );

    it(
      "keeps online repair-fitting evidence disjoint from the protected installation reserve",
      () => {
        const report =
          runOnlineBeliefModelCoevolutionBenchmark();

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

        expect(
          report
            .coevolution
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
      },
    );

    it(
      "updates the live hypothesis repair identity, prerequisite, and repaired task effect together",
      () => {
        const report =
          runOnlineBeliefModelCoevolutionBenchmark();

        expect(
          report
            .coevolution
            .revisedHypothesis,
        ).toMatchObject({
          id:
            "legacy-live+online-revision-1",

          repairCandidateId:
            "bad-linear-y+structure:interaction(y,z)",

          prerequisiteHypothesisId:
            "finish:readiness>=0.700",
        });

        expect(
          report
            .coevolution
            .revisedHypothesis
            ?.dimensionEffects
            .progress
            ?.finish,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          report
            .coevolution
            .catalogRevision
            ?.belief
            .topHypothesisId,
        ).toBe(
          "legacy-live+online-revision-1",
        );
      },
    );

    it(
      "replaces the old light-preparation plan and stale goal branch with the stronger prerequisite-aware branch",
      () => {
        const report =
          runOnlineBeliefModelCoevolutionBenchmark();

        expect(
          report
            .oldActionIds,
        ).toEqual([
          "prep-light",
          "finish",
        ]);

        expect(
          report
            .revisedActionIds,
        ).toEqual([
          "prep-strong",
          "finish",
        ]);

        expect(
          report
            .coevolution
            .goalRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          replacementGoalIds: [
            "prerequisite-revised-1-1",
            "prerequisite-revised-1-2",
          ],
        });

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );
      },
    );

    it(
      "feeds the revised live hypothesis straight back into receding-horizon control",
      () => {
        const report =
          runOnlineBeliefModelCoevolutionBenchmark();

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

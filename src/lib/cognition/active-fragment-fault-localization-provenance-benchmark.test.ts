import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runActiveFragmentFaultLocalizationProvenanceBenchmark,
} from "./active-fragment-fault-localization-provenance-benchmark";

describe(
  "active fragment fault localization and provenance benchmark",
  () => {
    it(
      "starts ambiguous and actively selects the safer informative z diagnostic",
      () => {
        const report =
          runActiveFragmentFaultLocalizationProvenanceBenchmark();

        expect(
          report
            .result
            .localization
            .initialBelief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          report
            .result
            .localization
            .steps[
              0
            ],
        ).toMatchObject({
          probeId:
            "fault-probe:z",

          observedEffect:
            0.2,
        });

        expect(
          report
            .result
            .localization
            .finalBelief,
        ).toMatchObject({
          topFragmentId:
            "rev-z:program-z-fragment",

          sufficientlyResolved:
            true,
        });
      },
    );

    it(
      "uses the active diagnostic as the second independent z blame episode before local repair",
      () => {
        const report =
          runActiveFragmentFaultLocalizationProvenanceBenchmark();

        expect(
          report
            .result
            .maintenance
            ?.reliability
            .quarantinedFragmentIds,
        ).toEqual([
          "rev-z:program-z-fragment",
        ]);

        expect(
          report
            .result
            .maintenance,
        ).toMatchObject({
          decision:
            "repaired",

          preservedFragmentIds: [
            "rev-y:program-y-fragment",
          ],

          replacementFragmentIds: {
            "rev-z:program-z-fragment":
              "repair-z-0.2",
          },

          reason:
            "selective-fragment-repair-installed",
        });
      },
    );

    it(
      "preserves y provenance while advancing only z through a protected repair generation",
      () => {
        const report =
          runActiveFragmentFaultLocalizationProvenanceBenchmark();

        const y =
          report
            .result
            .provenance
            .records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "rev-y:program-y-fragment",
            );

        const z =
          report
            .result
            .provenance
            .records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "rev-z:program-z-fragment",
            );

        expect(
          y,
        ).toMatchObject({
          originRevisionId:
            "rev-y",

          activeFragmentId:
            "rev-y:program-y-fragment",

          generation:
            1,

          status:
            "active",
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          originFragmentId:
            "program-z-fragment",

          activeFragmentId:
            "repair-z-0.2",

          currentRevisionId:
            "rev-composite-localized",

          generation:
            1,

          status:
            "active",
        });

        expect(
          z
            ?.history[
              1
            ],
        ).toMatchObject({
          kind:
            "repaired",

          protectedEvidenceIds: [
            "benchmark-fault-protected-half-joint",
            "benchmark-fault-protected-joint",
            "benchmark-fault-protected-y",
            "benchmark-fault-protected-z",
          ],
        });
      },
    );

    it(
      "replaces the stale finish branch with boost-finish while preserving the terminal contract",
      () => {
        const report =
          runActiveFragmentFaultLocalizationProvenanceBenchmark();

        expect(
          report.oldActionIds,
        ).toEqual([
          "finish",
        ]);

        expect(
          report.newActionIds,
        ).toEqual([
          "boost-finish",
        ]);

        expect(
          report
            .result
            .maintenance
            ?.goalRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          replacementGoalIds: [
            "prerequisite-revised-1-1",
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
      "feeds the actively localized maintained composite directly into receding-horizon control",
      () => {
        const report =
          runActiveFragmentFaultLocalizationProvenanceBenchmark();

        expect(
          report
            .nextRecedingDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "boost-finish",

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

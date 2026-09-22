import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runSelectiveCompositeFragmentMaintenanceBenchmark,
} from "./selective-composite-fragment-maintenance-benchmark";

describe(
  "selective composite fragment maintenance benchmark",
  () => {
    it(
      "isolates the degraded inherited z fragment while preserving support for y",
      () => {
        const report =
          runSelectiveCompositeFragmentMaintenanceBenchmark();

        expect(
          report
            .maintenance
            .reliability
            .quarantinedFragmentIds,
        ).toEqual([
          "rev-z:program-z-fragment",
        ]);

        expect(
          report
            .maintenance
            .preservedFragmentIds,
        ).toEqual([
          "rev-y:program-y-fragment",
        ]);
      },
    );

    it(
      "installs a protected local z repair without changing the healthy y fragment",
      () => {
        const report =
          runSelectiveCompositeFragmentMaintenanceBenchmark();

        expect(
          report
            .maintenance,
        ).toMatchObject({
          decision:
            "repaired",

          retiredFragmentIds: [
            "rev-z:program-z-fragment",
          ],

          replacementFragmentIds: {
            "rev-z:program-z-fragment":
              "repair-z-0.2",
          },

          reason:
            "selective-fragment-repair-installed",
        });

        expect(
          report
            .healthyFragmentAfter,
        ).toEqual(
          report
            .healthyFragmentBefore,
        );

        expect(
          report
            .maintenance
            .programRevision
            ?.revisedProtectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "projects the maintained composite back into the live hypothesis and changes the plan",
      () => {
        const report =
          runSelectiveCompositeFragmentMaintenanceBenchmark();

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
            .maintenance
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.5,

          "boost-finish":
            0.8,
        });
      },
    );

    it(
      "replaces only the stale live goal branch while preserving the terminal contract",
      () => {
        const report =
          runSelectiveCompositeFragmentMaintenanceBenchmark();

        expect(
          report
            .maintenance
            .goalRevision,
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
      "feeds the locally maintained composite directly into receding-horizon control",
      () => {
        const report =
          runSelectiveCompositeFragmentMaintenanceBenchmark();

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

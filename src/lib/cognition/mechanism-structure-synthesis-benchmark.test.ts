import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runMechanismStructureSynthesisBenchmark,
} from "./mechanism-structure-synthesis-benchmark";

describe(
  "mechanism structure synthesis and dual-control benchmark",
  () => {
    it(
      "discovers a missing pairwise interaction and promotes it on protected evidence",
      () => {
        const report =
          runMechanismStructureSynthesisBenchmark();

        expect(
          report
            .structuralChampion,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "linear-incumbent",

          reason:
            "validated-structural-challenger",
        });

        expect(
          report
            .structuralChampion
            .champion
            .terms,
        ).toHaveLength(
          1,
        );

        expect(
          report
            .structuralChampion
            .champion
            .terms[
              0
            ],
        ).toMatchObject({
          id:
            "interaction(x,y)",

          kind:
            "interaction",

          coefficient:
            0.6,
        });
      },
    );

    it(
      "keeps discovery and protected structural-validation evidence disjoint",
      () => {
        const report =
          runMechanismStructureSynthesisBenchmark();

        expect(
          report
            .discoveryObservationIds,
        ).toHaveLength(
          2,
        );

        expect(
          report
            .protectedObservationIds,
        ).toHaveLength(
          4,
        );

        expect(
          report
            .discoveryObservationIds
            .some(
              (id) =>
                report
                  .protectedObservationIds
                  .includes(
                    id,
                  ),
            ),
        ).toBe(
          false,
        );

        expect(
          report
            .structuralChallengerIds,
        ).toContain(
          "interaction(x,y)",
        );
      },
    );

    it(
      "chooses information gathering while causal uncertainty changes which goal action is justified",
      () => {
        const report =
          runMechanismStructureSynthesisBenchmark();

        expect(
          report
            .initialDualControl,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "probe-z",

          reason:
            "information-value-dominates",
        });

        expect(
          report
            .initialBestActionGoalSuccessProbability,
        ).toBeCloseTo(
          0.5,
        );

        expect(
          report
            .initialDualControl
            .experimentScore,
        ).toBeGreaterThan(
          report
            .initialDualControl
            .actionScore,
        );
      },
    );

    it(
      "switches to goal action after the experiment resolves decision-relevant uncertainty",
      () => {
        const report =
          runMechanismStructureSynthesisBenchmark();

        expect(
          report
            .postEvidenceDualControl,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "boost-x",

          reason:
            "goal-progress-dominates",
        });

        expect(
          report
            .postEvidenceActionGoalSuccessProbability,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          report
            .postEvidenceDualControl
            .actionScore,
        ).toBeGreaterThan(
          report
            .postEvidenceDualControl
            .experimentScore,
        );
      },
    );

    it(
      "pays a bounded information cost before acting instead of using unsafe zero-cost choices",
      () => {
        const report =
          runMechanismStructureSynthesisBenchmark();

        expect(
          report
            .informationExperimentCost,
        ).toBeCloseTo(
          0.05,
        );

        expect(
          report
            .selectedActionCost,
        ).toBeCloseTo(
          0.1,
        );

        expect(
          report
            .totalDualControlCost,
        ).toBeCloseTo(
          0.15,
        );

        expect(
          report
            .initialDualControl
            .selectedId,
        ).not.toBe(
          "unsafe-probe",
        );

        expect(
          report
            .postEvidenceDualControl
            .selectedId,
        ).not.toBe(
          "unsafe-boost",
        );
      },
    );
  },
);

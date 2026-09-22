import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runStructuralRepairPrerequisiteBenchmark,
} from "./structural-repair-prerequisite-planning-benchmark";

describe(
  "structural repair and prerequisite-aware planning benchmark",
  () => {
    it(
      "changes the causal repair topology from linear to interaction",
      () => {
        const report =
          runStructuralRepairPrerequisiteBenchmark();

        expect(
          report
            .structuralRepairDecision,
        ).toMatchObject({
          decision:
            "repaired",

          damagedFragmentId:
            "bad-linear-y",

          topologyChanged:
            true,

          reason:
            "protected-structural-repair",
        });

        expect(
          report
            .selectedRepairTermId,
        ).toBe(
          "interaction(y,z)",
        );

        expect(
          report
            .selectedRepairCoefficient,
        ).toBeCloseTo(
          0.5,
        );
      },
    );

    it(
      "keeps structural repair fitting evidence disjoint from protected installation evidence",
      () => {
        const report =
          runStructuralRepairPrerequisiteBenchmark();

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
      "learns that the finish action requires readiness and then revises the threshold upward when evidence changes",
      () => {
        const report =
          runStructuralRepairPrerequisiteBenchmark();

        expect(
          report
            .initialPrerequisiteThreshold,
        ).toBeCloseTo(
          0.35,
        );

        expect(
          report
            .revisedPrerequisiteThreshold,
        ).toBeCloseTo(
          0.7,
        );
      },
    );

    it(
      "replans from light preparation to strong preparation when the learned prerequisite changes",
      () => {
        const report =
          runStructuralRepairPrerequisiteBenchmark();

        expect(
          report
            .initialActionIds,
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
            .planRevision,
        ).toMatchObject({
          decision:
            "revised",

          terminalGoalPreserved:
            true,

          reason:
            "prerequisites-changed-plan",
        });
      },
    );

    it(
      "retires the stale vector-goal branch and makes the revised prerequisite branch actionable",
      () => {
        const report =
          runStructuralRepairPrerequisiteBenchmark();

        const oldFirst =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "prerequisite-vector-subgoal-1",
            );

        const oldSecond =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "prerequisite-vector-subgoal-2",
            );

        const revisedFirst =
          report
            .hierarchyAfterRevision
            .goals
            .find(
              (goal) =>
                goal.id ===
                "prerequisite-revised-1-1",
            );

        expect(
          oldFirst
            ?.status,
        ).toBe(
          "abandoned",
        );

        expect(
          oldSecond
            ?.status,
        ).toBe(
          "abandoned",
        );

        expect(
          revisedFirst
            ?.successCriteria,
        ).toEqual(
          expect.arrayContaining([
            "readiness >= 0.700 before finish",
          ]),
        );

        expect(
          report
            .nextActionableGoalId,
        ).toBe(
          "prerequisite-revised-1-1",
        );
      },
    );
  },
);

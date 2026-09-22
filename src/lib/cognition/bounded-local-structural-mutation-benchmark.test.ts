import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runBoundedLocalStructuralMutationBenchmark,
} from "./bounded-local-structural-mutation-benchmark";

describe(
  "bounded local structural mutation benchmark",
  () => {
    it(
      "starts with unresolved parameter-versus-structure uncertainty",
      () => {
        const report =
          runBoundedLocalStructuralMutationBenchmark();

        expect(
          report
            .initialBelief
            .sufficientlyResolved,
        ).toBe(
          false,
        );

        expect(
          report
            .candidates
            .some(
              (candidate) =>
                candidate.kind ===
                  "linear" &&
                candidate
                  .topologyChanged ===
                  false &&
                Math.abs(
                  candidate.coefficient -
                  0.9,
                ) <
                  1e-9,
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .candidates
            .some(
              (candidate) =>
                candidate.kind ===
                  "saturating" &&
                candidate
                  .topologyChanged ===
                  true &&
                Math.abs(
                  candidate.coefficient -
                  0.9,
                ) <
                  1e-9,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "actively chooses the discriminating full-y probe and resolves saturation",
      () => {
        const report =
          runBoundedLocalStructuralMutationBenchmark();

        expect(
          report
            .probeChoice,
        ).toMatchObject({
          decision:
            "probe",

          probe: {
            id:
              "structure-probe:y=1.00",
          },

          reason:
            "safe-structural-information-probe",
        });

        expect(
          report
            .diagnosticObservation
            .measuredEffect,
        ).toBeCloseTo(
          0.6,
        );

        expect(
          report
            .resolvedBelief,
        ).toMatchObject({
          topKind:
            "saturating",

          topologyChanged:
            true,

          sufficientlyResolved:
            true,
        });

        expect(
          report
            .resolvedBelief
            .topCoefficient,
        ).toBeCloseTo(
          0.9,
        );
      },
    );

    it(
      "requires the topology mutation to survive a fresh adaptive protected reserve",
      () => {
        const report =
          runBoundedLocalStructuralMutationBenchmark();

        expect(
          report
            .protectedDecision,
        ).toMatchObject({
          decision:
            "installed",

          requirement: {
            minimumProtectedEvidence:
              4,
          },

          reason:
            "protected-local-repair-selected",
        });

        expect(
          report
            .protectedDecision
            .candidateProtectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "changes only y provenance while preserving the healthy z fragment",
      () => {
        const report =
          runBoundedLocalStructuralMutationBenchmark();

        const y =
          report
            .installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "rev-y:program-y-fragment",
            );

        const z =
          report
            .installation
            .provenance
            ?.records
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
            "rev-y:program-y-fragment:mutation:saturating:y:0.900",

          generation:
            1,
        });

        expect(
          z,
        ).toMatchObject({
          originRevisionId:
            "rev-z",

          activeFragmentId:
            "rev-z:program-z-fragment",

          generation:
            1,
        });
      },
    );

    it(
      "switches the live branch from boost-finish to finish and feeds the mutation into receding control",
      () => {
        const report =
          runBoundedLocalStructuralMutationBenchmark();

        expect(
          report.oldActionIds,
        ).toEqual([
          "boost-finish",
        ]);

        expect(
          report.newActionIds,
        ).toEqual([
          "finish",
        ]);

        expect(
          report
            .installation
            .revisedHypothesis
            ?.dimensionEffects
            .progress,
        ).toMatchObject({
          finish:
            0.45,

          "boost-finish":
            0.6,
        });

        expect(
          report
            .installation
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
            .nextRecedingDecision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "finish",

          reason:
            "direct-action-best",
        });
      },
    );
  },
);

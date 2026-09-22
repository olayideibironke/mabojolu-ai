import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runAutomaticBoundedStructuralResynthesisBenchmark,
} from "./automatic-bounded-structural-resynthesis-benchmark";

describe(
  "automatic bounded structural resynthesis benchmark",
  () => {
    it(
      "detects stale-family collapse and automatically reopens bounded structural synthesis",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

        expect(
          report.collapse,
        ).toMatchObject({
          decision:
            "reopen-search",

          reason:
            "all-retained-structural-candidates-inadequate",
        });

        expect(
          report.recovery,
        ).toMatchObject({
          decision:
            "resolved",

          resynthesis: {
            decision:
              "resynthesized",

            reason:
              "bounded-structural-family-resynthesized",
          },

          reason:
            "resynthesized-family-resolved",
        });
      },
    );

    it(
      "targets y and z while preserving the healthy q fragment across the fresh family",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

        expect(
          report
            .recovery
            .resynthesis
            .targets
            .map(
              (target) =>
                target
                  .logicalFragmentId,
            )
            .sort(),
        ).toEqual([
          "rev-y:program-y-fragment",
          "rev-z:program-z-fragment",
        ]);

        expect(
          report
            .recovery
            .resynthesis
            .familyRevision,
        ).toMatchObject({
          parentFamilyId:
            "v1.35-stale-family",

          generation:
            1,

          preservedFragmentIds: [
            "rev-q:program-q-fragment",
          ],

          reason:
            "collapsed-family-bounded-resynthesis",
        });

        expect(
          report
            .recovery
            .resynthesis
            .candidates
            .every(
              (candidate) =>
                candidate
                  .program
                  .fragments
                  .some(
                    (fragment) =>
                      fragment.id ===
                      "rev-q:program-q-fragment" &&
                      fragment
                        .terms[
                          0
                        ]
                        ?.kind ===
                      "linear" &&
                      fragment
                        .terms[
                          0
                        ]
                        ?.coefficient ===
                      0.2,
                  ),
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "discovers the missing saturating-y plus interaction-z-w structure and restarts receding diagnosis",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

        const selectedId =
          report
            .recovery
            .diagnosis
            ?.selectedCandidateId;

        const selected =
          report
            .recovery
            .resynthesis
            .candidates
            .find(
              (candidate) =>
                candidate.id ===
                selectedId,
            );

        expect(
          selected,
        ).toBeDefined();

        expect(
          selected
            ?.program
            .fragments
            .some(
              (fragment) =>
                fragment
                  .terms
                  .some(
                    (term) =>
                      term.kind ===
                        "saturating" &&
                      term.variables
                        .includes(
                          "y",
                        ),
                  ),
            ),
        ).toBe(
          true,
        );

        expect(
          selected
            ?.program
            .fragments
            .some(
              (fragment) =>
                fragment
                  .terms
                  .some(
                    (term) =>
                      term.kind ===
                        "interaction" &&
                      term.variables
                        .includes(
                          "z",
                        ) &&
                      term.variables
                        .includes(
                          "w",
                        ),
                  ),
            ),
        ).toBe(
          true,
        );

        expect(
          report
            .recovery
            .diagnosis
            ?.acquiredObservations
            .length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .recovery
            .diagnosis
            ?.executedProbeIds
            .every(
              (id) =>
                id.startsWith(
                  "resynthesis-probe:",
                ),
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "keeps collapse evidence and restarted diagnostic evidence outside the fresh protected reserve",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

        const synthesisIds =
          new Set(
            report
              .recovery
              .resynthesis
              .sourceEvidence
              .map(
                (item) =>
                  item
                    .experiment
                    .id,
              ),
          );

        const diagnosticIds =
          new Set(
            report
              .recovery
              .diagnosis
              ?.acquiredObservations
              .map(
                (item) =>
                  item
                    .experiment
                    .id,
              ) ??
            [],
          );

        expect(
          report
            .protectedValidation
            .allProtectedEvidence
            .some(
              (item) =>
                synthesisIds.has(
                  item
                    .experiment
                    .id,
                ) ||
                diagnosticIds.has(
                  item
                    .experiment
                    .id,
                ),
            ),
        ).toBe(
          false,
        );

        expect(
          report
            .protectedValidation,
        ).toMatchObject({
          decision:
            "validated",

          protectedDecision: {
            decision:
              "installed",

            reason:
              "protected-local-repair-selected",
          },

          reason:
            "protected-structural-revision-validated",
        });
      },
    );

    it(
      "advances only y and z provenance while preserving healthy q after protected installation",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

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

        const q =
          report
            .installation
            .provenance
            ?.records
            .find(
              (record) =>
                record
                  .logicalFragmentId ===
                "rev-q:program-q-fragment",
            );

        expect(
          y
            ?.activeFragmentId,
        ).not.toBe(
          "rev-y:program-y-fragment",
        );

        expect(
          z
            ?.activeFragmentId,
        ).not.toBe(
          "rev-z:program-z-fragment",
        );

        expect(
          q,
        ).toMatchObject({
          originRevisionId:
            "rev-q",

          activeFragmentId:
            "rev-q:program-q-fragment",

          generation:
            1,
        });
      },
    );

    it(
      "feeds the protected re-synthesized structure into live planning and receding control",
      () => {
        const report =
          runAutomaticBoundedStructuralResynthesisBenchmark();

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

        const progressEffects =
          report
            .installation
            .revisedHypothesis
            ?.dimensionEffects
            .progress;

        expect(
          progressEffects,
        ).toBeDefined();

        expect(
          progressEffects
            ?.finish,
        ).toBeCloseTo(
          0.9,
        );

        expect(
          progressEffects?.[
            "boost-finish"
          ],
        ).toBeCloseTo(
          1.05,
        );

        expect(
          report
            .installation
            .goalRevision,
        ).toMatchObject({
          terminalGoalPreserved:
            true,
        });

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
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  pruneContradictedStructuralCandidates,
  restorePrunedStructuralCandidate,
  type AdaptivePrunedStructuralBelief,
  type AdaptiveStructuralCandidateSet,
} from "./adaptive-joint-candidate-pruning";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

const STATE:
  AdaptiveStructuralCandidateSet = {
  activeCandidateIds: [
    "a",
    "b",
    "c",
    "d",
  ],

  prunedCandidateIds:
    [],

  auditHistory:
    [],
};

const BELIEF:
  AdaptivePrunedStructuralBelief = {
  probabilities: {
    a:
      0.97,

    b:
      0.02,

    c:
      0.009,

    d:
      0.001,
  },

  topCandidateId:
    "a",

  confidence:
    0.97,

  margin:
    0.95,

  normalizedEntropy:
    0.13,

  activeCandidateCount:
    4,
};

function evidence(
  count: number,
): StructuralMechanismObservation[] {
  return Array.from(
    {
      length:
        count,
    },
    (
      _,
      index,
    ) => ({
      experiment: {
        id:
          `evidence-${index + 1}`,

        interventions: {
          x:
            (
              index +
              1
            ) /
            10,
        },

        risk:
          0.05,

        cost:
          0.02,

        reversible:
          true,
      },

      measuredEffect:
        0.1 *
        (
          index +
          1
        ),
    }),
  );
}

describe(
  "adaptive structural candidate pruning",
  () => {
    it(
      "does not prune before the minimum evidence threshold",
      () => {
        const result =
          pruneContradictedStructuralCandidates(
            STATE,
            BELIEF,
            evidence(
              1,
            ),
            {
              minimumEvidenceBeforePrune:
                2,
            },
          );

        expect(
          result
            .activeCandidateIds,
        ).toEqual([
          "a",
          "b",
          "c",
          "d",
        ]);

        expect(
          result
            .auditHistory,
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      "prunes only strongly contradicted non-top candidates",
      () => {
        const result =
          pruneContradictedStructuralCandidates(
            STATE,
            BELIEF,
            evidence(
              2,
            ),
            {
              minimumEvidenceBeforePrune:
                2,

              maximumProbabilityForPrune:
                0.01,

              maximumRelativeProbabilityForPrune:
                0.02,
            },
          );

        expect(
          result
            .activeCandidateIds,
        ).toEqual([
          "a",
          "b",
        ]);

        expect(
          result
            .prunedCandidateIds,
        ).toEqual([
          "c",
          "d",
        ]);

        expect(
          result
            .auditHistory
            .map(
              (event) =>
                event.action,
            ),
        ).toEqual([
          "pruned",
          "pruned",
        ]);

        expect(
          result
            .auditHistory
            .every(
              (event) =>
                event.reversible &&
                event.evidenceIds.length ===
                  2,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "never prunes below the configured minimum retained set",
      () => {
        const result =
          pruneContradictedStructuralCandidates(
            STATE,
            BELIEF,
            evidence(
              2,
            ),
            {
              minimumEvidenceBeforePrune:
                2,

              maximumProbabilityForPrune:
                0.03,

              maximumRelativeProbabilityForPrune:
                0.05,

              minimumRetainedCandidates:
                3,
            },
          );

        expect(
          result
            .activeCandidateIds,
        ).toHaveLength(
          3,
        );

        expect(
          result
            .prunedCandidateIds,
        ).toHaveLength(
          1,
        );

        expect(
          result
            .activeCandidateIds,
        ).toContain(
          "a",
        );
      },
    );

    it(
      "restores a pruned candidate without deleting its pruning audit history",
      () => {
        const pruned =
          pruneContradictedStructuralCandidates(
            STATE,
            BELIEF,
            evidence(
              2,
            ),
            {
              maximumProbabilityForPrune:
                0.01,

              maximumRelativeProbabilityForPrune:
                0.02,
            },
          );

        const restored =
          restorePrunedStructuralCandidate(
            pruned,
            "c",
            0.05,
          );

        expect(
          restored
            .activeCandidateIds,
        ).toContain(
          "c",
        );

        expect(
          restored
            .prunedCandidateIds,
        ).not.toContain(
          "c",
        );

        expect(
          restored
            .auditHistory
            .filter(
              (event) =>
                event.candidateId ===
                "c",
            )
            .map(
              (event) =>
                event.action,
            ),
        ).toEqual([
          "pruned",
          "restored",
        ]);

        expect(
          restored
            .auditHistory
            .at(
              -1,
            ),
        ).toMatchObject({
          action:
            "restored",

          candidateId:
            "c",

          probabilityAtAction:
            0.05,

          reversible:
            true,

          reason:
            "manual-audit-restoration",
        });
      },
    );

    it(
      "rejects an attempt to restore a candidate that was never pruned",
      () => {
        expect(
          () =>
            restorePrunedStructuralCandidate(
              STATE,
              "a",
            ),
        ).toThrow(
          "Cannot restore unpruned structural candidate a.",
        );
      },
    );
  },
);

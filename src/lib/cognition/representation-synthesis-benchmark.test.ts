import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runRepresentationSynthesisBenchmark,
} from "./representation-synthesis-benchmark";

describe(
  "cross-domain representation synthesis benchmark",
  () => {
    it(
      "discovers a three-role derived primitive rather than memorizing one source variable",
      () => {
        const report =
          runRepresentationSynthesisBenchmark();

        expect(
          report
            .synthesizedRule,
        ).toMatchObject({
          primitive: {
            id:
              "mean(signal-a,signal-b,signal-c)",

            operator:
              "mean",

            roles: [
              "signal-a",
              "signal-b",
              "signal-c",
            ],

            complexity:
              3,
          },

          threshold:
            0.5,

          lowPolicyId:
            "conservative",

          highPolicyId:
            "responsive",

          trainingRegret:
            0,
        });

        expect(
          report
            .synthesizedRule
            .primitive
            .id,
        ).not.toMatch(
          /errorLoad|driftBelief|transitionShock/,
        );
      },
    );

    it(
      "improves protected source validation over the best atomic-only representation",
      () => {
        const report =
          runRepresentationSynthesisBenchmark();

        expect(
          report
            .sourceValidation,
        ).toMatchObject({
          episodes:
            4,

          cumulativeRegret:
            0,

          oracleMatches:
            4,
        });

        expect(
          report
            .sourceAtomicBaseline
            .cumulativeRegret,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .sourceImprovement,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "transfers to an unfamiliar domain with renamed variables and shifted utility magnitudes",
      () => {
        const report =
          runRepresentationSynthesisBenchmark();

        expect(
          report
            .targetTransfer,
        ).toMatchObject({
          episodes:
            6,

          cumulativeRegret:
            0,

          oracleMatches:
            6,
        });

        expect(
          report
            .targetAtomicBaseline
            .cumulativeRegret,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .targetImprovement,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "promotes the primitive to reusable only after both source and target evidence are positive",
      () => {
        const report =
          runRepresentationSynthesisBenchmark();

        const entry =
          report
            .libraryAudit
            .entries
            .find(
              (candidate) =>
                candidate
                  .primitiveId ===
                report
                  .synthesizedRule
                  .primitive
                  .id,
            );

        expect(
          entry,
        ).toMatchObject({
          status:
            "reusable",

          domainsEvaluated:
            2,

          positiveTransfers:
            2,

          negativeTransfers:
            0,
        });

        expect(
          entry!
            .cumulativeImprovement,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "keeps the atomic comparison genuinely simpler than the synthesized challenger",
      () => {
        const report =
          runRepresentationSynthesisBenchmark();

        expect(
          report
            .atomicBaselineRule
            .primitive
            .complexity,
        ).toBe(
          1,
        );

        expect(
          report
            .synthesizedRule
            .primitive
            .complexity,
        ).toBe(
          3,
        );

        expect(
          report
            .synthesizedRule
            .complexityPenalty,
        ).toBeGreaterThan(
          report
            .atomicBaselineRule
            .complexityPenalty,
        );

        expect(
          report
            .synthesizedRule
            .objective,
        ).toBeLessThan(
          report
            .atomicBaselineRule
            .objective,
        );
      },
    );
  },
);

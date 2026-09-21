import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runStructuralRoleCompositionBenchmark,
} from "./structural-role-induction-benchmark";

describe(
  "autonomous structural role induction and composition benchmark",
  () => {
    it(
      "recovers the transferred target variable set without receiving the target role binding",
      () => {
        const report =
          runStructuralRoleCompositionBenchmark();

        expect(
          report
            .roleInduction,
        ).toMatchObject({
          decision:
            "mapped",

          selectedVariables: [
            "demandShock",
            "forecastUncertainty",
            "queuePressure",
          ],

          bestRegret:
            0,

          sufficientlyCertain:
            true,
        });

        expect(
          report
            .roleInduction
            .regretMargin,
        ).toBeGreaterThan(
          0.25,
        );
      },
    );

    it(
      "matches the supplied-binding transfer result after autonomous role induction",
      () => {
        const report =
          runStructuralRoleCompositionBenchmark();

        expect(
          report
            .inferredTransfer,
        ).toBeDefined();

        expect(
          report
            .inferredTransfer!
            .cumulativeRegret,
        ).toBeCloseTo(
          report
            .suppliedBindingTransfer
            .cumulativeRegret,
        );

        expect(
          report
            .inferredTransfer!
            .oracleMatches,
        ).toBe(
          report
            .suppliedBindingTransfer
            .oracleMatches,
        );
      },
    );

    it(
      "abstains when target correspondence evidence has an equally good competing variable set",
      () => {
        const report =
          runStructuralRoleCompositionBenchmark();

        expect(
          report
            .ambiguousRoleInduction,
        ).toMatchObject({
          decision:
            "abstained",

          bestRegret:
            0,

          regretMargin:
            0,

          sufficientlyCertain:
            false,
        });

        expect(
          report
            .ambiguousRoleInduction
            .binding,
        ).toBeUndefined();
      },
    );

    it(
      "independently synthesizes a second primitive with a different operator",
      () => {
        const report =
          runStructuralRoleCompositionBenchmark();

        expect(
          report
            .secondSynthesizedRule,
        ).toMatchObject({
          primitive: {
            id:
              "absolute-gap(signal-d,signal-e)",

            operator:
              "absolute-gap",

            roles: [
              "signal-d",
              "signal-e",
            ],

            complexity:
              2,
          },

          threshold:
            0.4,

          lowPolicyId:
            "conservative",

          highPolicyId:
            "responsive",

          trainingRegret:
            0,
        });
      },
    );

    it(
      "composes two primitives when neither primitive alone solves the task",
      () => {
        const report =
          runStructuralRoleCompositionBenchmark();

        expect(
          report
            .leftOnlyRegret,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .rightOnlyRegret,
        ).toBeGreaterThan(
          0,
        );

        expect(
          report
            .compositionRule,
        ).toMatchObject({
          gate:
            "and",

          lowPolicyId:
            "conservative",

          highPolicyId:
            "responsive",

          trainingRegret:
            0,
        });

        expect(
          report
            .compositionEvaluation,
        ).toMatchObject({
          episodes:
            8,

          cumulativeRegret:
            0,

          oracleMatches:
            8,
        });
      },
    );
  },
);

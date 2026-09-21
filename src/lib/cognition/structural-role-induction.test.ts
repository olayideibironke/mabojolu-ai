import {
  describe,
  expect,
  it,
} from "vitest";

import {
  evaluateRepresentationComposition,
  induceStructuralRoleBinding,
  synthesizeRepresentationComposition,
  type BoundRepresentationPrimitive,
} from "./structural-role-induction";

import type {
  RepresentationSynthesisExample,
  SynthesizedRepresentationRule,
} from "./representation-synthesis";

const TRANSFERRED_RULE:
  SynthesizedRepresentationRule = {
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

  complexityPenalty:
    0.04,

  objective:
    0.04,
};

const LOW_UTILITIES = {
  conservative:
    0.7,
  balanced:
    0.15,
  responsive:
    -0.4,
};

const HIGH_UTILITIES = {
  conservative:
    -0.65,
  balanced:
    0.25,
  responsive:
    0.7,
};

function transferExample(
  observation:
    Record<
      string,
      number
    >,

  utilities:
    Record<
      string,
      number
    >,
): RepresentationSynthesisExample {
  return {
    observation,
    policyUtilities: {
      ...utilities,
    },
  };
}

const TARGET_CALIBRATION:
  readonly RepresentationSynthesisExample[] = [
    transferExample(
      {
        queuePressure:
          0.15,
        forecastUncertainty:
          0.55,
        demandShock:
          0.5,
        holidayIndex:
          0.9,
      },
      LOW_UTILITIES,
    ),
    transferExample(
      {
        queuePressure:
          0.55,
        forecastUncertainty:
          0.15,
        demandShock:
          0.5,
        holidayIndex:
          0.1,
      },
      LOW_UTILITIES,
    ),
    transferExample(
      {
        queuePressure:
          0.5,
        forecastUncertainty:
          0.55,
        demandShock:
          0.15,
        holidayIndex:
          0.8,
      },
      LOW_UTILITIES,
    ),
    transferExample(
      {
        queuePressure:
          0.85,
        forecastUncertainty:
          0.55,
        demandShock:
          0.5,
        holidayIndex:
          0.1,
      },
      HIGH_UTILITIES,
    ),
    transferExample(
      {
        queuePressure:
          0.55,
        forecastUncertainty:
          0.85,
        demandShock:
          0.5,
        holidayIndex:
          0.9,
      },
      HIGH_UTILITIES,
    ),
    transferExample(
      {
        queuePressure:
          0.5,
        forecastUncertainty:
          0.55,
        demandShock:
          0.85,
        holidayIndex:
          0.2,
      },
      HIGH_UTILITIES,
    ),
  ];

describe(
  "structural role induction",
  () => {
    it(
      "infers the transferred primitive's target variable set without receiving a role binding",
      () => {
        const result =
          induceStructuralRoleBinding(
            TRANSFERRED_RULE,
            TARGET_CALIBRATION,
            "target-resource-routing",
          );

        expect(
          result,
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

          candidateCount:
            4,
        });

        expect(
          result.regretMargin,
        ).toBeGreaterThan(
          0.25,
        );
      },
    );

    it(
      "keeps mathematically symmetric role permutations in one variable-set hypothesis",
      () => {
        const result =
          induceStructuralRoleBinding(
            TRANSFERRED_RULE,
            TARGET_CALIBRATION,
            "target-resource-routing",
          );

        expect(
          result.candidateCount,
        ).toBe(
          4,
        );

        expect(
          new Set(
            result.candidates.map(
              (candidate) =>
                candidate
                  .variableSet
                  .join("|"),
            ),
          ).size,
        ).toBe(
          4,
        );
      },
    );

    it(
      "abstains when two target variable sets are behaviorally indistinguishable",
      () => {
        const ambiguous =
          TARGET_CALIBRATION.map(
            (example) => ({
              observation: {
                ...example.observation,

                mirrorPressure:
                  example
                    .observation
                    .queuePressure!,
              },

              policyUtilities: {
                ...example
                  .policyUtilities,
              },
            }),
          );

        const result =
          induceStructuralRoleBinding(
            TRANSFERRED_RULE,
            ambiguous,
            "ambiguous-target",
          );

        expect(
          result,
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
          result.binding,
        ).toBeUndefined();
      },
    );

    it(
      "fails closed when the target exposes fewer variables than the primitive needs",
      () => {
        const tooSmall =
          TARGET_CALIBRATION.map(
            (example) => ({
              observation: {
                onlyOne:
                  example
                    .observation
                    .queuePressure!,

                onlyTwo:
                  example
                    .observation
                    .demandShock!,
              },

              policyUtilities: {
                ...example
                  .policyUtilities,
              },
            }),
          );

        expect(
          () =>
            induceStructuralRoleBinding(
              TRANSFERRED_RULE,
              tooSmall,
              "underspecified-target",
            ),
        ).toThrow(
          /fewer observed variables than required primitive roles/,
        );
      },
    );
  },
);

const COMPOSITION_LOW = {
  conservative:
    0.8,
  balanced:
    0.1,
  responsive:
    -0.5,
};

const COMPOSITION_HIGH = {
  conservative:
    -0.7,
  balanced:
    0.25,
  responsive:
    0.85,
};

const LEFT:
  BoundRepresentationPrimitive = {
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

  binding: {
    domainId:
      "composition-domain",

    roleToVariable: {
      "signal-a":
        "loadA",

      "signal-b":
        "loadB",

      "signal-c":
        "loadC",
    },
  },
};

const RIGHT:
  BoundRepresentationPrimitive = {
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

  binding: {
    domainId:
      "composition-domain",

    roleToVariable: {
      "signal-d":
        "stateD",

      "signal-e":
        "stateE",
    },
  },
};

function compositionExample(
  leftHigh:
    boolean,

  rightHigh:
    boolean,
): RepresentationSynthesisExample {
  return {
    observation: {
      loadA:
        leftHigh
          ? 0.8
          : 0.2,

      loadB:
        leftHigh
          ? 0.7
          : 0.3,

      loadC:
        leftHigh
          ? 0.75
          : 0.25,

      stateD:
        rightHigh
          ? 0.9
          : 0.55,

      stateE:
        rightHigh
          ? 0.2
          : 0.45,
    },

    policyUtilities: {
      ...(
        leftHigh &&
        rightHigh
          ? COMPOSITION_HIGH
          : COMPOSITION_LOW
      ),
    },
  };
}

const COMPOSITION_TRAINING:
  readonly RepresentationSynthesisExample[] = [
    compositionExample(
      false,
      false,
    ),
    compositionExample(
      false,
      false,
    ),
    compositionExample(
      true,
      false,
    ),
    compositionExample(
      true,
      false,
    ),
    compositionExample(
      false,
      true,
    ),
    compositionExample(
      false,
      true,
    ),
    compositionExample(
      true,
      true,
    ),
    compositionExample(
      true,
      true,
    ),
  ];

describe(
  "representation composition",
  () => {
    it(
      "synthesizes an AND composition when neither reusable primitive is sufficient alone",
      () => {
        const rule =
          synthesizeRepresentationComposition(
            LEFT,
            RIGHT,
            COMPOSITION_TRAINING,
          );

        expect(
          rule,
        ).toMatchObject({
          leftPrimitiveId:
            LEFT.primitive.id,

          rightPrimitiveId:
            RIGHT.primitive.id,

          gate:
            "and",

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
      "reaches the oracle across all four primitive-state combinations",
      () => {
        const rule =
          synthesizeRepresentationComposition(
            LEFT,
            RIGHT,
            COMPOSITION_TRAINING,
          );

        const evaluation =
          evaluateRepresentationComposition(
            rule,
            LEFT,
            RIGHT,
            COMPOSITION_TRAINING,
          );

        expect(
          evaluation,
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

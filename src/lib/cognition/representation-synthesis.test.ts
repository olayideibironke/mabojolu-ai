import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BoundedRepresentationPrimitiveLibrary,
  evaluateSynthesizedRepresentationRule,
  synthesizeRepresentationRule,
  type RepresentationDomainBinding,
  type RepresentationSynthesisExample,
} from "./representation-synthesis";

const ROLES = [
  "signal-a",
  "signal-b",
  "signal-c",
  "nuisance",
] as const;

const SOURCE_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "source-regime-control",

  roleToVariable: {
    "signal-a":
      "errorLoad",

    "signal-b":
      "driftBelief",

    "signal-c":
      "transitionShock",

    nuisance:
      "calendarNoise",
  },
};

const TARGET_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "target-resource-routing",

  roleToVariable: {
    "signal-a":
      "queuePressure",

    "signal-b":
      "forecastUncertainty",

    "signal-c":
      "demandShock",

    nuisance:
      "holidayIndex",
  },
};

const SOURCE_LOW_UTILITIES = {
  conservative:
    0.6,
  balanced:
    0.05,
  responsive:
    -0.5,
};

const SOURCE_HIGH_UTILITIES = {
  conservative:
    -0.8,
  balanced:
    0.2,
  responsive:
    0.55,
};

const TARGET_LOW_UTILITIES = {
  conservative:
    0.7,
  balanced:
    0.15,
  responsive:
    -0.4,
};

const TARGET_HIGH_UTILITIES = {
  conservative:
    -0.65,
  balanced:
    0.25,
  responsive:
    0.7,
};

function sourceExample(
  errorLoad:
    number,

  driftBelief:
    number,

  transitionShock:
    number,

  calendarNoise:
    number,

  utilities:
    Record<
      string,
      number
    >,
): RepresentationSynthesisExample {
  return {
    observation: {
      errorLoad,
      driftBelief,
      transitionShock,
      calendarNoise,
    },

    policyUtilities: {
      ...utilities,
    },
  };
}

function targetExample(
  queuePressure:
    number,

  forecastUncertainty:
    number,

  demandShock:
    number,

  holidayIndex:
    number,

  utilities:
    Record<
      string,
      number
    >,
): RepresentationSynthesisExample {
  return {
    observation: {
      queuePressure,
      forecastUncertainty,
      demandShock,
      holidayIndex,
    },

    policyUtilities: {
      ...utilities,
    },
  };
}

const SOURCE_TRAINING:
  readonly RepresentationSynthesisExample[] = [
    sourceExample(
      0.1,
      0.5,
      0.5,
      0.1,
      SOURCE_LOW_UTILITIES,
    ),
    sourceExample(
      0.5,
      0.1,
      0.5,
      0.9,
      SOURCE_LOW_UTILITIES,
    ),
    sourceExample(
      0.5,
      0.5,
      0.1,
      0.2,
      SOURCE_LOW_UTILITIES,
    ),
    sourceExample(
      0.9,
      0.5,
      0.5,
      0.9,
      SOURCE_HIGH_UTILITIES,
    ),
    sourceExample(
      0.5,
      0.9,
      0.5,
      0.1,
      SOURCE_HIGH_UTILITIES,
    ),
    sourceExample(
      0.5,
      0.5,
      0.9,
      0.8,
      SOURCE_HIGH_UTILITIES,
    ),
  ];

const SOURCE_VALIDATION:
  readonly RepresentationSynthesisExample[] = [
    sourceExample(
      0.2,
      0.4,
      0.5,
      0.8,
      SOURCE_LOW_UTILITIES,
    ),
    sourceExample(
      0.4,
      0.2,
      0.5,
      0.2,
      SOURCE_LOW_UTILITIES,
    ),
    sourceExample(
      0.8,
      0.6,
      0.5,
      0.2,
      SOURCE_HIGH_UTILITIES,
    ),
    sourceExample(
      0.6,
      0.8,
      0.5,
      0.8,
      SOURCE_HIGH_UTILITIES,
    ),
  ];

const TARGET_TRANSFER:
  readonly RepresentationSynthesisExample[] = [
    targetExample(
      0.15,
      0.55,
      0.5,
      0.9,
      TARGET_LOW_UTILITIES,
    ),
    targetExample(
      0.55,
      0.15,
      0.5,
      0.1,
      TARGET_LOW_UTILITIES,
    ),
    targetExample(
      0.5,
      0.55,
      0.15,
      0.8,
      TARGET_LOW_UTILITIES,
    ),
    targetExample(
      0.85,
      0.55,
      0.5,
      0.1,
      TARGET_HIGH_UTILITIES,
    ),
    targetExample(
      0.55,
      0.85,
      0.5,
      0.9,
      TARGET_HIGH_UTILITIES,
    ),
    targetExample(
      0.5,
      0.55,
      0.85,
      0.2,
      TARGET_HIGH_UTILITIES,
    ),
  ];

describe(
  "bounded representation synthesis",
  () => {
    it(
      "synthesizes a nontrivial three-role mean from outcome evidence",
      () => {
        const rule =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
          );

        expect(
          rule,
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
          rule.complexityPenalty,
        ).toBeCloseTo(
          0.04,
        );
      },
    );

    it(
      "beats every atomic-only source representation on protected validation",
      () => {
        const synthesized =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
          );

        const atomic =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
            {
              maximumArity:
                1,
            },
          );

        const synthesizedResult =
          evaluateSynthesizedRepresentationRule(
            synthesized,
            SOURCE_VALIDATION,
            SOURCE_BINDING,
          );

        const atomicResult =
          evaluateSynthesizedRepresentationRule(
            atomic,
            SOURCE_VALIDATION,
            SOURCE_BINDING,
          );

        expect(
          synthesizedResult,
        ).toMatchObject({
          episodes:
            4,

          cumulativeRegret:
            0,

          oracleMatches:
            4,
        });

        expect(
          atomicResult
            .cumulativeRegret,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "transfers the synthesized primitive across renamed variables and shifted utilities",
      () => {
        const rule =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
          );

        const result =
          evaluateSynthesizedRepresentationRule(
            rule,
            TARGET_TRANSFER,
            TARGET_BINDING,
          );

        expect(
          result,
        ).toMatchObject({
          episodes:
            6,

          cumulativeRegret:
            0,

          oracleMatches:
            6,
        });
      },
    );

    it(
      "fails closed when a target domain omits one of the primitive's role bindings",
      () => {
        const rule =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
          );

        expect(
          () =>
            evaluateSynthesizedRepresentationRule(
              rule,
              TARGET_TRANSFER,
              {
                domainId:
                  "broken-target",

                roleToVariable: {
                  "signal-a":
                    "queuePressure",

                  "signal-b":
                    "forecastUncertainty",

                  nuisance:
                    "holidayIndex",
                },
              },
            ),
        ).toThrow(
          /no variable binding for role signal-c/,
        );
      },
    );
  },
);

describe(
  "BoundedRepresentationPrimitiveLibrary",
  () => {
    it(
      "promotes a primitive to reusable only after positive evidence in two domains",
      () => {
        const rule =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
          );

        const atomic =
          synthesizeRepresentationRule(
            SOURCE_TRAINING,
            SOURCE_BINDING,
            ROLES,
            {
              maximumArity:
                1,
            },
          );

        const sourcePrimitive =
          evaluateSynthesizedRepresentationRule(
            rule,
            SOURCE_VALIDATION,
            SOURCE_BINDING,
          );

        const sourceBaseline =
          evaluateSynthesizedRepresentationRule(
            atomic,
            SOURCE_VALIDATION,
            SOURCE_BINDING,
          );

        const targetPrimitive =
          evaluateSynthesizedRepresentationRule(
            rule,
            TARGET_TRANSFER,
            TARGET_BINDING,
          );

        const targetBaseline =
          evaluateSynthesizedRepresentationRule(
            atomic,
            TARGET_TRANSFER,
            TARGET_BINDING,
          );

        const library =
          new BoundedRepresentationPrimitiveLibrary();

        library.register(
          rule.primitive,
        );

        const sourceEntry =
          library.recordTransfer({
            primitiveId:
              rule.primitive.id,

            domainId:
              SOURCE_BINDING
                .domainId,

            baselineRegret:
              sourceBaseline
                .cumulativeRegret,

            primitiveRegret:
              sourcePrimitive
                .cumulativeRegret,

            improvement:
              sourceBaseline
                .cumulativeRegret -
              sourcePrimitive
                .cumulativeRegret,

            unsafeIrreversibleActions:
              0,

            falsePromotions:
              0,
          });

        expect(
          sourceEntry.status,
        ).toBe(
          "candidate",
        );

        const targetEntry =
          library.recordTransfer({
            primitiveId:
              rule.primitive.id,

            domainId:
              TARGET_BINDING
                .domainId,

            baselineRegret:
              targetBaseline
                .cumulativeRegret,

            primitiveRegret:
              targetPrimitive
                .cumulativeRegret,

            improvement:
              targetBaseline
                .cumulativeRegret -
              targetPrimitive
                .cumulativeRegret,

            unsafeIrreversibleActions:
              0,

            falsePromotions:
              0,
          });

        expect(
          targetEntry,
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
      },
    );

    it(
      "retires a primitive after repeated negative transfer",
      () => {
        const library =
          new BoundedRepresentationPrimitiveLibrary();

        library.register({
          id:
            "atomic(nuisance)",

          operator:
            "atomic",

          roles: [
            "nuisance",
          ],

          complexity:
            1,
        });

        library.recordTransfer({
          primitiveId:
            "atomic(nuisance)",

          domainId:
            "domain-one",

          baselineRegret:
            0.2,

          primitiveRegret:
            0.5,

          improvement:
            -0.3,

          unsafeIrreversibleActions:
            0,

          falsePromotions:
            0,
        });

        const retired =
          library.recordTransfer({
            primitiveId:
              "atomic(nuisance)",

            domainId:
              "domain-two",

            baselineRegret:
              0.1,

            primitiveRegret:
              0.5,

            improvement:
              -0.4,

            unsafeIrreversibleActions:
              0,

            falsePromotions:
              0,
          });

        expect(
          retired.status,
        ).toBe(
          "retired",
        );
      },
    );

    it(
      "quarantines unsafe primitives and refuses later evidence updates",
      () => {
        const library =
          new BoundedRepresentationPrimitiveLibrary();

        library.register({
          id:
            "mean(signal-a,signal-b)",

          operator:
            "mean",

          roles: [
            "signal-a",
            "signal-b",
          ],

          complexity:
            2,
        });

        const quarantined =
          library.recordTransfer({
            primitiveId:
              "mean(signal-a,signal-b)",

            domainId:
              "unsafe-domain",

            baselineRegret:
              1,

            primitiveRegret:
              0,

            improvement:
              1,

            unsafeIrreversibleActions:
              1,

            falsePromotions:
              0,
          });

        expect(
          quarantined.status,
        ).toBe(
          "quarantined",
        );

        expect(
          () =>
            library.recordTransfer({
              primitiveId:
                "mean(signal-a,signal-b)",

              domainId:
                "later-domain",

              baselineRegret:
                1,

              primitiveRegret:
                0,

              improvement:
                1,

              unsafeIrreversibleActions:
                0,

              falsePromotions:
                0,
            }),
        ).toThrow(
          /terminally quarantined/,
        );
      },
    );

    it(
      "rejects inconsistent transfer-improvement claims",
      () => {
        const library =
          new BoundedRepresentationPrimitiveLibrary();

        library.register({
          id:
            "atomic(signal-a)",

          operator:
            "atomic",

          roles: [
            "signal-a",
          ],

          complexity:
            1,
        });

        expect(
          () =>
            library.recordTransfer({
              primitiveId:
                "atomic(signal-a)",

              domainId:
                "domain-one",

              baselineRegret:
                0.8,

              primitiveRegret:
                0.2,

              improvement:
                0.1,

              unsafeIrreversibleActions:
                0,

              falsePromotions:
                0,
            }),
        ).toThrow(
          /improvement must equal baseline regret minus primitive regret/,
        );
      },
    );
  },
);

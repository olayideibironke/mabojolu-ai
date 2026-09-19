import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ValidatedSymbolicPredicateApplicabilityModel,
} from "./validated-predicate-search";

import type {
  InducedContextFeatures,
  InducedContextSignature,
} from "./principle-context-signature";

function signature(
  overrides:
    Partial<
      InducedContextFeatures
    >,
):
  InducedContextSignature {
  const features:
    InducedContextFeatures = {
    historyLength:
      "1",

    distinctActionsSeen:
      "1",

    lastChangeArity:
      "one",

    lastValueShapes: [
      "number:increase",
    ],

    candidateAttempts:
      "1",

    candidateNoEffectAttempts:
      "0",

    candidateEffectAttempts:
      "1",

    candidateMatchesLastAction:
      true,

    candidateMatchesLastProductiveAction:
      true,

    stepsSinceCandidateAttempt:
      "0",

    ...overrides,
  };

  return {
    key:
      JSON.stringify(
        features,
      ),

    features,
  };
}

function fitEvidence():
  Array<{
    history:
      "1" |
      "2" |
      "3+";

    distinct:
      "1" |
      "2" |
      "3+";

    useful:
      boolean;
  }> {
  return [
    {
      history:
        "1",

      distinct:
        "1",

      useful:
        true,
    },

    {
      history:
        "2",

      distinct:
        "1",

      useful:
        true,
    },

    {
      history:
        "3+",

      distinct:
        "3+",

      useful:
        true,
    },

    {
      history:
        "3+",

      distinct:
        "3+",

      useful:
        true,
    },

    {
      history:
        "3+",

      distinct:
        "1",

      useful:
        false,
    },

    {
      history:
        "3+",

      distinct:
        "1",

      useful:
        false,
    },
  ];
}

function recordFit(
  model:
    ValidatedSymbolicPredicateApplicabilityModel,
): void {
  for (
    const observation of
      fitEvidence()
  ) {
    model.record({
      principleId:
        "principle-a",

      signature:
        signature({
          historyLength:
            observation.history,

          distinctActionsSeen:
            observation.distinct,
        }),

      useful:
        observation.useful,
    });
  }
}

describe(
  "Mabojolu G held-out symbolic predicate validation",
  () => {
    it(
      "does not expose an applicability estimate before held-out validation completes",
      () => {
        const model =
          new ValidatedSymbolicPredicateApplicabilityModel();

        recordFit(
          model,
        );

        expect(
          model
            .getValidationSummary(
              "principle-a",
            )
            .status,
        ).toBe(
          "validating",
        );

        expect(
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),
          ),
        ).toBeUndefined();

        model.record({
          principleId:
            "principle-a",

          signature:
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),

          useful:
            true,
        });

        expect(
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),
          ),
        ).toBeUndefined();
      },
    );

    it(
      "validates a frozen predicate when it beats the majority baseline on held-out evidence",
      () => {
        const model =
          new ValidatedSymbolicPredicateApplicabilityModel();

        recordFit(
          model,
        );

        for (
          const observation of [
            {
              history:
                "3+" as const,

              distinct:
                "2" as const,

              useful:
                true,
            },

            {
              history:
                "3+" as const,

              distinct:
                "1" as const,

              useful:
                false,
            },

            {
              history:
                "2" as const,

              distinct:
                "2" as const,

              useful:
                true,
            },
          ]
        ) {
          model.record({
            principleId:
              "principle-a",

            signature:
              signature({
                historyLength:
                  observation.history,

                distinctActionsSeen:
                  observation.distinct,
              }),

            useful:
              observation.useful,
          });
        }

        const summary =
          model.getValidationSummary(
            "principle-a",
          );

        expect(
          summary,
        ).toMatchObject({
          status:
            "validated",

          fitEvidenceCount:
            6,

          validationEvidenceCount:
            3,

          operationalEvidenceCount:
            0,

          validationAccuracy:
            1,

          validationBaselineAccuracy:
            2 / 3,
        });

        const estimate =
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),
          );

        expect(
          estimate,
        ).toBeDefined();

        expect(
          estimate
            ?.projection,
        ).toMatchObject({
          operator:
            "absolute-difference-at-most",

          parameter:
            1,

          predicateValue:
            true,
        });

        expect(
          estimate
            ?.validation
            .status,
        ).toBe(
          "validated",
        );
      },
    );

    it(
      "rejects a fitted predicate when withheld outcomes contradict it",
      () => {
        const model =
          new ValidatedSymbolicPredicateApplicabilityModel();

        recordFit(
          model,
        );

        for (
          const observation of [
            {
              history:
                "3+" as const,

              distinct:
                "2" as const,

              useful:
                false,
            },

            {
              history:
                "3+" as const,

              distinct:
                "1" as const,

              useful:
                true,
            },

            {
              history:
                "2" as const,

              distinct:
                "2" as const,

              useful:
                false,
            },
          ]
        ) {
          model.record({
            principleId:
              "principle-a",

            signature:
              signature({
                historyLength:
                  observation.history,

                distinctActionsSeen:
                  observation.distinct,
              }),

            useful:
              observation.useful,
          });
        }

        expect(
          model.getValidationSummary(
            "principle-a",
          ),
        ).toMatchObject({
          status:
            "rejected",

          validationEvidenceCount:
            3,

          rejectionReason:
            "failed-held-out-validation",
        });

        expect(
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),
          ),
        ).toBeUndefined();
      },
    );

    it(
      "keeps validation outcomes out of post-validation applicability evidence",
      () => {
        const model =
          new ValidatedSymbolicPredicateApplicabilityModel();

        recordFit(
          model,
        );

        for (
          const observation of [
            {
              history:
                "3+" as const,

              distinct:
                "2" as const,

              useful:
                true,
            },

            {
              history:
                "3+" as const,

              distinct:
                "1" as const,

              useful:
                false,
            },

            {
              history:
                "2" as const,

              distinct:
                "2" as const,

              useful:
                true,
            },
          ]
        ) {
          model.record({
            principleId:
              "principle-a",

            signature:
              signature({
                historyLength:
                  observation.history,

                distinctActionsSeen:
                  observation.distinct,
              }),

            useful:
              observation.useful,
          });
        }

        const estimate =
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "2",
            }),
          );

        expect(
          estimate
            ?.evidenceCount,
        ).toBe(4);

        expect(
          estimate
            ?.successes,
        ).toBe(4);

        expect(
          estimate
            ?.failures,
        ).toBe(0);

        expect(
          estimate
            ?.validation
            .fitEvidenceCount,
        ).toBe(6);

        expect(
          estimate
            ?.validation
            .validationEvidenceCount,
        ).toBe(3);
      },
    );
  },
);

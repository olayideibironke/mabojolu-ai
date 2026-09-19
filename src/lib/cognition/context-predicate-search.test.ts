import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SymbolicPredicateApplicabilityModel,
} from "./context-predicate-search";

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

function differenceModel():
  SymbolicPredicateApplicabilityModel {
  const model =
    new SymbolicPredicateApplicabilityModel();

  const observations = [
    {
      history:
        "2" as const,

      distinct:
        "1" as const,

      useful:
        true,
    },

    {
      history:
        "2" as const,

      distinct:
        "1" as const,

      useful:
        true,
    },

    {
      history:
        "1" as const,

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
        false,
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
        "3+" as const,

      distinct:
        "3+" as const,

      useful:
        false,
    },
  ];

  for (
    const observation of
      observations
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

  return model;
}

describe(
  "Mabojolu G complexity-regularized symbolic predicate search",
  () => {
    it(
      "abstains before the minimum evidence threshold",
      () => {
        const model =
          new SymbolicPredicateApplicabilityModel();

        for (
          let index = 0;
          index <
            5;
          index +=
            1
        ) {
          model.record({
            principleId:
              "principle-a",

            signature:
              signature({
                historyLength:
                  index %
                    2 ===
                    0
                    ? "1"
                    : "2",
              }),

            useful:
              index %
                2 ===
                0,
          });
        }

        expect(
          model.rankPrograms(
            "principle-a",
          ),
        ).toEqual([]);

        expect(
          model.estimate(
            "principle-a",
            signature({}),
          ),
        ).toBeUndefined();
      },
    );

    it(
      "discovers a difference-equals-one predicate that beats all atomic features after complexity regularization",
      () => {
        const model =
          differenceModel();

        const best =
          model.rankPrograms(
            "principle-a",
          )[0];

        expect(
          best,
        ).toMatchObject({
          left:
            "historyLength",

          right:
            "distinctActionsSeen",

          operator:
            "difference-equals",

          parameter:
            1,

          complexity:
            2,

          complexityPenalty:
            0.05,
        });

        expect(
          best
            ?.informationGain,
        ).toBeGreaterThan(
          best
            ?.bestAtomicInformationGain ??
            0,
        );

        expect(
          best
            ?.regularizedScore,
        ).toBeGreaterThan(
          best
            ?.bestAtomicInformationGain ??
            0,
        );

        expect(
          best
            ?.gainOverBestAtomic,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "transfers the discovered predicate to an unseen three-plus over two context",
      () => {
        const model =
          differenceModel();

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
            "difference-equals",

          parameter:
            1,

          predicateValue:
            true,
        });

        expect(
          estimate
            ?.evidenceCount,
        ).toBe(2);

        expect(
          estimate
            ?.successes,
        ).toBe(2);

        expect(
          estimate
            ?.failures,
        ).toBe(0);

        expect(
          estimate
            ?.applicability,
        ).toBe(0.75);
      },
    );

    it(
      "prefers a simpler equality predicate over an equivalent difference-equals-zero predicate",
      () => {
        const model =
          new SymbolicPredicateApplicabilityModel(
            4,
          );

        for (
          const input of [
            {
              history:
                "1" as const,

              distinct:
                "1" as const,

              useful:
                true,
            },
            {
              history:
                "1" as const,

              distinct:
                "2" as const,

              useful:
                false,
            },
            {
              history:
                "2" as const,

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
                  input.history,

                distinctActionsSeen:
                  input.distinct,
              }),

            useful:
              input.useful,
          });
        }

        const best =
          model.rankPrograms(
            "principle-a",
          )[0];

        expect(
          best,
        ).toMatchObject({
          operator:
            "equal",

          complexity:
            1,

          complexityPenalty:
            0,
        });
      },
    );

    it(
      "refuses symbolic predicates when an atomic feature already explains the evidence equally well",
      () => {
        const model =
          new SymbolicPredicateApplicabilityModel(
            4,
          );

        for (
          const input of [
            {
              arity:
                "one" as const,

              history:
                "1" as const,

              useful:
                true,
            },
            {
              arity:
                "one" as const,

              history:
                "2" as const,

              useful:
                true,
            },
            {
              arity:
                "many" as const,

              history:
                "1" as const,

              useful:
                false,
            },
            {
              arity:
                "many" as const,

              history:
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
                lastChangeArity:
                  input.arity,

                historyLength:
                  input.history,
              }),

            useful:
              input.useful,
          });
        }

        expect(
          model.rankPrograms(
            "principle-a",
          ),
        ).toEqual([]);
      },
    );
  },
);

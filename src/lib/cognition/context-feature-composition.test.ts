import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ComposedContextFeatureApplicabilityModel,
} from "./context-feature-composition";

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
      JSON.stringify({
        lastChangeArity:
          features
            .lastChangeArity,

        lastValueShapes:
          features
            .lastValueShapes,

        candidateAttempts:
          features
            .candidateAttempts,

        candidateNoEffectAttempts:
          features
            .candidateNoEffectAttempts,

        candidateEffectAttempts:
          features
            .candidateEffectAttempts,

        candidateMatchesLastAction:
          features
            .candidateMatchesLastAction,

        candidateMatchesLastProductiveAction:
          features
            .candidateMatchesLastProductiveAction,

        stepsSinceCandidateAttempt:
          features
            .stepsSinceCandidateAttempt,
      }),

    features,
  };
}

function xorModel():
  ComposedContextFeatureApplicabilityModel {
  const model =
    new ComposedContextFeatureApplicabilityModel();

  const observations = [
    {
      useful:
        false,

      signature:
        signature({
          historyLength:
            "1",

          lastChangeArity:
            "one",
        }),
    },

    {
      useful:
        true,

      signature:
        signature({
          historyLength:
            "2",

          lastChangeArity:
            "one",
        }),
    },

    {
      useful:
        true,

      signature:
        signature({
          historyLength:
            "1",

          lastChangeArity:
            "many",
        }),
    },

    {
      useful:
        false,

      signature:
        signature({
          historyLength:
            "2",

          lastChangeArity:
            "many",
        }),
    },
  ] as const;

  for (
    const observation of
      observations
  ) {
    model.record({
      principleId:
        "principle-a",

      signature:
        observation.signature,

      useful:
        observation.useful,
    });
  }

  return model;
}

describe(
  "Mabojolu G autonomous context feature composition",
  () => {
    it(
      "does not compose a context feature before enough outcome evidence exists",
      () => {
        const model =
          new ComposedContextFeatureApplicabilityModel();

        for (
          let index = 0;
          index <
            3;
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
          model.rankCompositions(
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
      "constructs a pairwise feature when no atomic feature predicts the XOR-style outcome",
      () => {
        const model =
          xorModel();

        const best =
          model.rankCompositions(
            "principle-a",
          )[0];

        expect(
          best,
        ).toMatchObject({
          id:
            "pair::historyLength::lastChangeArity",

          components: [
            "historyLength",
            "lastChangeArity",
          ],

          bestAtomicInformationGain:
            0,

          informationGain:
            1,

          gainOverBestAtomic:
            1,
        });
      },
    );

    it(
      "uses the constructed feature to estimate applicability for a matching higher-order context",
      () => {
        const model =
          xorModel();

        const estimate =
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "2",

              lastChangeArity:
                "one",

              distinctActionsSeen:
                "3+",

              candidateAttempts:
                "2+",
            }),
          );

        expect(
          estimate,
        ).toBeDefined();

        expect(
          estimate
            ?.projection
            .components,
        ).toEqual([
          "historyLength",
          "lastChangeArity",
        ]);

        expect(
          estimate
            ?.evidenceCount,
        ).toBe(1);

        expect(
          estimate
            ?.successes,
        ).toBe(1);

        expect(
          estimate
            ?.applicability,
        ).toBeCloseTo(
          2 / 3,
        );
      },
    );

    it(
      "refuses a composition when an atomic feature already explains the outcomes equally well",
      () => {
        const model =
          new ComposedContextFeatureApplicabilityModel();

        for (
          const input of [
            {
              arity:
                "one" as const,

              useful:
                true,
            },
            {
              arity:
                "one" as const,

              useful:
                true,
            },
            {
              arity:
                "many" as const,

              useful:
                false,
            },
            {
              arity:
                "many" as const,

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
              }),

            useful:
              input.useful,
          });
        }

        expect(
          model.rankCompositions(
            "principle-a",
          ),
        ).toEqual([]);
      },
    );

    it(
      "keeps constructed feature evidence independent across principles",
      () => {
        const model =
          xorModel();

        expect(
          model.rankCompositions(
            "principle-b",
          ),
        ).toEqual([]);

        expect(
          model.getObservationCount(
            "principle-a",
          ),
        ).toBe(4);

        expect(
          model.getObservationCount(
            "principle-b",
          ),
        ).toBe(0);
      },
    );
  },
);

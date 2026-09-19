import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RelationalContextFeatureApplicabilityModel,
} from "./context-feature-relation";

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

function relationalModel():
  RelationalContextFeatureApplicabilityModel {
  const model =
    new RelationalContextFeatureApplicabilityModel();

  const observations = [
    {
      historyLength:
        "1" as const,

      distinctActionsSeen:
        "1" as const,

      useful:
        true,
    },

    {
      historyLength:
        "2" as const,

      distinctActionsSeen:
        "1" as const,

      useful:
        false,
    },

    {
      historyLength:
        "2" as const,

      distinctActionsSeen:
        "2" as const,

      useful:
        true,
    },

    {
      historyLength:
        "3+" as const,

      distinctActionsSeen:
        "1" as const,

      useful:
        false,
    },

    {
      historyLength:
        "3+" as const,

      distinctActionsSeen:
        "2" as const,

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
            observation
              .historyLength,

          distinctActionsSeen:
            observation
              .distinctActionsSeen,
        }),

      useful:
        observation.useful,
    });
  }

  return model;
}

describe(
  "Mabojolu G autonomous relational context feature synthesis",
  () => {
    it(
      "does not synthesize a relation before enough outcome evidence exists",
      () => {
        const model =
          new RelationalContextFeatureApplicabilityModel();

        for (
          let index = 0;
          index <
            4;
          index +=
            1
        ) {
          model.record({
            principleId:
              "principle-a",

            signature:
              signature({
                historyLength:
                  index <
                    2
                    ? "1"
                    : "2",

                distinctActionsSeen:
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
          model.rankRelations(
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
      "discovers an equality relation that predicts usefulness beyond every atomic feature",
      () => {
        const model =
          relationalModel();

        const best =
          model.rankRelations(
            "principle-a",
          )[0];

        expect(
          best,
        ).toBeDefined();

        expect(
          best,
        ).toMatchObject({
          left:
            "historyLength",

          right:
            "distinctActionsSeen",

          operator:
            "equal",
        });

        expect(
          best
            ?.gainOverBestAtomic,
        ).toBeGreaterThan(
          0,
        );

        expect(
          best
            ?.informationGain,
        ).toBeGreaterThan(
          best
            ?.bestAtomicInformationGain ??
            0,
        );
      },
    );

    it(
      "transfers the learned relation to an unseen equal-valued pair",
      () => {
        const model =
          relationalModel();

        const estimate =
          model.estimate(
            "principle-a",
            signature({
              historyLength:
                "3+",

              distinctActionsSeen:
                "3+",
            }),
          );

        expect(
          estimate,
        ).toBeDefined();

        expect(
          estimate
            ?.projection,
        ).toMatchObject({
          left:
            "historyLength",

          right:
            "distinctActionsSeen",

          operator:
            "equal",

          relationValue:
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
      "refuses relational synthesis when an atomic feature already explains the evidence equally well",
      () => {
        const model =
          new RelationalContextFeatureApplicabilityModel(
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
                true,
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
                  input.history,

                distinctActionsSeen:
                  input.distinct,
              }),

            useful:
              input.useful,
          });
        }

        expect(
          model.rankRelations(
            "principle-a",
          ),
        ).toEqual([]);
      },
    );

    it(
      "keeps synthesized relations independent across principles",
      () => {
        const model =
          relationalModel();

        expect(
          model.rankRelations(
            "principle-b",
          ),
        ).toEqual([]);

        expect(
          model.getObservationCount(
            "principle-a",
          ),
        ).toBe(5);

        expect(
          model.getObservationCount(
            "principle-b",
          ),
        ).toBe(0);
      },
    );
  },
);

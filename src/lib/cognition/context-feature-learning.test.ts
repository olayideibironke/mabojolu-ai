import {
  describe,
  expect,
  it,
} from "vitest";

import {
  LearnedContextFeatureApplicabilityModel,
} from "./context-feature-learning";

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

function trainedModel():
  LearnedContextFeatureApplicabilityModel {
  const model =
    new LearnedContextFeatureApplicabilityModel();

  const observations = [
    {
      useful:
        true,

      signature:
        signature({
          lastChangeArity:
            "one",

          historyLength:
            "1",

          distinctActionsSeen:
            "1",

          candidateAttempts:
            "1",

          candidateMatchesLastAction:
            true,
        }),
    },

    {
      useful:
        true,

      signature:
        signature({
          lastChangeArity:
            "one",

          historyLength:
            "3+",

          distinctActionsSeen:
            "3+",

          candidateAttempts:
            "2+",

          candidateMatchesLastAction:
            false,
        }),
    },

    {
      useful:
        false,

      signature:
        signature({
          lastChangeArity:
            "many",

          historyLength:
            "1",

          distinctActionsSeen:
            "1",

          candidateAttempts:
            "2+",

          candidateMatchesLastAction:
            false,
        }),
    },

    {
      useful:
        false,

      signature:
        signature({
          lastChangeArity:
            "many",

          historyLength:
            "3+",

          distinctActionsSeen:
            "3+",

          candidateAttempts:
            "1",

          candidateMatchesLastAction:
            true,
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
  "Mabojolu G learned structural context features",
  () => {
    it(
      "stays at an uncertainty prior before enough evidence exists",
      () => {
        const model =
          new LearnedContextFeatureApplicabilityModel();

        const estimate =
          model.estimate(
            "principle-a",
            signature({}),
          );

        expect(
          estimate
            .projection
            .selectedFeatures,
        ).toEqual([]);

        expect(
          estimate.evidenceCount,
        ).toBe(0);

        expect(
          estimate.applicability,
        ).toBe(0.5);
      },
    );

    it(
      "discovers the structural dimension that predicts usefulness",
      () => {
        const model =
          trainedModel();

        const relevance =
          model.rankFeatures(
            "principle-a",
          );

        expect(
          relevance[0]
            ?.feature,
        ).toBe(
          "lastChangeArity",
        );

        expect(
          relevance[0]
            ?.informationGain,
        ).toBeGreaterThan(
          0,
        );

        expect(
          model.project(
            "principle-a",
            signature({}),
          )
            .selectedFeatures,
        ).toEqual([
          "lastChangeArity",
        ]);
      },
    );

    it(
      "generalizes across nuisance history differences after learning the compressed projection",
      () => {
        const model =
          trainedModel();

        const heldOut =
          signature({
            lastChangeArity:
              "one",

            historyLength:
              "2",

            distinctActionsSeen:
              "2",

            candidateAttempts:
              "1",

            candidateMatchesLastAction:
              false,

            stepsSinceCandidateAttempt:
              "2+",
          });

        const estimate =
          model.estimate(
            "principle-a",
            heldOut,
          );

        expect(
          estimate
            .projection
            .selectedFeatures,
        ).toEqual([
          "lastChangeArity",
        ]);

        expect(
          estimate.evidenceCount,
        ).toBe(2);

        expect(
          estimate.successes,
        ).toBe(2);

        expect(
          estimate.failures,
        ).toBe(0);

        expect(
          estimate.applicability,
        ).toBe(0.75);
      },
    );

    it(
      "learns a lower applicability estimate for the contrasting structural projection",
      () => {
        const model =
          trainedModel();

        const estimate =
          model.estimate(
            "principle-a",
            signature({
              lastChangeArity:
                "many",

              historyLength:
                "2",

              distinctActionsSeen:
                "2",
            }),
          );

        expect(
          estimate.evidenceCount,
        ).toBe(2);

        expect(
          estimate.successes,
        ).toBe(0);

        expect(
          estimate.failures,
        ).toBe(2);

        expect(
          estimate.applicability,
        ).toBe(0.25);
      },
    );

    it(
      "keeps learned feature relevance independent across principles",
      () => {
        const model =
          trainedModel();

        const other =
          model.estimate(
            "principle-b",
            signature({
              lastChangeArity:
                "one",
            }),
          );

        expect(
          other
            .projection
            .selectedFeatures,
        ).toEqual([]);

        expect(
          other.evidenceCount,
        ).toBe(0);

        expect(
          other.applicability,
        ).toBe(0.5);
      },
    );
  },
);

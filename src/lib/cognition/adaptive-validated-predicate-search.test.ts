import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AdaptiveValidatedSymbolicPredicateApplicabilityModel,
} from "./adaptive-validated-predicate-search";

import type {
  InducedContextFeatures,
  InducedContextSignature,
} from "./principle-context-signature";

const PRINCIPLE_ID =
  "principle-a";

function signature(
  historyLength:
    InducedContextFeatures[
      "historyLength"
    ],

  distinctActionsSeen:
    InducedContextFeatures[
      "distinctActionsSeen"
    ],
):
  InducedContextSignature {
  const features:
    InducedContextFeatures = {
    historyLength,

    distinctActionsSeen,

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
  };

  return {
    key:
      JSON.stringify(
        features,
      ),

    features,
  };
}

const fitEvidence = [
  { history: "1" as const, distinct: "1" as const, useful: true },
  { history: "2" as const, distinct: "1" as const, useful: true },
  { history: "3+" as const, distinct: "3+" as const, useful: true },
  { history: "3+" as const, distinct: "3+" as const, useful: true },
  { history: "3+" as const, distinct: "1" as const, useful: false },
  { history: "3+" as const, distinct: "1" as const, useful: false },
];

const validationEvidence = [
  { history: "3+" as const, distinct: "2" as const, useful: true },
  { history: "3+" as const, distinct: "1" as const, useful: false },
  { history: "2" as const, distinct: "2" as const, useful: true },
];

function record(
  model:
    AdaptiveValidatedSymbolicPredicateApplicabilityModel,

  inputs:
    readonly {
      history:
        InducedContextFeatures[
          "historyLength"
        ];

      distinct:
        InducedContextFeatures[
          "distinctActionsSeen"
        ];

      useful:
        boolean;
    }[],
): void {
  for (
    const input of
      inputs
  ) {
    model.record({
      principleId:
        PRINCIPLE_ID,

      signature:
        signature(
          input.history,
          input.distinct,
        ),

      useful:
        input.useful,
    });
  }
}

function establishChampion(
  model:
    AdaptiveValidatedSymbolicPredicateApplicabilityModel,
): void {
  record(
    model,
    fitEvidence,
  );

  record(
    model,
    validationEvidence,
  );
}

function reverse(
  inputs:
    readonly {
      history:
        InducedContextFeatures[
          "historyLength"
        ];

      distinct:
        InducedContextFeatures[
          "distinctActionsSeen"
        ];

      useful:
        boolean;
    }[],
) {
  return inputs.map(
    (input) => ({
      ...input,

      useful:
        !input.useful,
    }),
  );
}

describe(
  "Mabojolu G adaptive challenger/champion predicate validation",
  () => {
    it(
      "keeps the first candidate inert until its own held-out reserve creates a champion",
      () => {
        const model =
          new AdaptiveValidatedSymbolicPredicateApplicabilityModel();

        record(
          model,
          fitEvidence,
        );

        expect(
          model.estimate(
            PRINCIPLE_ID,
            signature(
              "3+",
              "2",
            ),
          ),
        ).toBeUndefined();

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          status:
            "initial-validating",

          activeGeneration:
            1,

          replacementCount:
            0,

          totalObservationCount:
            6,
        });

        record(
          model,
          validationEvidence,
        );

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          status:
            "challenger-fitting",

          activeGeneration:
            2,

          championGeneration:
            1,

          replacementCount:
            0,

          completedGenerationCount:
            1,

          totalObservationCount:
            9,

          lastDecision:
            "initial-champion-accepted",
        });

        expect(
          model.estimate(
            PRINCIPLE_ID,
            signature(
              "3+",
              "2",
            ),
          ),
        ).toMatchObject({
          validation: {
            status:
              "validated",

            fitEvidenceCount:
              6,

            validationEvidenceCount:
              3,
          },

          adaptiveValidation: {
            championGeneration:
              1,

            activeGeneration:
              2,
          },
        });
      },
    );

    it(
      "does not replace a champion when a fresh challenger only ties it on the new reserve",
      () => {
        const model =
          new AdaptiveValidatedSymbolicPredicateApplicabilityModel();

        establishChampion(
          model,
        );

        record(
          model,
          fitEvidence,
        );

        record(
          model,
          validationEvidence,
        );

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          activeGeneration:
            3,

          championGeneration:
            1,

          replacementCount:
            0,

          completedGenerationCount:
            2,

          totalObservationCount:
            18,

          lastDecision:
            "challenger-not-better",

          lastIncumbentReserveAccuracy:
            1,

          lastChallengerReserveAccuracy:
            1,
        });
      },
    );

    it(
      "promotes a challenger under concept drift only after it beats the incumbent on a fresh reserve",
      () => {
        const model =
          new AdaptiveValidatedSymbolicPredicateApplicabilityModel();

        establishChampion(
          model,
        );

        expect(
          model.estimate(
            PRINCIPLE_ID,
            signature(
              "3+",
              "2",
            ),
          )
            ?.validation
            .predictsUsefulWhenPredicateIs,
        ).toBe(
          true,
        );

        record(
          model,
          reverse(
            fitEvidence,
          ),
        );

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          status:
            "challenger-validating",

          activeGeneration:
            2,

          championGeneration:
            1,
        });

        record(
          model,
          reverse(
            validationEvidence,
          ),
        );

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          activeGeneration:
            3,

          championGeneration:
            2,

          replacementCount:
            1,

          completedGenerationCount:
            2,

          totalObservationCount:
            18,

          lastDecision:
            "challenger-promoted",

          lastIncumbentReserveAccuracy:
            0,

          lastChallengerReserveAccuracy:
            1,
        });

        const after =
          model.estimate(
            PRINCIPLE_ID,
            signature(
              "3+",
              "2",
            ),
          );

        expect(
          after
            ?.validation
            .predictsUsefulWhenPredicateIs,
        ).toBe(
          false,
        );

        expect(
          after
            ?.applicability,
        ).toBeLessThan(
          0.5,
        );
      },
    );

    it(
      "keeps the incumbent when a challenger fails its own held-out validation",
      () => {
        const model =
          new AdaptiveValidatedSymbolicPredicateApplicabilityModel();

        establishChampion(
          model,
        );

        record(
          model,
          fitEvidence,
        );

        record(
          model,
          [
            { history: "3+" as const, distinct: "2" as const, useful: false },
            { history: "3+" as const, distinct: "1" as const, useful: true },
            { history: "2" as const, distinct: "2" as const, useful: true },
          ],
        );

        expect(
          model
            .getAdaptiveValidationSummary(
              PRINCIPLE_ID,
            ),
        ).toMatchObject({
          activeGeneration:
            3,

          championGeneration:
            1,

          replacementCount:
            0,

          completedGenerationCount:
            2,

          totalObservationCount:
            18,

          lastDecision:
            "challenger-rejected",
        });

        expect(
          model
            .getValidationSummary(
              PRINCIPLE_ID,
            )
            .status,
        ).toBe(
          "validated",
        );
      },
    );
  },
);

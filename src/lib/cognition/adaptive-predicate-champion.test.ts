import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AdaptiveValidatedPredicateApplicabilityModel,
} from "./adaptive-predicate-champion";

import type {
  InducedContextFeatures,
  InducedContextSignature,
} from "./principle-context-signature";

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

function record(
  model:
    AdaptiveValidatedPredicateApplicabilityModel,

  history:
    InducedContextFeatures[
      "historyLength"
    ],

  distinct:
    InducedContextFeatures[
      "distinctActionsSeen"
    ],

  useful:
    boolean,
): void {
  model.record({
    principleId:
      "principle-a",

    signature:
      signature(
        history,
        distinct,
      ),

    useful,
  });
}

function bootstrapChampion(
  model:
    AdaptiveValidatedPredicateApplicabilityModel,
): void {
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
          "2" as const,

        distinct:
          "1" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "3+" as const,

        useful:
          true,
      },

      {
        history:
          "3+" as const,

        distinct:
          "3+" as const,

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
          "3+" as const,

        distinct:
          "1" as const,

        useful:
          false,
      },
    ]
  ) {
    record(
      model,
      input.history,
      input.distinct,
      input.useful,
    );
  }

  for (
    const input of [
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
    record(
      model,
      input.history,
      input.distinct,
      input.useful,
    );
  }
}

function triggerDrift(
  model:
    AdaptiveValidatedPredicateApplicabilityModel,
): void {
  for (
    const input of [
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
          "3+" as const,

        distinct:
          "2" as const,

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
    record(
      model,
      input.history,
      input.distinct,
      input.useful,
    );
  }
}

function recordChallengerFit(
  model:
    AdaptiveValidatedPredicateApplicabilityModel,
): void {
  for (
    const input of [
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
          "3+" as const,

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
          "3+" as const,

        useful:
          false,
      },
    ]
  ) {
    record(
      model,
      input.history,
      input.distinct,
      input.useful,
    );
  }
}

describe(
  "Mabojolu G fresh-reserve challenger champion predicate adaptation",
  () => {
    it(
      "keeps a frozen bootstrap candidate out of selection until validation completes",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

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
                "2" as const,

              distinct:
                "1" as const,

              useful:
                true,
            },

            {
              history:
                "3+" as const,

              distinct:
                "3+" as const,

              useful:
                true,
            },

            {
              history:
                "3+" as const,

              distinct:
                "3+" as const,

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
                "3+" as const,

              distinct:
                "1" as const,

              useful:
                false,
            },
          ]
        ) {
          record(
            model,
            input.history,
            input.distinct,
            input.useful,
          );
        }

        expect(
          model.getSummary(
            "principle-a",
          )
            .phase,
        ).toBe(
          "bootstrap-validation",
        );

        expect(
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "2",
            ),
          ),
        ).toBeUndefined();

        record(
          model,
          "3+",
          "2",
          true,
        );

        expect(
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "2",
            ),
          ),
        ).toBeUndefined();
      },
    );

    it(
      "bootstraps a validated champion without reusing bootstrap holdout as applicability evidence",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

        bootstrapChampion(
          model,
        );

        expect(
          model.getSummary(
            "principle-a",
          ),
        ).toMatchObject({
          phase:
            "champion",

          championGeneration:
            1,

          replacementCount:
            0,

          bootstrapFitEvidenceCount:
            6,

          bootstrapValidationEvidenceCount:
            3,

          championOperationalEvidenceCount:
            0,

          lastChampionValidationAccuracy:
            1,

          lastValidationBaselineAccuracy:
            2 / 3,
        });

        const estimate =
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "2",
            ),
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
            ?.evidenceCount,
        ).toBe(4);

        expect(
          estimate
            ?.successes,
        ).toBe(4);
      },
    );

    it(
      "detects champion drift without reusing the trigger window as challenger fitting data",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

        bootstrapChampion(
          model,
        );

        triggerDrift(
          model,
        );

        const summary =
          model.getSummary(
            "principle-a",
          );

        expect(
          summary,
        ).toMatchObject({
          phase:
            "challenger-fit",

          championGeneration:
            1,

          championOperationalEvidenceCount:
            3,

          lastDriftTriggerEvidenceCount:
            3,

          lastDriftTriggerAccuracy:
            0,

          challengerFitEvidenceCount:
            0,

          challengerValidationEvidenceCount:
            0,
        });

        expect(
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "1",
            ),
          )
            ?.program
            .operator,
        ).toBe(
          "absolute-difference-at-most",
        );
      },
    );

    it(
      "replaces the champion only after a fresh challenger beats champion and baseline on fresh holdout",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

        bootstrapChampion(
          model,
        );

        triggerDrift(
          model,
        );

        recordChallengerFit(
          model,
        );

        expect(
          model.getSummary(
            "principle-a",
          ),
        ).toMatchObject({
          phase:
            "challenger-validation",

          championGeneration:
            1,

          challengerFitEvidenceCount:
            6,

          challengerValidationEvidenceCount:
            0,
        });

        for (
          const input of [
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
                "3+" as const,

              distinct:
                "2" as const,

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
          record(
            model,
            input.history,
            input.distinct,
            input.useful,
          );
        }

        expect(
          model.getSummary(
            "principle-a",
          ),
        ).toMatchObject({
          phase:
            "champion",

          championGeneration:
            2,

          replacementCount:
            1,

          championOperationalEvidenceCount:
            0,

          challengerFitEvidenceCount:
            0,

          challengerValidationEvidenceCount:
            0,

          lastChallengerValidationAccuracy:
            1,

          lastChampionValidationAccuracy:
            0,

          lastValidationBaselineAccuracy:
            2 / 3,

          lastReplacementDecision:
            "replaced",
        });

        const estimate =
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "1",
            ),
          );

        expect(
          estimate
            ?.program,
        ).toMatchObject({
          operator:
            "difference-equals",

          parameter:
            2,
        });

        expect(
          estimate
            ?.projection
            .predicateValue,
        ).toBe(true);

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
      },
    );

    it(
      "retains the incumbent when the challenger loses the fresh validation comparison",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

        bootstrapChampion(
          model,
        );

        triggerDrift(
          model,
        );

        recordChallengerFit(
          model,
        );

        for (
          const input of [
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
                "2" as const,

              useful:
                true,
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
          record(
            model,
            input.history,
            input.distinct,
            input.useful,
          );
        }

        expect(
          model.getSummary(
            "principle-a",
          ),
        ).toMatchObject({
          phase:
            "champion",

          championGeneration:
            1,

          replacementCount:
            0,

          lastChallengerValidationAccuracy:
            0,

          lastChampionValidationAccuracy:
            1,

          lastValidationBaselineAccuracy:
            2 / 3,

          lastReplacementDecision:
            "retained",

          lastRejectionReason:
            "challenger-validation-failed",
        });

        expect(
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "2",
            ),
          )
            ?.program,
        ).toMatchObject({
          operator:
            "absolute-difference-at-most",

          parameter:
            1,
        });
      },
    );
  },
);

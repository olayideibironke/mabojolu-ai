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


function promoteChallenger(
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

function triggerReturnToBootstrapRegime(
  model:
    AdaptiveValidatedPredicateApplicabilityModel,
): void {
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
          "2" as const,

        distinct:
          "2" as const,

        useful:
          true,
      },

      {
        history:
          "1" as const,

        distinct:
          "1" as const,

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
      "requires posterior confidence before treating low recent accuracy as drift",
      () => {
        const model =
          new AdaptiveValidatedPredicateApplicabilityModel();

        bootstrapChampion(
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
                "1" as const,

              distinct:
                "1" as const,

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

        const ambiguous =
          model.getSummary(
            "principle-a",
          );

        expect(
          ambiguous,
        ).toMatchObject({
          phase:
            "champion",

          driftWindowEvidenceCount:
            3,

          driftWindowAccuracy:
            1 / 3,

          driftConfidenceThreshold:
            0.9,
        });

        expect(
          ambiguous
            .driftPosteriorProbability,
        ).toBeCloseTo(
          11 / 16,
        );

        for (
          let index =
            0;
          index <
            2;
          index +=
            1
        ) {
          record(
            model,
            "2",
            "2",
            false,
          );
        }

        const stillChampion =
          model.getSummary(
            "principle-a",
          );

        expect(
          stillChampion.phase,
        ).toBe(
          "champion",
        );

        expect(
          stillChampion
            .driftPosteriorProbability,
        ).toBeCloseTo(
          57 / 64,
        );

        record(
          model,
          "2",
          "2",
          false,
        );

        const triggered =
          model.getSummary(
            "principle-a",
          );

        expect(
          triggered,
        ).toMatchObject({
          phase:
            "challenger-fit",

          lastDriftTriggerEvidenceCount:
            6,

          lastDriftTriggerAccuracy:
            1 / 6,

          driftConfidenceThreshold:
            0.9,

          challengerFitEvidenceCount:
            0,
        });

        expect(
          triggered
            .lastDriftTriggerPosteriorProbability,
        ).toBeCloseTo(
          15 / 16,
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
            ?.adaptation,
        ).toMatchObject({
          championGeneration:
            2,

          championPredictsUsefulWhenPredicateIs:
            false,
        });

        expect(
          estimate
            ?.projection
            .predicateValue,
        ).toBe(false);

        expect(
          estimate
            ?.projection
            .predicateValue,
        ).toBe(
          estimate
            ?.adaptation
            .championPredictsUsefulWhenPredicateIs,
        );

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

    it(
      "recalls a previously validated regime after the environment returns without relearning it",
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

        promoteChallenger(
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
            2,

          replacementCount:
            1,

          archivedChampionCount:
            1,

          rollbackCount:
            0,
        });

        triggerReturnToBootstrapRegime(
          model,
        );

        expect(
          model.getSummary(
            "principle-a",
          ),
        ).toMatchObject({
          phase:
            "regime-recall-validation",

          championGeneration:
            2,

          archivedChampionCount:
            1,

          regimeRecallValidationEvidenceCount:
            0,
        });

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
            1,

          archivedChampionCount:
            1,

          rollbackCount:
            1,

          regimeRecallValidationEvidenceCount:
            0,

          lastRegimeRecallAccuracy:
            1,

          lastRegimeRecallGeneration:
            1,

          lastRegimeRecallDecision:
            "rolled-back",

          championOperationalEvidenceCount:
            0,
        });

        expect(
          model.estimate(
            "principle-a",
            signature(
              "3+",
              "2",
            ),
          )
            ?.adaptation
            .championPredictsUsefulWhenPredicateIs,
        ).toBe(true);
      },
    );

    it(
      "rejects regime recall when an archived champion does not beat the fresh majority baseline",
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

        promoteChallenger(
          model,
        );

        triggerReturnToBootstrapRegime(
          model,
        );

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
                "2" as const,

              distinct:
                "2" as const,

              useful:
                true,
            },

            {
              history:
                "1" as const,

              distinct:
                "1" as const,

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
            "challenger-fit",

          championGeneration:
            2,

          rollbackCount:
            0,

          lastRegimeRecallAccuracy:
            1,

          lastRegimeRecallGeneration:
            1,

          lastRegimeRecallDecision:
            "no-match",

          challengerFitEvidenceCount:
            0,

          regimeRecallValidationEvidenceCount:
            0,
        });
      },
    );

  },
);

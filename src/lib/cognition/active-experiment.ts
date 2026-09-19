export interface ExperimentHypothesis {
  id: string;

  /**
   * Prior or posterior probability mass assigned to this hypothesis.
   */
  confidence: number;

  /**
   * Predicted observable outcome for each action the hypothesis can evaluate.
   *
   * Outcomes are symbolic public summaries, not hidden reasoning.
   */
  predictions:
    Record<
      string,
      string
    >;
}

export interface ExperimentChoice {
  action: string;

  informationGain:
    number;

  priorEntropy:
    number;

  expectedPosteriorEntropy:
    number;

  predictedOutcomes:
    string[];
}

export interface HypothesisUpdate {
  hypotheses:
    ExperimentHypothesis[];

  contradiction:
    boolean;

  eliminatedHypothesisIds:
    string[];
}

const EPSILON =
  1e-12;

function normalized(
  hypotheses:
    readonly ExperimentHypothesis[],
): ExperimentHypothesis[] {
  const usable =
    hypotheses.filter(
      (hypothesis) =>
        Number.isFinite(
          hypothesis.confidence,
        ) &&
        hypothesis.confidence >
          0,
    );

  const total =
    usable.reduce(
      (
        sum,
        hypothesis,
      ) =>
        sum +
        hypothesis.confidence,
      0,
    );

  if (
    total <= 0
  ) {
    return [];
  }

  return usable.map(
    (hypothesis) => ({
      ...hypothesis,

      confidence:
        hypothesis.confidence /
        total,

      predictions: {
        ...hypothesis
          .predictions,
      },
    }),
  );
}

function entropy(
  hypotheses:
    readonly ExperimentHypothesis[],
): number {
  return hypotheses.reduce(
    (
      total,
      hypothesis,
    ) => {
      const probability =
        hypothesis.confidence;

      if (
        probability <= 0
      ) {
        return total;
      }

      return (
        total -
        probability *
          Math.log2(
            probability,
          )
      );
    },
    0,
  );
}

function outcomeGroups(
  hypotheses:
    readonly ExperimentHypothesis[],

  action:
    string,
): Map<
  string,
  ExperimentHypothesis[]
> | undefined {
  const groups =
    new Map<
      string,
      ExperimentHypothesis[]
    >();

  for (
    const hypothesis of
      hypotheses
  ) {
    const outcome =
      hypothesis
        .predictions[
          action
        ];

    if (
      outcome ===
      undefined
    ) {
      return undefined;
    }

    const existing =
      groups.get(
        outcome,
      ) ?? [];

    existing.push(
      hypothesis,
    );

    groups.set(
      outcome,
      existing,
    );
  }

  return groups;
}

/**
 * Mabojolu G Active Experiment Designer v0.1.
 *
 * Given explicit competing hypotheses and their observable predictions, choose
 * the available action with maximum expected Shannon information gain.
 *
 * The module is deterministic:
 *
 * - hypotheses are normalized before evaluation;
 * - actions with incomplete predictions are ignored;
 * - zero-information actions are rejected;
 * - equal-information ties are broken lexicographically.
 *
 * This is epistemic action selection rather than goal-directed planning: the
 * chosen action is valuable because of what its outcome can teach Mabojolu.
 */
export class ActiveExperimentDesigner {
  selectExperiment(input: {
    hypotheses:
      readonly ExperimentHypothesis[];

    availableActions:
      readonly string[];
  }):
    ExperimentChoice |
    undefined {
    const hypotheses =
      normalized(
        input.hypotheses,
      );

    if (
      hypotheses.length <
      2
    ) {
      return undefined;
    }

    const priorEntropy =
      entropy(
        hypotheses,
      );

    const actions =
      Array.from(
        new Set(
          input.availableActions,
        ),
      ).sort();

    let best:
      ExperimentChoice |
      undefined;

    for (
      const action of
        actions
    ) {
      const groups =
        outcomeGroups(
          hypotheses,
          action,
        );

      if (
        !groups ||
        groups.size <
          2
      ) {
        continue;
      }

      let expectedPosteriorEntropy =
        0;

      for (
        const group of
          groups.values()
      ) {
        const outcomeProbability =
          group.reduce(
            (
              sum,
              hypothesis,
            ) =>
              sum +
              hypothesis
                .confidence,
            0,
          );

        const posterior =
          normalized(
            group,
          );

        expectedPosteriorEntropy +=
          outcomeProbability *
          entropy(
            posterior,
          );
      }

      const informationGain =
        priorEntropy -
        expectedPosteriorEntropy;

      if (
        informationGain <=
        EPSILON
      ) {
        continue;
      }

      const candidate:
        ExperimentChoice = {
        action,

        informationGain,

        priorEntropy,

        expectedPosteriorEntropy,

        predictedOutcomes:
          Array.from(
            groups.keys(),
          ).sort(),
      };

      if (
        !best ||
        candidate
          .informationGain >
          best.informationGain +
            EPSILON ||
        (
          Math.abs(
            candidate
              .informationGain -
            best.informationGain,
          ) <=
            EPSILON &&
          candidate.action <
            best.action
        )
      ) {
        best =
          candidate;
      }
    }

    return best;
  }

  updateHypotheses(input: {
    hypotheses:
      readonly ExperimentHypothesis[];

    action: string;

    observedOutcome:
      string;
  }):
    HypothesisUpdate {
    const hypotheses =
      normalized(
        input.hypotheses,
      );

    const surviving =
      hypotheses.filter(
        (hypothesis) =>
          hypothesis
            .predictions[
              input.action
            ] ===
          input.observedOutcome,
      );

    const survivingIds =
      new Set(
        surviving.map(
          (hypothesis) =>
            hypothesis.id,
        ),
      );

    const eliminatedHypothesisIds =
      hypotheses
        .filter(
          (hypothesis) =>
            !survivingIds.has(
              hypothesis.id,
            ),
        )
        .map(
          (hypothesis) =>
            hypothesis.id,
        );

    if (
      surviving.length ===
      0
    ) {
      return {
        hypotheses: [],

        contradiction:
          true,

        eliminatedHypothesisIds,
      };
    }

    return {
      hypotheses:
        normalized(
          surviving,
        ),

      contradiction:
        false,

      eliminatedHypothesisIds,
    };
  }
}

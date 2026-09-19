import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ActiveExperimentDesigner,
  type ExperimentHypothesis,
} from "./active-experiment";

function hypotheses():
  ExperimentHypothesis[] {
  return [
    {
      id: "h1",
      confidence: 0.5,
      predictions: {
        A: "left",
        B: "same",
      },
    },
    {
      id: "h2",
      confidence: 0.5,
      predictions: {
        A: "right",
        B: "same",
      },
    },
  ];
}

describe(
  "Mabojolu G active experiment designer",
  () => {
    it(
      "selects the action that best distinguishes competing hypotheses",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const choice =
          designer.selectExperiment({
            hypotheses:
              hypotheses(),

            availableActions: [
              "A",
              "B",
            ],
          });

        expect(
          choice,
        ).toBeDefined();

        expect(
          choice?.action,
        ).toBe("A");

        expect(
          choice
            ?.informationGain,
        ).toBeCloseTo(1);

        expect(
          choice
            ?.expectedPosteriorEntropy,
        ).toBeCloseTo(0);
      },
    );

    it(
      "refuses actions that provide no information",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const choice =
          designer.selectExperiment({
            hypotheses:
              hypotheses(),

            availableActions: [
              "B",
            ],
          });

        expect(
          choice,
        ).toBeUndefined();
      },
    );

    it(
      "updates the posterior by eliminating hypotheses contradicted by observation",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const update =
          designer.updateHypotheses({
            hypotheses:
              hypotheses(),

            action: "A",

            observedOutcome:
              "left",
          });

        expect(
          update.contradiction,
        ).toBe(false);

        expect(
          update
            .hypotheses
            .map(
              (hypothesis) =>
                hypothesis.id,
            ),
        ).toEqual([
          "h1",
        ]);

        expect(
          update
            .hypotheses[0]
            ?.confidence,
        ).toBe(1);

        expect(
          update
            .eliminatedHypothesisIds,
        ).toEqual([
          "h2",
        ]);
      },
    );

    it(
      "reports a contradiction when reality matches none of the active hypotheses",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const update =
          designer.updateHypotheses({
            hypotheses:
              hypotheses(),

            action: "A",

            observedOutcome:
              "unexpected",
          });

        expect(
          update.contradiction,
        ).toBe(true);

        expect(
          update.hypotheses,
        ).toEqual([]);

        expect(
          update
            .eliminatedHypothesisIds,
        ).toEqual([
          "h1",
          "h2",
        ]);
      },
    );

    it(
      "uses weighted uncertainty instead of treating unequal hypotheses as equally likely",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const choice =
          designer.selectExperiment({
            hypotheses: [
              {
                id: "h1",
                confidence: 0.8,
                predictions: {
                  A: "one",
                  B: "common",
                },
              },
              {
                id: "h2",
                confidence: 0.1,
                predictions: {
                  A: "two",
                  B: "common",
                },
              },
              {
                id: "h3",
                confidence: 0.1,
                predictions: {
                  A: "two",
                  B: "rare",
                },
              },
            ],

            availableActions: [
              "A",
              "B",
            ],
          });

        expect(
          choice?.action,
        ).toBe("A");

        expect(
          choice
            ?.informationGain,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "breaks equal-information ties deterministically",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const choice =
          designer.selectExperiment({
            hypotheses: [
              {
                id: "h1",
                confidence: 0.5,
                predictions: {
                  A: "yes",
                  B: "yes",
                },
              },
              {
                id: "h2",
                confidence: 0.5,
                predictions: {
                  A: "no",
                  B: "no",
                },
              },
            ],

            availableActions: [
              "B",
              "A",
            ],
          });

        expect(
          choice?.action,
        ).toBe("A");
      },
    );

    it(
      "ignores actions lacking complete predictions across the active hypothesis set",
      () => {
        const designer =
          new ActiveExperimentDesigner();

        const choice =
          designer.selectExperiment({
            hypotheses: [
              {
                id: "h1",
                confidence: 0.5,
                predictions: {
                  A: "yes",
                },
              },
              {
                id: "h2",
                confidence: 0.5,
                predictions: {
                  B: "no",
                },
              },
            ],

            availableActions: [
              "A",
              "B",
            ],
          });

        expect(
          choice,
        ).toBeUndefined();
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ActiveCausalCorrespondenceLearner,
  chooseTransferredPlanningAction,
  generateCausalCorrespondenceHypotheses,
  simulateCausalExperimentObservation,
  type CausalCorrespondenceExperiment,
} from "./active-causal-correspondence";

import type {
  RepresentationPrimitive,
} from "./representation-synthesis";

const VARIABLES = [
  "demandShock",
  "forecastUncertainty",
  "holidayIndex",
  "queuePressure",
  "sensorNoise",
] as const;

const TRUE_VARIABLE_SET = [
  "demandShock",
  "forecastUncertainty",
  "queuePressure",
] as const;

const EXPERIMENTS:
  readonly CausalCorrespondenceExperiment[] = [
    {
      id:
        "unsafe-triple",

      variables: [
        "demandShock",
        "forecastUncertainty",
        "queuePressure",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
    {
      id:
        "pair-core",

      variables: [
        "demandShock",
        "forecastUncertainty",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "pair-holiday",

      variables: [
        "demandShock",
        "holidayIndex",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.06,

      reversible:
        true,
    },
    {
      id:
        "pair-queue",

      variables: [
        "demandShock",
        "queuePressure",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.07,

      reversible:
        true,
    },
    {
      id:
        "pair-sensor",

      variables: [
        "demandShock",
        "sensorNoise",
      ],

      interventionMagnitude:
        0.3,

      risk:
        0.2,

      cost:
        0.08,

      reversible:
        true,
    },
    ...VARIABLES.map(
      (
        variable,
        index,
      ) => ({
        id:
          `single-${variable}`,

        variables: [
          variable,
        ],

        interventionMagnitude:
          0.3,

        risk:
          0.1,

        cost:
          0.2 +
          index *
            0.01,

        reversible:
          true,
      }),
    ),
  ];

function learner():
  ActiveCausalCorrespondenceLearner {
  return new ActiveCausalCorrespondenceLearner(
    generateCausalCorrespondenceHypotheses(
      VARIABLES,
      3,
    ),
    3,
  );
}

describe(
  "ActiveCausalCorrespondenceLearner",
  () => {
    it(
      "starts with ten structural hypotheses over five variables",
      () => {
        const hypotheses =
          generateCausalCorrespondenceHypotheses(
            VARIABLES,
            3,
          );

        expect(
          hypotheses,
        ).toHaveLength(
          10,
        );

        expect(
          new Set(
            hypotheses.map(
              (hypothesis) =>
                hypothesis
                  .variableSet
                  .join("|"),
            ),
          ).size,
        ).toBe(
          10,
        );
      },
    );

    it(
      "blocks the unsafe highest-information intervention and selects the safest useful pair probe",
      () => {
        const active =
          learner();

        const choice =
          active.chooseExperiment(
            EXPERIMENTS,
          );

        expect(
          choice,
        ).toMatchObject({
          decision:
            "experiment",

          experiment: {
            id:
              "pair-core",
          },

          reason:
            "informative-safe-experiment",
        });

        expect(
          choice
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.85,
        );

        expect(
          active
            .getAuditSummary()
            .blockedExperimentIds,
        ).toContain(
          "unsafe-triple",
        );
      },
    );

    it(
      "resolves the hidden correspondence through sequential safe causal experiments",
      () => {
        const active =
          learner();

        const chosenIds:
          string[] =
            [];

        for (
          let step =
            0;
          step <
            4;
          step +=
            1
        ) {
          const resolution =
            active.resolve();

          if (
            resolution.decision ===
              "resolved"
          ) {
            break;
          }

          const choice =
            active.chooseExperiment(
              EXPERIMENTS,
            );

          expect(
            choice.decision,
          ).toBe(
            "experiment",
          );

          const experiment =
            choice.experiment!;

          chosenIds.push(
            experiment.id,
          );

          active.recordObservation(
            experiment,
            simulateCausalExperimentObservation(
              TRUE_VARIABLE_SET,
              experiment,
              3,
            ),
          );
        }

        expect(
          chosenIds,
        ).toEqual([
          "pair-core",
          "pair-holiday",
          "pair-queue",
        ]);

        const resolution =
          active.resolve();

        expect(
          resolution,
        ).toMatchObject({
          decision:
            "resolved",

          variableSet: [
            "demandShock",
            "forecastUncertainty",
            "queuePressure",
          ],

          belief: {
            confidence:
              1,

            margin:
              1,

            sufficientlyCertain:
              true,
          },
        });
      },
    );

    it(
      "refuses observations inconsistent with every surviving causal hypothesis",
      () => {
        const active =
          learner();

        const choice =
          active.chooseExperiment(
            EXPERIMENTS,
          );

        expect(
          () =>
            active.recordObservation(
              choice.experiment!,
              {
                experimentId:
                  choice
                    .experiment!
                    .id,

                measuredEffect:
                  0.123456,
              },
            ),
        ).toThrow(
          /inconsistent with every active correspondence hypothesis/,
        );
      },
    );

    it(
      "abstains when every informative experiment is unsafe",
      () => {
        const active =
          learner();

        const choice =
          active.chooseExperiment([
            {
              id:
                "unsafe-only",

              variables: [
                "demandShock",
                "forecastUncertainty",
                "queuePressure",
              ],

              interventionMagnitude:
                0.3,

              risk:
                0.9,

              cost:
                0,

              reversible:
                false,
            },
          ]);

        expect(
          choice,
        ).toMatchObject({
          decision:
            "abstained",

          expectedInformationGain:
            0,

          reason:
            "no-safe-informative-experiment",
        });
      },
    );
  },
);

describe(
  "transferred causal planning",
  () => {
    it(
      "uses the resolved structural mapping to choose the cheapest safe goal-reaching action",
      () => {
        const primitive:
          RepresentationPrimitive = {
          id:
            "mean(signal-a,signal-b,signal-c)",

          operator:
            "mean",

          roles: [
            "signal-a",
            "signal-b",
            "signal-c",
          ],

          complexity:
            3,
        };

        const decision =
          chooseTransferredPlanningAction(
            primitive,
            0.5,
            TRUE_VARIABLE_SET,
            {
              demandShock:
                0.4,

              forecastUncertainty:
                0.4,

              queuePressure:
                0.4,

              holidayIndex:
                0.1,

              sensorNoise:
                0.1,
            },
            [
              {
                id:
                  "cheap-nuisance",

                variable:
                  "holidayIndex",

                delta:
                  0.6,

                cost:
                  0.01,

                risk:
                  0.05,

                reversible:
                  true,
              },
              {
                id:
                  "raise-demand",

                variable:
                  "demandShock",

                delta:
                  0.4,

                cost:
                  0.2,

                risk:
                  0.1,

                reversible:
                  true,
              },
              {
                id:
                  "raise-forecast",

                variable:
                  "forecastUncertainty",

                delta:
                  0.4,

                cost:
                  0.3,

                risk:
                  0.1,

                reversible:
                  true,
              },
              {
                id:
                  "unsafe-queue",

                variable:
                  "queuePressure",

                delta:
                  0.4,

                cost:
                  0.05,

                risk:
                  0.8,

                reversible:
                  false,
              },
            ],
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          action: {
            id:
              "raise-demand",
          },

          reason:
            "safe-goal-reaching-action",
        });

        expect(
          decision
            .projectedRepresentationValue,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );
  },
);

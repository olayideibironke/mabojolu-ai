import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProbabilisticCausalWorldModel,
  chooseProbabilisticActionPlan,
  predictMechanismEffect,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

const MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "mechanism-1",

      effects: {
        x:
          0.2,
        y:
          0.2,
        z:
          0.2,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "mechanism-2",

      effects: {
        x:
          0.2,
        y:
          0.8,
        z:
          0.5,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "mechanism-3",

      effects: {
        x:
          0.8,
        y:
          0.2,
        z:
          0.8,
      },

      observationStdDev:
        0.05,
    },
  ];

const EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "direct-z",

      interventions: {
        z:
          1,
      },

      risk:
        0.2,

      cost:
        0.5,

      reversible:
        true,
    },
    {
      id:
        "cheap-x",

      interventions: {
        x:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "cheap-y",

      interventions: {
        y:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "unsafe-all",

      interventions: {
        x:
          1,
        y:
          1,
        z:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

function experiment(
  id:
    string,
): WorldModelExperiment {
  const found =
    EXPERIMENTS.find(
      (candidate) =>
        candidate.id ===
        id,
    );

  if (
    !found
  ) {
    throw new Error(
      `Missing test experiment ${id}`,
    );
  }

  return found;
}

describe(
  "ProbabilisticCausalWorldModel",
  () => {
    it(
      "prefers an expensive direct probe under one-step information planning",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        const plan =
          model.chooseMyopicExperiment(
            EXPERIMENTS,
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "plan",

          experimentIds: [
            "direct-z",
          ],

          totalCost:
            0.5,

          reason:
            "safe-information-plan",
        });

        expect(
          plan
            .expectedInformationGain,
        ).toBeGreaterThan(
          1.09,
        );
      },
    );

    it(
      "uses two-step lookahead to prefer two cheap complementary probes",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        const plan =
          model.chooseExperimentSequence(
            EXPERIMENTS,
            2,
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "plan",

          experimentIds: [
            "cheap-x",
            "cheap-y",
          ],

          totalCost:
            0.1,

          maximumRisk:
            0.1,

          reason:
            "safe-information-plan",
        });

        expect(
          plan.score,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          model
            .getAuditSummary()
            .blockedExperimentIds,
        ).toContain(
          "unsafe-all",
        );
      },
    );

    it(
      "updates mechanism probabilities smoothly under noisy observations",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        model.recordObservation(
          experiment(
            "cheap-x",
          ),
          {
            experimentId:
              "cheap-x",

            measuredEffect:
              0.22,
          },
        );

        const afterFirst =
          model.getBelief();

        expect(
          afterFirst
            .probabilities[
              "mechanism-1"
            ],
        ).toBeCloseTo(
          0.5,
        );

        expect(
          afterFirst
            .probabilities[
              "mechanism-2"
            ],
        ).toBeCloseTo(
          0.5,
        );

        expect(
          afterFirst
            .probabilities[
              "mechanism-3"
            ],
        ).toBeGreaterThan(
          0,
        );

        model.recordObservation(
          experiment(
            "cheap-y",
          ),
          {
            experimentId:
              "cheap-y",

            measuredEffect:
              0.185,
          },
        );

        const afterSecond =
          model.getBelief();

        expect(
          afterSecond
            .topMechanismId,
        ).toBe(
          "mechanism-1",
        );

        expect(
          afterSecond
            .confidence,
        ).toBeGreaterThan(
          0.999999,
        );

        expect(
          afterSecond
            .normalizedEntropy,
        ).toBeLessThan(
          1e-6,
        );
      },
    );

    it(
      "refuses to record an unsafe irreversible experiment",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        expect(
          () =>
            model.recordObservation(
              experiment(
                "unsafe-all",
              ),
              {
                experimentId:
                  "unsafe-all",

                measuredEffect:
                  1.2,
              },
            ),
        ).toThrow(
          /unsafe or irreversible world-model experiment/,
        );
      },
    );

    it(
      "predicts mechanism effects from intervention structure",
      () => {
        expect(
          predictMechanismEffect(
            MECHANISMS[
              1
            ]!,
            {
              x:
                0.5,
              y:
                0.25,
            },
          ),
        ).toBeCloseTo(
          0.3,
        );
      },
    );
  },
);

describe(
  "probabilistic multi-step planning",
  () => {
    const ACTIONS:
      readonly WorldModelAction[] = [
        {
          id:
            "boost-x",

          interventions: {
            x:
              1,
          },

          risk:
            0.1,

          cost:
            0.1,

          reversible:
            true,
        },
        {
          id:
            "boost-y",

          interventions: {
            y:
              1,
          },

          risk:
            0.1,

          cost:
            0.12,

          reversible:
            true,
        },
        {
          id:
            "nuisance-w",

          interventions: {
            w:
              1,
          },

          risk:
            0.05,

          cost:
            0.01,

          reversible:
            true,
        },
        {
          id:
            "unsafe-combo",

          interventions: {
            x:
              1,
            y:
              1,
          },

          risk:
            0.9,

          cost:
            0.02,

          reversible:
            false,
        },
      ];

    it(
      "abstains at horizon one when no safe single action can meet the robust goal threshold",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        model.recordObservation(
          experiment(
            "cheap-x",
          ),
          {
            experimentId:
              "cheap-x",

            measuredEffect:
              0.22,
          },
        );

        model.recordObservation(
          experiment(
            "cheap-y",
          ),
          {
            experimentId:
              "cheap-y",

            measuredEffect:
              0.185,
          },
        );

        const plan =
          chooseProbabilisticActionPlan(
            model.getMechanisms(),
            model.getProbabilityMap(),
            0.1,
            0.45,
            ACTIONS,
            {
              horizon:
                1,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "abstained",

          actionIds:
            [],

          reason:
            "no-safe-goal-plan",
        });
      },
    );

    it(
      "finds a safe two-action plan that reaches the goal across the posterior mechanism belief",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            MECHANISMS,
          );

        model.recordObservation(
          experiment(
            "cheap-x",
          ),
          {
            experimentId:
              "cheap-x",

            measuredEffect:
              0.22,
          },
        );

        model.recordObservation(
          experiment(
            "cheap-y",
          ),
          {
            experimentId:
              "cheap-y",

            measuredEffect:
              0.185,
          },
        );

        const plan =
          chooseProbabilisticActionPlan(
            model.getMechanisms(),
            model.getProbabilityMap(),
            0.1,
            0.45,
            ACTIONS,
            {
              horizon:
                2,

              minimumGoalSuccessProbability:
                0.9,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "plan",

          actionIds: [
            "boost-x",
            "boost-y",
          ],

          goalSuccessProbability:
            1,

          totalCost:
            0.22,

          maximumRisk:
            0.1,

          reason:
            "safe-probabilistic-goal-plan",
        });

        expect(
          plan
            .expectedFinalState,
        ).toBeGreaterThanOrEqual(
          0.5,
        );
      },
    );
  },
);

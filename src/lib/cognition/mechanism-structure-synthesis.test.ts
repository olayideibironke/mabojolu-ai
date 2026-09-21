import {
  describe,
  expect,
  it,
} from "vitest";

import {
  chooseDualControlDecision,
  predictStructuredMechanismEffect,
  selectValidatedStructuralChampion,
  synthesizeBoundedStructuralChallengers,
  type StructuredCausalMechanism,
  type StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import {
  ProbabilisticCausalWorldModel,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

const INCUMBENT:
  StructuredCausalMechanism = {
  id:
    "linear-incumbent",

  baseEffects: {
    x:
      0.2,
    y:
      0.2,
  },

  terms:
    [],

  observationStdDev:
    0.05,
};

function observation(
  id:
    string,

  x:
    number,

  y:
    number,

  measuredEffect:
    number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        x,
        y,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },

    measuredEffect,
  };
}

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "discover-xy-1",
      1,
      1,
      1,
    ),
    observation(
      "discover-xy-2",
      0.5,
      0.5,
      0.35,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-x",
      1,
      0,
      0.2,
    ),
    observation(
      "protected-y",
      0,
      1,
      0.2,
    ),
    observation(
      "protected-half",
      0.5,
      0.5,
      0.35,
    ),
    observation(
      "protected-xy",
      1,
      1,
      1,
    ),
  ];

describe(
  "bounded mechanism-structure synthesis",
  () => {
    it(
      "represents a learned pairwise interaction that the additive incumbent cannot express",
      () => {
        const interaction:
          StructuredCausalMechanism = {
          ...INCUMBENT,

          id:
            "interaction-model",

          terms: [
            {
              id:
                "interaction(x,y)",

              kind:
                "interaction",

              variables: [
                "x",
                "y",
              ],

              coefficient:
                0.6,
            },
          ],
        };

        expect(
          predictStructuredMechanismEffect(
            INCUMBENT,
            {
              x:
                1,
              y:
                1,
            },
          ),
        ).toBeCloseTo(
          0.4,
        );

        expect(
          predictStructuredMechanismEffect(
            interaction,
            {
              x:
                1,
              y:
                1,
            },
          ),
        ).toBeCloseTo(
          1,
        );
      },
    );

    it(
      "synthesizes an interaction challenger from discovery residuals",
      () => {
        const challengers =
          synthesizeBoundedStructuralChallengers(
            INCUMBENT,
            DISCOVERY,
            [
              "x",
              "y",
            ],
          );

        const interaction =
          challengers.find(
            (candidate) =>
              candidate
                .addedTerm
                .id ===
              "interaction(x,y)",
          );

        expect(
          interaction,
        ).toBeDefined();

        expect(
          interaction!
            .addedTerm
            .coefficient,
        ).toBeCloseTo(
          0.6,
        );

        expect(
          interaction!
            .discoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "promotes the interaction only after it beats simpler challengers on protected observations",
      () => {
        const challengers =
          synthesizeBoundedStructuralChallengers(
            INCUMBENT,
            DISCOVERY,
            [
              "x",
              "y",
            ],
          );

        const decision =
          selectValidatedStructuralChampion(
            INCUMBENT,
            challengers,
            PROTECTED,
          );

        expect(
          decision,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "linear-incumbent",

          reason:
            "validated-structural-challenger",
        });

        expect(
          decision
            .champion
            .terms,
        ).toHaveLength(
          1,
        );

        expect(
          decision
            .champion
            .terms[
              0
            ],
        ).toMatchObject({
          id:
            "interaction(x,y)",

          kind:
            "interaction",

          coefficient:
            0.6,
        });

        expect(
          decision
            .protectedMeanSquaredError,
        ).toBeCloseTo(
          0,
        );

        expect(
          decision
            .improvement,
        ).toBeGreaterThan(
          0.08,
        );
      },
    );

    it(
      "can propose a latent-bias term when residual effect exists without observed intervention support",
      () => {
        const challengers =
          synthesizeBoundedStructuralChallengers(
            {
              ...INCUMBENT,

              id:
                "zero-baseline",

              baseEffects: {
                x:
                  0,
              },
            },
            [
              {
                experiment: {
                  id:
                    "zero-input",

                  interventions: {
                    x:
                      0,
                  },

                  risk:
                    0.1,

                  cost:
                    0.05,

                  reversible:
                    true,
                },

                measuredEffect:
                  0.3,
              },
            ],
            [
              "x",
            ],
          );

        const bias =
          challengers.find(
            (candidate) =>
              candidate
                .addedTerm
                .kind ===
              "latent-bias",
          );

        expect(
          bias,
        ).toBeDefined();

        expect(
          bias!
            .addedTerm
            .coefficient,
        ).toBeCloseTo(
          0.3,
        );

        expect(
          bias!
            .discoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );
  },
);

const DUAL_MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "slow",

      effects: {
        x:
          0.2,
        z:
          0.2,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "fast",

      effects: {
        x:
          0.8,
        z:
          0.8,
      },

      observationStdDev:
        0.05,
    },
  ];

const DUAL_EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "probe-z",

      interventions: {
        z:
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
        "unsafe-perfect-probe",

      interventions: {
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

const DUAL_ACTIONS:
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
        "unsafe-boost",

      interventions: {
        x:
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

describe(
  "dual-control planning",
  () => {
    it(
      "experiments first when mechanism uncertainty is valuable for the goal decision",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            DUAL_MECHANISMS,
          );

        const decision =
          chooseDualControlDecision(
            model,
            0.1,
            0.7,
            DUAL_EXPERIMENTS,
            DUAL_ACTIONS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "probe-z",

          reason:
            "information-value-dominates",
        });

        expect(
          decision
            .experimentScore,
        ).toBeGreaterThan(
          decision
            .actionScore,
        );

        expect(
          decision
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.68,
        );
      },
    );

    it(
      "switches from experimentation to action after evidence concentrates the mechanism belief",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            DUAL_MECHANISMS,
          );

        model.recordObservation(
          DUAL_EXPERIMENTS[
            0
          ]!,
          {
            experimentId:
              "probe-z",

            measuredEffect:
              0.79,
          },
        );

        const decision =
          chooseDualControlDecision(
            model,
            0.1,
            0.7,
            DUAL_EXPERIMENTS,
            DUAL_ACTIONS,
          );

        expect(
          model
            .getBelief()
            .topMechanismId,
        ).toBe(
          "fast",
        );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "boost-x",

          reason:
            "goal-progress-dominates",
        });

        expect(
          decision
            .actionScore,
        ).toBeGreaterThan(
          decision
            .experimentScore,
        );

        expect(
          decision
            .goalSuccessProbability,
        ).toBeGreaterThan(
          0.999,
        );
      },
    );

    it(
      "stops without experimenting or acting when the goal is already satisfied",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            DUAL_MECHANISMS,
          );

        const decision =
          chooseDualControlDecision(
            model,
            0.8,
            0.7,
            DUAL_EXPERIMENTS,
            DUAL_ACTIONS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "goal-already-reached",
        });
      },
    );

    it(
      "abstains when every available experiment and action violates the safety boundary",
      () => {
        const model =
          new ProbabilisticCausalWorldModel(
            DUAL_MECHANISMS,
          );

        const decision =
          chooseDualControlDecision(
            model,
            0.1,
            0.7,
            [
              DUAL_EXPERIMENTS[
                1
              ]!,
            ],
            [
              DUAL_ACTIONS[
                1
              ]!,
            ],
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-useful-choice",
        });
      },
    );
  },
);

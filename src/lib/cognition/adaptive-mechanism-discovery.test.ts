import {
  describe,
  expect,
  it,
} from "vitest";

import {
  OnlineMechanismParameterLearner,
  chooseContingentExperimentPolicy,
  chooseRecedingHorizonDecision,
  evaluateMechanismFamilyAdequacy,
  proposeBoundedMechanismChallengers,
  selectValidatedMechanismChampion,
  type MechanismLearningObservation,
} from "./adaptive-mechanism-discovery";

import type {
  ProbabilisticCausalMechanism,
  WorldModelAction,
  WorldModelExperiment,
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

function singleExperiment(
  id:
    string,

  variable:
    string,
): WorldModelExperiment {
  return {
    id,

    interventions: {
      [
        variable
      ]:
        1,
    },

    risk:
      0.1,

    cost:
      0.05,

    reversible:
      true,
  };
}

describe(
  "online mechanism parameter learning",
  () => {
    it(
      "learns an intervention effect online from repeated noisy single-variable observations",
      () => {
        const learner =
          new OnlineMechanismParameterLearner([
            "x",
          ]);

        for (
          const [
            index,
            measuredEffect,
          ] of
            [
              0.68,
              0.72,
              0.7,
            ].entries()
        ) {
          learner.recordObservation({
            experiment:
              singleExperiment(
                `x-${index + 1}`,
                "x",
              ),

            measuredEffect,
          });
        }

        const summary =
          learner.getSummary();

        expect(
          summary
            .effects
            .x,
        ).toMatchObject({
          samples:
            3,
        });

        expect(
          summary
            .effects
            .x!
            .mean,
        ).toBeCloseTo(
          0.7,
        );

        expect(
          summary
            .effects
            .x!
            .sampleVariance,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "rejects multi-variable observations from the bounded single-effect learner",
      () => {
        const learner =
          new OnlineMechanismParameterLearner([
            "x",
            "y",
          ]);

        expect(
          () =>
            learner.recordObservation({
              experiment: {
                id:
                  "xy",

                interventions: {
                  x:
                    1,
                  y:
                    1,
                },

                risk:
                  0.1,

                cost:
                  0.1,

                reversible:
                  true,
              },

              measuredEffect:
                0.8,
            }),
        ).toThrow(
          /single-variable intervention/,
        );
      },
    );
  },
);

describe(
  "bounded mechanism discovery",
  () => {
    const discoveryObservation:
      MechanismLearningObservation = {
      experiment:
        singleExperiment(
          "discovery-x",
          "x",
        ),

      measuredEffect:
        0.72,
    };

    it(
      "detects when every incumbent mechanism has poor predictive fit",
      () => {
        const incumbents = [
          {
            id:
              "low-x",

            effects: {
              x:
                0.2,
            },

            observationStdDev:
              0.05,
          },
          {
            id:
              "mid-x",

            effects: {
              x:
                0.4,
            },

            observationStdDev:
              0.05,
          },
        ];

        const adequacy =
          evaluateMechanismFamilyAdequacy(
            incumbents,
            [
              discoveryObservation,
            ],
            0.5,
          );

        expect(
          adequacy.adequate,
        ).toBe(
          false,
        );

        expect(
          adequacy
            .bestMeanLikelihood,
        ).toBeLessThan(
          0.001,
        );
      },
    );

    it(
      "proposes bounded challengers from the discrepant intervention without mutating incumbents",
      () => {
        const incumbents = [
          {
            id:
              "low-x",

            effects: {
              x:
                0.2,
              y:
                0.3,
            },

            observationStdDev:
              0.05,
          },
          {
            id:
              "mid-x",

            effects: {
              x:
                0.4,
              y:
                0.7,
            },

            observationStdDev:
              0.05,
          },
        ];

        const adequacy =
          evaluateMechanismFamilyAdequacy(
            incumbents,
            [
              discoveryObservation,
            ],
            0.5,
          );

        const proposal =
          proposeBoundedMechanismChallengers(
            incumbents,
            discoveryObservation,
            adequacy,
          );

        expect(
          proposal.reason,
        ).toBe(
          "predictive-misfit",
        );

        expect(
          proposal
            .challengers,
        ).toHaveLength(
          2,
        );

        expect(
          proposal
            .challengers
            .every(
              (challenger) =>
                challenger
                  .effects
                  .x ===
                0.72,
            ),
        ).toBe(
          true,
        );

        expect(
          incumbents[
            0
          ]!
            .effects
            .x,
        ).toBe(
          0.2,
        );
      },
    );

    it(
      "promotes a challenger only after it wins on separate protected observations",
      () => {
        const incumbent:
          ProbabilisticCausalMechanism = {
          id:
            "incumbent",

          effects: {
            x:
              0.2,
          },

          observationStdDev:
            0.05,
        };

        const adequacy =
          evaluateMechanismFamilyAdequacy(
            [
              incumbent,
            ],
            [
              discoveryObservation,
            ],
            0.5,
          );

        const proposal =
          proposeBoundedMechanismChallengers(
            [
              incumbent,
            ],
            discoveryObservation,
            adequacy,
          );

        const protectedObservations:
          MechanismLearningObservation[] = [
          {
            experiment:
              singleExperiment(
                "protected-x-1",
                "x",
              ),

            measuredEffect:
              0.7,
          },
          {
            experiment:
              singleExperiment(
                "protected-x-2",
                "x",
              ),

            measuredEffect:
              0.74,
          },
        ];

        const decision =
          selectValidatedMechanismChampion(
            incumbent,
            proposal.challengers,
            protectedObservations,
          );

        expect(
          decision,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "incumbent",

          reason:
            "validated-challenger",
        });

        expect(
          decision
            .champion
            .effects
            .x,
        ).toBeCloseTo(
          0.72,
        );

        expect(
          decision.improvement,
        ).toBeGreaterThan(
          0.2,
        );
      },
    );
  },
);

describe(
  "contingent scientific planning",
  () => {
    const experiments:
      readonly WorldModelExperiment[] = [
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

    it(
      "chooses a cheap first experiment and conditions the second experiment on the first outcome",
      () => {
        const prior =
          new Map(
            MECHANISMS.map(
              (mechanism) => [
                mechanism.id,
                1 /
                  MECHANISMS.length,
              ],
            ),
          );

        const policy =
          chooseContingentExperimentPolicy(
            MECHANISMS,
            prior,
            experiments,
          );

        expect(
          policy,
        ).toMatchObject({
          decision:
            "policy",

          firstExperimentId:
            "cheap-x",

          maximumRisk:
            0.1,

          reason:
            "safe-contingent-policy",
        });

        const mechanismOneBranch =
          policy.branches.find(
            (branch) =>
              branch
                .representativeMechanismId ===
              "mechanism-1",
          );

        const mechanismThreeBranch =
          policy.branches.find(
            (branch) =>
              branch
                .representativeMechanismId ===
              "mechanism-3",
          );

        expect(
          mechanismOneBranch
            ?.nextExperimentId,
        ).toBe(
          "cheap-y",
        );

        expect(
          mechanismThreeBranch
            ?.nextExperimentId,
        ).toBeUndefined();

        expect(
          policy
            .expectedTotalCost,
        ).toBeLessThan(
          0.1,
        );
      },
    );

    it(
      "never includes the unsafe irreversible experiment in a contingent branch",
      () => {
        const prior =
          new Map(
            MECHANISMS.map(
              (mechanism) => [
                mechanism.id,
                1 /
                  MECHANISMS.length,
              ],
            ),
          );

        const policy =
          chooseContingentExperimentPolicy(
            MECHANISMS,
            prior,
            experiments,
          );

        expect(
          policy
            .firstExperimentId,
        ).not.toBe(
          "unsafe-all",
        );

        expect(
          policy
            .branches
            .map(
              (branch) =>
                branch
                  .nextExperimentId,
            ),
        ).not.toContain(
          "unsafe-all",
        );
      },
    );
  },
);

describe(
  "receding-horizon action replanning",
  () => {
    const actions:
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
    ];

    it(
      "executes only the first action of a safe multi-step plan and replans after the observed transition",
      () => {
        const belief =
          new Map([
            [
              "mechanism-1",
              1,
            ],
            [
              "mechanism-2",
              0,
            ],
            [
              "mechanism-3",
              0,
            ],
          ]);

        const first =
          chooseRecedingHorizonDecision(
            MECHANISMS,
            belief,
            0.1,
            0.45,
            actions,
            {
              horizon:
                2,
            },
          );

        expect(
          first,
        ).toMatchObject({
          decision:
            "act",

          actionId:
            "boost-x",

          reason:
            "execute-first-safe-action",
        });

        expect(
          first
            .underlyingPlan
            ?.actionIds,
        ).toEqual([
          "boost-x",
          "boost-y",
        ]);

        const replanned =
          chooseRecedingHorizonDecision(
            MECHANISMS,
            belief,
            0.5,
            0.45,
            actions,
            {
              horizon:
                2,
            },
          );

        expect(
          replanned,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "goal-already-reached",
        });
      },
    );
  },
);

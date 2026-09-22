import {
  describe,
  expect,
  it,
} from "vitest";

import {
  chooseOpenLoopTaskPlan,
  chooseValueOfInformationDualControl,
  type DualControlAction,
  type DualControlExperiment,
} from "./value-of-information-dual-control";

import type {
  ProbabilisticCausalMechanism,
} from "./probabilistic-causal-world-model";

const MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "slow-world",

      effects: {
        diagnostic:
          0.2,
        probe:
          0.2,
        slow:
          1,
        fast:
          0.1,
        unsafe:
          1,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "fast-world",

      effects: {
        diagnostic:
          0.6,
        probe:
          0.8,
        slow:
          0.1,
        fast:
          1,
        unsafe:
          1,
      },

      observationStdDev:
        0.05,
    },
  ];

const PRIOR =
  new Map([
    [
      "slow-world",
      0.5,
    ],
    [
      "fast-world",
      0.5,
    ],
  ]);

const INFORMATIVE_ACTIONS:
  readonly DualControlAction[] = [
    {
      id:
        "diagnostic-progress",

      interventions: {
        diagnostic:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "finish-slow",

      interventions: {
        slow:
          1,
      },

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "finish-fast",

      interventions: {
        fast:
          1,
      },

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,
    },
    {
      id:
        "unsafe-action",

      interventions: {
        unsafe:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      delay:
        0,

      reversible:
        false,
    },
  ];

const PURE_EXPERIMENTS:
  readonly DualControlExperiment[] = [
    {
      id:
        "pure-probe",

      interventions: {
        probe:
          1,
      },

      risk:
        0.1,

      cost:
        0.08,

      delay:
        0.15,

      reversible:
        true,
    },
    {
      id:
        "unsafe-probe",

      interventions: {
        probe:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      delay:
        0,

      reversible:
        false,
    },
  ];

describe(
  "value-of-information mixed dual control",
  () => {
    it(
      "prefers an informative task action when it both makes progress and reveals which follow-up action to take",
      () => {
        const decision =
          chooseValueOfInformationDualControl(
            MECHANISMS,
            PRIOR,
            0,
            1,
            PURE_EXPERIMENTS,
            INFORMATIVE_ACTIONS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "diagnostic-progress",

          reason:
            "informative-action-worth-value",
        });

        expect(
          decision
            .valueOfInformation,
        ).toBeGreaterThan(
          0.05,
        );

        expect(
          decision
            .selectedPolicy
            ?.usesInformation,
        ).toBe(
          true,
        );

        const slowBranch =
          decision
            .selectedPolicy
            ?.branches
            .find(
              (branch) =>
                branch
                  .truthMechanismId ===
                "slow-world",
            );

        const fastBranch =
          decision
            .selectedPolicy
            ?.branches
            .find(
              (branch) =>
                branch
                  .truthMechanismId ===
                "fast-world",
            );

        expect(
          slowBranch,
        ).toMatchObject({
          followUpActionId:
            "finish-slow",

          taskUtility:
            1,
        });

        expect(
          fastBranch,
        ).toMatchObject({
          followUpActionId:
            "finish-fast",

          taskUtility:
            1,
        });

        expect(
          slowBranch
            ?.posteriorConfidence,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          fastBranch
            ?.posteriorConfidence,
        ).toBeGreaterThan(
          0.999,
        );
      },
    );

    it(
      "uses the same two-step horizon for the open-loop baseline",
      () => {
        const baseline =
          chooseOpenLoopTaskPlan(
            MECHANISMS,
            PRIOR,
            0,
            1,
            INFORMATIVE_ACTIONS,
          );

        expect(
          baseline.decision,
        ).toBe(
          "plan",
        );

        expect(
          baseline.actionIds,
        ).toHaveLength(
          2,
        );

        expect(
          baseline.expectedTaskUtility,
        ).toBeCloseTo(
          1,
        );

        expect(
          baseline.totalCost,
        ).toBeCloseTo(
          0.24,
        );
      },
    );

    it(
      "prefers a pure experiment when task actions are too expensive to use as probes",
      () => {
        const expensiveActions:
          DualControlAction[] = [
          {
            ...INFORMATIVE_ACTIONS[
              0
            ]!,

            cost:
              0.25,

            delay:
              0.2,
          },
          {
            ...INFORMATIVE_ACTIONS[
              1
            ]!,

            cost:
              0.3,
          },
          {
            ...INFORMATIVE_ACTIONS[
              2
            ]!,

            cost:
              0.3,
          },
        ];

        const cheapProbe:
          DualControlExperiment = {
          ...PURE_EXPERIMENTS[
            0
          ]!,

          cost:
            0.03,

          delay:
            0.05,
        };

        const decision =
          chooseValueOfInformationDualControl(
            MECHANISMS,
            PRIOR,
            0,
            1,
            [
              cheapProbe,
            ],
            expensiveActions,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "pure-probe",

          reason:
            "pure-experiment-worth-value",
        });

        expect(
          decision
            .selectedPolicy
            ?.branches
            .map(
              (branch) =>
                branch
                  .followUpActionId,
            )
            .sort(),
        ).toEqual([
          "finish-fast",
          "finish-slow",
        ]);
      },
    );

    it(
      "acts immediately when remaining uncertainty cannot change the best safe action",
      () => {
        const mechanisms:
          ProbabilisticCausalMechanism[] = [
          {
            id:
              "left",

            effects: {
              probe:
                0.2,
              universal:
                1,
            },

            observationStdDev:
              0.05,
          },
          {
            id:
              "right",

            effects: {
              probe:
                0.8,
              universal:
                1,
            },

            observationStdDev:
              0.05,
          },
        ];

        const actions:
          DualControlAction[] = [
          {
            id:
              "universal-finish",

            interventions: {
              universal:
                1,
            },

            risk:
              0.1,

            cost:
              0.05,

            delay:
              0.05,

            reversible:
              true,
          },
        ];

        const decision =
          chooseValueOfInformationDualControl(
            mechanisms,
            new Map([
              [
                "left",
                0.5,
              ],
              [
                "right",
                0.5,
              ],
            ]),
            0,
            1,
            [
              PURE_EXPERIMENTS[
                0
              ]!,
            ],
            actions,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "universal-finish",

          valueOfInformation:
            0,

          reason:
            "information-not-worth-cost",
        });
      },
    );

    it(
      "never selects unsafe zero-cost experiments or actions",
      () => {
        const decision =
          chooseValueOfInformationDualControl(
            MECHANISMS,
            PRIOR,
            0,
            1,
            PURE_EXPERIMENTS,
            INFORMATIVE_ACTIONS,
            {
              maximumRisk:
                0.3,
            },
          );

        expect(
          decision.selectedId,
        ).not.toBe(
          "unsafe-probe",
        );

        expect(
          decision.selectedId,
        ).not.toBe(
          "unsafe-action",
        );

        expect(
          decision.maximumRisk,
        ).toBeLessThanOrEqual(
          0.3,
        );
      },
    );

    it(
      "stops without further control when the goal is already reached",
      () => {
        const decision =
          chooseValueOfInformationDualControl(
            MECHANISMS,
            PRIOR,
            1,
            1,
            PURE_EXPERIMENTS,
            INFORMATIVE_ACTIONS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "stop",

          valueOfInformation:
            0,

          reason:
            "goal-already-reached",
        });
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  chooseRecedingHorizonVectorControl,
  createRecedingVectorController,
  executeRecedingVectorControl,
  type RecedingVectorAction,
  type RecedingVectorExperiment,
  type RecedingVectorGoal,
  type RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

const HYPOTHESES:
  readonly RecedingVectorHypothesis[] = [
    {
      id:
        "slow-combination",

      repairCandidateId:
        "repair-slow",

      prerequisiteHypothesisId:
        "finish-readiness>=0.400",

      dimensionEffects: {
        readiness: {
          "prepare-diagnostic":
            0.5,
        },

        progress: {
          "prepare-diagnostic":
            0.1,
          "finish-slow":
            0.9,
          "finish-fast":
            0.1,
          "blind-finish-slow":
            0.9,
          "blind-finish-fast":
            0.1,
          "constraint-shortcut":
            1,
        },

        exposure: {
          "prepare-diagnostic":
            0.05,
          "finish-slow":
            0.1,
          "finish-fast":
            0.1,
          "blind-finish-slow":
            0.1,
          "blind-finish-fast":
            0.1,
          "constraint-shortcut":
            0.8,
        },

        signal: {
          "probe-route":
            0.2,
        },
      },

      observationStdDev:
        0.05,

      actionPrerequisites: {
        "finish-slow": {
          readiness:
            0.4,
        },

        "finish-fast": {
          readiness:
            0.4,
        },

        "blind-finish-slow": {
          readiness:
            0.4,
        },

        "blind-finish-fast": {
          readiness:
            0.4,
        },
      },
    },
    {
      id:
        "fast-combination",

      repairCandidateId:
        "repair-fast",

      prerequisiteHypothesisId:
        "finish-readiness>=0.700",

      dimensionEffects: {
        readiness: {
          "prepare-diagnostic":
            0.8,
        },

        progress: {
          "prepare-diagnostic":
            0.1,
          "finish-slow":
            0.1,
          "finish-fast":
            0.9,
          "blind-finish-slow":
            0.1,
          "blind-finish-fast":
            0.9,
          "constraint-shortcut":
            1,
        },

        exposure: {
          "prepare-diagnostic":
            0.05,
          "finish-slow":
            0.1,
          "finish-fast":
            0.1,
          "constraint-shortcut":
            0.8,
        },

        signal: {
          "probe-route":
            0.8,
        },
      },

      observationStdDev:
        0.05,

      actionPrerequisites: {
        "finish-slow": {
          readiness:
            0.7,
        },

        "finish-fast": {
          readiness:
            0.7,
        },

        "blind-finish-slow": {
          readiness:
            0.7,
        },

        "blind-finish-fast": {
          readiness:
            0.7,
        },
      },
    },
  ];

const GOAL:
  RecedingVectorGoal = {
  minimums: {
    progress:
      0.9,
  },

  maximums: {
    exposure:
      0.3,
  },
};

const ACTIONS:
  readonly RecedingVectorAction[] = [
    {
      id:
        "prepare-diagnostic",

      risk:
        0.1,

      cost:
        0.05,

      delay:
        0.05,

      reversible:
        true,

      observationDimension:
        "readiness",
    },
    {
      id:
        "finish-slow",

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "progress",
    },
    {
      id:
        "finish-fast",

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "progress",
    },
    {
      id:
        "constraint-shortcut",

      risk:
        0.1,

      cost:
        0.01,

      delay:
        0.01,

      reversible:
        true,

      observationDimension:
        "progress",
    },
    {
      id:
        "unsafe-action",

      risk:
        0.9,

      cost:
        0,

      delay:
        0,

      reversible:
        false,

      observationDimension:
        "progress",
    },
  ];

const READY_ACTIONS:
  readonly RecedingVectorAction[] = [
    {
      id:
        "blind-finish-slow",

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "exposure",
    },
    {
      id:
        "blind-finish-fast",

      risk:
        0.1,

      cost:
        0.12,

      delay:
        0.1,

      reversible:
        true,

      observationDimension:
        "exposure",
    },
  ];

const EXPERIMENTS:
  readonly RecedingVectorExperiment[] = [
    {
      id:
        "probe-route",

      risk:
        0.1,

      cost:
        0.08,

      delay:
        0.15,

      reversible:
        true,

      observationDimension:
        "signal",
    },
    {
      id:
        "unsafe-probe",

      risk:
        0.9,

      cost:
        0,

      delay:
        0,

      reversible:
        false,

      observationDimension:
        "signal",
    },
  ];

const PRIOR = {
  "slow-combination":
    0.5,
  "fast-combination":
    0.5,
};

describe(
  "receding-horizon multidimensional dual control",
  () => {
    it(
      "chooses an informative preparation action from an unprepared uncertain state",
      () => {
        const controller =
          createRecedingVectorController(
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            PRIOR,
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            HYPOTHESES,
            controller,
            GOAL,
            ACTIONS,
            EXPERIMENTS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "prepare-diagnostic",

          reason:
            "informative-action-best",
        });

        expect(
          decision
            .valueOverOpenLoop,
        ).toBeGreaterThan(
          0.2,
        );

        expect(
          decision.maximumRisk,
        ).toBeLessThanOrEqual(
          0.1,
        );
      },
    );

    it(
      "updates vector state and posterior from the real informative action observation",
      () => {
        const controller =
          createRecedingVectorController(
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            PRIOR,
          );

        const next =
          executeRecedingVectorControl(
            HYPOTHESES,
            controller,
            "fast-combination",
            ACTIONS[
              0
            ]!,
            "action",
          );

        expect(
          next.state,
        ).toMatchObject({
          readiness:
            0.8,

          progress:
            0.1,

          exposure:
            0.05,
        });

        expect(
          next
            .belief
            .topHypothesisId,
        ).toBe(
          "fast-combination",
        );

        expect(
          next
            .belief
            .confidence,
        ).toBeGreaterThan(
          0.99,
        );

        expect(
          next.history,
        ).toHaveLength(
          1,
        );
      },
    );

    it(
      "replans after the observation and selects the route-specific finish action",
      () => {
        let controller =
          createRecedingVectorController(
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            PRIOR,
          );

        controller =
          executeRecedingVectorControl(
            HYPOTHESES,
            controller,
            "fast-combination",
            ACTIONS[
              0
            ]!,
            "action",
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            HYPOTHESES,
            controller,
            GOAL,
            ACTIONS,
            EXPERIMENTS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "act",

          selectedId:
            "finish-fast",

          reason:
            "direct-action-best",
        });
      },
    );

    it(
      "reaches the multidimensional goal and then stops on the next receding-horizon cycle",
      () => {
        let controller =
          createRecedingVectorController(
            {
              readiness:
                0,
              progress:
                0,
              exposure:
                0,
            },
            PRIOR,
          );

        controller =
          executeRecedingVectorControl(
            HYPOTHESES,
            controller,
            "fast-combination",
            ACTIONS[
              0
            ]!,
            "action",
          );

        controller =
          executeRecedingVectorControl(
            HYPOTHESES,
            controller,
            "fast-combination",
            ACTIONS[
              2
            ]!,
            "action",
          );

        expect(
          controller.state,
        ).toMatchObject({
          readiness:
            0.8,

          progress:
            1,

          exposure:
            0.15,
        });

        const finalDecision =
          chooseRecedingHorizonVectorControl(
            HYPOTHESES,
            controller,
            GOAL,
            ACTIONS,
            EXPERIMENTS,
          );

        expect(
          finalDecision,
        ).toMatchObject({
          decision:
            "stop",

          reason:
            "goal-satisfied",
        });

        expect(
          controller.history,
        ).toHaveLength(
          2,
        );
      },
    );

    it(
      "chooses a pure experiment from an already-ready state when probing is cheaper than blind route execution",
      () => {
        const controller =
          createRecedingVectorController(
            {
              readiness:
                0.8,
              progress:
                0,
              exposure:
                0,
            },
            PRIOR,
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            HYPOTHESES,
            controller,
            GOAL,
            READY_ACTIONS,
            EXPERIMENTS,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "experiment",

          selectedId:
            "probe-route",

          reason:
            "pure-experiment-best",
        });

        expect(
          decision
            .valueOverOpenLoop,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "rejects a cheap action that violates the terminal exposure constraint",
      () => {
        const controller =
          createRecedingVectorController(
            {
              readiness:
                0.8,
              progress:
                0,
              exposure:
                0,
            },
            {
              "slow-combination":
                1,
              "fast-combination":
                0,
            },
          );

        const decision =
          chooseRecedingHorizonVectorControl(
            HYPOTHESES,
            controller,
            GOAL,
            ACTIONS,
            EXPERIMENTS,
          );

        expect(
          decision.selectedId,
        ).not.toBe(
          "constraint-shortcut",
        );

        expect(
          decision.selectedId,
        ).not.toBe(
          "unsafe-action",
        );

        expect(
          decision.selectedId,
        ).not.toBe(
          "unsafe-probe",
        );
      },
    );
  },
);

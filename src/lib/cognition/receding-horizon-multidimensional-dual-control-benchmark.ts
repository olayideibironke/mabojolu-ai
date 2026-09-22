import {
  chooseRecedingHorizonVectorControl,
  createRecedingVectorController,
  executeRecedingVectorControl,
  type RecedingVectorAction,
  type RecedingVectorDecision,
  type RecedingVectorExperiment,
  type RecedingVectorGoal,
  type RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface RecedingHorizonMultidimensionalBenchmarkReport {
  initialDecision: RecedingVectorDecision;
  fastPosteriorConfidenceAfterPrepare: number;
  fastStateAfterPrepare: Record<string, number>;
  fastReplan: RecedingVectorDecision;
  fastFinalDecision: RecedingVectorDecision;
  fastHistoryIds: string[];
  slowReplan: RecedingVectorDecision;
  readyStateExperimentDecision: RecedingVectorDecision;
}

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
  ];

const PRIOR = {
  "slow-combination":
    0.5,
  "fast-combination":
    0.5,
};

function initialController() {
  return createRecedingVectorController(
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
}

export function runRecedingHorizonMultidimensionalBenchmark():
  RecedingHorizonMultidimensionalBenchmarkReport {
  const initial =
    initialController();

  const initialDecision =
    chooseRecedingHorizonVectorControl(
      HYPOTHESES,
      initial,
      GOAL,
      ACTIONS,
      EXPERIMENTS,
    );

  let fast =
    executeRecedingVectorControl(
      HYPOTHESES,
      initial,
      "fast-combination",
      ACTIONS[
        0
      ]!,
      "action",
    );

  const fastPosteriorConfidenceAfterPrepare =
    fast
      .belief
      .confidence;

  const fastStateAfterPrepare = {
    ...fast.state,
  };

  const fastReplan =
    chooseRecedingHorizonVectorControl(
      HYPOTHESES,
      fast,
      GOAL,
      ACTIONS,
      EXPERIMENTS,
    );

  fast =
    executeRecedingVectorControl(
      HYPOTHESES,
      fast,
      "fast-combination",
      ACTIONS[
        2
      ]!,
      "action",
    );

  const fastFinalDecision =
    chooseRecedingHorizonVectorControl(
      HYPOTHESES,
      fast,
      GOAL,
      ACTIONS,
      EXPERIMENTS,
    );

  const slow =
    executeRecedingVectorControl(
      HYPOTHESES,
      initialController(),
      "slow-combination",
      ACTIONS[
        0
      ]!,
      "action",
    );

  const slowReplan =
    chooseRecedingHorizonVectorControl(
      HYPOTHESES,
      slow,
      GOAL,
      ACTIONS,
      EXPERIMENTS,
    );

  const ready =
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

  const readyStateExperimentDecision =
    chooseRecedingHorizonVectorControl(
      HYPOTHESES,
      ready,
      GOAL,
      READY_ACTIONS,
      EXPERIMENTS,
    );

  return {
    initialDecision,

    fastPosteriorConfidenceAfterPrepare,

    fastStateAfterPrepare,

    fastReplan,

    fastFinalDecision,

    fastHistoryIds:
      fast.history.map(
        (entry) =>
          entry.controlId,
      ),

    slowReplan,

    readyStateExperimentDecision,
  };
}

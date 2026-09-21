import {
  OnlineMechanismParameterLearner,
  chooseContingentExperimentPolicy,
  chooseRecedingHorizonDecision,
  evaluateMechanismFamilyAdequacy,
  proposeBoundedMechanismChallengers,
  selectContingentExperimentBranch,
  selectValidatedMechanismChampion,
  type ContingentBranchSelection,
  type ContingentExperimentPolicy,
  type MechanismChampionDecision,
  type MechanismFamilyAdequacy,
  type MechanismParameterLearningSummary,
  type RecedingHorizonDecision,
} from "./adaptive-mechanism-discovery";

import {
  ProbabilisticCausalWorldModel,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface AdaptiveMechanismDiscoveryBenchmarkReport {
  parameterLearning:
    MechanismParameterLearningSummary;
  inadequacy:
    MechanismFamilyAdequacy;
  championDecision:
    MechanismChampionDecision;
  openLoopExperimentIds:
    string[];
  openLoopExperimentCost:
    number;
  contingentPolicy:
    ContingentExperimentPolicy;
  contingentRuntimeBranch:
    ContingentBranchSelection;
  contingentExecutedExperimentIds:
    string[];
  contingentExecutedCost:
    number;
  initialActionDecision:
    RecedingHorizonDecision;
  replannedActionDecision:
    RecedingHorizonDecision;
}

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

export function runAdaptiveMechanismDiscoveryBenchmark():
  AdaptiveMechanismDiscoveryBenchmarkReport {
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
          `learn-x-${index + 1}`,
          "x",
        ),

      measuredEffect,
    });
  }

  const parameterLearning =
    learner.getSummary();

  const incumbent:
    ProbabilisticCausalMechanism = {
    id:
      "incumbent-low-x",

    effects: {
      x:
        0.2,
    },

    observationStdDev:
      0.05,
  };

  const discoveryObservation = {
    experiment:
      singleExperiment(
        "discover-x",
        "x",
      ),

    measuredEffect:
      0.72,
  };

  const inadequacy =
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
      inadequacy,
    );

  const championDecision =
    selectValidatedMechanismChampion(
      incumbent,
      proposal.challengers,
      [
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
      ],
    );

  const openLoopModel =
    new ProbabilisticCausalWorldModel(
      MECHANISMS,
    );

  const openLoop =
    openLoopModel
      .chooseExperimentSequence(
        EXPERIMENTS,
        2,
      );

  if (
    openLoop.decision !==
      "plan"
  ) {
    throw new Error(
      "Adaptive mechanism benchmark open-loop control unexpectedly abstained.",
    );
  }

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

  const contingentPolicy =
    chooseContingentExperimentPolicy(
      MECHANISMS,
      prior,
      EXPERIMENTS,
    );

  if (
    contingentPolicy.decision !==
      "policy" ||
    !contingentPolicy
      .firstExperimentId
  ) {
    throw new Error(
      "Adaptive mechanism benchmark contingent policy unexpectedly abstained.",
    );
  }

  const firstExperiment =
    EXPERIMENTS.find(
      (experiment) =>
        experiment.id ===
        contingentPolicy
          .firstExperimentId,
    );

  if (
    !firstExperiment
  ) {
    throw new Error(
      "Adaptive mechanism benchmark first contingent experiment is missing.",
    );
  }

  const contingentRuntimeBranch =
    selectContingentExperimentBranch(
      contingentPolicy,
      0.79,
    );

  const contingentExecutedExperimentIds = [
    firstExperiment.id,
    ...(
      contingentRuntimeBranch
        .nextExperimentId
        ? [
            contingentRuntimeBranch
              .nextExperimentId,
          ]
        : []
    ),
  ];

  const contingentExecutedCost =
    contingentExecutedExperimentIds
      .map(
        (experimentId) =>
          EXPERIMENTS.find(
            (experiment) =>
              experiment.id ===
              experimentId,
          ),
      )
      .reduce(
        (
          total,
          experiment,
        ) => {
          if (
            !experiment
          ) {
            throw new Error(
              "Adaptive mechanism benchmark contingent branch references a missing experiment.",
            );
          }

          return total +
            experiment.cost;
        },
        0,
      );

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

  const initialActionDecision =
    chooseRecedingHorizonDecision(
      MECHANISMS,
      belief,
      0.1,
      0.45,
      ACTIONS,
      {
        horizon:
          2,
      },
    );

  const replannedActionDecision =
    chooseRecedingHorizonDecision(
      MECHANISMS,
      belief,
      0.5,
      0.45,
      ACTIONS,
      {
        horizon:
          2,
      },
    );

  return {
    parameterLearning,
    inadequacy,
    championDecision,

    openLoopExperimentIds:
      openLoop
        .experimentIds,

    openLoopExperimentCost:
      openLoop
        .totalCost,

    contingentPolicy,
    contingentRuntimeBranch,
    contingentExecutedExperimentIds,
    contingentExecutedCost,
    initialActionDecision,
    replannedActionDecision,
  };
}

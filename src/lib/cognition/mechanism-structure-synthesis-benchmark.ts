import {
  chooseDualControlDecision,
  selectValidatedStructuralChampion,
  synthesizeBoundedStructuralChallengers,
  type DualControlDecision,
  type StructuralChampionDecision,
  type StructuredCausalMechanism,
  type StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import {
  ProbabilisticCausalWorldModel,
  type ProbabilisticCausalMechanism,
  type WorldModelAction,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface MechanismStructureSynthesisBenchmarkReport {
  structuralChampion:
    StructuralChampionDecision;
  discoveryObservationIds:
    string[];
  protectedObservationIds:
    string[];
  structuralChallengerIds:
    string[];
  initialDualControl:
    DualControlDecision;
  postEvidenceDualControl:
    DualControlDecision;
  initialBestActionGoalSuccessProbability:
    number;
  postEvidenceActionGoalSuccessProbability:
    number;
  informationExperimentCost:
    number;
  selectedActionCost:
    number;
  totalDualControlCost:
    number;
}

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

function structuralObservation(
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
    structuralObservation(
      "discover-xy-1",
      1,
      1,
      1,
    ),
    structuralObservation(
      "discover-xy-2",
      0.5,
      0.5,
      0.35,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    structuralObservation(
      "protected-x",
      1,
      0,
      0.2,
    ),
    structuralObservation(
      "protected-y",
      0,
      1,
      0.2,
    ),
    structuralObservation(
      "protected-half",
      0.5,
      0.5,
      0.35,
    ),
    structuralObservation(
      "protected-xy",
      1,
      1,
      1,
    ),
  ];

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
        "unsafe-probe",

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

function experimentById(
  id:
    string,
): WorldModelExperiment {
  const experiment =
    DUAL_EXPERIMENTS.find(
      (candidate) =>
        candidate.id ===
        id,
    );

  if (
    !experiment
  ) {
    throw new Error(
      `Dual-control benchmark experiment ${id} is missing.`,
    );
  }

  return experiment;
}

function actionById(
  id:
    string,
): WorldModelAction {
  const action =
    DUAL_ACTIONS.find(
      (candidate) =>
        candidate.id ===
        id,
    );

  if (
    !action
  ) {
    throw new Error(
      `Dual-control benchmark action ${id} is missing.`,
    );
  }

  return action;
}

export function runMechanismStructureSynthesisBenchmark():
  MechanismStructureSynthesisBenchmarkReport {
  const challengers =
    synthesizeBoundedStructuralChallengers(
      INCUMBENT,
      DISCOVERY,
      [
        "x",
        "y",
      ],
    );

  const structuralChampion =
    selectValidatedStructuralChampion(
      INCUMBENT,
      challengers,
      PROTECTED,
    );

  const model =
    new ProbabilisticCausalWorldModel(
      DUAL_MECHANISMS,
    );

  const initialDualControl =
    chooseDualControlDecision(
      model,
      0.1,
      0.7,
      DUAL_EXPERIMENTS,
      DUAL_ACTIONS,
    );

  if (
    initialDualControl.decision !==
      "experiment" ||
    !initialDualControl
      .selectedId
  ) {
    throw new Error(
      "Dual-control benchmark failed to choose information gathering under initial uncertainty.",
    );
  }

  const informationExperiment =
    experimentById(
      initialDualControl
        .selectedId,
    );

  model.recordObservation(
    informationExperiment,
    {
      experimentId:
        informationExperiment.id,

      measuredEffect:
        0.79,
    },
  );

  const postEvidenceDualControl =
    chooseDualControlDecision(
      model,
      0.1,
      0.7,
      DUAL_EXPERIMENTS,
      DUAL_ACTIONS,
    );

  if (
    postEvidenceDualControl.decision !==
      "act" ||
    !postEvidenceDualControl
      .selectedId
  ) {
    throw new Error(
      "Dual-control benchmark failed to switch from information gathering to goal action.",
    );
  }

  const selectedAction =
    actionById(
      postEvidenceDualControl
        .selectedId,
    );

  return {
    structuralChampion,

    discoveryObservationIds:
      DISCOVERY.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    protectedObservationIds:
      PROTECTED.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    structuralChallengerIds:
      challengers.map(
        (challenger) =>
          challenger
            .addedTerm
            .id,
      ),

    initialDualControl,

    postEvidenceDualControl,

    initialBestActionGoalSuccessProbability:
      initialDualControl
        .goalSuccessProbability,

    postEvidenceActionGoalSuccessProbability:
      postEvidenceDualControl
        .goalSuccessProbability,

    informationExperimentCost:
      informationExperiment
        .cost,

    selectedActionCost:
      selectedAction.cost,

    totalDualControlCost:
      informationExperiment
        .cost +
      selectedAction.cost,
  };
}

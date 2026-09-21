import {
  ProbabilisticCausalWorldModel,
  chooseProbabilisticActionPlan,
  predictMechanismEffect,
  type ExperimentSequencePlan,
  type ProbabilisticCausalMechanism,
  type ProbabilisticMechanismBelief,
  type WorldModelAction,
  type WorldModelActionPlan,
  type WorldModelExperiment,
} from "./probabilistic-causal-world-model";

export interface ProbabilisticCausalWorldModelBenchmarkReport {
  myopicExperimentPlan: ExperimentSequencePlan;
  lookaheadExperimentPlan: ExperimentSequencePlan;
  myopicBelief: ProbabilisticMechanismBelief;
  lookaheadBelief: ProbabilisticMechanismBelief;
  myopicExecutedCost: number;
  lookaheadExecutedCost: number;
  myopicExecutedRisk: number;
  lookaheadExecutedRisk: number;
  horizonOneActionPlan: WorldModelActionPlan;
  horizonTwoActionPlan: WorldModelActionPlan;
  blockedUnsafeExperimentIds: string[];
  trueMechanismId: string;
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

const TRUE_MECHANISM_ID =
  "mechanism-1";

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

const NOISE_BY_EXPERIMENT:
  Readonly<
    Record<
      string,
      number
    >
  > = {
    "direct-z":
      0.02,

    "cheap-x":
      0.02,

    "cheap-y":
      -0.015,
  };

function experimentById(
  id:
    string,
): WorldModelExperiment {
  const experiment =
    EXPERIMENTS.find(
      (candidate) =>
        candidate.id ===
        id,
    );

  if (
    !experiment
  ) {
    throw new Error(
      `Benchmark experiment ${id} is missing.`,
    );
  }

  return experiment;
}

function trueMechanism():
  ProbabilisticCausalMechanism {
  const mechanism =
    MECHANISMS.find(
      (candidate) =>
        candidate.id ===
        TRUE_MECHANISM_ID,
    );

  if (
    !mechanism
  ) {
    throw new Error(
      "Benchmark true mechanism is missing.",
    );
  }

  return mechanism;
}

function executeExperimentPlan(
  plan:
    ExperimentSequencePlan,
): {
  belief:
    ProbabilisticMechanismBelief;
  executedCost:
    number;
  executedRisk:
    number;
  blockedUnsafeExperimentIds:
    string[];
  model:
    ProbabilisticCausalWorldModel;
} {
  if (
    plan.decision !==
      "plan"
  ) {
    throw new Error(
      "Benchmark cannot execute an abstained experiment plan.",
    );
  }

  const model =
    new ProbabilisticCausalWorldModel(
      MECHANISMS,
    );

  let executedCost =
    0;

  let executedRisk =
    0;

  const truth =
    trueMechanism();

  for (
    const experimentId of
      plan.experimentIds
  ) {
    const experiment =
      experimentById(
        experimentId,
      );

    const measuredEffect =
      predictMechanismEffect(
        truth,
        experiment.interventions,
      ) +
      (
        NOISE_BY_EXPERIMENT[
          experiment.id
        ] ??
        0
      );

    model.recordObservation(
      experiment,
      {
        experimentId:
          experiment.id,

        measuredEffect,
      },
    );

    executedCost +=
      experiment.cost;

    executedRisk =
      Math.max(
        executedRisk,
        experiment.risk,
      );
  }

  model.chooseExperimentSequence(
    EXPERIMENTS,
    2,
  );

  return {
    belief:
      model.getBelief(),

    executedCost,

    executedRisk,

    blockedUnsafeExperimentIds:
      model
        .getAuditSummary()
        .blockedExperimentIds,

    model,
  };
}

export function runProbabilisticCausalWorldModelBenchmark():
  ProbabilisticCausalWorldModelBenchmarkReport {
  const planningModel =
    new ProbabilisticCausalWorldModel(
      MECHANISMS,
    );

  const myopicExperimentPlan =
    planningModel.chooseMyopicExperiment(
      EXPERIMENTS,
    );

  const lookaheadExperimentPlan =
    planningModel.chooseExperimentSequence(
      EXPERIMENTS,
      2,
    );

  const myopic =
    executeExperimentPlan(
      myopicExperimentPlan,
    );

  const lookahead =
    executeExperimentPlan(
      lookaheadExperimentPlan,
    );

  const horizonOneActionPlan =
    chooseProbabilisticActionPlan(
      lookahead.model
        .getMechanisms(),
      lookahead.model
        .getProbabilityMap(),
      0.1,
      0.45,
      ACTIONS,
      {
        horizon:
          1,

        minimumGoalSuccessProbability:
          0.9,
      },
    );

  const horizonTwoActionPlan =
    chooseProbabilisticActionPlan(
      lookahead.model
        .getMechanisms(),
      lookahead.model
        .getProbabilityMap(),
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

  return {
    myopicExperimentPlan,

    lookaheadExperimentPlan,

    myopicBelief:
      myopic.belief,

    lookaheadBelief:
      lookahead.belief,

    myopicExecutedCost:
      myopic.executedCost,

    lookaheadExecutedCost:
      lookahead.executedCost,

    myopicExecutedRisk:
      myopic.executedRisk,

    lookaheadExecutedRisk:
      lookahead.executedRisk,

    horizonOneActionPlan,

    horizonTwoActionPlan,

    blockedUnsafeExperimentIds:
      Array.from(
        new Set([
          ...myopic
            .blockedUnsafeExperimentIds,
          ...lookahead
            .blockedUnsafeExperimentIds,
        ]),
      ),

    trueMechanismId:
      TRUE_MECHANISM_ID,
  };
}

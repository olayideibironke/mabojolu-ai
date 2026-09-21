import type {
  Goal,
} from "./types";

import type {
  GoalSpecification,
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  WorldModelAction,
} from "./probabilistic-causal-world-model";

export interface HierarchicalProgramBelief {
  probabilities: Record<
    string,
    number
  >;
  topProgramId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
}

export interface FragmentFailureAttribution {
  fragmentId: string;
  fullProgramSquaredError: number;
  withoutFragmentSquaredError: number;
  errorReductionWhenRemoved: number;
  blamed: boolean;
}

export interface FragmentFailureDiagnosis {
  programId: string;
  observationId: string;
  fullProgramSquaredError: number;
  blamedFragmentIds: string[];
  attributions: FragmentFailureAttribution[];
}

export interface AutonomousNumericSubgoal {
  id: string;
  targetState: number;
  actionId: string;
  expectedStateAfterAction: number;
  goalSuccessProbabilityAfterAction: number;
  dependsOnGoalIds: string[];
  rationale: string;
}

export interface AutonomousSubgoalPlan {
  decision:
    | "planned"
    | "abstained";
  terminalGoalState: number;
  expectedFinalState: number;
  goalSuccessProbability: number;
  totalCost: number;
  maximumRisk: number;
  actionIds: string[];
  subgoals: AutonomousNumericSubgoal[];
  reason:
    | "posterior-supported-subgoals"
    | "no-safe-subgoal-plan";
}

function validateUnitInterval(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0 ||
    value >
      1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validateNonNegativeFinite(
  name:
    string,

  value:
    number,
): void {
  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function gaussianLikelihood(
  observation:
    number,

  mean:
    number,

  stdDev:
    number,
): number {
  const variance =
    stdDev *
    stdDev;

  return Math.exp(
    -(
      (
        observation -
        mean
      ) *
      (
        observation -
        mean
      )
    ) /
    (
      2 *
      variance
    ),
  ) /
    (
      stdDev *
      Math.sqrt(
        2 *
        Math.PI,
      )
    );
}

function entropy(
  probabilities:
    readonly number[],
): number {
  let result =
    0;

  for (
    const probability of
      probabilities
  ) {
    if (
      probability >
        0
    ) {
      result -=
        probability *
        Math.log(
          probability,
        );
    }
  }

  return result;
}

function normalizedEntropy(
  probabilities:
    readonly number[],
): number {
  if (
    probabilities.length <=
      1
  ) {
    return 0;
  }

  return entropy(
    probabilities,
  ) /
    Math.log(
      probabilities.length,
    );
}

function cloneProgram(
  program:
    HierarchicalCausalProgram,
): HierarchicalCausalProgram {
  return {
    ...program,

    baseEffects: {
      ...program.baseEffects,
    },

    fragments:
      program.fragments.map(
        (fragment) => ({
          ...fragment,

          terms:
            fragment.terms.map(
              (term) => ({
                ...term,

                variables: [
                  ...term.variables,
                ],
              }),
            ),
        }),
      ),
  };
}

function normalizeBelief(
  belief:
    ReadonlyMap<
      string,
      number
    >,
): Map<
  string,
  number
> {
  const total =
    Array.from(
      belief.values(),
    ).reduce(
      (
        sum,
        probability,
      ) =>
        sum +
        probability,
      0,
    );

  if (
    !Number.isFinite(
      total,
    ) ||
    total <=
      0
  ) {
    throw new Error(
      "Hierarchical program belief cannot be normalized.",
    );
  }

  return new Map(
    Array.from(
      belief.entries(),
    ).map(
      (
        [
          id,
          probability,
        ],
      ) => [
        id,
        probability /
          total,
      ],
    ),
  );
}

export class HierarchicalProgramPosterior {
  private readonly programsById =
    new Map<
      string,
      HierarchicalCausalProgram
    >();

  private probabilities:
    Map<
      string,
      number
    >;

  constructor(
    programs:
      readonly HierarchicalCausalProgram[],

    prior?: Readonly<
      Record<
        string,
        number
      >
    >,
  ) {
    if (
      programs.length <
        2
    ) {
      throw new Error(
        "Hierarchical program uncertainty requires at least two competing programs.",
      );
    }

    const seen =
      new Set<
        string
      >();

    for (
      const program of
        programs
    ) {
      if (
        !program.id.trim() ||
        seen.has(
          program.id,
        )
      ) {
        throw new Error(
          "Hierarchical program ids must be non-empty and unique.",
        );
      }

      if (
        !Number.isFinite(
          program.observationStdDev,
        ) ||
        program.observationStdDev <=
          0
      ) {
        throw new Error(
          `Program ${program.id} requires a positive finite observationStdDev.`,
        );
      }

      seen.add(
        program.id,
      );

      this.programsById.set(
        program.id,
        cloneProgram(
          program,
        ),
      );
    }

    if (
      prior
    ) {
      const raw =
        new Map<
          string,
          number
        >();

      for (
        const program of
          programs
      ) {
        const probability =
          prior[
            program.id
          ];

        if (
          probability ===
            undefined
        ) {
          throw new Error(
            `Hierarchical program prior is missing ${program.id}.`,
          );
        }

        validateNonNegativeFinite(
          `prior probability for ${program.id}`,
          probability,
        );

        raw.set(
          program.id,
          probability,
        );
      }

      this.probabilities =
        normalizeBelief(
          raw,
        );
    } else {
      const uniform =
        1 /
        programs.length;

      this.probabilities =
        new Map(
          programs.map(
            (program) => [
              program.id,
              uniform,
            ],
          ),
        );
    }
  }

  recordObservation(
    observation:
      StructuralMechanismObservation,
  ): void {
    validateNonNegativeFinite(
      "hierarchical program measuredEffect",
      observation.measuredEffect,
    );

    const weighted =
      new Map<
        string,
        number
      >();

    for (
      const [
        programId,
        program,
      ] of
        this.programsById.entries()
    ) {
      const predicted =
        predictHierarchicalProgramEffect(
          program,
          observation
            .experiment
            .interventions,
        );

      weighted.set(
        programId,
        (
          this.probabilities.get(
            programId,
          ) ??
          0
        ) *
          gaussianLikelihood(
            observation.measuredEffect,
            predicted,
            program.observationStdDev,
          ),
      );
    }

    this.probabilities =
      normalizeBelief(
        weighted,
      );
  }

  getBelief():
    HierarchicalProgramBelief {
    const ranked =
      Array.from(
        this.probabilities.entries(),
      )
        .map(
          (
            [
              programId,
              probability,
            ],
          ) => ({
            programId,
            probability,
          }),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.probability -
              left.probability ||
            left.programId.localeCompare(
              right.programId,
            ),
        );

    const top =
      ranked[
        0
      ];

    const runnerUp =
      ranked[
        1
      ];

    if (
      !top
    ) {
      throw new Error(
        "Hierarchical program posterior has no programs.",
      );
    }

    const probabilities:
      Record<
        string,
        number
      > = {};

    for (
      const item of
        ranked
    ) {
      probabilities[
        item.programId
      ] =
        item.probability;
    }

    return {
      probabilities,

      topProgramId:
        top.programId,

      confidence:
        top.probability,

      margin:
        top.probability -
        (
          runnerUp
            ?.probability ??
          0
        ),

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            (item) =>
              item.probability,
          ),
        ),
    };
  }

  getPrograms():
    readonly HierarchicalCausalProgram[] {
    return Array.from(
      this.programsById.values(),
    ).map(
      cloneProgram,
    );
  }

  getProbabilityMap():
    ReadonlyMap<
      string,
      number
    > {
    return new Map(
      this.probabilities,
    );
  }
}

export function diagnoseHierarchicalFragmentFailure(
  program:
    HierarchicalCausalProgram,

  observation:
    StructuralMechanismObservation,

  minimumErrorReduction =
    0.01,
): FragmentFailureDiagnosis {
  validateNonNegativeFinite(
    "minimumErrorReduction",
    minimumErrorReduction,
  );

  const prediction =
    predictHierarchicalProgramEffect(
      program,
      observation
        .experiment
        .interventions,
    );

  const fullError =
    observation.measuredEffect -
    prediction;

  const fullProgramSquaredError =
    fullError *
    fullError;

  const attributions =
    program.fragments
      .map(
        (fragment) => {
          const withoutFragment:
            HierarchicalCausalProgram = {
            ...program,

            fragments:
              program.fragments
                .filter(
                  (candidate) =>
                    candidate.id !==
                    fragment.id,
                )
                .map(
                  (candidate) => ({
                    ...candidate,

                    terms:
                      candidate.terms.map(
                        (term) => ({
                          ...term,

                          variables: [
                            ...term.variables,
                          ],
                        }),
                      ),
                  }),
                ),
          };

          const withoutPrediction =
            predictHierarchicalProgramEffect(
              withoutFragment,
              observation
                .experiment
                .interventions,
            );

          const withoutError =
            observation.measuredEffect -
            withoutPrediction;

          const withoutFragmentSquaredError =
            withoutError *
            withoutError;

          const errorReductionWhenRemoved =
            fullProgramSquaredError -
            withoutFragmentSquaredError;

          return {
            fragmentId:
              fragment.id,

            fullProgramSquaredError,

            withoutFragmentSquaredError,

            errorReductionWhenRemoved,

            blamed:
              errorReductionWhenRemoved >=
              minimumErrorReduction,
          };
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.errorReductionWhenRemoved -
            left.errorReductionWhenRemoved ||
          left.fragmentId.localeCompare(
            right.fragmentId,
          ),
      );

  return {
    programId:
      program.id,

    observationId:
      observation
        .experiment
        .id,

    fullProgramSquaredError,

    blamedFragmentIds:
      attributions
        .filter(
          (item) =>
            item.blamed,
        )
        .map(
          (item) =>
            item.fragmentId,
        ),

    attributions,
  };
}

function actionSequences(
  actions:
    readonly WorldModelAction[],

  maximumLength:
    number,
): WorldModelAction[][] {
  const output:
    WorldModelAction[][] =
      [];

  function visit(
    remaining:
      WorldModelAction[],

    chosen:
      WorldModelAction[],
  ): void {
    if (
      chosen.length >
        0
    ) {
      output.push([
        ...chosen,
      ]);
    }

    if (
      chosen.length >=
        maximumLength
    ) {
      return;
    }

    for (
      let index =
        0;
      index <
        remaining.length;
      index +=
        1
    ) {
      const action =
        remaining[
          index
        ];

      if (
        !action
      ) {
        continue;
      }

      chosen.push(
        action,
      );

      visit(
        [
          ...remaining.slice(
            0,
            index,
          ),
          ...remaining.slice(
            index +
              1,
          ),
        ],
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    [
      ...actions,
    ],
    [],
  );

  return output;
}

function projectedState(
  program:
    HierarchicalCausalProgram,

  initialState:
    number,

  sequence:
    readonly WorldModelAction[],
): number {
  return sequence.reduce(
    (
      state,
      action,
    ) =>
      state +
      predictHierarchicalProgramEffect(
        program,
        action.interventions,
      ),
    initialState,
  );
}

export function generateAutonomousSubgoalPlan(
  programs:
    readonly HierarchicalCausalProgram[],

  belief:
    ReadonlyMap<
      string,
      number
    >,

  currentState:
    number,

  terminalGoalState:
    number,

  actions:
    readonly WorldModelAction[],

  options?: {
    maximumActions?: number;
    maximumRisk?: number;
    minimumGoalSuccessProbability?: number;
  },
): AutonomousSubgoalPlan {
  if (
    programs.length ===
      0
  ) {
    throw new Error(
      "Autonomous subgoal formation requires at least one causal program.",
    );
  }

  validateNonNegativeFinite(
    "currentState",
    currentState,
  );

  validateNonNegativeFinite(
    "terminalGoalState",
    terminalGoalState,
  );

  const maximumActions =
    options
      ?.maximumActions ??
    4;

  if (
    !Number.isInteger(
      maximumActions,
    ) ||
    maximumActions <
      1
  ) {
    throw new Error(
      "maximumActions must be a positive integer.",
    );
  }

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const minimumGoalSuccessProbability =
    options
      ?.minimumGoalSuccessProbability ??
    0.8;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateUnitInterval(
    "minimumGoalSuccessProbability",
    minimumGoalSuccessProbability,
  );

  const normalizedBelief =
    normalizeBelief(
      belief,
    );

  const safeActions =
    actions.filter(
      (action) => {
        validateUnitInterval(
          "subgoal action risk",
          action.risk,
        );

        validateNonNegativeFinite(
          "subgoal action cost",
          action.cost,
        );

        return action.reversible &&
          action.risk <=
            maximumRisk;
      },
    );

  let best:
    {
      sequence:
        WorldModelAction[];
      successProbability:
        number;
      expectedFinalState:
        number;
      totalCost:
        number;
      maximumRisk:
        number;
    } |
    undefined;

  for (
    const sequence of
      actionSequences(
        safeActions,
        Math.min(
          maximumActions,
          safeActions.length,
        ),
      )
  ) {
    let successProbability =
      0;

    let expectedFinalState =
      0;

    for (
      const program of
        programs
    ) {
      const probability =
        normalizedBelief.get(
          program.id,
        ) ??
        0;

      const finalState =
        projectedState(
          program,
          currentState,
          sequence,
        );

      expectedFinalState +=
        probability *
        finalState;

      if (
        finalState >=
          terminalGoalState
      ) {
        successProbability +=
          probability;
      }
    }

    if (
      successProbability <
        minimumGoalSuccessProbability
    ) {
      continue;
    }

    const totalCost =
      sequence.reduce(
        (
          total,
          action,
        ) =>
          total +
          action.cost,
        0,
      );

    const sequenceMaximumRisk =
      sequence.reduce(
        (
          risk,
          action,
        ) =>
          Math.max(
            risk,
            action.risk,
          ),
        0,
      );

    if (
      !best ||
      totalCost <
        best.totalCost -
          Number.EPSILON ||
      (
        Math.abs(
          totalCost -
            best.totalCost,
        ) <=
          Number.EPSILON &&
        sequence.length <
          best.sequence.length
      ) ||
      (
        Math.abs(
          totalCost -
            best.totalCost,
        ) <=
          Number.EPSILON &&
        sequence.length ===
          best.sequence.length &&
        sequence
          .map(
            (action) =>
              action.id,
          )
          .join("|") <
          best.sequence
            .map(
              (action) =>
                action.id,
            )
            .join("|")
      )
    ) {
      best = {
        sequence:
          sequence.map(
            (action) => ({
              ...action,

              interventions: {
                ...action.interventions,
              },
            }),
          ),

        successProbability,

        expectedFinalState,

        totalCost,

        maximumRisk:
          sequenceMaximumRisk,
      };
    }
  }

  if (
    !best
  ) {
    return {
      decision:
        "abstained",

      terminalGoalState,

      expectedFinalState:
        currentState,

      goalSuccessProbability:
        0,

      totalCost:
        0,

      maximumRisk:
        0,

      actionIds:
        [],

      subgoals:
        [],

      reason:
        "no-safe-subgoal-plan",
    };
  }

  const subgoals:
    AutonomousNumericSubgoal[] =
      [];

  let expectedState =
    currentState;

  for (
    let index =
      0;
    index <
      best.sequence.length;
    index +=
      1
  ) {
    const action =
      best.sequence[
        index
      ]!;

    let expectedEffect =
      0;

    let successProbabilityAfterAction =
      0;

    for (
      const program of
        programs
    ) {
      const probability =
        normalizedBelief.get(
          program.id,
        ) ??
        0;

      expectedEffect +=
        probability *
        predictHierarchicalProgramEffect(
          program,
          action.interventions,
        );

      const partialSequence =
        best.sequence.slice(
          0,
          index +
            1,
        );

      if (
        projectedState(
          program,
          currentState,
          partialSequence,
        ) >=
          terminalGoalState
      ) {
        successProbabilityAfterAction +=
          probability;
      }
    }

    expectedState +=
      expectedEffect;

    const id =
      `autonomous-subgoal-${index + 1}`;

    subgoals.push({
      id,

      targetState:
        Math.min(
          terminalGoalState,
          expectedState,
        ),

      actionId:
        action.id,

      expectedStateAfterAction:
        expectedState,

      goalSuccessProbabilityAfterAction:
        successProbabilityAfterAction,

      dependsOnGoalIds:
        index ===
          0
          ? []
          : [
              `autonomous-subgoal-${index}`,
            ],

      rationale:
        index ===
          best.sequence.length -
            1
          ? "Complete the posterior-supported final transition to the terminal goal."
          : "Reach a posterior-supported intermediate state that enables the next safe action.",
    });
  }

  return {
    decision:
      "planned",

    terminalGoalState,

    expectedFinalState:
      best.expectedFinalState,

    goalSuccessProbability:
      best.successProbability,

    totalCost:
      best.totalCost,

    maximumRisk:
      best.maximumRisk,

    actionIds:
      best.sequence.map(
        (action) =>
          action.id,
      ),

    subgoals,

    reason:
      "posterior-supported-subgoals",
  };
}

export function materializeAutonomousSubgoals(
  reasoner:
    HierarchicalGoalReasoner,

  parentGoalId:
    string,

  plan:
    AutonomousSubgoalPlan,
): Goal[] {
  if (
    plan.decision !==
      "planned"
  ) {
    throw new Error(
      "Cannot materialize an abstained autonomous subgoal plan.",
    );
  }

  const specifications:
    GoalSpecification[] =
      plan.subgoals.map(
        (subgoal) => ({
          id:
            subgoal.id,

          description:
            `Reach state ${subgoal.targetState.toFixed(
              3,
            )} using ${subgoal.actionId}.`,

          successCriteria: [
            `Observed state is at least ${subgoal.targetState.toFixed(
              3,
            )}.`,
          ],

          constraints: [
            "Use only reversible actions within the approved risk ceiling.",
          ],

          dependsOnGoalIds: [
            ...subgoal
              .dependsOnGoalIds,
          ],
        }),
      );

  return reasoner.decompose(
    parentGoalId,
    specifications,
  );
}

export function reconcileAutonomousSubgoals(
  reasoner:
    HierarchicalGoalReasoner,

  plan:
    AutonomousSubgoalPlan,

  observedState:
    number,
): string[] {
  validateNonNegativeFinite(
    "observedState",
    observedState,
  );

  if (
    plan.decision !==
      "planned"
  ) {
    return [];
  }

  const completed:
    string[] =
      [];

  for (
    const subgoal of
      plan.subgoals
  ) {
    if (
      observedState +
        Number.EPSILON <
      subgoal.targetState
    ) {
      break;
    }

    try {
      reasoner.complete(
        subgoal.id,
      );

      completed.push(
        subgoal.id,
      );
    } catch (
      error
    ) {
      if (
        !(
          error instanceof
            Error
        ) ||
        !/Unknown goal/.test(
          error.message,
        )
      ) {
        throw error;
      }
    }
  }

  return completed;
}

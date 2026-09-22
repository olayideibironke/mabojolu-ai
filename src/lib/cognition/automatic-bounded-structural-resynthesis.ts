import {
  runControlledAdaptivePrunedStructuralDiagnosis,
  type AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import {
  synthesizeBoundedLocalStructuralMutations,
  type LocalStructuralMutationCandidate,
  type StructuralMutationProbe,
} from "./bounded-local-structural-mutation";

import {
  synthesizeBoundedMultiFragmentStructuralRevisions,
  type MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  LocalRepairSearchCandidate,
  ProbabilisticLocalRepairSearch,
} from "./multi-step-fault-diagnosis-local-repair";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface StructuralResynthesisTarget {
  logicalFragmentId: string;
  variables: string[];
  evidenceIds: string[];
  evidenceCount: number;
  localMeanSquaredError: number;
}

export interface StructuralCandidateFamilyRevision {
  familyId: string;
  parentFamilyId: string;
  generation: number;
  failedCandidateIds: string[];
  targetFragmentIds: string[];
  preservedFragmentIds: string[];
  sourceEvidenceIds: string[];
  candidateIds: string[];
  grammarKinds: string[];
  reason:
    "collapsed-family-bounded-resynthesis";
}

export interface AutomaticStructuralResynthesisResult {
  decision:
    | "resynthesized"
    | "abstained";
  targets: StructuralResynthesisTarget[];
  localCandidateIds:
    Record<string, string[]>;
  candidates:
    MultiFragmentStructuralRevisionCandidate[];
  diagnosticProbes:
    StructuralMutationProbe[];
  familyRevision?:
    StructuralCandidateFamilyRevision;
  sourceEvidence:
    StructuralMechanismObservation[];
  reason:
    | "bounded-structural-family-resynthesized"
    | "no-local-resynthesis-targets"
    | "resynthesized-family-still-inadequate";
}

export interface AutomaticStructuralRecoveryResult {
  decision:
    | "resolved"
    | "reopen-search"
    | "abstained";
  resynthesis:
    AutomaticStructuralResynthesisResult;
  diagnosis?:
    AdaptivePrunedStructuralDiagnosisResult;
  reason:
    | "resynthesized-family-resolved"
    | "resynthesized-family-inadequate"
    | "resynthesized-diagnosis-abstained"
    | "resynthesis-abstained";
}

function validateNonNegativeFinite(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value <
      0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function validatePositiveInteger(
  name: string,
  value: number,
): void {
  if (
    !Number.isInteger(value) ||
    value <
      1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }
}

function validateUnitInterval(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
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

function cloneObservation(
  observation:
    StructuralMechanismObservation,
): StructuralMechanismObservation {
  return {
    measuredEffect:
      observation
        .measuredEffect,

    experiment: {
      ...observation
        .experiment,

      interventions: {
        ...observation
          .experiment
          .interventions,
      },
    },
  };
}

function cloneFragment(
  fragment:
    ValidatedCausalFragment,
): ValidatedCausalFragment {
  return {
    ...fragment,

    terms:
      fragment
        .terms
        .map(
          (term) => ({
            ...term,

            variables: [
              ...term
                .variables,
            ],
          }),
        ),
  };
}

function programWithoutFragment(
  program:
    HierarchicalCausalProgram,
  fragmentId:
    string,
): HierarchicalCausalProgram {
  const fragments =
    program
      .fragments
      .filter(
        (fragment) =>
          fragment.id !==
          fragmentId,
      )
      .map(
        cloneFragment,
      );

  if (
    fragments.length ===
      program
        .fragments
        .length
  ) {
    throw new Error(
      `Unknown structural resynthesis fragment ${fragmentId}.`,
    );
  }

  return {
    ...program,

    id:
      `${program.id}:resynthesis-without:${fragmentId}`,

    baseEffects: {
      ...program
        .baseEffects,
    },

    fragments,

    depth:
      1 +
      fragments.length,

    complexity:
      fragments.reduce(
        (
          sum,
          fragment,
        ) =>
          sum +
          fragment
            .terms
            .length,
        0,
      ),
  };
}

function fragmentVariables(
  fragment:
    ValidatedCausalFragment,
): string[] {
  return Array.from(
    new Set(
      fragment
        .terms
        .flatMap(
          (term) =>
            term.variables,
        ),
    ),
  ).sort();
}

function fragmentActivated(
  fragment:
    ValidatedCausalFragment,
  observation:
    StructuralMechanismObservation,
): boolean {
  if (
    fragment
      .terms
      .some(
        (term) =>
          term.kind ===
          "latent-bias",
      )
  ) {
    return true;
  }

  return fragmentVariables(
    fragment,
  ).some(
    (variable) =>
      Math.abs(
        observation
          .experiment
          .interventions[
            variable
          ] ??
        0,
      ) >
      Number.EPSILON,
  );
}

function localEvidenceForFragment(
  program:
    HierarchicalCausalProgram,
  fragment:
    ValidatedCausalFragment,
  evidence:
    readonly StructuralMechanismObservation[],
  maximumBackgroundMagnitude:
    number,
): StructuralMechanismObservation[] {
  const background =
    programWithoutFragment(
      program,
      fragment.id,
    );

  return evidence
    .filter(
      (observation) => {
        if (
          !fragmentActivated(
            fragment,
            observation,
          )
        ) {
          return false;
        }

        const backgroundPrediction =
          predictHierarchicalProgramEffect(
            background,
            observation
              .experiment
              .interventions,
          );

        return Math.abs(
          backgroundPrediction,
        ) <=
          maximumBackgroundMagnitude;
      },
    )
    .map(
      cloneObservation,
    );
}

function programMeanSquaredError(
  program:
    HierarchicalCausalProgram,
  evidence:
    readonly StructuralMechanismObservation[],
): number {
  if (
    evidence.length ===
      0
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return evidence.reduce(
    (
      sum,
      observation,
    ) => {
      const error =
        observation
          .measuredEffect -
        predictHierarchicalProgramEffect(
          program,
          observation
            .experiment
            .interventions,
        );

      return sum +
        error *
          error;
    },
    0,
  ) /
    evidence.length;
}

function observedVariables(
  evidence:
    readonly StructuralMechanismObservation[],
): string[] {
  return Array.from(
    new Set(
      evidence.flatMap(
        (observation) =>
          Object.keys(
            observation
              .experiment
              .interventions,
          ),
      ),
    ),
  ).sort();
}

export function identifyStructuralResynthesisTargets(
  incumbent:
    HierarchicalCausalProgram,
  evidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumLocalEvidence?: number;
    minimumLocalMeanSquaredError?: number;
    maximumBackgroundMagnitude?: number;
    maximumTargets?: number;
  },
): StructuralResynthesisTarget[] {
  const minimumLocalEvidence =
    options
      ?.minimumLocalEvidence ??
    2;

  const minimumLocalMeanSquaredError =
    options
      ?.minimumLocalMeanSquaredError ??
    0.005;

  const maximumBackgroundMagnitude =
    options
      ?.maximumBackgroundMagnitude ??
    0.05;

  const maximumTargets =
    options
      ?.maximumTargets ??
    3;

  validatePositiveInteger(
    "minimumLocalEvidence",
    minimumLocalEvidence,
  );

  validateNonNegativeFinite(
    "minimumLocalMeanSquaredError",
    minimumLocalMeanSquaredError,
  );

  validateNonNegativeFinite(
    "maximumBackgroundMagnitude",
    maximumBackgroundMagnitude,
  );

  validatePositiveInteger(
    "maximumTargets",
    maximumTargets,
  );

  return incumbent
    .fragments
    .map(
      (
        fragment,
      ):
        StructuralResynthesisTarget |
        undefined => {
        const localEvidence =
          localEvidenceForFragment(
            incumbent,
            fragment,
            evidence,
            maximumBackgroundMagnitude,
          );

        if (
          localEvidence.length <
            minimumLocalEvidence
        ) {
          return undefined;
        }

        const localMeanSquaredError =
          programMeanSquaredError(
            incumbent,
            localEvidence,
          );

        if (
          localMeanSquaredError <
            minimumLocalMeanSquaredError
        ) {
          return undefined;
        }

        return {
          logicalFragmentId:
            fragment.id,

          variables:
            fragmentVariables(
              fragment,
            ),

          evidenceIds:
            localEvidence.map(
              (observation) =>
                observation
                  .experiment
                  .id,
            ),

          evidenceCount:
            localEvidence.length,

          localMeanSquaredError,
        };
      },
    )
    .filter(
      (
        target,
      ):
        target is
          StructuralResynthesisTarget =>
        target !==
        undefined,
    )
    .sort(
      (
        left,
        right,
      ) =>
        right
          .localMeanSquaredError -
          left
            .localMeanSquaredError ||
        left
          .logicalFragmentId
          .localeCompare(
            right
              .logicalFragmentId,
          ),
    )
    .slice(
      0,
      maximumTargets,
    );
}

function selectLocalCandidates(
  candidates:
    readonly LocalStructuralMutationCandidate[],
  options: {
    maximumLocalCandidates: number;
    localObjectiveGap: number;
    minimumLocalCandidates: number;
  },
): LocalStructuralMutationCandidate[] {
  if (
    candidates.length ===
      0
  ) {
    return [];
  }

  const ranked = [
    ...candidates,
  ].sort(
    (
      left,
      right,
    ) =>
      left.objective -
        right.objective ||
      left.id.localeCompare(
        right.id,
      ),
  );

  const bestObjective =
    ranked[
      0
    ]!
      .objective;

  const plausible =
    ranked.filter(
      (candidate) =>
        candidate.objective <=
          bestObjective +
          options
            .localObjectiveGap,
    );

  const selected = [
    ...plausible,
  ];

  for (
    const candidate of
      ranked
  ) {
    if (
      selected.length >=
        options
          .minimumLocalCandidates
    ) {
      break;
    }

    if (
      selected.some(
        (item) =>
          item.id ===
          candidate.id,
      )
    ) {
      continue;
    }

    selected.push(
      candidate,
    );
  }

  return selected
    .slice(
      0,
      options
        .maximumLocalCandidates,
    );
}

function localCandidateToJoint(
  candidate:
    LocalStructuralMutationCandidate,
): MultiFragmentStructuralRevisionCandidate {
  const changed =
    candidate.kind !==
      "incumbent" &&
    candidate.fragment.id !==
      candidate.targetFragmentId;

  return {
    id:
      `${candidate.id}:resynthesized-joint`,

    componentCandidateIds: {
      [
        candidate
          .targetFragmentId
      ]:
        candidate.id,
    },

    replacementFragmentIds:
      changed
        ? {
            [
              candidate
                .targetFragmentId
            ]:
              candidate
                .fragment
                .id,
          }
        : {},

    retiredFragmentIds:
      changed
        ? [
            candidate
              .targetFragmentId,
          ]
        : [],

    topologyChangedFragmentIds:
      changed &&
      candidate
        .topologyChanged
        ? [
            candidate
              .targetFragmentId,
          ]
        : [],

    parameterChangedFragmentIds:
      changed &&
      !candidate
        .topologyChanged
        ? [
            candidate
              .targetFragmentId,
          ]
        : [],

    program:
      candidate.program,

    discoveryMeanSquaredError:
      candidate
        .discoveryMeanSquaredError,

    complexityPenalty:
      candidate
        .complexityPenalty,

    objective:
      candidate.objective,
  };
}

function candidateVariables(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
): string[] {
  return Array.from(
    new Set(
      candidates.flatMap(
        (candidate) => [
          ...Object.keys(
            candidate
              .program
              .baseEffects,
          ),
          ...candidate
            .program
            .fragments
            .flatMap(
              (fragment) =>
                fragment
                  .terms
                  .flatMap(
                    (term) =>
                      term.variables,
                  ),
            ),
        ]),
      ),
    ),
  ).sort();
}

function boundedSubsets(
  values:
    readonly string[],
  maximumArity:
    number,
): string[][] {
  const output:
    string[][] =
      [];

  function visit(
    start:
      number,
    chosen:
      string[],
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
        maximumArity
    ) {
      return;
    }

    for (
      let index =
        start;
      index <
        values.length;
      index +=
        1
    ) {
      const value =
        values[
          index
        ];

      if (
        value ===
          undefined
      ) {
        continue;
      }

      chosen.push(
        value,
      );

      visit(
        index +
          1,
        chosen,
      );

      chosen.pop();
    }
  }

  visit(
    0,
    [],
  );

  return output;
}

function levelAssignments(
  variables:
    readonly string[],
  levels:
    readonly number[],
): Record<string, number>[] {
  let assignments:
    Record<string, number>[] = [
      {},
    ];

  for (
    const variable of
      variables
  ) {
    const next:
      Record<string, number>[] =
        [];

    for (
      const assignment of
        assignments
    ) {
      for (
        const level of
          levels
      ) {
        next.push({
          ...assignment,

          [
            variable
          ]:
            level,
        });
      }
    }

    assignments =
      next;
  }

  return assignments;
}

export function synthesizeResynthesisDiagnosticProbes(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  options?: {
    levels?: readonly number[];
    maximumArity?: number;
    maximumProbes?: number;
    minimumPredictionSpread?: number;
    baseRisk?: number;
    baseCost?: number;
    observationStdDev?: number;
  },
): StructuralMutationProbe[] {
  if (
    candidates.length <
      2
  ) {
    return [];
  }

  const variables =
    candidateVariables(
      candidates,
    );

  const levels =
    options
      ?.levels ??
    [
      0.5,
      1,
    ];

  for (
    const level of
      levels
  ) {
    validateUnitInterval(
      "resynthesis probe level",
      level,
    );
  }

  const maximumArity =
    options
      ?.maximumArity ??
    2;

  const maximumProbes =
    options
      ?.maximumProbes ??
    32;

  const minimumPredictionSpread =
    options
      ?.minimumPredictionSpread ??
    0.05;

  const baseRisk =
    options
      ?.baseRisk ??
    0.03;

  const baseCost =
    options
      ?.baseCost ??
    0.02;

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.03;

  validatePositiveInteger(
    "maximumArity",
    maximumArity,
  );

  validatePositiveInteger(
    "maximumProbes",
    maximumProbes,
  );

  validateNonNegativeFinite(
    "minimumPredictionSpread",
    minimumPredictionSpread,
  );

  validateUnitInterval(
    "baseRisk",
    baseRisk,
  );

  validateNonNegativeFinite(
    "baseCost",
    baseCost,
  );

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <=
      0
  ) {
    throw new Error(
      "resynthesis observationStdDev must be positive and finite.",
    );
  }

  const probes:
    StructuralMutationProbe[] =
      [];

  for (
    const subset of
      boundedSubsets(
        variables,
        Math.min(
          maximumArity,
          variables.length,
        ),
      )
  ) {
    for (
      const active of
        levelAssignments(
          subset,
          levels,
        )
    ) {
      const interventions:
        Record<string, number> =
          {};

      for (
        const variable of
          variables
      ) {
        interventions[
          variable
        ] =
          active[
            variable
          ] ??
          0;
      }

      const predictions =
        candidates.map(
          (candidate) =>
            predictHierarchicalProgramEffect(
              candidate.program,
              interventions,
            ),
        );

      const spread =
        Math.max(
          ...predictions,
        ) -
        Math.min(
          ...predictions,
        );

      if (
        spread <
          minimumPredictionSpread
      ) {
        continue;
      }

      const arity =
        subset.length;

      const meanLevel =
        Object.values(
          active,
        ).reduce(
          (
            sum,
            value,
          ) =>
            sum +
            value,
          0,
        ) /
        arity;

      const signature =
        Object.entries(
          interventions,
        )
          .filter(
            ([, value]) =>
              Math.abs(
                value,
              ) >
              Number.EPSILON,
          )
          .sort(
            (
              left,
              right,
            ) =>
              left[0]
                .localeCompare(
                  right[0],
                ),
          )
          .map(
            (
              [
                variable,
                value,
              ],
            ) =>
              `${variable}=${value.toFixed(
                2,
              )}`,
          )
          .join("+");

      probes.push({
        id:
          `resynthesis-probe:${signature}`,

        interventions,

        risk:
          Math.min(
            1,
            baseRisk *
            arity *
            Math.max(
              0.5,
              meanLevel,
            ),
          ),

        cost:
          baseCost *
          arity *
          Math.max(
            0.5,
            meanLevel,
          ),

        reversible:
          true,

        observationStdDev,
      });
    }
  }

  return probes
    .sort(
      (
        left,
        right,
      ) =>
        left.cost -
          right.cost ||
        left.risk -
          right.risk ||
        left.id.localeCompare(
          right.id,
        ),
    )
    .slice(
      0,
      maximumProbes,
    );
}

export function automaticallyResynthesizeCollapsedStructuralFamily(
  incumbent:
    HierarchicalCausalProgram,
  failedCandidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  collapse:
    AdaptivePrunedStructuralDiagnosisResult,
  parentFamilyId:
    string,
  generation:
    number,
  excludedEvidenceIds:
    readonly string[] = [],
  options?: {
    minimumLocalEvidence?: number;
    minimumLocalMeanSquaredError?: number;
    maximumBackgroundMagnitude?: number;
    maximumTargets?: number;
    maximumLocalCandidates?: number;
    minimumLocalCandidates?: number;
    localObjectiveGap?: number;
    maximumJointCandidates?: number;
    jointObjectiveGap?: number;
    maximumResynthesizedMeanSquaredError?: number;
  },
): AutomaticStructuralResynthesisResult {
  if (
    collapse.decision !==
      "reopen-search"
  ) {
    throw new Error(
      "Automatic structural re-synthesis requires a collapsed candidate family.",
    );
  }

  validatePositiveInteger(
    "generation",
    generation,
  );

  const sourceEvidence =
    collapse
      .allEvidence
      .map(
        cloneObservation,
      );

  const excluded =
    new Set(
      excludedEvidenceIds,
    );

  const overlapping =
    sourceEvidence
      .map(
        (observation) =>
          observation
            .experiment
            .id,
      )
      .filter(
        (id) =>
          excluded.has(
            id,
          ),
      );

  if (
    overlapping.length >
      0
  ) {
    throw new Error(
      "Structural re-synthesis evidence must remain disjoint from excluded protected evidence.",
    );
  }

  const targets =
    identifyStructuralResynthesisTargets(
      incumbent,
      sourceEvidence,
      {
        minimumLocalEvidence:
          options
            ?.minimumLocalEvidence,

        minimumLocalMeanSquaredError:
          options
            ?.minimumLocalMeanSquaredError,

        maximumBackgroundMagnitude:
          options
            ?.maximumBackgroundMagnitude,

        maximumTargets:
          options
            ?.maximumTargets,
      },
    );

  if (
    targets.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      targets:
        [],

      localCandidateIds:
        {},

      candidates:
        [],

      diagnosticProbes:
        [],

      sourceEvidence,

      reason:
        "no-local-resynthesis-targets",
    };
  }

  const maximumLocalCandidates =
    options
      ?.maximumLocalCandidates ??
    3;

  const minimumLocalCandidates =
    options
      ?.minimumLocalCandidates ??
    2;

  const localObjectiveGap =
    options
      ?.localObjectiveGap ??
    0.02;

  const maximumJointCandidates =
    options
      ?.maximumJointCandidates ??
    16;

  const jointObjectiveGap =
    options
      ?.jointObjectiveGap ??
    0.03;

  const maximumResynthesizedMeanSquaredError =
    options
      ?.maximumResynthesizedMeanSquaredError ??
    0.02;

  validatePositiveInteger(
    "maximumLocalCandidates",
    maximumLocalCandidates,
  );

  validatePositiveInteger(
    "minimumLocalCandidates",
    minimumLocalCandidates,
  );

  validateNonNegativeFinite(
    "localObjectiveGap",
    localObjectiveGap,
  );

  validatePositiveInteger(
    "maximumJointCandidates",
    maximumJointCandidates,
  );

  validateNonNegativeFinite(
    "jointObjectiveGap",
    jointObjectiveGap,
  );

  validateNonNegativeFinite(
    "maximumResynthesizedMeanSquaredError",
    maximumResynthesizedMeanSquaredError,
  );

  const variables =
    observedVariables(
      sourceEvidence,
    );

  const localSets:
    Record<
      string,
      LocalStructuralMutationCandidate[]
    > =
      {};

  for (
    const target of
      targets
  ) {
    const fragment =
      incumbent
        .fragments
        .find(
          (candidate) =>
            candidate.id ===
            target
              .logicalFragmentId,
        );

    if (!fragment) {
      throw new Error(
        `Structural re-synthesis target ${target.logicalFragmentId} is missing from the active program.`,
      );
    }

    const localEvidence =
      localEvidenceForFragment(
        incumbent,
        fragment,
        sourceEvidence,
        options
          ?.maximumBackgroundMagnitude ??
          0.05,
      );

    const synthesized =
      synthesizeBoundedLocalStructuralMutations(
        incumbent,
        target
          .logicalFragmentId,
        localEvidence,
        variables,
        {
          includeSaturating:
            true,

          includeInteractions:
            true,

          includeLatentBias:
            true,

          maximumCandidates:
            Math.max(
              12,
              maximumLocalCandidates *
              3,
            ),
        },
      );

    localSets[
      target
        .logicalFragmentId
    ] =
      selectLocalCandidates(
        synthesized,
        {
          maximumLocalCandidates,

          localObjectiveGap,

          minimumLocalCandidates,
        },
      );
  }

  const localCandidateIds =
    Object.fromEntries(
      Object.entries(
        localSets,
      ).map(
        (
          [
            fragmentId,
            candidates,
          ],
        ) => [
          fragmentId,
          candidates.map(
            (candidate) =>
              candidate.id,
          ),
        ],
      ),
    );

  let candidates:
    MultiFragmentStructuralRevisionCandidate[];

  if (
    targets.length ===
      1
  ) {
    const only =
      localSets[
        targets[
          0
        ]!
          .logicalFragmentId
      ] ??
      [];

    candidates =
      only.map(
        localCandidateToJoint,
      );
  } else {
    candidates =
      synthesizeBoundedMultiFragmentStructuralRevisions(
        incumbent,
        localSets,
        sourceEvidence,
        {
          maximumChangedFragments:
            targets.length,

          maximumCandidates:
            maximumJointCandidates,

          complexityPenaltyPerTopologyChange:
            0.002,
        },
      );
  }

  if (
    candidates.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      targets,

      localCandidateIds,

      candidates:
        [],

      diagnosticProbes:
        [],

      sourceEvidence,

      reason:
        "resynthesized-family-still-inadequate",
    };
  }

  const ranked = [
    ...candidates,
  ].sort(
    (
      left,
      right,
    ) =>
      left.objective -
        right.objective ||
      left.id.localeCompare(
        right.id,
      ),
  );

  const bestObjective =
    ranked[
      0
    ]!
      .objective;

  candidates =
    ranked
      .filter(
        (candidate) =>
          candidate.objective <=
            bestObjective +
            jointObjectiveGap,
      )
      .slice(
        0,
        maximumJointCandidates,
      );

  const bestMeanSquaredError =
    Math.min(
      ...candidates.map(
        (candidate) =>
          programMeanSquaredError(
            candidate.program,
            sourceEvidence,
          ),
      ),
    );

  if (
    !Number.isFinite(
      bestMeanSquaredError,
    ) ||
    bestMeanSquaredError >
      maximumResynthesizedMeanSquaredError
  ) {
    return {
      decision:
        "abstained",

      targets,

      localCandidateIds,

      candidates,

      diagnosticProbes:
        [],

      sourceEvidence,

      reason:
        "resynthesized-family-still-inadequate",
    };
  }

  const diagnosticProbes =
    synthesizeResynthesisDiagnosticProbes(
      candidates,
    );

  const targetSet =
    new Set(
      targets.map(
        (target) =>
          target
            .logicalFragmentId,
      ),
    );

  const preservedFragmentIds =
    incumbent
      .fragments
      .map(
        (fragment) =>
          fragment.id,
      )
      .filter(
        (fragmentId) =>
          !targetSet.has(
            fragmentId,
          ),
      )
      .sort();

  const grammarKinds =
    Array.from(
      new Set(
        Object.values(
          localSets,
        )
          .flat()
          .map(
            (candidate) =>
              candidate.kind,
          ),
      ),
    ).sort();

  const familyRevision:
    StructuralCandidateFamilyRevision = {
    familyId:
      `${parentFamilyId}:resynthesis:${generation}`,

    parentFamilyId,

    generation,

    failedCandidateIds:
      failedCandidates
        .map(
          (candidate) =>
            candidate.id,
        )
        .sort(),

    targetFragmentIds:
      targets
        .map(
          (target) =>
            target
              .logicalFragmentId,
        )
        .sort(),

    preservedFragmentIds,

    sourceEvidenceIds:
      sourceEvidence
        .map(
          (observation) =>
            observation
              .experiment
              .id,
        )
        .sort(),

    candidateIds:
      candidates
        .map(
          (candidate) =>
            candidate.id,
        )
        .sort(),

    grammarKinds,

    reason:
      "collapsed-family-bounded-resynthesis",
  };

  return {
    decision:
      "resynthesized",

    targets,

    localCandidateIds,

    candidates,

    diagnosticProbes,

    familyRevision,

    sourceEvidence,

    reason:
      "bounded-structural-family-resynthesized",
  };
}

export function runControlledAutomaticStructuralRecovery(
  incumbent:
    HierarchicalCausalProgram,
  failedCandidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  collapse:
    AdaptivePrunedStructuralDiagnosisResult,
  parentFamilyId:
    string,
  generation:
    number,
  actualProgram:
    HierarchicalCausalProgram,
  excludedEvidenceIds:
    readonly string[] = [],
  options?: {
    resynthesis?: Parameters<
      typeof automaticallyResynthesizeCollapsedStructuralFamily
    >[
      6
    ];
    diagnosis?: Parameters<
      typeof runControlledAdaptivePrunedStructuralDiagnosis
    >[
      4
    ];
  },
): AutomaticStructuralRecoveryResult {
  const resynthesis =
    automaticallyResynthesizeCollapsedStructuralFamily(
      incumbent,
      failedCandidates,
      collapse,
      parentFamilyId,
      generation,
      excludedEvidenceIds,
      options
        ?.resynthesis,
    );

  if (
    resynthesis.decision !==
      "resynthesized"
  ) {
    return {
      decision:
        "abstained",

      resynthesis,

      reason:
        "resynthesis-abstained",
    };
  }

  if (
    resynthesis
      .candidates
      .length <
      2 ||
    resynthesis
      .diagnosticProbes
      .length ===
      0
  ) {
    return {
      decision:
        "abstained",

      resynthesis,

      reason:
        "resynthesized-diagnosis-abstained",
    };
  }

  const diagnosis =
    runControlledAdaptivePrunedStructuralDiagnosis(
      resynthesis
        .candidates,
      resynthesis
        .diagnosticProbes,
      actualProgram,
      [],
      options
        ?.diagnosis,
    );

  if (
    diagnosis.decision ===
      "resolved"
  ) {
    return {
      decision:
        "resolved",

      resynthesis,

      diagnosis,

      reason:
        "resynthesized-family-resolved",
    };
  }

  if (
    diagnosis.decision ===
      "reopen-search"
  ) {
    return {
      decision:
        "reopen-search",

      resynthesis,

      diagnosis,

      reason:
        "resynthesized-family-inadequate",
    };
  }

  return {
    decision:
      "abstained",

    resynthesis,

    diagnosis,

    reason:
      "resynthesized-diagnosis-abstained",
  };
}

function toRepairCandidate(
  candidate:
    MultiFragmentStructuralRevisionCandidate,
): LocalRepairSearchCandidate {
  return {
    id:
      candidate.id,

    program:
      candidate.program,

    replacementFragmentIds: {
      ...candidate
        .replacementFragmentIds,
    },

    retiredFragmentIds: [
      ...candidate
        .retiredFragmentIds,
    ],

    discoveryMeanSquaredError:
      candidate
        .discoveryMeanSquaredError,

    complexityPenalty:
      candidate
        .complexityPenalty,

    objective:
      candidate.objective,
  };
}

export function buildResynthesizedStructuralRepairSearch(
  recovery:
    AutomaticStructuralRecoveryResult,
): ProbabilisticLocalRepairSearch {
  if (
    recovery.decision !==
      "resolved" ||
    !recovery
      .diagnosis
      ?.selectedCandidateId ||
    recovery
      .resynthesis
      .decision !==
      "resynthesized"
  ) {
    throw new Error(
      "Resynthesized structural repair search requires a resolved recovery episode.",
    );
  }

  const candidates =
    recovery
      .resynthesis
      .candidates
      .map(
        toRepairCandidate,
      );

  const selectedCandidate =
    candidates.find(
      (candidate) =>
        candidate.id ===
        recovery
          .diagnosis
          ?.selectedCandidateId,
    );

  if (!selectedCandidate) {
    throw new Error(
      `Resolved resynthesized candidate ${recovery.diagnosis.selectedCandidateId} is missing.`,
    );
  }

  const targetFragmentIds =
    recovery
      .resynthesis
      .targets
      .map(
        (target) =>
          target
            .logicalFragmentId,
      )
      .sort();

  return {
    decision:
      "search",

    faultExplanation: {
      id:
        "automatic-bounded-structural-resynthesis",

      kind:
        targetFragmentIds.length >
          1
          ? "multi-fragment"
          : "single-fragment",

      fragmentIds:
        targetFragmentIds,
    },

    faultConfidence:
      recovery
        .diagnosis
        .finalBelief
        .confidence,

    faultFragmentIds:
      targetFragmentIds,

    repairEvidenceIds:
      recovery
        .resynthesis
        .sourceEvidence
        .map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

    candidates,

    selectedCandidate,

    reason:
      "fault-posterior-authorized-local-repair-search",
  };
}

import {
  MultiFragmentStructuralPosterior,
  planContingentMultiFragmentStructuralDiagnostics,
  type ContingentStructuralDiagnosticPlan,
  type MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import type {
  StructuralMutationProbe,
} from "./bounded-local-structural-mutation";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export type StructuralCandidateAuditAction =
  | "pruned"
  | "restored";

export interface StructuralCandidateAuditEvent {
  sequence: number;
  action: StructuralCandidateAuditAction;
  candidateId: string;
  evidenceIds: string[];
  probabilityAtAction: number;
  topProbabilityAtAction: number;
  reversible: true;
  reason:
    | "repeated-posterior-contradiction"
    | "manual-audit-restoration";
}

export interface AdaptiveStructuralCandidateSet {
  activeCandidateIds: string[];
  prunedCandidateIds: string[];
  auditHistory: StructuralCandidateAuditEvent[];
}

export interface AdaptivePrunedStructuralBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  activeCandidateCount: number;
}

export interface RecedingStructuralDiagnosisStep {
  step: number;
  probeId: string;
  observationId: string;
  observedEffect: number;
  activeCandidateCountBefore: number;
  activeCandidateCountAfter: number;
  prunedCandidateIds: string[];
  belief: AdaptivePrunedStructuralBelief;
  replanned: true;
}

export interface AdaptivePrunedStructuralDiagnosisResult {
  decision:
    | "resolved"
    | "reopen-search"
    | "abstained";
  selectedCandidateId?: string;
  initialCandidateCount: number;
  finalCandidateSet: AdaptiveStructuralCandidateSet;
  initialBelief: AdaptivePrunedStructuralBelief;
  finalBelief: AdaptivePrunedStructuralBelief;
  acquiredObservations: StructuralMechanismObservation[];
  allEvidence: StructuralMechanismObservation[];
  executedProbeIds: string[];
  steps: RecedingStructuralDiagnosisStep[];
  reason:
    | "single-structural-candidate-remains"
    | "all-retained-structural-candidates-inadequate"
    | "no-safe-receding-structural-probe"
    | "receding-structural-budget-exhausted";
}

function validateUnitInterval(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validatePositiveInteger(
  name: string,
  value: number,
): void {
  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${name} must be a positive integer.`,
    );
  }
}

function validateNonNegativeFinite(
  name: string,
  value: number,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative finite number.`,
    );
  }
}

function cloneObservation(
  observation:
    StructuralMechanismObservation,
): StructuralMechanismObservation {
  return {
    measuredEffect:
      observation.measuredEffect,

    experiment: {
      ...observation.experiment,

      interventions: {
        ...observation
          .experiment
          .interventions,
      },
    },
  };
}

function logGaussianLikelihood(
  observation: number,
  mean: number,
  stdDev: number,
): number {
  if (
    !Number.isFinite(stdDev) ||
    stdDev <= 0
  ) {
    throw new Error(
      "Receding structural observationStdDev must be positive and finite.",
    );
  }

  const variance =
    stdDev *
    stdDev;

  return -0.5 *
    Math.log(
      2 *
      Math.PI *
      variance,
    ) -
    (
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
      );
}

function normalizeWeights(
  weights:
    Readonly<Record<string, number>>,
  activeCandidateIds:
    readonly string[],
): Record<string, number> {
  const active =
    new Set(
      activeCandidateIds,
    );

  const entries =
    Object.entries(
      weights,
    ).filter(
      ([id]) =>
        active.has(
          id,
        ),
    );

  if (
    entries.length ===
      0
  ) {
    throw new Error(
      "Adaptive structural candidate set has no active probability mass.",
    );
  }

  const total =
    entries.reduce(
      (sum, [, value]) =>
        sum +
        value,
      0,
    );

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    throw new Error(
      "Adaptive structural candidate probabilities must contain positive finite mass.",
    );
  }

  return Object.fromEntries(
    entries.map(
      ([id, value]) => [
        id,
        value /
          total,
      ],
    ),
  );
}

function updateProbabilities(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  activeCandidateIds:
    readonly string[],
  probabilities:
    Readonly<Record<string, number>>,
  observation:
    StructuralMechanismObservation,
  observationStdDev: number,
): Record<string, number> {
  const active =
    new Set(
      activeCandidateIds,
    );

  const logWeights:
    Record<string, number> =
      {};

  for (
    const candidate of
      candidates
  ) {
    if (
      !active.has(
        candidate.id,
      )
    ) {
      continue;
    }

    const prior =
      probabilities[
        candidate.id
      ] ??
      0;

    if (
      prior <=
        0
    ) {
      continue;
    }

    const prediction =
      predictHierarchicalProgramEffect(
        candidate.program,
        observation
          .experiment
          .interventions,
      );

    logWeights[
      candidate.id
    ] =
      Math.log(
        prior,
      ) +
      logGaussianLikelihood(
        observation
          .measuredEffect,
        prediction,
        observationStdDev,
      );
  }

  const entries =
    Object.entries(
      logWeights,
    );

  if (
    entries.length ===
      0
  ) {
    throw new Error(
      "Receding structural posterior lost all active probability mass.",
    );
  }

  const maximum =
    Math.max(
      ...entries.map(
        ([, value]) =>
          value,
      ),
    );

  const exponentiated =
    Object.fromEntries(
      entries.map(
        ([id, value]) => [
          id,
          Math.exp(
            value -
              maximum,
          ),
        ],
      ),
    );

  return normalizeWeights(
    exponentiated,
    activeCandidateIds,
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

function beliefFromProbabilities(
  probabilities:
    Readonly<Record<string, number>>,
  activeCandidateIds:
    readonly string[],
): AdaptivePrunedStructuralBelief {
  const normalized =
    normalizeWeights(
      probabilities,
      activeCandidateIds,
    );

  const ranked =
    Object.entries(
      normalized,
    ).sort(
      (left, right) =>
        right[1] -
          left[1] ||
        left[0].localeCompare(
          right[0],
        ),
    );

  const top =
    ranked[0];

  if (!top) {
    throw new Error(
      "Adaptive structural belief has no top candidate.",
    );
  }

  const second =
    ranked[
      1
    ]?.[1] ??
    0;

  const probabilityValues =
    ranked.map(
      ([, probability]) =>
        probability,
    );

  return {
    probabilities:
      normalized,

    topCandidateId:
      top[0],

    confidence:
      top[1],

    margin:
      top[1] -
      second,

    normalizedEntropy:
      probabilityValues.length <=
        1
        ? 0
        : entropy(
            probabilityValues,
          ) /
          Math.log(
            probabilityValues.length,
          ),

    activeCandidateCount:
      activeCandidateIds.length,
  };
}

function candidateMeanSquaredError(
  candidate:
    MultiFragmentStructuralRevisionCandidate,
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
    (sum, observation) => {
      const error =
        observation
          .measuredEffect -
        predictHierarchicalProgramEffect(
          candidate.program,
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

function bestActiveMeanSquaredError(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  activeCandidateIds:
    readonly string[],
  evidence:
    readonly StructuralMechanismObservation[],
): number {
  const active =
    new Set(
      activeCandidateIds,
    );

  const scores =
    candidates
      .filter(
        (candidate) =>
          active.has(
            candidate.id,
          ),
      )
      .map(
        (candidate) =>
          candidateMeanSquaredError(
            candidate,
            evidence,
          ),
      );

  return scores.length ===
    0
    ? Number.POSITIVE_INFINITY
    : Math.min(
        ...scores,
      );
}

export function createAdaptiveStructuralCandidateSet(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
): AdaptiveStructuralCandidateSet {
  if (
    candidates.length <
      2
  ) {
    throw new Error(
      "Adaptive structural candidate pruning requires at least two candidates.",
    );
  }

  return {
    activeCandidateIds:
      candidates
        .map(
          (candidate) =>
            candidate.id,
        )
        .sort(),

    prunedCandidateIds:
      [],

    auditHistory:
      [],
  };
}

export function pruneContradictedStructuralCandidates(
  state:
    AdaptiveStructuralCandidateSet,
  belief:
    AdaptivePrunedStructuralBelief,
  evidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumEvidenceBeforePrune?: number;
    maximumProbabilityForPrune?: number;
    maximumRelativeProbabilityForPrune?: number;
    minimumRetainedCandidates?: number;
  },
): AdaptiveStructuralCandidateSet {
  const minimumEvidenceBeforePrune =
    options
      ?.minimumEvidenceBeforePrune ??
    2;

  const maximumProbabilityForPrune =
    options
      ?.maximumProbabilityForPrune ??
    0.01;

  const maximumRelativeProbabilityForPrune =
    options
      ?.maximumRelativeProbabilityForPrune ??
    0.02;

  const minimumRetainedCandidates =
    options
      ?.minimumRetainedCandidates ??
    1;

  validatePositiveInteger(
    "minimumEvidenceBeforePrune",
    minimumEvidenceBeforePrune,
  );

  validateUnitInterval(
    "maximumProbabilityForPrune",
    maximumProbabilityForPrune,
  );

  validateUnitInterval(
    "maximumRelativeProbabilityForPrune",
    maximumRelativeProbabilityForPrune,
  );

  validatePositiveInteger(
    "minimumRetainedCandidates",
    minimumRetainedCandidates,
  );

  if (
    evidence.length <
      minimumEvidenceBeforePrune ||
    state
      .activeCandidateIds
      .length <=
      minimumRetainedCandidates
  ) {
    return {
      activeCandidateIds: [
        ...state
          .activeCandidateIds,
      ],

      prunedCandidateIds: [
        ...state
          .prunedCandidateIds,
      ],

      auditHistory:
        state
          .auditHistory
          .map(
            (event) => ({
              ...event,

              evidenceIds: [
                ...event
                  .evidenceIds,
              ],
            }),
          ),
    };
  }

  const topProbability =
    belief.confidence;

  const candidatesToPrune =
    state
      .activeCandidateIds
      .filter(
        (candidateId) => {
          if (
            candidateId ===
              belief
                .topCandidateId
          ) {
            return false;
          }

          const probability =
            belief.probabilities[
              candidateId
            ] ??
            0;

          const relative =
            topProbability >
              0
              ? probability /
                topProbability
              : 1;

          return (
            probability <=
              maximumProbabilityForPrune &&
            relative <=
              maximumRelativeProbabilityForPrune
          );
        },
      )
      .sort(
        (left, right) =>
          (
            belief
              .probabilities[
                left
              ] ??
            0
          ) -
            (
              belief
                .probabilities[
                  right
                ] ??
              0
            ) ||
          left.localeCompare(
            right,
          ),
      );

  const maximumPrunable =
    Math.max(
      0,
      state
        .activeCandidateIds
        .length -
        minimumRetainedCandidates,
    );

  const selected =
    candidatesToPrune.slice(
      0,
      maximumPrunable,
    );

  if (
    selected.length ===
      0
  ) {
    return {
      activeCandidateIds: [
        ...state
          .activeCandidateIds,
      ],

      prunedCandidateIds: [
        ...state
          .prunedCandidateIds,
      ],

      auditHistory: [
        ...state
          .auditHistory
          .map(
            (event) => ({
              ...event,

              evidenceIds: [
                ...event
                  .evidenceIds,
              ],
            }),
          ),
      ],
    };
  }

  const selectedSet =
    new Set(
      selected,
    );

  const evidenceIds =
    evidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  const startSequence =
    state
      .auditHistory
      .length;

  const newEvents =
    selected.map(
      (
        candidateId,
        index,
      ): StructuralCandidateAuditEvent => ({
        sequence:
          startSequence +
          index +
          1,

        action:
          "pruned",

        candidateId,

        evidenceIds: [
          ...evidenceIds,
        ],

        probabilityAtAction:
          belief.probabilities[
            candidateId
          ] ??
          0,

        topProbabilityAtAction:
          topProbability,

        reversible:
          true,

        reason:
          "repeated-posterior-contradiction",
      }),
    );

  return {
    activeCandidateIds:
      state
        .activeCandidateIds
        .filter(
          (candidateId) =>
            !selectedSet.has(
              candidateId,
            ),
        )
        .sort(),

    prunedCandidateIds:
      Array.from(
        new Set([
          ...state
            .prunedCandidateIds,
          ...selected,
        ]),
      ).sort(),

    auditHistory: [
      ...state
        .auditHistory
        .map(
          (event) => ({
            ...event,

            evidenceIds: [
              ...event
                .evidenceIds,
            ],
          }),
        ),
      ...newEvents,
    ],
  };
}

export function restorePrunedStructuralCandidate(
  state:
    AdaptiveStructuralCandidateSet,
  candidateId: string,
  probabilityAtRestore = 0,
): AdaptiveStructuralCandidateSet {
  validateUnitInterval(
    "probabilityAtRestore",
    probabilityAtRestore,
  );

  if (
    !state
      .prunedCandidateIds
      .includes(
        candidateId,
      )
  ) {
    throw new Error(
      `Cannot restore unpruned structural candidate ${candidateId}.`,
    );
  }

  return {
    activeCandidateIds:
      Array.from(
        new Set([
          ...state
            .activeCandidateIds,
          candidateId,
        ]),
      ).sort(),

    prunedCandidateIds:
      state
        .prunedCandidateIds
        .filter(
          (id) =>
            id !==
            candidateId,
        )
        .sort(),

    auditHistory: [
      ...state
        .auditHistory
        .map(
          (event) => ({
            ...event,

            evidenceIds: [
              ...event
                .evidenceIds,
            ],
          }),
        ),
      {
        sequence:
          state
            .auditHistory
            .length +
          1,

        action:
          "restored",

        candidateId,

        evidenceIds:
          [],

        probabilityAtAction:
          probabilityAtRestore,

        topProbabilityAtAction:
          1,

        reversible:
          true,

        reason:
          "manual-audit-restoration",
      },
    ],
  };
}

function activeCandidates(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  state:
    AdaptiveStructuralCandidateSet,
): MultiFragmentStructuralRevisionCandidate[] {
  const active =
    new Set(
      state
        .activeCandidateIds,
    );

  return candidates.filter(
    (candidate) =>
      active.has(
        candidate.id,
      ),
  );
}

function toPlannerPosterior(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  state:
    AdaptiveStructuralCandidateSet,
  probabilities:
    Readonly<Record<string, number>>,
  sufficientConfidence: number,
  minimumMargin: number,
): MultiFragmentStructuralPosterior {
  const retained =
    activeCandidates(
      candidates,
      state,
    );

  if (
    retained.length <
      2
  ) {
    throw new Error(
      "Receding structural planner requires at least two active candidates.",
    );
  }

  const prior =
    normalizeWeights(
      probabilities,
      state
        .activeCandidateIds,
    );

  return new MultiFragmentStructuralPosterior(
    retained,
    prior,
    sufficientConfidence,
    minimumMargin,
  );
}

function initialProbabilities(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  prior?:
    Readonly<Record<string, number>>,
): Record<string, number> {
  const ids =
    candidates.map(
      (candidate) =>
        candidate.id,
    );

  if (!prior) {
    return Object.fromEntries(
      ids.map(
        (id) => [
          id,
          1 /
            ids.length,
        ],
      ),
    );
  }

  for (
    const id of
      ids
  ) {
    const value =
      prior[
        id
      ];

    if (
      value ===
        undefined ||
      !Number.isFinite(
        value,
      ) ||
      value <=
        0
    ) {
      throw new Error(
        `Adaptive structural prior is missing positive finite mass for ${id}.`,
      );
    }
  }

  return normalizeWeights(
    prior,
    ids,
  );
}

function availableProbes(
  probes:
    readonly StructuralMutationProbe[],
  executedProbeIds:
    readonly string[],
): StructuralMutationProbe[] {
  const executed =
    new Set(
      executedProbeIds,
    );

  return probes
    .filter(
      (probe) =>
        !executed.has(
          probe.id,
        ),
    )
    .map(
      (probe) => ({
        ...probe,

        interventions: {
          ...probe.interventions,
        },
      }),
    );
}

function planNextProbe(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  state:
    AdaptiveStructuralCandidateSet,
  probabilities:
    Readonly<Record<string, number>>,
  probes:
    readonly StructuralMutationProbe[],
  executedProbeIds:
    readonly string[],
  options: {
    maximumRisk: number;
    costPenalty: number;
    riskPenalty: number;
    minimumInformationGain: number;
    sufficientConfidence: number;
    minimumMargin: number;
  },
): ContingentStructuralDiagnosticPlan {
  const remaining =
    availableProbes(
      probes,
      executedProbeIds,
    );

  if (
    remaining.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      branches:
        [],

      expectedTerminalNormalizedEntropy:
        beliefFromProbabilities(
          probabilities,
          state
            .activeCandidateIds,
        )
          .normalizedEntropy,

      expectedInformationGain:
        0,

      expectedCost:
        0,

      maximumRisk:
        0,

      horizon:
        1,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-contingent-structural-plan",
    };
  }

  return planContingentMultiFragmentStructuralDiagnostics(
    toPlannerPosterior(
      candidates,
      state,
      probabilities,
      options
        .sufficientConfidence,
      options
        .minimumMargin,
    ),
    remaining,
    {
      horizon:
        1,

      maximumRisk:
        options
          .maximumRisk,

      costPenalty:
        options
          .costPenalty,

      riskPenalty:
        options
          .riskPenalty,

      minimumInformationGain:
        options
          .minimumInformationGain,
    },
  );
}

export function runControlledAdaptivePrunedStructuralDiagnosis(
  candidates:
    readonly MultiFragmentStructuralRevisionCandidate[],
  probes:
    readonly StructuralMutationProbe[],
  actualProgram:
    HierarchicalCausalProgram,
  initialEvidence:
    readonly StructuralMechanismObservation[] = [],
  options?: {
    prior?: Readonly<Record<string, number>>;
    maximumSteps?: number;
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
    minimumInformationGain?: number;
    sufficientConfidence?: number;
    minimumMargin?: number;
    minimumEvidenceBeforePrune?: number;
    maximumProbabilityForPrune?: number;
    maximumRelativeProbabilityForPrune?: number;
    minimumRetainedCandidates?: number;
    minimumEvidenceBeforeReopen?: number;
    maximumAcceptableMeanSquaredError?: number;
  },
): AdaptivePrunedStructuralDiagnosisResult {
  if (
    candidates.length <
      2
  ) {
    throw new Error(
      "Receding structural diagnosis requires at least two candidates.",
    );
  }

  const maximumSteps =
    options
      ?.maximumSteps ??
    6;

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    0.2;

  const riskPenalty =
    options
      ?.riskPenalty ??
    0.1;

  const minimumInformationGain =
    options
      ?.minimumInformationGain ??
    0.01;

  const sufficientConfidence =
    options
      ?.sufficientConfidence ??
    0.95;

  const minimumMargin =
    options
      ?.minimumMargin ??
    0.1;

  const minimumEvidenceBeforeReopen =
    options
      ?.minimumEvidenceBeforeReopen ??
    3;

  const maximumAcceptableMeanSquaredError =
    options
      ?.maximumAcceptableMeanSquaredError ??
    0.02;

  validatePositiveInteger(
    "maximumSteps",
    maximumSteps,
  );

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  validateNonNegativeFinite(
    "riskPenalty",
    riskPenalty,
  );

  validateNonNegativeFinite(
    "minimumInformationGain",
    minimumInformationGain,
  );

  validateUnitInterval(
    "sufficientConfidence",
    sufficientConfidence,
  );

  validateUnitInterval(
    "minimumMargin",
    minimumMargin,
  );

  validatePositiveInteger(
    "minimumEvidenceBeforeReopen",
    minimumEvidenceBeforeReopen,
  );

  validateNonNegativeFinite(
    "maximumAcceptableMeanSquaredError",
    maximumAcceptableMeanSquaredError,
  );

  let state =
    createAdaptiveStructuralCandidateSet(
      candidates,
    );

  let probabilities =
    initialProbabilities(
      candidates,
      options
        ?.prior,
    );

  const evidence =
    initialEvidence.map(
      cloneObservation,
    );

  const defaultObservationStdDev =
    candidates.reduce(
      (sum, candidate) =>
        sum +
        candidate
          .program
          .observationStdDev,
      0,
    ) /
    candidates.length;

  for (
    const observation of
      evidence
  ) {
    probabilities =
      updateProbabilities(
        candidates,
        state
          .activeCandidateIds,
        probabilities,
        observation,
        defaultObservationStdDev,
      );
  }

  const initialBelief =
    beliefFromProbabilities(
      probabilities,
      state
        .activeCandidateIds,
    );

  const acquiredObservations:
    StructuralMechanismObservation[] =
      [];

  const executedProbeIds:
    string[] =
      [];

  const steps:
    RecedingStructuralDiagnosisStep[] =
      [];

  function finish(
    decision:
      AdaptivePrunedStructuralDiagnosisResult[
        "decision"
      ],
    reason:
      AdaptivePrunedStructuralDiagnosisResult[
        "reason"
      ],
    selectedCandidateId?:
      string,
  ):
    AdaptivePrunedStructuralDiagnosisResult {
    return {
      decision,

      selectedCandidateId,

      initialCandidateCount:
        candidates.length,

      finalCandidateSet: {
        activeCandidateIds: [
          ...state
            .activeCandidateIds,
        ],

        prunedCandidateIds: [
          ...state
            .prunedCandidateIds,
        ],

        auditHistory:
          state
            .auditHistory
            .map(
              (event) => ({
                ...event,

                evidenceIds: [
                  ...event
                    .evidenceIds,
                ],
              }),
            ),
      },

      initialBelief,

      finalBelief:
        beliefFromProbabilities(
          probabilities,
          state
            .activeCandidateIds,
        ),

      acquiredObservations:
        acquiredObservations.map(
          cloneObservation,
        ),

      allEvidence:
        evidence.map(
          cloneObservation,
        ),

      executedProbeIds: [
        ...executedProbeIds,
      ],

      steps: [
        ...steps,
      ],

      reason,
    };
  }

  for (
    let step =
      1;
    step <=
      maximumSteps;
    step +=
      1
  ) {
    if (
      state
        .activeCandidateIds
        .length ===
      1
    ) {
      return finish(
        "resolved",
        "single-structural-candidate-remains",
        state
          .activeCandidateIds[
            0
          ],
      );
    }

    if (
      evidence.length >=
        minimumEvidenceBeforeReopen &&
      bestActiveMeanSquaredError(
        candidates,
        state
          .activeCandidateIds,
        evidence,
      ) >
        maximumAcceptableMeanSquaredError
    ) {
      return finish(
        "reopen-search",
        "all-retained-structural-candidates-inadequate",
      );
    }

    const plan =
      planNextProbe(
        candidates,
        state,
        probabilities,
        probes,
        executedProbeIds,
        {
          maximumRisk,

          costPenalty,

          riskPenalty,

          minimumInformationGain,

          sufficientConfidence,

          minimumMargin,
        },
      );

    if (
      plan.decision !==
        "plan" ||
      !plan.firstProbe
    ) {
      return finish(
        "abstained",
        "no-safe-receding-structural-probe",
      );
    }

    const activeCountBefore =
      state
        .activeCandidateIds
        .length;

    const observedEffect =
      predictHierarchicalProgramEffect(
        actualProgram,
        plan
          .firstProbe
          .interventions,
      );

    const observationId =
      `${plan.firstProbe.id}:receding-${step}`;

    const observation:
      StructuralMechanismObservation = {
      experiment: {
        id:
          observationId,

        interventions: {
          ...plan
            .firstProbe
            .interventions,
        },

        risk:
          plan.firstProbe.risk,

        cost:
          plan.firstProbe.cost,

        reversible:
          plan
            .firstProbe
            .reversible,
      },

      measuredEffect:
        observedEffect,
    };

    evidence.push(
      observation,
    );

    acquiredObservations.push(
      cloneObservation(
        observation,
      ),
    );

    executedProbeIds.push(
      plan.firstProbe.id,
    );

    probabilities =
      updateProbabilities(
        candidates,
        state
          .activeCandidateIds,
        probabilities,
        observation,
        plan
          .firstProbe
          .observationStdDev,
      );

    const beliefBeforePrune =
      beliefFromProbabilities(
        probabilities,
        state
          .activeCandidateIds,
      );

    const nextState =
      pruneContradictedStructuralCandidates(
        state,
        beliefBeforePrune,
        evidence,
        {
          minimumEvidenceBeforePrune:
            options
              ?.minimumEvidenceBeforePrune,

          maximumProbabilityForPrune:
            options
              ?.maximumProbabilityForPrune,

          maximumRelativeProbabilityForPrune:
            options
              ?.maximumRelativeProbabilityForPrune,

          minimumRetainedCandidates:
            options
              ?.minimumRetainedCandidates,
        },
      );

    const prunedCandidateIds =
      nextState
        .prunedCandidateIds
        .filter(
          (candidateId) =>
            !state
              .prunedCandidateIds
              .includes(
                candidateId,
              ),
        );

    state =
      nextState;

    probabilities =
      normalizeWeights(
        probabilities,
        state
          .activeCandidateIds,
      );

    const beliefAfterPrune =
      beliefFromProbabilities(
        probabilities,
        state
          .activeCandidateIds,
      );

    steps.push({
      step,

      probeId:
        plan.firstProbe.id,

      observationId,

      observedEffect,

      activeCandidateCountBefore:
        activeCountBefore,

      activeCandidateCountAfter:
        state
          .activeCandidateIds
          .length,

      prunedCandidateIds,

      belief:
        beliefAfterPrune,

      replanned:
        true,
    });
  }

  if (
    state
      .activeCandidateIds
      .length ===
    1
  ) {
    return finish(
      "resolved",
      "single-structural-candidate-remains",
      state
        .activeCandidateIds[
          0
        ],
    );
  }

  if (
    evidence.length >=
      minimumEvidenceBeforeReopen &&
    bestActiveMeanSquaredError(
      candidates,
      state
        .activeCandidateIds,
      evidence,
    ) >
      maximumAcceptableMeanSquaredError
  ) {
    return finish(
      "reopen-search",
      "all-retained-structural-candidates-inadequate",
    );
  }

  return finish(
    "abstained",
    "receding-structural-budget-exhausted",
  );
}

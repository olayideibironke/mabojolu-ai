import {
  assessAdaptiveProtectedEvidence,
  deriveAdaptiveEvidenceRequirement,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  FragmentFaultProbe,
} from "./active-fragment-fault-localization-provenance";

import type {
  LocalRepairSearchCandidate,
  ProbabilisticLocalRepairSearch,
  ProtectedLocalRepairDecision,
} from "./multi-step-fault-diagnosis-local-repair";

export interface FragmentFaultMagnitudeEstimate {
  fragmentId: string;
  estimatedScale: number;
  weightedStdDev: number;
  effectiveEvidenceCount: number;
  lowerBound: number;
  upperBound: number;
}

export interface AdaptiveFaultModelCandidate {
  id: string;
  scales: Record<string, number>;
  retiredFragmentIds: string[];
  program: HierarchicalCausalProgram;
  distanceFromIncumbent: number;
}

export interface AdaptiveFaultModelBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  topScales: Record<string, number>;
  topRetiredFragmentIds: string[];
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface AdaptiveRepairBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface AdaptiveFaultRepairActionDecision {
  decision:
    | "diagnose"
    | "validate"
    | "repair"
    | "retain"
    | "abstain";
  diagnosticScore: number;
  validationScore: number;
  reason:
    | "fault-uncertainty-favors-diagnosis"
    | "repair-uncertainty-favors-validation"
    | "protected-repair-ready"
    | "resolved-no-fault-retains-incumbent"
    | "no-positive-safe-information-action";
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

function clamp01(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(
      1,
      value,
    ),
  );
}

function cloneFragment(
  fragment:
    ValidatedCausalFragment,
): ValidatedCausalFragment {
  return {
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
  };
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
        cloneFragment,
      ),
  };
}

function withoutFragment(
  program:
    HierarchicalCausalProgram,
  fragmentId: string,
): HierarchicalCausalProgram {
  const fragments =
    program.fragments.filter(
      (fragment) =>
        fragment.id !==
        fragmentId,
    );

  if (
    fragments.length ===
      program.fragments.length
  ) {
    throw new Error(
      `Unknown magnitude-estimation fragment ${fragmentId}.`,
    );
  }

  return {
    ...cloneProgram(
      program,
    ),

    id:
      `${program.id}:without:${fragmentId}`,

    fragments,

    complexity:
      fragments.reduce(
        (sum, fragment) =>
          sum +
          fragment.terms.length,
        0,
      ),
  };
}

function uniqueSorted(
  values:
    readonly number[],
): number[] {
  const seen =
    new Map<
      string,
      number
    >();

  for (
    const value of
      values
  ) {
    const bounded =
      clamp01(
        value,
      );

    const key =
      bounded.toFixed(
        6,
      );

    seen.set(
      key,
      Number(
        key,
      ),
    );
  }

  return Array.from(
    seen.values(),
  ).sort(
    (left, right) =>
      left -
      right,
  );
}

export function inferFragmentFaultMagnitudes(
  program:
    HierarchicalCausalProgram,
  evidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumContribution?: number;
    uncertaintyRadius?: number;
  },
): FragmentFaultMagnitudeEstimate[] {
  if (
    evidence.length ===
      0
  ) {
    throw new Error(
      "Adaptive fault magnitude inference requires evidence.",
    );
  }

  const minimumContribution =
    options
      ?.minimumContribution ??
    0.02;

  const uncertaintyRadius =
    options
      ?.uncertaintyRadius ??
    0.1;

  validateNonNegativeFinite(
    "minimumContribution",
    minimumContribution,
  );

  validateUnitInterval(
    "uncertaintyRadius",
    uncertaintyRadius,
  );

  return program.fragments.map(
    (fragment) => {
      const reduced =
        withoutFragment(
          program,
          fragment.id,
        );

      const samples:
        {
          scale: number;
          weight: number;
        }[] =
          [];

      for (
        const observation of
          evidence
      ) {
        const full =
          predictHierarchicalProgramEffect(
            program,
            observation
              .experiment
              .interventions,
          );

        const without =
          predictHierarchicalProgramEffect(
            reduced,
            observation
              .experiment
              .interventions,
          );

        const contribution =
          full -
          without;

        if (
          Math.abs(
            contribution,
          ) <
          minimumContribution
        ) {
          continue;
        }

        const scale =
          clamp01(
            (
              observation
                .measuredEffect -
              without
            ) /
              contribution,
          );

        samples.push({
          scale,

          weight:
            contribution *
            contribution,
        });
      }

      if (
        samples.length ===
          0
      ) {
        return {
          fragmentId:
            fragment.id,

          estimatedScale:
            1,

          weightedStdDev:
            0.5,

          effectiveEvidenceCount:
            0,

          lowerBound:
            0,

          upperBound:
            1,
        };
      }

      const totalWeight =
        samples.reduce(
          (sum, sample) =>
            sum +
            sample.weight,
          0,
        );

      const estimatedScale =
        samples.reduce(
          (sum, sample) =>
            sum +
            sample.scale *
              sample.weight,
          0,
        ) /
        totalWeight;

      const variance =
        samples.reduce(
          (sum, sample) =>
            sum +
            sample.weight *
              (
                sample.scale -
                estimatedScale
              ) *
              (
                sample.scale -
                estimatedScale
              ),
          0,
        ) /
        totalWeight;

      const weightedStdDev =
        Math.sqrt(
          variance,
        );

      const radius =
        Math.max(
          uncertaintyRadius,
          weightedStdDev,
        );

      return {
        fragmentId:
          fragment.id,

        estimatedScale,

        weightedStdDev,

        effectiveEvidenceCount:
          samples.length,

        lowerBound:
          clamp01(
            estimatedScale -
            radius,
          ),

        upperBound:
          clamp01(
            estimatedScale +
            radius,
          ),
      };
    },
  );
}

function scaleFragment(
  fragment:
    ValidatedCausalFragment,
  scale: number,
): ValidatedCausalFragment {
  validateUnitInterval(
    `fragment scale for ${fragment.id}`,
    scale,
  );

  return {
    ...cloneFragment(
      fragment,
    ),

    id:
      `${fragment.id}:adaptive-scale-${scale.toFixed(
        3,
      )}`,

    terms:
      fragment.terms.map(
        (term) => ({
          ...term,

          id:
            `${term.id}:adaptive-scale-${scale.toFixed(
              3,
            )}`,

          coefficient:
            term.coefficient *
            scale,

          variables: [
            ...term.variables,
          ],
        }),
      ),
  };
}

function cartesian<T>(
  values:
    readonly (readonly T[])[],
): T[][] {
  let output:
    T[][] = [
      [],
    ];

  for (
    const choices of
      values
  ) {
    const next:
      T[][] =
        [];

    for (
      const prefix of
        output
    ) {
      for (
        const choice of
          choices
      ) {
        next.push([
          ...prefix,
          choice,
        ]);
      }
    }

    output =
      next;
  }

  return output;
}

export function synthesizeAdaptiveFaultModels(
  program:
    HierarchicalCausalProgram,
  estimates:
    readonly FragmentFaultMagnitudeEstimate[],
  options?: {
    includeIncumbentScale?: boolean;
    includeRetirementCandidate?: boolean;
    retirementThreshold?: number;
    maximumChangedFragments?: number;
    maximumCandidates?: number;
  },
): AdaptiveFaultModelCandidate[] {
  const includeIncumbentScale =
    options
      ?.includeIncumbentScale ??
    true;

  const includeRetirementCandidate =
    options
      ?.includeRetirementCandidate ??
    true;

  const retirementThreshold =
    options
      ?.retirementThreshold ??
    0.15;

  const maximumChangedFragments =
    options
      ?.maximumChangedFragments ??
    2;

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    64;

  validateUnitInterval(
    "retirementThreshold",
    retirementThreshold,
  );

  if (
    !Number.isInteger(
      maximumChangedFragments,
    ) ||
    maximumChangedFragments <
      1
  ) {
    throw new Error(
      "maximumChangedFragments must be a positive integer.",
    );
  }

  if (
    !Number.isInteger(
      maximumCandidates,
    ) ||
    maximumCandidates <
      1
  ) {
    throw new Error(
      "maximumCandidates must be a positive integer.",
    );
  }

  const estimateById =
    new Map(
      estimates.map(
        (estimate) => [
          estimate.fragmentId,
          estimate,
        ],
      ),
    );

  const choices =
    program.fragments.map(
      (fragment) => {
        const estimate =
          estimateById.get(
            fragment.id,
          );

        if (!estimate) {
          throw new Error(
            `Missing adaptive fault estimate for ${fragment.id}.`,
          );
        }

        const candidateScales = [
          estimate
            .estimatedScale,
          estimate
            .lowerBound,
          estimate
            .upperBound,
        ];

        if (
          includeIncumbentScale
        ) {
          candidateScales.push(
            1,
          );
        }

        if (
          includeRetirementCandidate &&
          estimate.lowerBound <=
            retirementThreshold
        ) {
          candidateScales.push(
            0,
          );
        }

        return uniqueSorted(
          candidateScales,
        ).map(
          (scale) => ({
            fragmentId:
              fragment.id,

            scale,
          }),
        );
      },
    );

  const candidates =
    cartesian(
      choices,
    )
      .map(
        (assignment) => {
          const scales =
            Object.fromEntries(
              assignment.map(
                (item) => [
                  item.fragmentId,
                  item.scale,
                ],
              ),
            );

          const changed =
            assignment.filter(
              (item) =>
                Math.abs(
                  item.scale -
                  1,
                ) >
                Number.EPSILON,
            );

          if (
            changed.length >
              maximumChangedFragments
          ) {
            return undefined;
          }

          const retiredFragmentIds =
            changed
              .filter(
                (item) =>
                  item.scale ===
                  0,
              )
              .map(
                (item) =>
                  item.fragmentId,
              )
              .sort();

          const fragments =
            program.fragments.flatMap(
              (fragment) => {
                const scale =
                  scales[
                    fragment.id
                  ] ??
                  1;

                if (
                  scale ===
                    0
                ) {
                  return [];
                }

                if (
                  Math.abs(
                    scale -
                    1,
                  ) <=
                    Number.EPSILON
                ) {
                  return [
                    cloneFragment(
                      fragment,
                    ),
                  ];
                }

                return [
                  scaleFragment(
                    fragment,
                    scale,
                  ),
                ];
              },
            );

          const idParts =
            program.fragments.map(
              (fragment) =>
                `${fragment.id}=${(
                  scales[
                    fragment.id
                  ] ??
                  1
                ).toFixed(
                  3,
                )}`,
            );

          const distanceFromIncumbent =
            program.fragments.reduce(
              (sum, fragment) =>
                sum +
                Math.abs(
                  (
                    scales[
                      fragment.id
                    ] ??
                    1
                  ) -
                  1,
                ),
              0,
            );

          return {
            id:
              `${program.id}:adaptive:${idParts.join(
                "|",
              )}`,

            scales,

            retiredFragmentIds,

            program: {
              ...cloneProgram(
                program,
              ),

              id:
                `${program.id}:adaptive:${idParts.join(
                  "|",
                )}`,

              fragments,

              depth:
                1 +
                fragments.length,

              complexity:
                fragments.reduce(
                  (sum, fragment) =>
                    sum +
                    fragment
                      .terms
                      .length,
                  0,
                ),
            },

            distanceFromIncumbent,
          } satisfies
            AdaptiveFaultModelCandidate;
        },
      )
      .filter(
        (
          candidate,
        ): candidate is
          AdaptiveFaultModelCandidate =>
          candidate !==
          undefined,
      )
      .sort(
        (left, right) =>
          left.distanceFromIncumbent -
            right.distanceFromIncumbent ||
          left.id.localeCompare(
            right.id,
          ),
      );

  return candidates.slice(
    0,
    maximumCandidates,
  );
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
      "Adaptive fault posterior observationStdDev must be positive and finite.",
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

function normalizeLogWeights(
  logWeights:
    Readonly<Record<string, number>>,
): Record<string, number> {
  const entries =
    Object.entries(
      logWeights,
    );

  if (
    entries.length ===
      0
  ) {
    throw new Error(
      "Adaptive posterior requires candidates.",
    );
  }

  const maximum =
    Math.max(
      ...entries.map(
        ([, value]) =>
          value,
      ),
    );

  const scaled =
    entries.map(
      ([id, value]) => [
        id,
        Math.exp(
          value -
          maximum,
        ),
      ] as const,
    );

  const total =
    scaled.reduce(
      (sum, [, value]) =>
        sum +
        value,
      0,
    );

  return Object.fromEntries(
    scaled.map(
      ([id, value]) => [
        id,
        value /
          total,
      ],
    ),
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
      probability > 0
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

export class AdaptiveFaultModelPosterior {
  private logWeights:
    Record<string, number>;

  constructor(
    private readonly candidates:
      readonly AdaptiveFaultModelCandidate[],
    prior?:
      Readonly<Record<string, number>>,
    private readonly sufficientConfidence =
      0.9,
    private readonly minimumMargin =
      0.1,
  ) {
    if (
      candidates.length <
        2
    ) {
      throw new Error(
        "Adaptive fault posterior requires at least two candidates.",
      );
    }

    validateUnitInterval(
      "sufficientConfidence",
      sufficientConfidence,
    );

    validateUnitInterval(
      "minimumMargin",
      minimumMargin,
    );

    this.logWeights =
      Object.fromEntries(
        candidates.map(
          (candidate) => {
            const probability =
              prior
                ? (
                    prior[
                      candidate.id
                    ] ??
                    (() => {
                      throw new Error(
                        `Adaptive fault prior is missing ${candidate.id}.`,
                      );
                    })()
                  )
                : 1 /
                  candidates.length;

            if (
              !Number.isFinite(
                probability,
              ) ||
              probability <= 0
            ) {
              throw new Error(
                "Adaptive fault prior probabilities must be positive and finite.",
              );
            }

            return [
              candidate.id,
              Math.log(
                probability,
              ),
            ];
          },
        ),
      );
  }

  getCandidates():
    readonly AdaptiveFaultModelCandidate[] {
    return this.candidates;
  }

  getBelief():
    AdaptiveFaultModelBelief {
    const probabilities =
      normalizeLogWeights(
        this.logWeights,
      );

    const ranked =
      Object.entries(
        probabilities,
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
        "Adaptive fault posterior has no top candidate.",
      );
    }

    const candidate =
      this.candidates.find(
        (item) =>
          item.id ===
          top[0],
      );

    if (!candidate) {
      throw new Error(
        `Unknown adaptive fault candidate ${top[0]}.`,
      );
    }

    const second =
      ranked[1]?.[1] ??
      0;

    const confidence =
      top[1];

    const margin =
      confidence -
      second;

    return {
      probabilities,

      topCandidateId:
        candidate.id,

      topScales: {
        ...candidate.scales,
      },

      topRetiredFragmentIds: [
        ...candidate
          .retiredFragmentIds,
      ],

      confidence,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            ([, probability]) =>
              probability,
          ),
        ),

      sufficientlyResolved:
        confidence >=
          this
            .sufficientConfidence &&
        margin >=
          this
            .minimumMargin,
    };
  }

  recordObservation(
    observation:
      StructuralMechanismObservation,
    observationStdDev =
      0.08,
  ): AdaptiveFaultModelBelief {
    for (
      const candidate of
        this.candidates
    ) {
      const predicted =
        predictHierarchicalProgramEffect(
          candidate.program,
          observation
            .experiment
            .interventions,
        );

      this.logWeights[
        candidate.id
      ] =
        (
          this.logWeights[
            candidate.id
          ] ??
          Number.NEGATIVE_INFINITY
        ) +
        logGaussianLikelihood(
          observation
            .measuredEffect,
          predicted,
          observationStdDev,
        );
    }

    const probabilities =
      normalizeLogWeights(
        this.logWeights,
      );

    this.logWeights =
      Object.fromEntries(
        Object.entries(
          probabilities,
        ).map(
          ([id, probability]) => [
            id,
            Math.log(
              Math.max(
                probability,
                Number.MIN_VALUE,
              ),
            ),
          ],
        ),
      );

    return this.getBelief();
  }
}

function toLocalRepairCandidate(
  incumbent:
    HierarchicalCausalProgram,
  candidate:
    AdaptiveFaultModelCandidate,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
): LocalRepairSearchCandidate {
  const replacementFragmentIds:
    Record<string, string> =
      {};

  const candidateByOriginal =
    new Map<
      string,
      ValidatedCausalFragment
    >();

  for (
    const fragment of
      candidate
        .program
        .fragments
  ) {
    const match =
      incumbent.fragments.find(
        (incumbentFragment) =>
          fragment.id ===
            incumbentFragment.id ||
          fragment.id.startsWith(
            `${incumbentFragment.id}:adaptive-scale-`,
          ),
      );

    if (match) {
      candidateByOriginal.set(
        match.id,
        fragment,
      );
    }
  }

  for (
    const fragment of
      incumbent.fragments
  ) {
    const scale =
      candidate.scales[
        fragment.id
      ] ??
      1;

    if (
      scale > 0 &&
      Math.abs(
        scale -
        1,
      ) >
        Number.EPSILON
    ) {
      const replacement =
        candidateByOriginal.get(
          fragment.id,
        );

      if (!replacement) {
        throw new Error(
          `Adaptive repair replacement missing for ${fragment.id}.`,
        );
      }

      replacementFragmentIds[
        fragment.id
      ] =
        replacement.id;
    }
  }

  const discoveryMeanSquaredError =
    discoveryEvidence.reduce(
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
    discoveryEvidence.length;

  return {
    id:
      candidate.id,

    program:
      candidate.program,

    replacementFragmentIds,

    retiredFragmentIds:
      Array.from(
        new Set([
          ...Object.keys(
            replacementFragmentIds,
          ),
          ...candidate
            .retiredFragmentIds,
        ]),
      ).sort(),

    discoveryMeanSquaredError,

    complexityPenalty:
      0,

    objective:
      discoveryMeanSquaredError,
  };
}

export class AdaptiveRepairCandidatePosterior {
  private logWeights:
    Record<string, number>;

  constructor(
    private readonly candidates:
      readonly LocalRepairSearchCandidate[],
    private readonly sufficientConfidence =
      0.9,
    private readonly minimumMargin =
      0.1,
  ) {
    if (
      candidates.length <
        2
    ) {
      throw new Error(
        "Adaptive repair posterior requires at least two candidates.",
      );
    }

    this.logWeights =
      Object.fromEntries(
        candidates.map(
          (candidate) => [
            candidate.id,
            -Math.log(
              candidates.length,
            ),
          ],
        ),
      );
  }

  getCandidates():
    readonly LocalRepairSearchCandidate[] {
    return this.candidates;
  }

  getBelief():
    AdaptiveRepairBelief {
    const probabilities =
      normalizeLogWeights(
        this.logWeights,
      );

    const ranked =
      Object.entries(
        probabilities,
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
        "Adaptive repair posterior has no candidates.",
      );
    }

    const second =
      ranked[1]?.[1] ??
      0;

    const confidence =
      top[1];

    const margin =
      confidence -
      second;

    return {
      probabilities,

      topCandidateId:
        top[0],

      confidence,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            ([, probability]) =>
              probability,
          ),
        ),

      sufficientlyResolved:
        confidence >=
          this
            .sufficientConfidence &&
        margin >=
          this
            .minimumMargin,
    };
  }

  recordObservation(
    observation:
      StructuralMechanismObservation,
    observationStdDev =
      0.06,
  ): AdaptiveRepairBelief {
    for (
      const candidate of
        this.candidates
    ) {
      const predicted =
        predictHierarchicalProgramEffect(
          candidate.program,
          observation
            .experiment
            .interventions,
        );

      this.logWeights[
        candidate.id
      ] =
        (
          this.logWeights[
            candidate.id
          ] ??
          Number.NEGATIVE_INFINITY
        ) +
        logGaussianLikelihood(
          observation
            .measuredEffect,
          predicted,
          observationStdDev,
        );
    }

    const probabilities =
      normalizeLogWeights(
        this.logWeights,
      );

    this.logWeights =
      Object.fromEntries(
        Object.entries(
          probabilities,
        ).map(
          ([id, probability]) => [
            id,
            Math.log(
              Math.max(
                probability,
                Number.MIN_VALUE,
              ),
            ),
          ],
        ),
      );

    return this.getBelief();
  }
}

export function createAdaptiveRepairPosterior(
  incumbent:
    HierarchicalCausalProgram,
  faultCandidates:
    readonly AdaptiveFaultModelCandidate[],
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    maximumRepairCandidates?: number;
  },
): AdaptiveRepairCandidatePosterior {
  if (
    discoveryEvidence.length ===
      0
  ) {
    throw new Error(
      "Adaptive repair posterior requires discovery evidence.",
    );
  }

  const maximumRepairCandidates =
    options
      ?.maximumRepairCandidates ??
    8;

  const repairCandidates =
    faultCandidates
      .map(
        (candidate) =>
          toLocalRepairCandidate(
            incumbent,
            candidate,
            discoveryEvidence,
          ),
      )
      .sort(
        (left, right) =>
          left.objective -
            right.objective ||
          left.id.localeCompare(
            right.id,
          ),
      )
      .slice(
        0,
        maximumRepairCandidates,
      );

  return new AdaptiveRepairCandidatePosterior(
    repairCandidates,
  );
}

export function chooseAdaptiveFaultRepairAction(
  faultBelief:
    AdaptiveFaultModelBelief,
  repairBelief:
    AdaptiveRepairBelief |
    undefined,
  protectedReady: boolean,
  options?: {
    diagnosticExpectedInformationGain?: number;
    diagnosticCost?: number;
    diagnosticRisk?: number;
    validationExpectedInformationGain?: number;
    validationCost?: number;
    validationRisk?: number;
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
  },
): AdaptiveFaultRepairActionDecision {
  const diagnosticExpectedInformationGain =
    options
      ?.diagnosticExpectedInformationGain ??
    0;

  const diagnosticCost =
    options
      ?.diagnosticCost ??
    0;

  const diagnosticRisk =
    options
      ?.diagnosticRisk ??
    0;

  const validationExpectedInformationGain =
    options
      ?.validationExpectedInformationGain ??
    0;

  const validationCost =
    options
      ?.validationCost ??
    0;

  const validationRisk =
    options
      ?.validationRisk ??
    0;

  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    1;

  const riskPenalty =
    options
      ?.riskPenalty ??
    1;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  const diagnosticScore =
    diagnosticRisk <=
      maximumRisk
      ? diagnosticExpectedInformationGain -
        costPenalty *
          diagnosticCost -
        riskPenalty *
          diagnosticRisk
      : Number.NEGATIVE_INFINITY;

  const validationScore =
    validationRisk <=
      maximumRisk
      ? validationExpectedInformationGain -
        costPenalty *
          validationCost -
        riskPenalty *
          validationRisk
      : Number.NEGATIVE_INFINITY;

  const incumbentCandidate =
    Object.entries(
      faultBelief.topScales,
    ).every(
      ([, scale]) =>
        Math.abs(
          scale -
          1,
        ) <=
          Number.EPSILON,
    );

  if (
    faultBelief
      .sufficientlyResolved &&
    incumbentCandidate
  ) {
    return {
      decision:
        "retain",

      diagnosticScore,

      validationScore,

      reason:
        "resolved-no-fault-retains-incumbent",
    };
  }

  if (
    !faultBelief
      .sufficientlyResolved
  ) {
    if (
      diagnosticScore >
        0 &&
      diagnosticScore >=
        validationScore
    ) {
      return {
        decision:
          "diagnose",

        diagnosticScore,

        validationScore,

        reason:
          "fault-uncertainty-favors-diagnosis",
      };
    }

    return {
      decision:
        "abstain",

      diagnosticScore,

      validationScore,

      reason:
        "no-positive-safe-information-action",
    };
  }

  if (
    !repairBelief ||
    !repairBelief
      .sufficientlyResolved ||
    !protectedReady
  ) {
    if (
      validationScore >
        0
    ) {
      return {
        decision:
          "validate",

        diagnosticScore,

        validationScore,

        reason:
          "repair-uncertainty-favors-validation",
      };
    }

    return {
      decision:
        "abstain",

      diagnosticScore,

      validationScore,

      reason:
        "no-positive-safe-information-action",
    };
  }

  return {
    decision:
      "repair",

    diagnosticScore,

    validationScore,

    reason:
      "protected-repair-ready",
  };
}

function historicalProtectedEvidenceIds(
  lineage:
    RevisionLineage,
): string[] {
  return Array.from(
    new Set(
      lineage.nodes.flatMap(
        (node) =>
          node
            .installationProtectedEvidenceIds,
      ),
    ),
  ).sort();
}

export function validateAdaptiveRepairPosterior(
  lineage:
    RevisionLineage,
  incumbent:
    HierarchicalCausalProgram,
  repairPosterior:
    AdaptiveRepairCandidatePosterior,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
  diagnosticEvidence:
    readonly StructuralMechanismObservation[],
  protectedEvidence:
    readonly StructuralMechanismObservation[],
  uncertaintyAtInstall: number,
  options?: {
    minimumImprovement?: number;
  },
): ProtectedLocalRepairDecision {
  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
  );

  const belief =
    repairPosterior.getBelief();

  if (
    !belief
      .sufficientlyResolved
  ) {
    const placeholderSearch:
      ProbabilisticLocalRepairSearch = {
      decision:
        "abstained",

      faultExplanation: {
        id:
          "adaptive-fault-unresolved",

        kind:
          "multi-fragment",

        fragmentIds:
          [],
      },

      faultConfidence:
        0,

      faultFragmentIds:
        [],

      repairEvidenceIds:
        discoveryEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates: [
        ...repairPosterior
          .getCandidates(),
      ],

      reason:
        "fault-posterior-not-resolved",
    };

    return {
      decision:
        "abstained",

      search:
        placeholderSearch,

      protectedEvidenceIds:
        protectedEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      reason:
        "local-repair-search-required",
    };
  }

  const candidates = [
    ...repairPosterior
      .getCandidates(),
  ];

  const selected =
    candidates.find(
      (candidate) =>
        candidate.id ===
        belief
          .topCandidateId,
    );

  if (!selected) {
    throw new Error(
      `Unknown adaptive repair candidate ${belief.topCandidateId}.`,
    );
  }

  const discoveryIds =
    new Set(
      discoveryEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),
    );

  const diagnosticIds =
    new Set(
      diagnosticEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),
    );

  const protectedIds =
    protectedEvidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  if (
    protectedIds.some(
      (id) =>
        discoveryIds.has(
          id,
        ) ||
        diagnosticIds.has(
          id,
        )
    )
  ) {
    throw new Error(
      "Adaptive discovery, diagnostic, and protected evidence must remain disjoint.",
    );
  }

  const protectedScores =
    candidates
      .map(
        (candidate) => {
          const meanSquaredError =
            protectedEvidence.reduce(
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
            protectedEvidence.length;

          return {
            candidate,

            meanSquaredError,
          };
        },
      )
      .sort(
        (left, right) =>
          left.meanSquaredError -
            right.meanSquaredError ||
          left.candidate.id.localeCompare(
            right.candidate.id,
          ),
      );

  const protectedBest =
    protectedScores[0];

  if (!protectedBest) {
    throw new Error(
      "Adaptive protected repair validation requires candidates.",
    );
  }

  const selectedProtected =
    protectedScores.find(
      (entry) =>
        entry.candidate.id ===
        selected.id,
    );

  if (!selectedProtected) {
    throw new Error(
      "Adaptive selected repair is missing from protected comparison.",
    );
  }

  const incumbentProtectedMeanSquaredError =
    protectedEvidence.reduce(
      (sum, observation) => {
        const error =
          observation
            .measuredEffect -
          predictHierarchicalProgramEffect(
            incumbent,
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
    protectedEvidence.length;

  const improvement =
    incumbentProtectedMeanSquaredError -
    selectedProtected
      .meanSquaredError;

  const changedFragmentIds =
    Array.from(
      new Set([
        ...Object.keys(
          selected
            .replacementFragmentIds,
        ),
        ...selected
          .retiredFragmentIds,
      ]),
    ).sort();

  const search:
    ProbabilisticLocalRepairSearch = {
    decision:
      "search",

    faultExplanation: {
      id:
        "adaptive-fault-model",

      kind:
        changedFragmentIds.length >
          1
          ? "multi-fragment"
          : "single-fragment",

      fragmentIds: [
        ...changedFragmentIds,
      ],
    },

    faultConfidence:
      belief.confidence,

    faultFragmentIds: [
      ...changedFragmentIds,
    ],

    repairEvidenceIds:
      discoveryEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    candidates,

    selectedCandidate:
      selected,

    reason:
      "fault-posterior-authorized-local-repair-search",
  };

  if (
    protectedBest
      .candidate
      .id !==
    selected.id
  ) {
    return {
      decision:
        "retained",

      search,

      protectedEvidenceIds:
        protectedIds,

      selectedCandidate:
        selected,

      incumbentProtectedMeanSquaredError,

      candidateProtectedMeanSquaredError:
        selectedProtected
          .meanSquaredError,

      improvement,

      reason:
        "repair-search-selection-not-protected",
    };
  }

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.01;

  if (
    improvement <
      minimumImprovement
  ) {
    return {
      decision:
        "retained",

      search,

      protectedEvidenceIds:
        protectedIds,

      selectedCandidate:
        selected,

      incumbentProtectedMeanSquaredError,

      candidateProtectedMeanSquaredError:
        selectedProtected
          .meanSquaredError,

      improvement,

      reason:
        "incumbent-remains-protected",
    };
  }

  const requirement =
    deriveAdaptiveEvidenceRequirement(
      selected.program,
      uncertaintyAtInstall,
    );

  const coverage =
    assessAdaptiveProtectedEvidence(
      protectedEvidence,
      requirement,
      [
        ...historicalProtectedEvidenceIds(
          lineage,
        ),
        ...discoveryEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),
        ...diagnosticEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),
      ],
    );

  if (
    coverage.decision !==
      "ready"
  ) {
    return {
      decision:
        "abstained",

      search,

      requirement,

      protectedEvidenceIds:
        protectedIds,

      selectedCandidate:
        selected,

      incumbentProtectedMeanSquaredError,

      candidateProtectedMeanSquaredError:
        selectedProtected
          .meanSquaredError,

      improvement,

      reason:
        "adaptive-protected-local-repair-reserve-insufficient",
    };
  }

  return {
    decision:
      "installed",

    search,

    requirement,

    protectedEvidenceIds:
      coverage
        .protectedEvidenceIds,

    selectedCandidate:
      selected,

    incumbentProtectedMeanSquaredError,

    candidateProtectedMeanSquaredError:
      selectedProtected
        .meanSquaredError,

    improvement,

    reason:
      "protected-local-repair-selected",
  };
}

export function expectedProbeInformationGainForAdaptiveFaults(
  posterior:
    AdaptiveFaultModelPosterior,
  probe:
    FragmentFaultProbe,
): number {
  const belief =
    posterior.getBelief();

  const priorEntropy =
    entropy(
      Object.values(
        belief
          .probabilities,
      ),
    );

  let expectedPosteriorEntropy =
    0;

  for (
    const truth of
      posterior.getCandidates()
  ) {
    const truthProbability =
      belief.probabilities[
        truth.id
      ] ??
      0;

    if (
      truthProbability <=
        0
    ) {
      continue;
    }

    const observation =
      predictHierarchicalProgramEffect(
        truth.program,
        probe.interventions,
      );

    const logWeights:
      Record<string, number> =
        {};

    for (
      const candidate of
        posterior.getCandidates()
    ) {
      const predicted =
        predictHierarchicalProgramEffect(
          candidate.program,
          probe.interventions,
        );

      logWeights[
        candidate.id
      ] =
        Math.log(
          Math.max(
            belief
              .probabilities[
                candidate.id
              ] ??
              Number.MIN_VALUE,
            Number.MIN_VALUE,
          ),
        ) +
        logGaussianLikelihood(
          observation,
          predicted,
          probe
            .observationStdDev,
        );
    }

    const probabilities =
      normalizeLogWeights(
        logWeights,
      );

    expectedPosteriorEntropy +=
      truthProbability *
      entropy(
        Object.values(
          probabilities,
        ),
      );
  }

  return Math.max(
    0,
    priorEntropy -
    expectedPosteriorEntropy,
  );
}

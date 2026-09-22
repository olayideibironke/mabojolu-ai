import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  LocalStructuralMutationCandidate,
  StructuralMutationProbe,
} from "./bounded-local-structural-mutation";

import type {
  ProbabilisticLocalRepairSearch,
  LocalRepairSearchCandidate,
} from "./multi-step-fault-diagnosis-local-repair";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface MultiFragmentStructuralRevisionCandidate {
  id: string;
  componentCandidateIds: Record<string, string>;
  replacementFragmentIds: Record<string, string>;
  retiredFragmentIds: string[];
  topologyChangedFragmentIds: string[];
  parameterChangedFragmentIds: string[];
  program: HierarchicalCausalProgram;
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
}

export interface MultiFragmentStructuralBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  topReplacementFragmentIds: Record<string, string>;
  topTopologyChangedFragmentIds: string[];
  topParameterChangedFragmentIds: string[];
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface ContingentStructuralBranch {
  truthCandidateId: string;
  representativeObservation: number;
  posteriorConfidenceAfterFirst: number;
  secondProbeId?: string;
  terminalNormalizedEntropy: number;
}

export interface ContingentStructuralDiagnosticPlan {
  decision:
    | "plan"
    | "abstained";
  firstProbe?: StructuralMutationProbe;
  branches: ContingentStructuralBranch[];
  expectedTerminalNormalizedEntropy: number;
  expectedInformationGain: number;
  expectedCost: number;
  maximumRisk: number;
  horizon:
    | 1
    | 2;
  score: number;
  reason:
    | "safe-contingent-structural-plan"
    | "no-safe-contingent-structural-plan";
}

export interface ControlledContingentStructuralDiagnosisResult {
  decision:
    | "resolved"
    | "abstained";
  initialBelief: MultiFragmentStructuralBelief;
  initialPlan: ContingentStructuralDiagnosticPlan;
  acquiredObservations: StructuralMechanismObservation[];
  executedProbeIds: string[];
  finalBelief: MultiFragmentStructuralBelief;
  reason:
    | "multi-fragment-structure-resolved"
    | "contingent-structural-budget-exhausted"
    | "no-safe-contingent-structural-plan";
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

function cloneFragment(
  fragment: ValidatedCausalFragment,
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
  program: HierarchicalCausalProgram,
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

function programMeanSquaredError(
  program: HierarchicalCausalProgram,
  observations:
    readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Multi-fragment structural revision requires discovery evidence.",
    );
  }

  return observations.reduce(
    (sum, observation) => {
      const error =
        observation.measuredEffect -
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
    observations.length;
}

function cartesian<T>(
  values:
    readonly (readonly T[])[],
): T[][] {
  let result:
    T[][] = [
      [],
    ];

  for (
    const choices of
      values
  ) {
    const next:
      T[][] = [];

    for (
      const prefix of
        result
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

    result =
      next;
  }

  return result;
}

function candidateChangesFragment(
  candidate:
    LocalStructuralMutationCandidate,
): boolean {
  return (
    candidate.kind !==
      "incumbent" &&
    (
      candidate.topologyChanged ||
      Math.abs(
        candidate.coefficient -
          (
            candidate.program.fragments.find(
              (fragment) =>
                fragment.id ===
                candidate
                  .targetFragmentId,
            )
              ?.terms[
                0
              ]
              ?.coefficient ??
            candidate.coefficient
          ),
      ) >
        Number.EPSILON ||
      candidate.fragment.id !==
        candidate.targetFragmentId
    )
  );
}

export function synthesizeBoundedMultiFragmentStructuralRevisions(
  incumbent:
    HierarchicalCausalProgram,
  localCandidateSets:
    Readonly<
      Record<
        string,
        readonly LocalStructuralMutationCandidate[]
      >
    >,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    maximumChangedFragments?: number;
    maximumCandidates?: number;
    complexityPenaltyPerTopologyChange?: number;
  },
): MultiFragmentStructuralRevisionCandidate[] {
  const fragmentIds =
    Object.keys(
      localCandidateSets,
    ).sort();

  if (
    fragmentIds.length <
      2
  ) {
    throw new Error(
      "Multi-fragment structural revision requires at least two target fragments.",
    );
  }

  const maximumChangedFragments =
    options
      ?.maximumChangedFragments ??
    2;

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    32;

  const complexityPenaltyPerTopologyChange =
    options
      ?.complexityPenaltyPerTopologyChange ??
    0.002;

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
      2
  ) {
    throw new Error(
      "maximumCandidates must be an integer of at least two.",
    );
  }

  validateNonNegativeFinite(
    "complexityPenaltyPerTopologyChange",
    complexityPenaltyPerTopologyChange,
  );

  const incumbentById =
    new Map(
      incumbent.fragments.map(
        (fragment) => [
          fragment.id,
          fragment,
        ],
      ),
    );

  const choices =
    fragmentIds.map(
      (fragmentId) => {
        if (
          !incumbentById.has(
            fragmentId,
          )
        ) {
          throw new Error(
            `Unknown multi-fragment structural target ${fragmentId}.`,
          );
        }

        const local =
          localCandidateSets[
            fragmentId
          ];

        if (
          !local ||
          local.length <
            2
        ) {
          throw new Error(
            `Structural target ${fragmentId} requires at least two local candidates.`,
          );
        }

        return local;
      },
    );

  const revisions:
    MultiFragmentStructuralRevisionCandidate[] =
      [];

  for (
    const assignment of
      cartesian(
        choices,
      )
  ) {
    const componentCandidateIds:
      Record<string, string> =
        {};

    const replacementFragmentIds:
      Record<string, string> =
        {};

    const retiredFragmentIds:
      string[] =
        [];

    const topologyChangedFragmentIds:
      string[] =
        [];

    const parameterChangedFragmentIds:
      string[] =
        [];

    const replacementByTarget =
      new Map<
        string,
        ValidatedCausalFragment
      >();

    let changedCount =
      0;

    for (
      const candidate of
        assignment
    ) {
      const fragmentId =
        candidate
          .targetFragmentId;

      componentCandidateIds[
        fragmentId
      ] =
        candidate.id;

      const changed =
        candidateChangesFragment(
          candidate,
        );

      if (
        changed
      ) {
        changedCount +=
          1;

        retiredFragmentIds.push(
          fragmentId,
        );

        replacementFragmentIds[
          fragmentId
        ] =
          candidate
            .fragment
            .id;

        replacementByTarget.set(
          fragmentId,
          candidate.fragment,
        );

        if (
          candidate
            .topologyChanged
        ) {
          topologyChangedFragmentIds.push(
            fragmentId,
          );
        } else {
          parameterChangedFragmentIds.push(
            fragmentId,
          );
        }
      }
    }

    if (
      changedCount >
        maximumChangedFragments
    ) {
      continue;
    }

    const fragments =
      incumbent.fragments.map(
        (fragment) => {
          const replacement =
            replacementByTarget.get(
              fragment.id,
            );

          return replacement
            ? cloneFragment(
                replacement,
              )
            : cloneFragment(
                fragment,
              );
        },
      );

    const id =
      `${incumbent.id}:joint-structure:${fragmentIds.map(
        (fragmentId) =>
          `${fragmentId}->${componentCandidateIds[
            fragmentId
          ]}`,
      ).join("|")}`;

    const program:
      HierarchicalCausalProgram = {
      ...cloneProgram(
        incumbent,
      ),

      id,

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
    };

    const discoveryMeanSquaredError =
      programMeanSquaredError(
        program,
        discoveryEvidence,
      );

    const complexityPenalty =
      complexityPenaltyPerTopologyChange *
      topologyChangedFragmentIds.length;

    revisions.push({
      id,

      componentCandidateIds,

      replacementFragmentIds,

      retiredFragmentIds:
        retiredFragmentIds.sort(),

      topologyChangedFragmentIds:
        topologyChangedFragmentIds.sort(),

      parameterChangedFragmentIds:
        parameterChangedFragmentIds.sort(),

      program,

      discoveryMeanSquaredError,

      complexityPenalty,

      objective:
        discoveryMeanSquaredError +
        complexityPenalty,
    });
  }

  return revisions
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
      maximumCandidates,
    );
}

function logGaussianLikelihood(
  observation: number,
  mean: number,
  stdDev: number,
): number {
  if (
    !Number.isFinite(
      stdDev,
    ) ||
    stdDev <=
      0
  ) {
    throw new Error(
      "Multi-fragment structural observationStdDev must be positive and finite.",
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
      "Multi-fragment structural posterior requires candidates.",
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

export class MultiFragmentStructuralPosterior {
  private logWeights:
    Record<string, number>;

  constructor(
    private readonly candidates:
      readonly MultiFragmentStructuralRevisionCandidate[],
    prior?:
      Readonly<Record<string, number>>,
    private readonly sufficientConfidence =
      0.95,
    private readonly minimumMargin =
      0.1,
  ) {
    if (
      candidates.length <
        2
    ) {
      throw new Error(
        "Multi-fragment structural posterior requires at least two candidates.",
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

    const raw:
      Record<string, number> =
        {};

    for (
      const candidate of
        candidates
    ) {
      const probability =
        prior
          ? (
              prior[
                candidate.id
              ] ??
              (() => {
                throw new Error(
                  `Multi-fragment structural prior is missing ${candidate.id}.`,
                );
              })()
            )
          : 1 /
            candidates.length;

      if (
        !Number.isFinite(
          probability,
        ) ||
        probability <=
          0
      ) {
        throw new Error(
          "Multi-fragment structural prior probabilities must be positive and finite.",
        );
      }

      raw[
        candidate.id
      ] =
        probability;
    }

    const total =
      Object.values(
        raw,
      ).reduce(
        (sum, value) =>
          sum +
          value,
        0,
      );

    this.logWeights =
      Object.fromEntries(
        Object.entries(
          raw,
        ).map(
          ([id, value]) => [
            id,
            Math.log(
              value /
                total,
            ),
          ],
        ),
      );
  }

  getCandidates():
    readonly MultiFragmentStructuralRevisionCandidate[] {
    return this.candidates;
  }

  getBelief():
    MultiFragmentStructuralBelief {
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
        "Multi-fragment structural posterior has no top candidate.",
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
        `Unknown multi-fragment structural candidate ${top[0]}.`,
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

      topReplacementFragmentIds: {
        ...candidate
          .replacementFragmentIds,
      },

      topTopologyChangedFragmentIds: [
        ...candidate
          .topologyChangedFragmentIds,
      ],

      topParameterChangedFragmentIds: [
        ...candidate
          .parameterChangedFragmentIds,
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
      0.03,
  ): MultiFragmentStructuralBelief {
    for (
      const candidate of
        this.candidates
    ) {
      const prediction =
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
          prediction,
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

  clone():
    MultiFragmentStructuralPosterior {
    return new MultiFragmentStructuralPosterior(
      this.candidates,
      this.getBelief()
        .probabilities,
      this.sufficientConfidence,
      this.minimumMargin,
    );
  }
}

function posteriorAfterRepresentativeObservation(
  posterior:
    MultiFragmentStructuralPosterior,
  probe:
    StructuralMutationProbe,
  truth:
    MultiFragmentStructuralRevisionCandidate,
): {
  posterior:
    MultiFragmentStructuralPosterior;
  observation:
    number;
} {
  const child =
    posterior.clone();

  const observation =
    predictHierarchicalProgramEffect(
      truth.program,
      probe.interventions,
    );

  child.recordObservation(
    {
      experiment: {
        id:
          `representative:${probe.id}`,

        interventions: {
          ...probe.interventions,
        },

        risk:
          probe.risk,

        cost:
          probe.cost,

        reversible:
          probe.reversible,
      },

      measuredEffect:
        observation,
    },
    probe.observationStdDev,
  );

  return {
    posterior:
      child,

    observation,
  };
}

function bestOneStepProbe(
  posterior:
    MultiFragmentStructuralPosterior,
  probes:
    readonly StructuralMutationProbe[],
  maximumRisk:
    number,
  costPenalty:
    number,
  riskPenalty:
    number,
): {
  probe?: StructuralMutationProbe;
  expectedNormalizedEntropy: number;
  score: number;
} {
  const belief =
    posterior.getBelief();

  let bestProbe:
    StructuralMutationProbe |
    undefined;

  let bestEntropy =
    belief.normalizedEntropy;

  let bestScore =
    Number.NEGATIVE_INFINITY;

  for (
    const probe of
      probes
  ) {
    if (
      !probe.reversible ||
      probe.risk >
        maximumRisk
    ) {
      continue;
    }

    let expectedEntropy =
      0;

    for (
      const truth of
        posterior.getCandidates()
    ) {
      const probability =
        belief.probabilities[
          truth.id
        ] ??
        0;

      if (
        probability <=
          0
      ) {
        continue;
      }

      const branch =
        posteriorAfterRepresentativeObservation(
          posterior,
          probe,
          truth,
        );

      expectedEntropy +=
        probability *
        branch
          .posterior
          .getBelief()
          .normalizedEntropy;
    }

    const informationGain =
      Math.max(
        0,
        belief.normalizedEntropy -
          expectedEntropy,
      );

    const score =
      informationGain -
      costPenalty *
        probe.cost -
      riskPenalty *
        probe.risk;

    if (
      score >
        bestScore +
          Number.EPSILON ||
      (
        Math.abs(
          score -
            bestScore,
        ) <=
          Number.EPSILON &&
        probe.risk <
          (
            bestProbe
              ?.risk ??
            Number.POSITIVE_INFINITY
          )
      ) ||
      (
        Math.abs(
          score -
            bestScore,
        ) <=
          Number.EPSILON &&
        Math.abs(
          probe.risk -
            (
              bestProbe
                ?.risk ??
              Number.POSITIVE_INFINITY
            ),
        ) <=
          Number.EPSILON &&
        probe.id <
          (
            bestProbe
              ?.id ??
            ""
          )
      )
    ) {
      bestProbe =
        probe;

      bestEntropy =
        expectedEntropy;

      bestScore =
        score;
    }
  }

  return {
    probe:
      bestProbe,

    expectedNormalizedEntropy:
      bestEntropy,

    score:
      bestScore,
  };
}

export function planContingentMultiFragmentStructuralDiagnostics(
  posterior:
    MultiFragmentStructuralPosterior,
  probes:
    readonly StructuralMutationProbe[],
  options?: {
    horizon?: 1 | 2;
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
    minimumInformationGain?: number;
  },
): ContingentStructuralDiagnosticPlan {
  const horizon =
    options
      ?.horizon ??
    2;

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

  const belief =
    posterior.getBelief();

  const safe =
    probes.filter(
      (probe) =>
        probe.reversible &&
        probe.risk <=
          maximumRisk,
    );

  let best:
    ContingentStructuralDiagnosticPlan |
    undefined;

  for (
    const firstProbe of
      safe
  ) {
    const branches:
      ContingentStructuralBranch[] =
        [];

    let expectedTerminalEntropy =
      0;

    let expectedSecondCost =
      0;

    let maximumPlanRisk =
      firstProbe.risk;

    for (
      const truth of
        posterior.getCandidates()
    ) {
      const probability =
        belief.probabilities[
          truth.id
        ] ??
        0;

      if (
        probability <=
          0
      ) {
        continue;
      }

      const first =
        posteriorAfterRepresentativeObservation(
          posterior,
          firstProbe,
          truth,
        );

      const firstBelief =
        first
          .posterior
          .getBelief();

      let terminalEntropy =
        firstBelief
          .normalizedEntropy;

      let secondProbeId:
        string |
        undefined;

      if (
        horizon ===
          2 &&
        !firstBelief
          .sufficientlyResolved
      ) {
        const remaining =
          safe.filter(
            (probe) =>
              probe.id !==
              firstProbe.id,
          );

        const second =
          bestOneStepProbe(
            first.posterior,
            remaining,
            maximumRisk,
            costPenalty,
            riskPenalty,
          );

        if (
          second.probe
        ) {
          terminalEntropy =
            second
              .expectedNormalizedEntropy;

          secondProbeId =
            second
              .probe
              .id;

          expectedSecondCost +=
            probability *
            second
              .probe
              .cost;

          maximumPlanRisk =
            Math.max(
              maximumPlanRisk,
              second
                .probe
                .risk,
            );
        }
      }

      expectedTerminalEntropy +=
        probability *
        terminalEntropy;

      branches.push({
        truthCandidateId:
          truth.id,

        representativeObservation:
          first.observation,

        posteriorConfidenceAfterFirst:
          firstBelief
            .confidence,

        secondProbeId,

        terminalNormalizedEntropy:
          terminalEntropy,
      });
    }

    const informationGain =
      Math.max(
        0,
        belief.normalizedEntropy -
          expectedTerminalEntropy,
      );

    if (
      informationGain <
        minimumInformationGain
    ) {
      continue;
    }

    const expectedCost =
      firstProbe.cost +
      expectedSecondCost;

    const score =
      informationGain -
      costPenalty *
        expectedCost -
      riskPenalty *
        maximumPlanRisk;

    const candidate:
      ContingentStructuralDiagnosticPlan = {
      decision:
        "plan",

      firstProbe: {
        ...firstProbe,

        interventions: {
          ...firstProbe.interventions,
        },
      },

      branches:
        branches.sort(
          (left, right) =>
            left
              .truthCandidateId
              .localeCompare(
                right
                  .truthCandidateId,
              ),
        ),

      expectedTerminalNormalizedEntropy:
        expectedTerminalEntropy,

      expectedInformationGain:
        informationGain,

      expectedCost,

      maximumRisk:
        maximumPlanRisk,

      horizon,

      score,

      reason:
        "safe-contingent-structural-plan",
    };

    if (
      !best ||
      candidate.score >
        best.score +
          Number.EPSILON ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        candidate.maximumRisk <
          best.maximumRisk -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.maximumRisk -
            best.maximumRisk,
        ) <=
          Number.EPSILON &&
        candidate.expectedCost <
          best.expectedCost -
            Number.EPSILON
      )
    ) {
      best =
        candidate;
    }
  }

  return best ?? {
    decision:
      "abstained",

    branches:
      [],

    expectedTerminalNormalizedEntropy:
      belief.normalizedEntropy,

    expectedInformationGain:
      0,

    expectedCost:
      0,

    maximumRisk:
      0,

    horizon,

    score:
      Number.NEGATIVE_INFINITY,

    reason:
      "no-safe-contingent-structural-plan",
  };
}

export function runControlledContingentStructuralDiagnosis(
  posterior:
    MultiFragmentStructuralPosterior,
  actualProgram:
    HierarchicalCausalProgram,
  probes:
    readonly StructuralMutationProbe[],
  options?: {
    maximumSteps?: 1 | 2;
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
  },
): ControlledContingentStructuralDiagnosisResult {
  const maximumSteps =
    options
      ?.maximumSteps ??
    2;

  const initialBelief =
    posterior.getBelief();

  const initialPlan =
    planContingentMultiFragmentStructuralDiagnostics(
      posterior,
      probes,
      {
        horizon:
          maximumSteps,

        maximumRisk:
          options
            ?.maximumRisk ??
          0.3,

        costPenalty:
          options
            ?.costPenalty ??
          0.2,

        riskPenalty:
          options
            ?.riskPenalty ??
          0.1,
      },
    );

  const acquiredObservations:
    StructuralMechanismObservation[] =
      [];

  const executedProbeIds:
    string[] =
      [];

  if (
    initialBelief
      .sufficientlyResolved
  ) {
    return {
      decision:
        "resolved",

      initialBelief,

      initialPlan,

      acquiredObservations,

      executedProbeIds,

      finalBelief:
        initialBelief,

      reason:
        "multi-fragment-structure-resolved",
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
    const available =
      probes.filter(
        (probe) =>
          !executedProbeIds.includes(
            probe.id,
          ),
      );

    const plan =
      planContingentMultiFragmentStructuralDiagnostics(
        posterior,
        available,
        {
          horizon:
            step <
              maximumSteps
              ? 2
              : 1,

          maximumRisk:
            options
              ?.maximumRisk ??
            0.3,

          costPenalty:
            options
              ?.costPenalty ??
            0.2,

          riskPenalty:
            options
              ?.riskPenalty ??
            0.1,
        },
      );

    if (
      plan.decision !==
        "plan" ||
      !plan.firstProbe
    ) {
      return {
        decision:
          "abstained",

        initialBelief,

        initialPlan,

        acquiredObservations,

        executedProbeIds,

        finalBelief:
          posterior.getBelief(),

        reason:
          "no-safe-contingent-structural-plan",
      };
    }

    const measuredEffect =
      predictHierarchicalProgramEffect(
        actualProgram,
        plan
          .firstProbe
          .interventions,
      );

    const observation:
      StructuralMechanismObservation = {
      experiment: {
        id:
          `${plan.firstProbe.id}:controlled-${step}`,

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

      measuredEffect,
    };

    acquiredObservations.push(
      observation,
    );

    executedProbeIds.push(
      plan.firstProbe.id,
    );

    const beliefAfter =
      posterior.recordObservation(
        observation,
        plan
          .firstProbe
          .observationStdDev,
      );

    if (
      beliefAfter
        .sufficientlyResolved
    ) {
      return {
        decision:
          "resolved",

        initialBelief,

        initialPlan,

        acquiredObservations,

        executedProbeIds,

        finalBelief:
          beliefAfter,

        reason:
          "multi-fragment-structure-resolved",
      };
    }
  }

  return {
    decision:
      "abstained",

    initialBelief,

    initialPlan,

    acquiredObservations,

    executedProbeIds,

    finalBelief:
      posterior.getBelief(),

    reason:
      "contingent-structural-budget-exhausted",
  };
}

export function buildResolvedMultiFragmentStructuralSearch(
  posterior:
    MultiFragmentStructuralPosterior,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
): ProbabilisticLocalRepairSearch {
  const belief =
    posterior.getBelief();

  const candidates:
    LocalRepairSearchCandidate[] =
      posterior
        .getCandidates()
        .map(
          (candidate) => ({
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
          }),
        );

  const selectedCandidate =
    candidates.find(
      (candidate) =>
        candidate.id ===
        belief
          .topCandidateId,
    );

  if (!selectedCandidate) {
    throw new Error(
      `Unknown resolved multi-fragment structural candidate ${belief.topCandidateId}.`,
    );
  }

  const top =
    posterior
      .getCandidates()
      .find(
        (candidate) =>
          candidate.id ===
          belief
            .topCandidateId,
      );

  if (!top) {
    throw new Error(
      "Resolved multi-fragment structural candidate is missing.",
    );
  }

  if (
    !belief
      .sufficientlyResolved
  ) {
    return {
      decision:
        "abstained",

      faultExplanation: {
        id:
          "multi-fragment-structure-unresolved",

        kind:
          "multi-fragment",

        fragmentIds:
          Object.keys(
            top
              .componentCandidateIds,
          ).sort(),
      },

      faultConfidence:
        belief.confidence,

      faultFragmentIds:
        Object.keys(
          top
            .componentCandidateIds,
        ).sort(),

      repairEvidenceIds:
        discoveryEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates,

      reason:
        "fault-posterior-not-resolved",
    };
  }

  const changedIds =
    Array.from(
      new Set([
        ...Object.keys(
          top
            .replacementFragmentIds,
        ),
        ...top
          .retiredFragmentIds,
      ]),
    ).sort();

  if (
    changedIds.length ===
      0
  ) {
    return {
      decision:
        "retain-no-fault",

      faultExplanation: {
        id:
          "multi-fragment-structure-incumbent",

        kind:
          "no-fault",

        fragmentIds:
          [],
      },

      faultConfidence:
        belief.confidence,

      faultFragmentIds:
        [],

      repairEvidenceIds:
        discoveryEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates,

      reason:
        "no-fault-posterior-retains-incumbent",
    };
  }

  return {
    decision:
      "search",

    faultExplanation: {
      id:
        "multi-fragment-structural-revision",

      kind:
        changedIds.length >
          1
          ? "multi-fragment"
          : "single-fragment",

      fragmentIds:
        changedIds,
    },

    faultConfidence:
      belief.confidence,

    faultFragmentIds:
      changedIds,

    repairEvidenceIds:
      discoveryEvidence.map(
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

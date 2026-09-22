import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
  StructuralTermKind,
} from "./mechanism-structure-synthesis";

import type {
  LocalRepairSearchCandidate,
  ProbabilisticLocalRepairSearch,
} from "./multi-step-fault-diagnosis-local-repair";

export type LocalMutationKind =
  | "incumbent"
  | StructuralTermKind;

export interface LocalStructuralMutationCandidate {
  id: string;
  targetFragmentId: string;
  kind: LocalMutationKind;
  variables: string[];
  coefficient: number;
  topologyChanged: boolean;
  fragment: ValidatedCausalFragment;
  program: HierarchicalCausalProgram;
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
}

export interface JointParameterStructureBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  topKind: LocalMutationKind;
  topCoefficient: number;
  topVariables: string[];
  topologyChanged: boolean;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface StructuralMutationProbe {
  id: string;
  interventions: Record<string, number>;
  risk: number;
  cost: number;
  reversible: boolean;
  observationStdDev: number;
}

export interface StructuralMutationProbeChoice {
  decision:
    | "probe"
    | "abstained";
  probe?: StructuralMutationProbe;
  expectedInformationGain: number;
  expectedPosteriorNormalizedEntropy: number;
  score: number;
  reason:
    | "safe-structural-information-probe"
    | "no-safe-structural-information-probe";
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

function cloneTerm(
  term:
    StructuralMechanismTerm,
): StructuralMechanismTerm {
  return {
    ...term,

    variables: [
      ...term.variables,
    ],
  };
}

function cloneFragment(
  fragment:
    ValidatedCausalFragment,
): ValidatedCausalFragment {
  return {
    ...fragment,

    terms:
      fragment.terms.map(
        cloneTerm,
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

function replaceFragment(
  program:
    HierarchicalCausalProgram,
  targetFragmentId: string,
  replacement:
    ValidatedCausalFragment,
  id: string,
): HierarchicalCausalProgram {
  let replaced =
    false;

  const fragments =
    program.fragments.map(
      (fragment) => {
        if (
          fragment.id !==
            targetFragmentId
        ) {
          return cloneFragment(
            fragment,
          );
        }

        replaced =
          true;

        return cloneFragment(
          replacement,
        );
      },
    );

  if (!replaced) {
    throw new Error(
      `Unknown local structural mutation target ${targetFragmentId}.`,
    );
  }

  return {
    ...cloneProgram(
      program,
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
}

function withoutFragment(
  program:
    HierarchicalCausalProgram,
  targetFragmentId:
    string,
): HierarchicalCausalProgram {
  const fragments =
    program.fragments.filter(
      (fragment) =>
        fragment.id !==
        targetFragmentId,
    );

  if (
    fragments.length ===
      program.fragments.length
  ) {
    throw new Error(
      `Unknown local structural mutation target ${targetFragmentId}.`,
    );
  }

  return {
    ...cloneProgram(
      program,
    ),

    id:
      `${program.id}:without:${targetFragmentId}`,

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
}

function programMeanSquaredError(
  program:
    HierarchicalCausalProgram,
  observations:
    readonly StructuralMechanismObservation[],
): number {
  if (
    observations.length ===
      0
  ) {
    throw new Error(
      "Local structural mutation evaluation requires evidence.",
    );
  }

  return observations.reduce(
    (sum, observation) => {
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
    observations.length;
}

function oneTermFragment(
  id: string,
  term:
    StructuralMechanismTerm,
  sourceEvidenceCount:
    number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      cloneTerm(
        term,
      ),
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      Math.max(
        1,
        sourceEvidenceCount,
      ),
  };
}

function fitLocalCoefficient(
  background:
    HierarchicalCausalProgram,
  targetFragmentId:
    string,
  template:
    StructuralMechanismTerm,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
): number {
  let numerator =
    0;

  let denominator =
    0;

  const unitTerm: StructuralMechanismTerm = {
    ...template,

    coefficient:
      1,

    variables: [
      ...template.variables,
    ],
  };

  const unitFragment =
    oneTermFragment(
      `${targetFragmentId}:fit-unit:${template.id}`,
      unitTerm,
      discoveryEvidence.length,
    );

  const unitProgram: HierarchicalCausalProgram = {
    ...cloneProgram(
      background,
    ),

    id:
      `${background.id}:fit-unit:${template.id}`,

    fragments: [
      ...background.fragments.map(
        cloneFragment,
      ),
      unitFragment,
    ],

    depth:
      2 +
      background.fragments.length,

    complexity:
      background.complexity +
      1,
  };

  for (
    const observation of
      discoveryEvidence
  ) {
    const backgroundPrediction =
      predictHierarchicalProgramEffect(
        background,
        observation
          .experiment
          .interventions,
      );

    const unitPrediction =
      predictHierarchicalProgramEffect(
        unitProgram,
        observation
          .experiment
          .interventions,
      );

    const feature =
      unitPrediction -
      backgroundPrediction;

    const residual =
      observation
        .measuredEffect -
      backgroundPrediction;

    numerator +=
      feature *
      residual;

    denominator +=
      feature *
      feature;
  }

  if (
    denominator <=
      Number.EPSILON
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      numerator /
        denominator,
    ),
  );
}

function termSignature(
  term:
    StructuralMechanismTerm,
): string {
  return `${term.kind}:${[
    ...term.variables,
  ].sort().join("|")}`;
}

function candidateKey(
  kind:
    LocalMutationKind,
  variables:
    readonly string[],
  coefficient:
    number,
): string {
  return `${kind}:${[
    ...variables,
  ].sort().join("|")}:${coefficient.toFixed(
    6,
  )}`;
}

function topologyComplexity(
  kind:
    LocalMutationKind,
  variableCount:
    number,
): number {
  if (
    kind ===
      "incumbent"
  ) {
    return 0;
  }

  if (
    kind ===
      "interaction"
  ) {
    return Math.max(
      2,
      variableCount,
    );
  }

  return 1;
}

export function synthesizeBoundedLocalStructuralMutations(
  incumbent:
    HierarchicalCausalProgram,
  targetFragmentId:
    string,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
  observedVariables:
    readonly string[],
  options?: {
    includeSaturating?: boolean;
    includeInteractions?: boolean;
    includeLatentBias?: boolean;
    maximumCandidates?: number;
    complexityPenaltyPerUnit?: number;
  },
): LocalStructuralMutationCandidate[] {
  if (
    discoveryEvidence.length ===
      0
  ) {
    throw new Error(
      "Local structural mutation synthesis requires discovery evidence.",
    );
  }

  const target =
    incumbent.fragments.find(
      (fragment) =>
        fragment.id ===
        targetFragmentId,
    );

  if (!target) {
    throw new Error(
      `Unknown local structural mutation target ${targetFragmentId}.`,
    );
  }

  if (
    target.terms.length !==
      1
  ) {
    throw new Error(
      "Bounded local structural mutation currently requires a one-term target fragment.",
    );
  }

  const incumbentTerm =
    target.terms[0]!;

  const variables =
    Array.from(
      new Set(
        observedVariables,
      ),
    ).sort();

  if (
    variables.length ===
      0
  ) {
    throw new Error(
      "Local structural mutation requires observed variables.",
    );
  }

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    12;

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

  const complexityPenaltyPerUnit =
    options
      ?.complexityPenaltyPerUnit ??
    0.002;

  validateNonNegativeFinite(
    "complexityPenaltyPerUnit",
    complexityPenaltyPerUnit,
  );

  const background =
    withoutFragment(
      incumbent,
      targetFragmentId,
    );

  const templates:
    {
      kind:
        StructuralTermKind;
      variables:
        string[];
    }[] =
      [];

  const incumbentVariables = [
    ...incumbentTerm.variables,
  ];

  templates.push({
    kind:
      incumbentTerm.kind,

    variables:
      incumbentVariables,
  });

  const primaryVariable =
    incumbentVariables[0] ??
    variables[0]!;

  if (
    incumbentTerm.kind !==
      "linear"
  ) {
    templates.push({
      kind:
        "linear",

      variables: [
        primaryVariable,
      ],
    });
  }

  if (
    options
      ?.includeSaturating !==
      false &&
    incumbentTerm.kind !==
      "saturating"
  ) {
    templates.push({
      kind:
        "saturating",

      variables: [
        primaryVariable,
      ],
    });
  }

  if (
    options
      ?.includeInteractions !==
      false
  ) {
    for (
      const variable of
        variables
    ) {
      if (
        variable ===
          primaryVariable
      ) {
        continue;
      }

      templates.push({
        kind:
          "interaction",

        variables: [
          primaryVariable,
          variable,
        ],
      });
    }
  }

  if (
    options
      ?.includeLatentBias !==
      false
  ) {
    templates.push({
      kind:
        "latent-bias",

      variables:
        [],
    });
  }

  const seen =
    new Set<string>();

  const candidates:
    LocalStructuralMutationCandidate[] =
      [];

  const incumbentCandidate:
    LocalStructuralMutationCandidate = {
    id:
      `${incumbent.id}:mutation:incumbent`,

    targetFragmentId,

    kind:
      "incumbent",

    variables:
      incumbentVariables,

    coefficient:
      incumbentTerm.coefficient,

    topologyChanged:
      false,

    fragment:
      cloneFragment(
        target,
      ),

    program:
      cloneProgram(
        incumbent,
      ),

    discoveryMeanSquaredError:
      programMeanSquaredError(
        incumbent,
        discoveryEvidence,
      ),

    complexityPenalty:
      0,

    objective:
      programMeanSquaredError(
        incumbent,
        discoveryEvidence,
      ),
  };

  candidates.push(
    incumbentCandidate,
  );

  seen.add(
    candidateKey(
      "incumbent",
      incumbentVariables,
      incumbentTerm.coefficient,
    ),
  );

  for (
    const template of
      templates
  ) {
    const fittedCoefficient =
      fitLocalCoefficient(
        background,
        targetFragmentId,
        {
          id:
            `template:${template.kind}:${template.variables.join(
              ",",
            )}`,

          kind:
            template.kind,

          variables: [
            ...template.variables,
          ],

          coefficient:
            0,
        },
        discoveryEvidence,
      );

    const key =
      candidateKey(
        template.kind,
        template.variables,
        fittedCoefficient,
      );

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    const term:
      StructuralMechanismTerm = {
      id:
        `mutation:${template.kind}(${template.variables.join(
          ",",
        )})`,

      kind:
        template.kind,

      variables: [
        ...template.variables,
      ],

      coefficient:
        fittedCoefficient,
    };

    const fragment =
      oneTermFragment(
        `${targetFragmentId}:mutation:${template.kind}:${template.variables.join(
          "+",
        ) || "bias"}:${fittedCoefficient.toFixed(
          3,
        )}`,
        term,
        discoveryEvidence.length,
      );

    const id =
      `${incumbent.id}:mutation:${template.kind}:${template.variables.join(
        "+",
      ) || "bias"}:${fittedCoefficient.toFixed(
        3,
      )}`;

    const program =
      replaceFragment(
        incumbent,
        targetFragmentId,
        fragment,
        id,
      );

    const discoveryMeanSquaredError =
      programMeanSquaredError(
        program,
        discoveryEvidence,
      );

    const topologyChanged =
      termSignature(
        term,
      ) !==
      termSignature(
        incumbentTerm,
      );

    const complexityPenalty =
      topologyChanged
        ? complexityPenaltyPerUnit *
          topologyComplexity(
            template.kind,
            template
              .variables
              .length,
          )
        : 0;

    candidates.push({
      id,

      targetFragmentId,

      kind:
        template.kind,

      variables: [
        ...template.variables,
      ],

      coefficient:
        fittedCoefficient,

      topologyChanged,

      fragment,

      program,

      discoveryMeanSquaredError,

      complexityPenalty,

      objective:
        discoveryMeanSquaredError +
        complexityPenalty,
    });
  }

  return candidates
    .sort(
      (left, right) =>
        left.objective -
          right.objective ||
        Number(
          left.topologyChanged,
        ) -
          Number(
            right.topologyChanged,
          ) ||
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
  observation:
    number,
  mean:
    number,
  stdDev:
    number,
): number {
  if (
    !Number.isFinite(
      stdDev,
    ) ||
    stdDev <=
      0
  ) {
    throw new Error(
      "Joint parameter-structure observationStdDev must be positive and finite.",
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
    Readonly<
      Record<
        string,
        number
      >
    >,
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
      "Joint parameter-structure posterior requires candidates.",
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

export class JointParameterStructurePosterior {
  private logWeights:
    Record<string, number>;

  constructor(
    private readonly candidates:
      readonly LocalStructuralMutationCandidate[],
    options?: {
      sufficientConfidence?: number;
      minimumMargin?: number;
      maximumDiscoveryObjectiveGap?: number;
    },
  ) {
    const maximumDiscoveryObjectiveGap =
      options
        ?.maximumDiscoveryObjectiveGap ??
      0.02;

    validateNonNegativeFinite(
      "maximumDiscoveryObjectiveGap",
      maximumDiscoveryObjectiveGap,
    );

    if (
      candidates.length <
        2
    ) {
      throw new Error(
        "Joint parameter-structure posterior requires at least two candidates.",
      );
    }

    const bestObjective =
      Math.min(
        ...candidates.map(
          (candidate) =>
            candidate.objective,
        ),
      );

    this.activeCandidates =
      candidates.filter(
        (candidate) =>
          candidate.objective <=
            bestObjective +
              maximumDiscoveryObjectiveGap,
      );

    if (
      this.activeCandidates.length <
        2
    ) {
      throw new Error(
        "Joint parameter-structure posterior requires at least two discovery-plausible candidates.",
      );
    }

    this.sufficientConfidence =
      options
        ?.sufficientConfidence ??
      0.95;

    this.minimumMargin =
      options
        ?.minimumMargin ??
      0.1;

    validateUnitInterval(
      "sufficientConfidence",
      this.sufficientConfidence,
    );

    validateUnitInterval(
      "minimumMargin",
      this.minimumMargin,
    );

    const prior =
      1 /
      this.activeCandidates.length;

    this.logWeights =
      Object.fromEntries(
        this.activeCandidates.map(
          (candidate) => [
            candidate.id,
            Math.log(
              prior,
            ),
          ],
        ),
      );
  }

  private readonly activeCandidates:
    readonly LocalStructuralMutationCandidate[];

  private readonly sufficientConfidence:
    number;

  private readonly minimumMargin:
    number;

  getCandidates():
    readonly LocalStructuralMutationCandidate[] {
    return this.activeCandidates;
  }

  getBelief():
    JointParameterStructureBelief {
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
        "Joint parameter-structure posterior has no top candidate.",
      );
    }

    const candidate =
      this.activeCandidates.find(
        (item) =>
          item.id ===
          top[0],
      );

    if (!candidate) {
      throw new Error(
        `Unknown joint parameter-structure candidate ${top[0]}.`,
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

      topKind:
        candidate.kind,

      topCoefficient:
        candidate.coefficient,

      topVariables: [
        ...candidate.variables,
      ],

      topologyChanged:
        candidate
          .topologyChanged,

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
      0.04,
  ): JointParameterStructureBelief {
    for (
      const candidate of
        this.activeCandidates
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
}

export function synthesizeStructuralMutationProbes(
  variables:
    readonly string[],
  options?: {
    levels?: readonly number[];
    includeJointProbe?: boolean;
    observationStdDev?: number;
    baseRisk?: number;
    baseCost?: number;
  },
): StructuralMutationProbe[] {
  const distinct =
    Array.from(
      new Set(
        variables,
      ),
    ).sort();

  if (
    distinct.length ===
      0
  ) {
    throw new Error(
      "Structural mutation probe synthesis requires observed variables.",
    );
  }

  const levels =
    options
      ?.levels ??
    [
      0.25,
      0.5,
      1,
    ];

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.04;

  const baseRisk =
    options
      ?.baseRisk ??
    0.04;

  const baseCost =
    options
      ?.baseCost ??
    0.02;

  validateNonNegativeFinite(
    "structural mutation observationStdDev",
    observationStdDev,
  );

  if (
    observationStdDev <=
      0
  ) {
    throw new Error(
      "structural mutation observationStdDev must be positive.",
    );
  }

  validateUnitInterval(
    "structural mutation baseRisk",
    baseRisk,
  );

  validateNonNegativeFinite(
    "structural mutation baseCost",
    baseCost,
  );

  const probes:
    StructuralMutationProbe[] =
      [];

  for (
    const variable of
      distinct
  ) {
    for (
      const level of
        levels
    ) {
      validateUnitInterval(
        `structural probe level for ${variable}`,
        level,
      );

      probes.push({
        id:
          `structure-probe:${variable}=${level.toFixed(
            2,
          )}`,

        interventions: {
          [
            variable
          ]:
            level,
        },

        risk:
          Math.min(
            1,
            baseRisk *
            Math.max(
              0.25,
              level,
            ),
          ),

        cost:
          baseCost *
          Math.max(
            0.25,
            level,
          ),

        reversible:
          true,

        observationStdDev,
      });
    }
  }

  if (
    options
      ?.includeJointProbe !==
      false &&
    distinct.length >=
      2
  ) {
    const first =
      distinct[0]!;

    const second =
      distinct[1]!;

    probes.push({
      id:
        `structure-probe:${first}=0.50+${second}=1.00`,

      interventions: {
        [
          first
        ]:
          0.5,

        [
          second
        ]:
          1,
      },

      risk:
        Math.min(
          1,
          baseRisk *
          1.25,
        ),

      cost:
        baseCost *
        1.25,

      reversible:
        true,

      observationStdDev,
    });
  }

  return probes;
}

function posteriorAfterRepresentativeObservation(
  posterior:
    JointParameterStructurePosterior,
  belief:
    JointParameterStructureBelief,
  probe:
    StructuralMutationProbe,
  observation:
    number,
): Record<string, number> {
  const logWeights:
    Record<string, number> =
      {};

  for (
    const candidate of
      posterior.getCandidates()
  ) {
    const prediction =
      predictHierarchicalProgramEffect(
        candidate.program,
        probe.interventions,
      );

    logWeights[
      candidate.id
    ] =
      Math.log(
        Math.max(
          belief.probabilities[
            candidate.id
          ] ??
          Number.MIN_VALUE,
          Number.MIN_VALUE,
        ),
      ) +
      logGaussianLikelihood(
        observation,
        prediction,
        probe.observationStdDev,
      );
  }

  return normalizeLogWeights(
    logWeights,
  );
}

export function chooseStructuralMutationProbe(
  posterior:
    JointParameterStructurePosterior,
  probes:
    readonly StructuralMutationProbe[],
  options?: {
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
  },
): StructuralMutationProbeChoice {
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

  const belief =
    posterior.getBelief();

  const priorEntropy =
    entropy(
      Object.values(
        belief
          .probabilities,
      ),
    );

  let best:
    StructuralMutationProbeChoice |
    undefined;

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

      const representativeObservation =
        predictHierarchicalProgramEffect(
          truth.program,
          probe.interventions,
        );

      const updated =
        posteriorAfterRepresentativeObservation(
          posterior,
          belief,
          probe,
          representativeObservation,
        );

      expectedPosteriorEntropy +=
        truthProbability *
        entropy(
          Object.values(
            updated,
          ),
        );
    }

    const expectedInformationGain =
      Math.max(
        0,
        priorEntropy -
        expectedPosteriorEntropy,
      );

    const expectedPosteriorNormalizedEntropy =
      posterior
        .getCandidates()
        .length <=
          1
        ? 0
        : expectedPosteriorEntropy /
          Math.log(
            posterior
              .getCandidates()
              .length,
          );

    const score =
      expectedInformationGain -
      costPenalty *
        probe.cost -
      riskPenalty *
        probe.risk;

    const candidate:
      StructuralMutationProbeChoice = {
      decision:
        "probe",

      probe: {
        ...probe,

        interventions: {
          ...probe.interventions,
        },
      },

      expectedInformationGain,

      expectedPosteriorNormalizedEntropy,

      score,

      reason:
        "safe-structural-information-probe",
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
        (
          candidate.probe
            ?.risk ??
          1
        ) <
          (
            best.probe
              ?.risk ??
            1
          ) -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          (
            candidate.probe
              ?.risk ??
            1
          ) -
            (
              best.probe
                ?.risk ??
              1
            ),
        ) <=
          Number.EPSILON &&
        (
          candidate.probe
            ?.id ??
          ""
        ) <
          (
            best.probe
              ?.id ??
            ""
          )
      )
    ) {
      best =
        candidate;
    }
  }

  return best ?? {
    decision:
      "abstained",

    expectedInformationGain:
      0,

    expectedPosteriorNormalizedEntropy:
      belief
        .normalizedEntropy,

    score:
      Number.NEGATIVE_INFINITY,

    reason:
      "no-safe-structural-information-probe",
  };
}

function toRepairCandidate(
  candidate:
    LocalStructuralMutationCandidate,
): LocalRepairSearchCandidate {
  const changed =
    candidate.kind !==
      "incumbent" &&
    (
      candidate.topologyChanged ||
      candidate.fragment.id !==
        candidate.targetFragmentId
    );

  return {
    id:
      candidate.id,

    program:
      candidate.program,

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

export function buildResolvedStructuralMutationSearch(
  posterior:
    JointParameterStructurePosterior,
  discoveryEvidence:
    readonly StructuralMechanismObservation[],
): ProbabilisticLocalRepairSearch {
  const belief =
    posterior.getBelief();

  const candidates =
    posterior
      .getCandidates()
      .map(
        toRepairCandidate,
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
      `Unknown resolved structural mutation candidate ${belief.topCandidateId}.`,
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
      "Resolved structural mutation candidate is missing.",
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
          "joint-parameter-structure-unresolved",

        kind:
          "single-fragment",

        fragmentIds: [
          top.targetFragmentId,
        ],
      },

      faultConfidence:
        belief.confidence,

      faultFragmentIds: [
        top.targetFragmentId,
      ],

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

  if (
    top.kind ===
      "incumbent"
  ) {
    return {
      decision:
        "retain-no-fault",

      faultExplanation: {
        id:
          "joint-parameter-structure-incumbent",

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
        `joint-parameter-structure:${top.kind}`,

      kind:
        "single-fragment",

      fragmentIds: [
        top.targetFragmentId,
      ],
    },

    faultConfidence:
      belief.confidence,

    faultFragmentIds: [
      top.targetFragmentId,
    ],

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

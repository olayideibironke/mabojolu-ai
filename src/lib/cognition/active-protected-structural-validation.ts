import {
  assessAdaptiveProtectedEvidence,
  deriveAdaptiveEvidenceRequirement,
  type AdaptiveEvidenceRequirement,
  type ProtectedEvidenceCoverageAssessment,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import {
  validateProbabilisticLocalRepairSearch,
  type LocalRepairSearchCandidate,
  type ProbabilisticLocalRepairSearch,
  type ProtectedLocalRepairDecision,
} from "./multi-step-fault-diagnosis-local-repair";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface ProtectedStructuralValidationProbe {
  id: string;
  interventions: Record<string, number>;
  signature: string;
  fillsMissingCoverage: boolean;
  risk: number;
  cost: number;
  reversible: boolean;
  observationStdDev: number;
}

export interface ProtectedStructuralBelief {
  probabilities: Record<string, number>;
  topCandidateId: string;
  selectedCandidateId: string;
  selectedProbability: number;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  selectedIsTop: boolean;
  sufficientlySeparated: boolean;
}

export interface ProtectedStructuralCoverageGap {
  requirement: AdaptiveEvidenceRequirement;
  assessment: ProtectedEvidenceCoverageAssessment;
  currentEvidenceCount: number;
  currentUniqueInterventionSignatures: string[];
  missingEvidenceCount: number;
  missingUniqueInterventionSignatures: number;
}

export interface ActiveProtectedStructuralProbeChoice {
  decision:
    | "probe"
    | "abstained";
  probe?: ProtectedStructuralValidationProbe;
  expectedInformationGain: number;
  expectedPosteriorNormalizedEntropy: number;
  coverageBonus: number;
  score: number;
  reason:
    | "safe-protected-structural-probe"
    | "no-safe-protected-structural-probe";
}

export interface ActiveProtectedStructuralValidationStep {
  step: number;
  probeId: string;
  observationId: string;
  observedEffect: number;
  belief: ProtectedStructuralBelief;
  evidenceCount: number;
  uniqueInterventionSignatures: number;
  bestMeanSquaredError: number;
  selectedMeanSquaredError: number;
}

export interface ActiveProtectedStructuralValidationResult {
  decision:
    | "validated"
    | "falsified"
    | "reopen-search"
    | "abstained";
  selectedCandidateId: string;
  initialBelief: ProtectedStructuralBelief;
  finalBelief: ProtectedStructuralBelief;
  initialGap: ProtectedStructuralCoverageGap;
  finalGap: ProtectedStructuralCoverageGap;
  initialProtectedEvidence: StructuralMechanismObservation[];
  acquiredProtectedEvidence: StructuralMechanismObservation[];
  allProtectedEvidence: StructuralMechanismObservation[];
  steps: ActiveProtectedStructuralValidationStep[];
  falsifyingCandidateId?: string;
  protectedDecision?: ProtectedLocalRepairDecision;
  reason:
    | "protected-structural-revision-validated"
    | "selected-structural-revision-falsified"
    | "all-retained-structural-candidates-inadequate"
    | "no-safe-protected-structural-probe"
    | "protected-structural-budget-exhausted";
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

function interventionSignature(
  interventions:
    Readonly<Record<string, number>>,
): string {
  return Object.entries(
    interventions,
  )
    .filter(
      ([, value]) =>
        Math.abs(value) >
        Number.EPSILON,
    )
    .sort(
      (left, right) =>
        left[0].localeCompare(
          right[0],
        ),
    )
    .map(
      ([key, value]) =>
        `${key}=${value.toFixed(
          6,
        )}`,
    )
    .join("|") ||
    "zero-intervention";
}

function lineageProtectedEvidenceIds(
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

function excludedProtectedEvidenceIds(
  lineage:
    RevisionLineage,
  search:
    ProbabilisticLocalRepairSearch,
  diagnosticEvidenceIds:
    readonly string[],
): string[] {
  return Array.from(
    new Set([
      ...lineageProtectedEvidenceIds(
        lineage,
      ),
      ...search
        .repairEvidenceIds,
      ...diagnosticEvidenceIds,
    ]),
  ).sort();
}

function meanSquaredError(
  candidate:
    LocalRepairSearchCandidate,
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
      "Protected structural posterior requires candidates.",
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

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    throw new Error(
      "Protected structural posterior cannot be normalized.",
    );
  }

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
      "Protected structural observationStdDev must be positive and finite.",
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

function boundedSubsets(
  values:
    readonly string[],
  maximumArity: number,
): string[][] {
  const output:
    string[][] =
      [];

  function visit(
    start: number,
    chosen: string[],
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

function candidateVariables(
  candidates:
    readonly LocalRepairSearchCandidate[],
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
  ).sort();
}

export function analyzeProtectedStructuralCoverageGap(
  selectedCandidate:
    LocalRepairSearchCandidate,
  uncertaintyAtInstall:
    number,
  evidence:
    readonly StructuralMechanismObservation[],
  excludedEvidenceIds:
    readonly string[],
): ProtectedStructuralCoverageGap {
  const requirement =
    deriveAdaptiveEvidenceRequirement(
      selectedCandidate.program,
      uncertaintyAtInstall,
    );

  const assessment =
    assessAdaptiveProtectedEvidence(
      evidence,
      requirement,
      excludedEvidenceIds,
    );

  const missingEvidenceCount =
    Math.max(
      0,
      requirement
        .minimumProtectedEvidence -
        evidence.length,
    );

  const missingUniqueInterventionSignatures =
    Math.max(
      0,
      requirement
        .minimumUniqueInterventionSignatures -
        assessment
          .uniqueInterventionSignatures
          .length,
    );

  return {
    requirement,

    assessment,

    currentEvidenceCount:
      evidence.length,

    currentUniqueInterventionSignatures: [
      ...assessment
        .uniqueInterventionSignatures,
    ],

    missingEvidenceCount,

    missingUniqueInterventionSignatures,
  };
}

export function synthesizeProtectedStructuralValidationProbes(
  candidates:
    readonly LocalRepairSearchCandidate[],
  currentEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    levels?: readonly number[];
    maximumArity?: number;
    maximumProbes?: number;
    risk?: number;
    cost?: number;
    observationStdDev?: number;
  },
): ProtectedStructuralValidationProbe[] {
  if (
    candidates.length <
      2
  ) {
    throw new Error(
      "Protected structural probe synthesis requires at least two candidates.",
    );
  }

  const variables =
    candidateVariables(
      candidates,
    );

  if (
    variables.length ===
      0
  ) {
    throw new Error(
      "Protected structural probe synthesis requires candidate variables.",
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

  for (
    const level of
      levels
  ) {
    validateUnitInterval(
      "protected structural probe level",
      level,
    );
  }

  const maximumArity =
    options
      ?.maximumArity ??
    2;

  validatePositiveInteger(
    "maximumArity",
    maximumArity,
  );

  const maximumProbes =
    options
      ?.maximumProbes ??
    48;

  validatePositiveInteger(
    "maximumProbes",
    maximumProbes,
  );

  const risk =
    options
      ?.risk ??
    0.08;

  const cost =
    options
      ?.cost ??
    0.03;

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.03;

  validateUnitInterval(
    "protected structural probe risk",
    risk,
  );

  validateNonNegativeFinite(
    "protected structural probe cost",
    cost,
  );

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <= 0
  ) {
    throw new Error(
      "protected structural probe observationStdDev must be positive and finite.",
    );
  }

  const existingSignatures =
    new Set(
      currentEvidence.map(
        (observation) =>
          interventionSignature(
            observation
              .experiment
              .interventions,
          ),
      ),
    );

  const output:
    ProtectedStructuralValidationProbe[] =
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

      const signature =
        interventionSignature(
          interventions,
        );

      const relevant =
        candidates.some(
          (candidate) =>
            Math.abs(
              predictHierarchicalProgramEffect(
                candidate.program,
                interventions,
              ),
            ) >
              Number.EPSILON,
        );

      if (
        !relevant
      ) {
        continue;
      }

      output.push({
        id:
          `protected-structure:${signature}`,

        interventions,

        signature,

        fillsMissingCoverage:
          !existingSignatures.has(
            signature,
          ),

        risk,

        cost,

        reversible:
          true,

        observationStdDev,
      });
    }
  }

  return output
    .sort(
      (left, right) =>
        Number(
          right
            .fillsMissingCoverage,
        ) -
          Number(
            left
              .fillsMissingCoverage,
          ) ||
        left.id.localeCompare(
          right.id,
        ),
    )
    .slice(
      0,
      maximumProbes,
    );
}

export class ProtectedStructuralPosterior {
  private logWeights:
    Record<string, number>;

  constructor(
    private readonly candidates:
      readonly LocalRepairSearchCandidate[],
    private readonly selectedCandidateId:
      string,
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
        "Protected structural posterior requires at least two candidates.",
      );
    }

    if (
      !candidates.some(
        (candidate) =>
          candidate.id ===
          selectedCandidateId,
      )
    ) {
      throw new Error(
        `Selected protected structural candidate ${selectedCandidateId} is missing.`,
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
                  `Protected structural prior is missing ${candidate.id}.`,
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
          "Protected structural prior probabilities must be positive and finite.",
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
    readonly LocalRepairSearchCandidate[] {
    return this.candidates;
  }

  getBelief():
    ProtectedStructuralBelief {
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
        "Protected structural posterior has no top candidate.",
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

    const selectedProbability =
      probabilities[
        this.selectedCandidateId
      ] ??
      0;

    return {
      probabilities,

      topCandidateId:
        top[0],

      selectedCandidateId:
        this.selectedCandidateId,

      selectedProbability,

      confidence,

      margin,

      normalizedEntropy:
        normalizedEntropy(
          ranked.map(
            ([, probability]) =>
              probability,
          ),
        ),

      selectedIsTop:
        top[0] ===
          this
            .selectedCandidateId,

      sufficientlySeparated:
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
  ): ProtectedStructuralBelief {
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

  chooseProbe(
    probes:
      readonly ProtectedStructuralValidationProbe[],
    gap:
      ProtectedStructuralCoverageGap,
    options?: {
      maximumRisk?: number;
      minimumInformationGain?: number;
      costPenalty?: number;
      riskPenalty?: number;
      coverageBonus?: number;
    },
  ): ActiveProtectedStructuralProbeChoice {
    const maximumRisk =
      options
        ?.maximumRisk ??
      0.3;

    const minimumInformationGain =
      options
        ?.minimumInformationGain ??
      0.005;

    const costPenalty =
      options
        ?.costPenalty ??
      0.1;

    const riskPenalty =
      options
        ?.riskPenalty ??
      0.05;

    const coverageBonusWeight =
      options
        ?.coverageBonus ??
      0.2;

    validateUnitInterval(
      "maximumRisk",
      maximumRisk,
    );

    validateNonNegativeFinite(
      "minimumInformationGain",
      minimumInformationGain,
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
      "coverageBonus",
      coverageBonusWeight,
    );

    const belief =
      this.getBelief();

    const priorEntropy =
      entropy(
        Object.values(
          belief
            .probabilities,
        ),
      );

    let best:
      ActiveProtectedStructuralProbeChoice |
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
          this.candidates
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

        const weighted:
          Record<string, number> =
            {};

        for (
          const candidate of
            this.candidates
        ) {
          const candidatePrediction =
            predictHierarchicalProgramEffect(
              candidate.program,
              probe.interventions,
            );

          weighted[
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
              representativeObservation,
              candidatePrediction,
              probe
                .observationStdDev,
            );
        }

        const posterior =
          normalizeLogWeights(
            weighted,
          );

        expectedPosteriorEntropy +=
          truthProbability *
          entropy(
            Object.values(
              posterior,
            ),
          );
      }

      const expectedInformationGain =
        Math.max(
          0,
          priorEntropy -
          expectedPosteriorEntropy,
        );

      const coverageBonus =
        gap
          .missingUniqueInterventionSignatures >
          0 &&
        probe
          .fillsMissingCoverage
          ? coverageBonusWeight
          : gap
              .missingEvidenceCount >
              0 &&
            probe
              .fillsMissingCoverage
            ? coverageBonusWeight *
              0.25
            : gap
                .missingEvidenceCount >
                0
              ? coverageBonusWeight *
                0.1
              : 0;

      if (
        expectedInformationGain <
          minimumInformationGain &&
        coverageBonus ===
          0
      ) {
        continue;
      }

      const score =
        expectedInformationGain +
        coverageBonus -
        costPenalty *
          probe.cost -
        riskPenalty *
          probe.risk;

      const candidate:
        ActiveProtectedStructuralProbeChoice = {
        decision:
          "probe",

        probe: {
          ...probe,

          interventions: {
            ...probe.interventions,
          },
        },

        expectedInformationGain,

        expectedPosteriorNormalizedEntropy:
          this.candidates.length <=
            1
            ? 0
            : expectedPosteriorEntropy /
              Math.log(
                this.candidates.length,
              ),

        coverageBonus,

        score,

        reason:
          "safe-protected-structural-probe",
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
          probe.cost <
            (
              best.probe
                ?.cost ??
              Number.POSITIVE_INFINITY
            )
        ) ||
        (
          Math.abs(
            candidate.score -
              best.score,
          ) <=
            Number.EPSILON &&
          Math.abs(
            probe.cost -
              (
                best.probe
                  ?.cost ??
                Number.POSITIVE_INFINITY
              ),
          ) <=
            Number.EPSILON &&
          probe.id <
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

      coverageBonus:
        0,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-protected-structural-probe",
    };
  }
}

function scoreCandidates(
  candidates:
    readonly LocalRepairSearchCandidate[],
  evidence:
    readonly StructuralMechanismObservation[],
): {
  candidateId: string;
  meanSquaredError: number;
}[] {
  return candidates
    .map(
      (candidate) => ({
        candidateId:
          candidate.id,

        meanSquaredError:
          meanSquaredError(
            candidate,
            evidence,
          ),
      }),
    )
    .sort(
      (left, right) =>
        left.meanSquaredError -
          right.meanSquaredError ||
        left
          .candidateId
          .localeCompare(
            right
              .candidateId,
          ),
    );
}

function protectedTerminalState(
  lineage:
    RevisionLineage,
  incumbent:
    HierarchicalCausalProgram,
  search:
    ProbabilisticLocalRepairSearch,
  posterior:
    ProtectedStructuralPosterior,
  evidence:
    readonly StructuralMechanismObservation[],
  excludedDiagnosticEvidenceIds:
    readonly string[],
  uncertaintyAtInstall:
    number,
  options: {
    minimumImprovement: number;
    minimumFalsificationEvidence: number;
    maximumSelectedProbabilityForFalsification: number;
    maximumAcceptableMeanSquaredError: number;
  },
):
  | {
      decision:
        "validated";
      protectedDecision:
        ProtectedLocalRepairDecision;
    }
  | {
      decision:
        "falsified";
      falsifyingCandidateId:
        string;
      protectedDecision?:
        ProtectedLocalRepairDecision;
    }
  | {
      decision:
        "reopen-search";
    }
  | {
      decision:
        "continue";
    } {
  if (
    search.decision !==
      "search" ||
    !search
      .selectedCandidate
  ) {
    return {
      decision:
        "continue",
    };
  }

  const belief =
    posterior.getBelief();

  const scores =
    scoreCandidates(
      search.candidates,
      evidence,
    );

  const best =
    scores[0];

  const selectedScore =
    scores.find(
      (score) =>
        score.candidateId ===
        search
          .selectedCandidate
          ?.id,
    );

  if (
    evidence.length >=
      options
        .minimumFalsificationEvidence &&
    best &&
    best
      .meanSquaredError >
      options
        .maximumAcceptableMeanSquaredError
  ) {
    return {
      decision:
        "reopen-search",
    };
  }

  if (
    evidence.length >=
      options
        .minimumFalsificationEvidence &&
    belief
      .sufficientlySeparated &&
    !belief
      .selectedIsTop &&
    belief
      .selectedProbability <=
      options
        .maximumSelectedProbabilityForFalsification
  ) {
    return {
      decision:
        "falsified",

      falsifyingCandidateId:
        belief
          .topCandidateId,
    };
  }

  const excludedIds =
    excludedProtectedEvidenceIds(
      lineage,
      search,
      excludedDiagnosticEvidenceIds,
    );

  const gap =
    analyzeProtectedStructuralCoverageGap(
      search
        .selectedCandidate,
      uncertaintyAtInstall,
      evidence,
      excludedIds,
    );

  if (
    gap.assessment.decision !==
      "ready"
  ) {
    return {
      decision:
        "continue",
    };
  }

  const protectedDecision =
    validateProbabilisticLocalRepairSearch(
      lineage,
      incumbent,
      search,
      evidence,
      excludedDiagnosticEvidenceIds,
      uncertaintyAtInstall,
      {
        minimumImprovement:
          options
            .minimumImprovement,
      },
    );

  if (
    protectedDecision.decision ===
      "installed" &&
    belief
      .selectedIsTop &&
    belief
      .sufficientlySeparated
  ) {
    return {
      decision:
        "validated",

      protectedDecision,
    };
  }

  if (
    protectedDecision.decision ===
      "retained"
  ) {
    return {
      decision:
        "falsified",

      falsifyingCandidateId:
        best
          ?.candidateId ??
        belief
          .topCandidateId,

      protectedDecision,
    };
  }

  if (
    selectedScore &&
    best &&
    best
      .candidateId !==
      selectedScore
        .candidateId &&
    belief
      .sufficientlySeparated
  ) {
    return {
      decision:
        "falsified",

      falsifyingCandidateId:
        best
          .candidateId,

      protectedDecision,
    };
  }

  return {
    decision:
      "continue",
  };
}

export function runControlledActiveProtectedStructuralValidation(
  lineage:
    RevisionLineage,
  incumbent:
    HierarchicalCausalProgram,
  search:
    ProbabilisticLocalRepairSearch,
  excludedDiagnosticEvidenceIds:
    readonly string[],
  actualProgram:
    HierarchicalCausalProgram,
  initialProtectedEvidence:
    readonly StructuralMechanismObservation[] = [],
  options?: {
    maximumSteps?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
    costPenalty?: number;
    riskPenalty?: number;
    coverageBonus?: number;
    observationStdDev?: number;
    levels?: readonly number[];
    maximumArity?: number;
    maximumProbes?: number;
    probeRisk?: number;
    probeCost?: number;
    uncertaintyAtInstall?: number;
    minimumImprovement?: number;
    minimumFalsificationEvidence?: number;
    maximumSelectedProbabilityForFalsification?: number;
    maximumAcceptableMeanSquaredError?: number;
    prior?: Readonly<Record<string, number>>;
  },
): ActiveProtectedStructuralValidationResult {
  if (
    search.decision !==
      "search" ||
    !search
      .selectedCandidate
  ) {
    throw new Error(
      "Active protected structural validation requires a resolved structural search.",
    );
  }

  if (
    search.candidates.length <
      2
  ) {
    throw new Error(
      "Active protected structural validation requires at least two retained candidates.",
    );
  }

  const maximumSteps =
    options
      ?.maximumSteps ??
    8;

  validatePositiveInteger(
    "maximumSteps",
    maximumSteps,
  );

  const uncertaintyAtInstall =
    options
      ?.uncertaintyAtInstall ??
    0.2;

  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
  );

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.01;

  const minimumFalsificationEvidence =
    options
      ?.minimumFalsificationEvidence ??
    2;

  const maximumSelectedProbabilityForFalsification =
    options
      ?.maximumSelectedProbabilityForFalsification ??
    0.1;

  const maximumAcceptableMeanSquaredError =
    options
      ?.maximumAcceptableMeanSquaredError ??
    0.02;

  validateNonNegativeFinite(
    "minimumImprovement",
    minimumImprovement,
  );

  validatePositiveInteger(
    "minimumFalsificationEvidence",
    minimumFalsificationEvidence,
  );

  validateUnitInterval(
    "maximumSelectedProbabilityForFalsification",
    maximumSelectedProbabilityForFalsification,
  );

  validateNonNegativeFinite(
    "maximumAcceptableMeanSquaredError",
    maximumAcceptableMeanSquaredError,
  );

  const excludedIds =
    excludedProtectedEvidenceIds(
      lineage,
      search,
      excludedDiagnosticEvidenceIds,
    );

  const evidence =
    initialProtectedEvidence.map(
      cloneObservation,
    );

  const posterior =
    new ProtectedStructuralPosterior(
      search.candidates,
      search
        .selectedCandidate
        .id,
      options
        ?.prior,
    );

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.03;

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <= 0
  ) {
    throw new Error(
      "observationStdDev must be positive and finite.",
    );
  }

  for (
    const observation of
      evidence
  ) {
    posterior.recordObservation(
      observation,
      observationStdDev,
    );
  }

  const initialBelief =
    posterior.getBelief();

  const initialGap =
    analyzeProtectedStructuralCoverageGap(
      search
        .selectedCandidate,
      uncertaintyAtInstall,
      evidence,
      excludedIds,
    );

  const acquiredProtectedEvidence:
    StructuralMechanismObservation[] =
      [];

  const steps:
    ActiveProtectedStructuralValidationStep[] =
      [];

  function finish(
    decision:
      ActiveProtectedStructuralValidationResult[
        "decision"
      ],
    reason:
      ActiveProtectedStructuralValidationResult[
        "reason"
      ],
    terminal?: {
      falsifyingCandidateId?: string;
      protectedDecision?: ProtectedLocalRepairDecision;
    },
  ):
    ActiveProtectedStructuralValidationResult {
    return {
      decision,

      selectedCandidateId:
        search
          .selectedCandidate!
          .id,

      initialBelief,

      finalBelief:
        posterior.getBelief(),

      initialGap,

      finalGap:
        analyzeProtectedStructuralCoverageGap(
          search
            .selectedCandidate!,
          uncertaintyAtInstall,
          evidence,
          excludedIds,
        ),

      initialProtectedEvidence:
        initialProtectedEvidence.map(
          cloneObservation,
        ),

      acquiredProtectedEvidence:
        acquiredProtectedEvidence.map(
          cloneObservation,
        ),

      allProtectedEvidence:
        evidence.map(
          cloneObservation,
        ),

      steps,

      falsifyingCandidateId:
        terminal
          ?.falsifyingCandidateId,

      protectedDecision:
        terminal
          ?.protectedDecision,

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
    const terminal =
      protectedTerminalState(
        lineage,
        incumbent,
        search,
        posterior,
        evidence,
        excludedDiagnosticEvidenceIds,
        uncertaintyAtInstall,
        {
          minimumImprovement,

          minimumFalsificationEvidence,

          maximumSelectedProbabilityForFalsification,

          maximumAcceptableMeanSquaredError,
        },
      );

    if (
      terminal.decision ===
        "validated"
    ) {
      return finish(
        "validated",
        "protected-structural-revision-validated",
        {
          protectedDecision:
            terminal
              .protectedDecision,
        },
      );
    }

    if (
      terminal.decision ===
        "falsified"
    ) {
      return finish(
        "falsified",
        "selected-structural-revision-falsified",
        {
          falsifyingCandidateId:
            terminal
              .falsifyingCandidateId,

          protectedDecision:
            terminal
              .protectedDecision,
        },
      );
    }

    if (
      terminal.decision ===
        "reopen-search"
    ) {
      return finish(
        "reopen-search",
        "all-retained-structural-candidates-inadequate",
      );
    }

    const gap =
      analyzeProtectedStructuralCoverageGap(
        lineage,
        search
          .selectedCandidate,
        uncertaintyAtInstall,
        evidence,
        excludedIds,
      );

    const probes =
      synthesizeProtectedStructuralValidationProbes(
        search.candidates,
        evidence,
        {
          levels:
            options
              ?.levels,

          maximumArity:
            options
              ?.maximumArity,

          maximumProbes:
            options
              ?.maximumProbes,

          risk:
            options
              ?.probeRisk,

          cost:
            options
              ?.probeCost,

          observationStdDev,
        },
      );

    const choice =
      posterior.chooseProbe(
        probes,
        gap,
        {
          maximumRisk:
            options
              ?.maximumRisk,

          minimumInformationGain:
            options
              ?.minimumInformationGain,

          costPenalty:
            options
              ?.costPenalty,

          riskPenalty:
            options
              ?.riskPenalty,

          coverageBonus:
            options
              ?.coverageBonus,
        },
      );

    if (
      choice.decision !==
        "probe" ||
      !choice.probe
    ) {
      return finish(
        "abstained",
        "no-safe-protected-structural-probe",
      );
    }

    const observedEffect =
      predictHierarchicalProgramEffect(
        actualProgram,
        choice
          .probe
          .interventions,
      );

    const observationId =
      `${choice.probe.id}:protected-${step}`;

    const observation:
      StructuralMechanismObservation = {
      experiment: {
        id:
          observationId,

        interventions: {
          ...choice
            .probe
            .interventions,
        },

        risk:
          choice.probe.risk,

        cost:
          choice.probe.cost,

        reversible:
          choice.probe
            .reversible,
      },

      measuredEffect:
        observedEffect,
    };

    evidence.push(
      observation,
    );

    acquiredProtectedEvidence.push(
      cloneObservation(
        observation,
      ),
    );

    const belief =
      posterior.recordObservation(
        observation,
        choice
          .probe
          .observationStdDev,
      );

    const scores =
      scoreCandidates(
        search.candidates,
        evidence,
      );

    const selectedScore =
      scores.find(
        (score) =>
          score.candidateId ===
          search
            .selectedCandidate
            ?.id,
      );

    const updatedGap =
      analyzeProtectedStructuralCoverageGap(
        lineage,
        search
          .selectedCandidate,
        uncertaintyAtInstall,
        evidence,
        excludedIds,
      );

    steps.push({
      step,

      probeId:
        choice.probe.id,

      observationId,

      observedEffect,

      belief,

      evidenceCount:
        evidence.length,

      uniqueInterventionSignatures:
        updatedGap
          .currentUniqueInterventionSignatures
          .length,

      bestMeanSquaredError:
        scores[
          0
        ]
          ?.meanSquaredError ??
        Number.POSITIVE_INFINITY,

      selectedMeanSquaredError:
        selectedScore
          ?.meanSquaredError ??
        Number.POSITIVE_INFINITY,
    });
  }

  const finalTerminal =
    protectedTerminalState(
      lineage,
      incumbent,
      search,
      posterior,
      evidence,
      excludedDiagnosticEvidenceIds,
      uncertaintyAtInstall,
      {
        minimumImprovement,

        minimumFalsificationEvidence,

        maximumSelectedProbabilityForFalsification,

        maximumAcceptableMeanSquaredError,
      },
    );

  if (
    finalTerminal.decision ===
      "validated"
  ) {
    return finish(
      "validated",
      "protected-structural-revision-validated",
      {
        protectedDecision:
          finalTerminal
            .protectedDecision,
      },
    );
  }

  if (
    finalTerminal.decision ===
      "falsified"
  ) {
    return finish(
      "falsified",
      "selected-structural-revision-falsified",
      {
        falsifyingCandidateId:
          finalTerminal
            .falsifyingCandidateId,

        protectedDecision:
          finalTerminal
            .protectedDecision,
      },
    );
  }

  if (
    finalTerminal.decision ===
      "reopen-search"
  ) {
    return finish(
      "reopen-search",
      "all-retained-structural-candidates-inadequate",
    );
  }

  return finish(
    "abstained",
    "protected-structural-budget-exhausted",
  );
}

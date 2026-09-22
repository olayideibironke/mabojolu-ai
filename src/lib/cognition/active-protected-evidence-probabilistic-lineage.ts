import {
  deriveAdaptiveEvidenceRequirement,
  evaluateRevisionLineage,
  type AdaptiveEvidenceRequirement,
  type RevisionLineage,
  type RevisionLineageAssessment,
} from "./adaptive-evidence-governance-lineage";

import {
  predictHierarchicalProgramEffect,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface ProtectedCoverageGap {
  requirement: AdaptiveEvidenceRequirement;
  currentEvidenceCount: number;
  currentUniqueInterventionSignatures: string[];
  missingEvidenceCount: number;
  missingUniqueInterventionSignatures: number;
  excludedInstallationEvidenceIds: string[];
  decision:
    | "ready"
    | "acquire";
}

export interface ProtectedValidationProbe {
  id: string;
  interventions: Record<string, number>;
  signature: string;
  fillsMissingCoverage: boolean;
  risk: number;
  cost: number;
  reversible: boolean;
  observationStdDev: number;
}

export interface ProbabilisticRevisionBelief {
  probabilities: Record<string, number>;
  topRevisionId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyCertain: boolean;
}

export interface ActiveProtectedProbeChoice {
  decision:
    | "probe"
    | "abstained";
  probe?: ProtectedValidationProbe;
  expectedInformationGain: number;
  expectedPosteriorEntropy: number;
  coverageBonus: number;
  score: number;
  reason:
    | "safe-protected-validation-probe"
    | "no-safe-protected-validation-probe";
}

export interface ActiveProtectedAcquisitionStep {
  step: number;
  probeId: string;
  observationId: string;
  observedEffect: number;
  belief: ProbabilisticRevisionBelief;
  evidenceCount: number;
  uniqueInterventionSignatures: number;
}

export interface ActiveProtectedAcquisitionResult {
  decision:
    | "ready"
    | "abstained";
  initialBelief: ProbabilisticRevisionBelief;
  finalBelief: ProbabilisticRevisionBelief;
  initialGap: ProtectedCoverageGap;
  finalGap: ProtectedCoverageGap;
  acquiredEvidence: StructuralMechanismObservation[];
  allProtectedEvidence: StructuralMechanismObservation[];
  steps: ActiveProtectedAcquisitionStep[];
  lineageAssessment?: RevisionLineageAssessment;
  reason:
    | "protected-reserve-ready-and-lineage-separated"
    | "protected-acquisition-budget-exhausted"
    | "no-safe-informative-probe";
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

function normalize(
  values: Readonly<Record<string, number>>,
): Record<string, number> {
  const entries =
    Object.entries(values);

  const total =
    entries.reduce(
      (sum, [, value]) =>
        sum + value,
      0,
    );

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {
    throw new Error(
      "Probabilistic revision ancestry cannot be normalized.",
    );
  }

  return Object.fromEntries(
    entries.map(
      ([id, value]) => [
        id,
        value / total,
      ],
    ),
  );
}

function entropy(
  probabilities: readonly number[],
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
  probabilities: readonly number[],
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

function gaussianLikelihood(
  observation: number,
  mean: number,
  stdDev: number,
): number {
  if (
    !Number.isFinite(stdDev) ||
    stdDev <= 0
  ) {
    throw new Error(
      "Protected validation observationStdDev must be positive and finite.",
    );
  }

  const variance =
    stdDev *
    stdDev;

  return Math.max(
    Number.MIN_VALUE,
    Math.exp(
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
      ),
  );
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
        `${key}=${value.toFixed(6)}`,
    )
    .join("|") ||
    "zero-intervention";
}

function strictLineageRequirement(
  lineage: RevisionLineage,
): AdaptiveEvidenceRequirement {
  const requirements =
    lineage.nodes.map(
      (node) =>
        deriveAdaptiveEvidenceRequirement(
          node.program,
          node
            .uncertaintyAtInstall,
        ),
    );

  return {
    minimumProtectedEvidence:
      Math.max(
        ...requirements.map(
          (requirement) =>
            requirement
              .minimumProtectedEvidence,
        ),
      ),

    minimumUniqueInterventionSignatures:
      Math.max(
        ...requirements.map(
          (requirement) =>
            requirement
              .minimumUniqueInterventionSignatures,
        ),
      ),

    complexityBand:
      Math.max(
        ...requirements.map(
          (requirement) =>
            requirement
              .complexityBand,
        ),
      ),

    uncertaintyBand:
      Math.max(
        ...requirements.map(
          (requirement) =>
            requirement
              .uncertaintyBand,
        ),
      ),

    reason:
      "complexity-and-uncertainty-adaptive-budget",
  };
}

function excludedInstallationEvidenceIds(
  lineage: RevisionLineage,
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

export function analyzeProtectedCoverageGap(
  lineage: RevisionLineage,
  evidence: readonly StructuralMechanismObservation[],
): ProtectedCoverageGap {
  const requirement =
    strictLineageRequirement(
      lineage,
    );

  const excludedInstallationIds =
    excludedInstallationEvidenceIds(
      lineage,
    );

  const excluded =
    new Set(
      excludedInstallationIds,
    );

  const evidenceIds =
    evidence.map(
      (observation) =>
        observation
          .experiment
          .id,
    );

  if (
    evidenceIds.some(
      (id) =>
        excluded.has(id),
    )
  ) {
    throw new Error(
      "Active protected evidence overlaps lineage installation evidence.",
    );
  }

  const signatures =
    Array.from(
      new Set(
        evidence.map(
          (observation) =>
            interventionSignature(
              observation
                .experiment
                .interventions,
            ),
        ),
      ),
    ).sort();

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
        signatures.length,
    );

  return {
    requirement,

    currentEvidenceCount:
      evidence.length,

    currentUniqueInterventionSignatures:
      signatures,

    missingEvidenceCount,

    missingUniqueInterventionSignatures,

    excludedInstallationEvidenceIds:
      excludedInstallationIds,

    decision:
      missingEvidenceCount ===
        0 &&
      missingUniqueInterventionSignatures ===
        0
        ? "ready"
        : "acquire",
  };
}

function lineageVariables(
  lineage: RevisionLineage,
): string[] {
  return Array.from(
    new Set(
      lineage.nodes.flatMap(
        (node) => [
          ...Object.keys(
            node
              .program
              .baseEffects,
          ),

          ...node
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

function boundedSubsets(
  values: readonly string[],
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
      chosen.length > 0
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
        index + 1,
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

export function synthesizeProtectedValidationProbes(
  lineage: RevisionLineage,
  currentEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    maximumArity?: number;
    risk?: number;
    cost?: number;
    observationStdDev?: number;
  },
): ProtectedValidationProbe[] {
  const gap =
    analyzeProtectedCoverageGap(
      lineage,
      currentEvidence,
    );

  const maximumArity =
    options
      ?.maximumArity ??
    2;

  if (
    !Number.isInteger(
      maximumArity,
    ) ||
    maximumArity < 1
  ) {
    throw new Error(
      "maximumArity must be a positive integer.",
    );
  }

  const risk =
    options
      ?.risk ??
    0.1;

  const cost =
    options
      ?.cost ??
    0.03;

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.05;

  validateUnitInterval(
    "protected probe risk",
    risk,
  );

  validateNonNegativeFinite(
    "protected probe cost",
    cost,
  );

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <= 0
  ) {
    throw new Error(
      "protected probe observationStdDev must be positive and finite.",
    );
  }

  const variables =
    lineageVariables(
      lineage,
    );

  const existingSignatures =
    new Set(
      gap
        .currentUniqueInterventionSignatures,
    );

  return boundedSubsets(
    variables,
    Math.min(
      maximumArity,
      variables.length,
    ),
  )
    .map(
      (subset) => {
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
            subset.includes(
              variable,
            )
              ? 1
              : 0;
        }

        const signature =
          interventionSignature(
            interventions,
          );

        return {
          id:
            `protected-probe:${subset.join(
              "+",
            )}`,

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
        };
      },
    )
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
    );
}

export class ProbabilisticRevisionAncestry {
  private probabilities:
    Record<string, number>;

  constructor(
    private readonly lineage:
      RevisionLineage,

    prior?: Readonly<
      Record<string, number>
    >,

    private readonly sufficientConfidence =
      0.95,

    private readonly minimumMargin =
      0.1,
  ) {
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
      const node of
        lineage.nodes
    ) {
      raw[
        node.revisionId
      ] =
        prior
          ? (
              prior[
                node.revisionId
              ] ??
              (() => {
                throw new Error(
                  `Revision prior is missing ${node.revisionId}.`,
                );
              })()
            )
          : 1;
    }

    this.probabilities =
      normalize(
        raw,
      );
  }

  getBelief():
    ProbabilisticRevisionBelief {
    const normalized =
      normalize(
        this.probabilities,
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
        "Revision ancestry has no hypotheses.",
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
      probabilities:
        normalized,

      topRevisionId:
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

      sufficientlyCertain:
        confidence >=
          this.sufficientConfidence &&
        margin >=
          this.minimumMargin,
    };
  }

  simulateObservation(
    truthRevisionId: string,
    probe:
      ProtectedValidationProbe,
  ): number {
    const node =
      this.lineage.nodes.find(
        (candidate) =>
          candidate.revisionId ===
          truthRevisionId,
      );

    if (!node) {
      throw new Error(
        `Unknown revision ${truthRevisionId}.`,
      );
    }

    return predictHierarchicalProgramEffect(
      node.program,
      probe.interventions,
    );
  }

  recordObservation(
    probe:
      ProtectedValidationProbe,

    observedEffect:
      number,
  ): ProbabilisticRevisionBelief {
    if (
      !Number.isFinite(
        observedEffect,
      )
    ) {
      throw new Error(
        "Protected observation must be finite.",
      );
    }

    const weighted:
      Record<string, number> =
        {};

    for (
      const node of
        this.lineage.nodes
    ) {
      const mean =
        predictHierarchicalProgramEffect(
          node.program,
          probe.interventions,
        );

      weighted[
        node.revisionId
      ] =
        (
          this.probabilities[
            node.revisionId
          ] ??
          0
        ) *
        gaussianLikelihood(
          observedEffect,
          mean,
          probe.observationStdDev,
        );
    }

    this.probabilities =
      normalize(
        weighted,
      );

    return this.getBelief();
  }

  chooseProbe(
    probes:
      readonly ProtectedValidationProbe[],

    currentEvidence:
      readonly StructuralMechanismObservation[],

    options?: {
      maximumRisk?: number;
      minimumInformationGain?: number;
      costPenalty?: number;
      coverageBonus?: number;
    },
  ): ActiveProtectedProbeChoice {
    const maximumRisk =
      options
        ?.maximumRisk ??
      0.3;

    const minimumInformationGain =
      options
        ?.minimumInformationGain ??
      0.01;

    const costPenalty =
      options
        ?.costPenalty ??
      0.1;

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
      "coverageBonus",
      coverageBonusWeight,
    );

    const prior =
      this.getBelief();

    const priorEntropy =
      entropy(
        Object.values(
          prior.probabilities,
        ),
      );

    const gap =
      analyzeProtectedCoverageGap(
        this.lineage,
        currentEvidence,
      );

    let best:
      ActiveProtectedProbeChoice |
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
        const node of
          this.lineage.nodes
      ) {
        const truthProbability =
          prior.probabilities[
            node.revisionId
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
            node.program,
            probe.interventions,
          );

        const weighted:
          Record<string, number> =
            {};

        for (
          const candidate of
            this.lineage.nodes
        ) {
          const candidateMean =
            predictHierarchicalProgramEffect(
              candidate.program,
              probe.interventions,
            );

          weighted[
            candidate.revisionId
          ] =
            (
              prior.probabilities[
                candidate.revisionId
              ] ??
              0
            ) *
            gaussianLikelihood(
              representativeObservation,
              candidateMean,
              probe.observationStdDev,
            );
        }

        const posterior =
          normalize(
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
              0
            ? coverageBonusWeight *
              0.25
            : 0;

      const score =
        expectedInformationGain +
        coverageBonus -
        costPenalty *
          probe.cost;

      if (
        expectedInformationGain <
          minimumInformationGain &&
        coverageBonus ===
          0
      ) {
        continue;
      }

      const candidate:
        ActiveProtectedProbeChoice = {
        decision:
          "probe",

        probe,

        expectedInformationGain,

        expectedPosteriorEntropy,

        coverageBonus,

        score,

        reason:
          "safe-protected-validation-probe",
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

      expectedPosteriorEntropy:
        priorEntropy,

      coverageBonus:
        0,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-protected-validation-probe",
    };
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

export function runControlledProtectedEvidenceAcquisition(
  lineage: RevisionLineage,
  initialEvidence:
    readonly StructuralMechanismObservation[],
  trueRevisionId: string,
  options?: {
    maximumSteps?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
    costPenalty?: number;
    coverageBonus?: number;
    observationStdDev?: number;
  },
): ActiveProtectedAcquisitionResult {
  const maximumSteps =
    options
      ?.maximumSteps ??
    8;

  if (
    !Number.isInteger(
      maximumSteps,
    ) ||
    maximumSteps < 1
  ) {
    throw new Error(
      "maximumSteps must be a positive integer.",
    );
  }

  const evidence =
    initialEvidence.map(
      cloneObservation,
    );

  const ancestry =
    new ProbabilisticRevisionAncestry(
      lineage,
    );

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.05;

  for (
    const observation of
      evidence
  ) {
    ancestry.recordObservation(
      {
        id:
          `existing-protected:${observation.experiment.id}`,

        interventions: {
          ...observation
            .experiment
            .interventions,
        },

        signature:
          interventionSignature(
            observation
              .experiment
              .interventions,
          ),

        fillsMissingCoverage:
          false,

        risk:
          observation
            .experiment
            .risk,

        cost:
          observation
            .experiment
            .cost,

        reversible:
          observation
            .experiment
            .reversible,

        observationStdDev,
      },
      observation
        .measuredEffect,
    );
  }

  const templates =
    synthesizeProtectedValidationProbes(
      lineage,
      evidence,
      {
        observationStdDev,
      },
    );

  const initialBelief =
    ancestry.getBelief();

  const initialGap =
    analyzeProtectedCoverageGap(
      lineage,
      evidence,
    );

  const acquiredEvidence:
    StructuralMechanismObservation[] =
      [];

  const steps:
    ActiveProtectedAcquisitionStep[] =
      [];

  for (
    let step =
      1;
    step <=
      maximumSteps;
    step +=
      1
  ) {
    const currentGap =
      analyzeProtectedCoverageGap(
        lineage,
        evidence,
      );

    const currentBelief =
      ancestry.getBelief();

    if (
      currentGap.decision ===
        "ready" &&
      currentBelief
        .sufficientlyCertain
    ) {
      const lineageAssessment =
        evaluateRevisionLineage(
          lineage,
          evidence,
        );

      return {
        decision:
          "ready",

        initialBelief,

        finalBelief:
          currentBelief,

        initialGap,

        finalGap:
          currentGap,

        acquiredEvidence,

        allProtectedEvidence:
          evidence,

        steps,

        lineageAssessment,

        reason:
          "protected-reserve-ready-and-lineage-separated",
      };
    }

    const choice =
      ancestry.chooseProbe(
        templates,
        evidence,
        {
          maximumRisk:
            options
              ?.maximumRisk ??
            0.3,

          minimumInformationGain:
            options
              ?.minimumInformationGain ??
            0.01,

          costPenalty:
            options
              ?.costPenalty ??
            0.1,

          coverageBonus:
            options
              ?.coverageBonus ??
            0.2,
        },
      );

    if (
      choice.decision !==
        "probe" ||
      !choice.probe
    ) {
      return {
        decision:
          "abstained",

        initialBelief,

        finalBelief:
          currentBelief,

        initialGap,

        finalGap:
          currentGap,

        acquiredEvidence,

        allProtectedEvidence:
          evidence,

        steps,

        reason:
          "no-safe-informative-probe",
      };
    }

    const observedEffect =
      ancestry.simulateObservation(
        trueRevisionId,
        choice.probe,
      );

    const observationId =
      `${choice.probe.id}:acquired-${step}`;

    const observation:
      StructuralMechanismObservation = {
      experiment: {
        id:
          observationId,

        interventions: {
          ...choice.probe
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

    acquiredEvidence.push(
      cloneObservation(
        observation,
      ),
    );

    const belief =
      ancestry.recordObservation(
        choice.probe,
        observedEffect,
      );

    const updatedGap =
      analyzeProtectedCoverageGap(
        lineage,
        evidence,
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
    });
  }

  const finalBelief =
    ancestry.getBelief();

  const finalGap =
    analyzeProtectedCoverageGap(
      lineage,
      evidence,
    );

  if (
    finalGap.decision ===
      "ready" &&
    finalBelief
      .sufficientlyCertain
  ) {
    return {
      decision:
        "ready",

      initialBelief,

      finalBelief,

      initialGap,

      finalGap,

      acquiredEvidence,

      allProtectedEvidence:
        evidence,

      steps,

      lineageAssessment:
        evaluateRevisionLineage(
          lineage,
          evidence,
        ),

      reason:
        "protected-reserve-ready-and-lineage-separated",
    };
  }

  return {
    decision:
      "abstained",

    initialBelief,

    finalBelief,

    initialGap,

    finalGap,

    acquiredEvidence,

    allProtectedEvidence:
      evidence,

    steps,

    reason:
      "protected-acquisition-budget-exhausted",
  };
}

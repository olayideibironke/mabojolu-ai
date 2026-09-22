import {
  appendInstalledRevision,
  deriveAdaptiveEvidenceRequirement,
  type AdaptiveEvidenceRequirement,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  predictHierarchicalProgramEffect,
  selectValidatedHierarchicalProgram,
  synthesizeHierarchicalCausalPrograms,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import {
  synthesizeProtectedValidationProbes,
  type ProtectedValidationProbe,
} from "./active-protected-evidence-probabilistic-lineage";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

import type {
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface RegionalRevisionScore {
  revisionId: string;
  meanSquaredError: number;
}

export interface RegionalRevisionSupport {
  regionSignature: string;
  observationIds: string[];
  selectedRevisionId: string;
  selectedMeanSquaredError: number;
  runnerUpRevisionId?: string;
  runnerUpMeanSquaredError?: number;
  margin: number;
  scores: RegionalRevisionScore[];
}

export interface RevisionCompositionProposal {
  decision:
    | "compose"
    | "retain-single"
    | "abstained";
  regionalSupport: RegionalRevisionSupport[];
  sourceRevisionIds: string[];
  bestSingleRevisionId?: string;
  bestSingleMeanSquaredError?: number;
  candidate?: HierarchicalCausalProgram;
  candidateDiscoveryMeanSquaredError?: number;
  reason:
    | "multiple-regions-require-composition"
    | "single-revision-already-adequate"
    | "regional-support-insufficient"
    | "no-bounded-composition-candidate";
}

export interface CompositionExplanation {
  id: string;
  program: HierarchicalCausalProgram;
  kind:
    | "single"
    | "composition";
}

export interface CompositionBelief {
  probabilities: Record<string, number>;
  topExplanationId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyCertain: boolean;
}

export interface CompositionValidationBranch {
  truthExplanationId: string;
  representativeObservation: number;
  secondProbeId?: string;
  terminalNormalizedEntropy: number;
}

export interface CompositionValidationPlan {
  decision:
    | "plan"
    | "abstained";
  firstProbe?: ProtectedValidationProbe;
  branches: CompositionValidationBranch[];
  expectedTerminalNormalizedEntropy: number;
  expectedInformationGain: number;
  expectedCost: number;
  maximumRisk: number;
  horizon: 1 | 2;
  score: number;
  reason:
    | "safe-composition-validation-plan"
    | "no-safe-composition-validation-plan";
}

export interface ProtectedCompositionDecision {
  decision:
    | "installed"
    | "retained"
    | "abstained";
  proposal: RevisionCompositionProposal;
  protectedEvidenceIds: string[];
  bestSingleRevisionId?: string;
  bestSingleProtectedMeanSquaredError?: number;
  compositeProtectedMeanSquaredError?: number;
  improvement?: number;
  compositeProgram?: HierarchicalCausalProgram;
  reason:
    | "protected-composition-installed"
    | "single-revision-retained"
    | "composition-protected-validation-failed";
}

export interface CompositeLineageInstallation {
  decision:
    | "installed"
    | "abstained";
  lineage?: RevisionLineage;
  hypothesis?: RecedingVectorHypothesis;
  prerequisite?: LearnedActionPrerequisite;
  requirement?: AdaptiveEvidenceRequirement;
  sourceRevisionIds: string[];
  reason:
    | "composite-revision-appended"
    | "protected-composition-required";
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
      "Revision composition evaluation requires observations.",
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

function cloneFragment(
  fragment: ValidatedCausalFragment,
  sourceRevisionId: string,
): ValidatedCausalFragment {
  return {
    ...fragment,

    id:
      `${sourceRevisionId}:${fragment.id}`,

    terms:
      fragment.terms.map(
        (term) => ({
          ...term,

          id:
            `${sourceRevisionId}:${term.id}`,

          variables: [
            ...term.variables,
          ],
        }),
      ),
  };
}

function sameBaseEffects(
  left:
    Readonly<Record<string, number>>,
  right:
    Readonly<Record<string, number>>,
): boolean {
  const keys =
    Array.from(
      new Set([
        ...Object.keys(left),
        ...Object.keys(right),
      ]),
    ).sort();

  return keys.every(
    (key) =>
      Math.abs(
        (
          left[key] ??
          0
        ) -
        (
          right[key] ??
          0
        ),
      ) <=
        Number.EPSILON,
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
      "Composition validation observationStdDev must be positive and finite.",
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

function normalize(
  values:
    Readonly<Record<string, number>>,
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
      "Composition belief cannot be normalized.",
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

function summarizeBelief(
  probabilities:
    Readonly<Record<string, number>>,
  sufficientConfidence:
    number,
  minimumMargin:
    number,
): CompositionBelief {
  const normalized =
    normalize(
      probabilities,
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
      "Composition belief has no explanations.",
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

    topExplanationId:
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
        sufficientConfidence &&
      margin >=
        minimumMargin,
  };
}

export function inferRegionalRevisionSupport(
  lineage: RevisionLineage,
  evidence:
    readonly StructuralMechanismObservation[],
): RegionalRevisionSupport[] {
  if (
    evidence.length ===
      0
  ) {
    return [];
  }

  const groups =
    new Map<
      string,
      StructuralMechanismObservation[]
    >();

  for (
    const observation of
      evidence
  ) {
    const signature =
      interventionSignature(
        observation
          .experiment
          .interventions,
      );

    const group =
      groups.get(
        signature,
      ) ??
      [];

    group.push(
      observation,
    );

    groups.set(
      signature,
      group,
    );
  }

  return Array.from(
    groups.entries(),
  )
    .map(
      (
        [
          regionSignature,
          observations,
        ],
      ) => {
        const scores =
          lineage.nodes
            .map(
              (node) => ({
                revisionId:
                  node.revisionId,

                meanSquaredError:
                  programMeanSquaredError(
                    node.program,
                    observations,
                  ),
              }),
            )
            .sort(
              (left, right) =>
                left.meanSquaredError -
                  right.meanSquaredError ||
                left.revisionId.localeCompare(
                  right.revisionId,
                ),
            );

        const selected =
          scores[0];

        if (!selected) {
          throw new Error(
            "Regional revision support has no candidates.",
          );
        }

        const runnerUp =
          scores[1];

        return {
          regionSignature,

          observationIds:
            observations.map(
              (observation) =>
                observation
                  .experiment
                  .id,
            ),

          selectedRevisionId:
            selected.revisionId,

          selectedMeanSquaredError:
            selected
              .meanSquaredError,

          runnerUpRevisionId:
            runnerUp
              ?.revisionId,

          runnerUpMeanSquaredError:
            runnerUp
              ?.meanSquaredError,

          margin:
            (
              runnerUp
                ?.meanSquaredError ??
              selected
                .meanSquaredError
            ) -
            selected
              .meanSquaredError,

          scores,
        };
      },
    )
    .sort(
      (left, right) =>
        left.regionSignature.localeCompare(
          right.regionSignature,
        ),
    );
}

export function proposeRevisionComposition(
  lineage: RevisionLineage,
  compositionEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    maximumAdequateSingleMeanSquaredError?: number;
    minimumRegionalMargin?: number;
    maximumFragments?: number;
    complexityPenaltyPerTerm?: number;
  },
): RevisionCompositionProposal {
  const maximumAdequateSingleMeanSquaredError =
    options
      ?.maximumAdequateSingleMeanSquaredError ??
    0.02;

  const minimumRegionalMargin =
    options
      ?.minimumRegionalMargin ??
    0.02;

  validateNonNegativeFinite(
    "maximumAdequateSingleMeanSquaredError",
    maximumAdequateSingleMeanSquaredError,
  );

  validateNonNegativeFinite(
    "minimumRegionalMargin",
    minimumRegionalMargin,
  );

  if (
    compositionEvidence.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      regionalSupport:
        [],

      sourceRevisionIds:
        [],

      reason:
        "regional-support-insufficient",
    };
  }

  const singleScores =
    lineage.nodes
      .map(
        (node) => ({
          revisionId:
            node.revisionId,

          meanSquaredError:
            programMeanSquaredError(
              node.program,
              compositionEvidence,
            ),
        }),
      )
      .sort(
        (left, right) =>
          left.meanSquaredError -
            right.meanSquaredError ||
          left.revisionId.localeCompare(
            right.revisionId,
          ),
      );

  const bestSingle =
    singleScores[0];

  if (!bestSingle) {
    throw new Error(
      "Revision lineage has no single candidates.",
    );
  }

  if (
    bestSingle.meanSquaredError <=
      maximumAdequateSingleMeanSquaredError
  ) {
    return {
      decision:
        "retain-single",

      regionalSupport:
        inferRegionalRevisionSupport(
          lineage,
          compositionEvidence,
        ),

      sourceRevisionIds: [
        bestSingle
          .revisionId,
      ],

      bestSingleRevisionId:
        bestSingle
          .revisionId,

      bestSingleMeanSquaredError:
        bestSingle
          .meanSquaredError,

      reason:
        "single-revision-already-adequate",
    };
  }

  const regionalSupport =
    inferRegionalRevisionSupport(
      lineage,
      compositionEvidence,
    );

  const decisiveRegions =
    regionalSupport.filter(
      (region) =>
        region.margin >=
        minimumRegionalMargin,
    );

  const sourceRevisionIds =
    Array.from(
      new Set(
        decisiveRegions.map(
          (region) =>
            region
              .selectedRevisionId,
        ),
      ),
    ).sort();

  if (
    decisiveRegions.length <
      2 ||
    sourceRevisionIds.length <
      2
  ) {
    return {
      decision:
        "abstained",

      regionalSupport,

      sourceRevisionIds,

      bestSingleRevisionId:
        bestSingle
          .revisionId,

      bestSingleMeanSquaredError:
        bestSingle
          .meanSquaredError,

      reason:
        "regional-support-insufficient",
    };
  }

  const sourceNodes =
    sourceRevisionIds.map(
      (revisionId) => {
        const node =
          lineage.nodes.find(
            (candidate) =>
              candidate.revisionId ===
              revisionId,
          );

        if (!node) {
          throw new Error(
            `Unknown composition source revision ${revisionId}.`,
          );
        }

        return node;
      },
    );

  const reference =
    sourceNodes[0]!;

  if (
    sourceNodes.some(
      (node) =>
        !sameBaseEffects(
          reference
            .program
            .baseEffects,
          node
            .program
            .baseEffects,
        ),
    )
  ) {
    return {
      decision:
        "abstained",

      regionalSupport,

      sourceRevisionIds,

      bestSingleRevisionId:
        bestSingle
          .revisionId,

      bestSingleMeanSquaredError:
        bestSingle
          .meanSquaredError,

      reason:
        "no-bounded-composition-candidate",
    };
  }

  const fragments =
    sourceNodes.flatMap(
      (node) =>
        node
          .program
          .fragments
          .map(
            (fragment) =>
              cloneFragment(
                fragment,
                node.revisionId,
              ),
          ),
    );

  const skeleton:
    HierarchicalCausalProgram = {
    id:
      `composition-skeleton:${sourceRevisionIds.join(
        "+",
      )}`,

    baseEffects: {
      ...reference
        .program
        .baseEffects,
    },

    fragments:
      [],

    observationStdDev:
      Math.max(
        ...sourceNodes.map(
          (node) =>
            node
              .program
              .observationStdDev,
        ),
      ),

    depth:
      1,

    complexity:
      0,
  };

  const candidates =
    synthesizeHierarchicalCausalPrograms(
      skeleton,
      fragments,
      compositionEvidence,
      {
        maximumFragments:
          options
            ?.maximumFragments ??
          sourceRevisionIds
            .length,

        complexityPenaltyPerTerm:
          options
            ?.complexityPenaltyPerTerm ??
          0.002,

        maximumCandidates:
          32,
      },
    );

  const bestCandidate =
    candidates[0];

  if (!bestCandidate) {
    return {
      decision:
        "abstained",

      regionalSupport,

      sourceRevisionIds,

      bestSingleRevisionId:
        bestSingle
          .revisionId,

      bestSingleMeanSquaredError:
        bestSingle
          .meanSquaredError,

      reason:
        "no-bounded-composition-candidate",
    };
  }

  return {
    decision:
      "compose",

    regionalSupport,

    sourceRevisionIds,

    bestSingleRevisionId:
      bestSingle
        .revisionId,

    bestSingleMeanSquaredError:
      bestSingle
        .meanSquaredError,

    candidate:
      bestCandidate
        .program,

    candidateDiscoveryMeanSquaredError:
      bestCandidate
        .discoveryMeanSquaredError,

    reason:
      "multiple-regions-require-composition",
  };
}

export class ProbabilisticCompositionBelief {
  private probabilities:
    Record<string, number>;

  constructor(
    private readonly explanations:
      readonly CompositionExplanation[],

    prior?: Readonly<
      Record<string, number>
    >,

    private readonly sufficientConfidence =
      0.95,

    private readonly minimumMargin =
      0.1,
  ) {
    if (
      explanations.length <
        2
    ) {
      throw new Error(
        "Composition belief requires at least two explanations.",
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
      const explanation of
        explanations
    ) {
      raw[
        explanation.id
      ] =
        prior
          ? (
              prior[
                explanation.id
              ] ??
              (() => {
                throw new Error(
                  `Composition prior is missing ${explanation.id}.`,
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
    CompositionBelief {
    return summarizeBelief(
      this.probabilities,
      this.sufficientConfidence,
      this.minimumMargin,
    );
  }

  simulateObservation(
    truthExplanationId:
      string,
    probe:
      ProtectedValidationProbe,
  ): number {
    const explanation =
      this.explanations.find(
        (candidate) =>
          candidate.id ===
          truthExplanationId,
      );

    if (!explanation) {
      throw new Error(
        `Unknown composition explanation ${truthExplanationId}.`,
      );
    }

    return predictHierarchicalProgramEffect(
      explanation.program,
      probe.interventions,
    );
  }

  recordObservation(
    probe:
      ProtectedValidationProbe,
    observedEffect:
      number,
  ): CompositionBelief {
    const weighted:
      Record<string, number> =
        {};

    for (
      const explanation of
        this.explanations
    ) {
      const mean =
        predictHierarchicalProgramEffect(
          explanation.program,
          probe.interventions,
        );

      weighted[
        explanation.id
      ] =
        (
          this.probabilities[
            explanation.id
          ] ??
          0
        ) *
        gaussianLikelihood(
          observedEffect,
          mean,
          probe
            .observationStdDev,
        );
    }

    this.probabilities =
      normalize(
        weighted,
      );

    return this.getBelief();
  }
}

function oneStepExpectedEntropy(
  explanations:
    readonly CompositionExplanation[],
  prior:
    Readonly<Record<string, number>>,
  probe:
    ProtectedValidationProbe,
): number {
  let expected =
    0;

  for (
    const truth of
      explanations
  ) {
    const truthProbability =
      prior[
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

    const weighted:
      Record<string, number> =
        {};

    for (
      const candidate of
        explanations
    ) {
      const mean =
        predictHierarchicalProgramEffect(
          candidate.program,
          probe.interventions,
        );

      weighted[
        candidate.id
      ] =
        (
          prior[
            candidate.id
          ] ??
          0
        ) *
        gaussianLikelihood(
          observation,
          mean,
          probe
            .observationStdDev,
        );
    }

    const posterior =
      normalize(
        weighted,
      );

    expected +=
      truthProbability *
      normalizedEntropy(
        Object.values(
          posterior,
        ),
      );
  }

  return expected;
}

function posteriorAfterRepresentativeObservation(
  explanations:
    readonly CompositionExplanation[],
  prior:
    Readonly<Record<string, number>>,
  probe:
    ProtectedValidationProbe,
  observation:
    number,
): Record<string, number> {
  const weighted:
    Record<string, number> =
      {};

  for (
    const candidate of
      explanations
  ) {
    const mean =
      predictHierarchicalProgramEffect(
        candidate.program,
        probe.interventions,
      );

    weighted[
      candidate.id
    ] =
      (
        prior[
          candidate.id
        ] ??
        0
      ) *
      gaussianLikelihood(
        observation,
        mean,
        probe
          .observationStdDev,
      );
  }

  return normalize(
    weighted,
  );
}

export function planCompositionValidation(
  explanations:
    readonly CompositionExplanation[],
  belief:
    CompositionBelief,
  probes:
    readonly ProtectedValidationProbe[],
  horizon: 1 | 2,
  options?: {
    maximumRisk?: number;
    costPenalty?: number;
  },
): CompositionValidationPlan {
  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    0.1;

  validateUnitInterval(
    "maximumRisk",
    maximumRisk,
  );

  validateNonNegativeFinite(
    "costPenalty",
    costPenalty,
  );

  const safe =
    probes.filter(
      (probe) =>
        probe.reversible &&
        probe.risk <=
          maximumRisk,
    );

  if (
    safe.length ===
      0
  ) {
    return {
      decision:
        "abstained",

      branches:
        [],

      expectedTerminalNormalizedEntropy:
        belief
          .normalizedEntropy,

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
        "no-safe-composition-validation-plan",
    };
  }

  let best:
    CompositionValidationPlan |
    undefined;

  for (
    const firstProbe of
      safe
  ) {
    const branches:
      CompositionValidationBranch[] =
        [];

    let expectedTerminalEntropy =
      0;

    let expectedSecondCost =
      0;

    let maximumPlanRisk =
      firstProbe.risk;

    for (
      const truth of
        explanations
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
          firstProbe
            .interventions,
        );

      const posterior =
        posteriorAfterRepresentativeObservation(
          explanations,
          belief
            .probabilities,
          firstProbe,
          representativeObservation,
        );

      let terminalEntropy =
        normalizedEntropy(
          Object.values(
            posterior,
          ),
        );

      let secondProbeId:
        string |
        undefined;

      if (
        horizon ===
          2
      ) {
        const remaining =
          safe.filter(
            (probe) =>
              probe.id !==
              firstProbe.id,
          );

        let bestSecond:
          {
            probe:
              ProtectedValidationProbe;
            expectedEntropy:
              number;
          } |
          undefined;

        for (
          const second of
            remaining
        ) {
          const expectedEntropy =
            oneStepExpectedEntropy(
              explanations,
              posterior,
              second,
            );

          if (
            !bestSecond ||
            expectedEntropy <
              bestSecond
                .expectedEntropy -
                Number.EPSILON ||
            (
              Math.abs(
                expectedEntropy -
                  bestSecond
                    .expectedEntropy,
              ) <=
                Number.EPSILON &&
              second.cost <
                bestSecond
                  .probe
                  .cost -
                  Number.EPSILON
            ) ||
            (
              Math.abs(
                expectedEntropy -
                  bestSecond
                    .expectedEntropy,
              ) <=
                Number.EPSILON &&
              Math.abs(
                second.cost -
                  bestSecond
                    .probe
                    .cost,
              ) <=
                Number.EPSILON &&
              second.id <
                bestSecond
                  .probe
                  .id
            )
          ) {
            bestSecond = {
              probe:
                second,

              expectedEntropy,
            };
          }
        }

        if (bestSecond) {
          terminalEntropy =
            bestSecond
              .expectedEntropy;

          secondProbeId =
            bestSecond
              .probe
              .id;

          expectedSecondCost +=
            truthProbability *
            bestSecond
              .probe
              .cost;

          maximumPlanRisk =
            Math.max(
              maximumPlanRisk,
              bestSecond
                .probe
                .risk,
            );
        }
      }

      expectedTerminalEntropy +=
        truthProbability *
        terminalEntropy;

      branches.push({
        truthExplanationId:
          truth.id,

        representativeObservation,

        secondProbeId,

        terminalNormalizedEntropy:
          terminalEntropy,
      });
    }

    const expectedCost =
      firstProbe.cost +
      expectedSecondCost;

    const expectedInformationGain =
      Math.max(
        0,
        belief
          .normalizedEntropy -
          expectedTerminalEntropy,
      );

    const score =
      expectedInformationGain -
      costPenalty *
        expectedCost;

    const candidate:
      CompositionValidationPlan = {
      decision:
        "plan",

      firstProbe,

      branches:
        branches.sort(
          (left, right) =>
            left.truthExplanationId.localeCompare(
              right.truthExplanationId,
            ),
        ),

      expectedTerminalNormalizedEntropy:
        expectedTerminalEntropy,

      expectedInformationGain,

      expectedCost,

      maximumRisk:
        maximumPlanRisk,

      horizon,

      score,

      reason:
        "safe-composition-validation-plan",
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
        candidate.expectedCost <
          best.expectedCost -
            Number.EPSILON
      ) ||
      (
        Math.abs(
          candidate.score -
            best.score,
        ) <=
          Number.EPSILON &&
        Math.abs(
          candidate.expectedCost -
            best.expectedCost,
        ) <=
          Number.EPSILON &&
        firstProbe.id <
          (
            best.firstProbe
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

    branches:
      [],

    expectedTerminalNormalizedEntropy:
      belief
        .normalizedEntropy,

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
      "no-safe-composition-validation-plan",
  };
}

export function validateRevisionComposition(
  lineage: RevisionLineage,
  proposal:
    RevisionCompositionProposal,
  protectedEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    minimumImprovement?: number;
    protectedComplexityPenaltyPerTerm?: number;
    maximumCompositeProtectedMeanSquaredError?: number;
  },
): ProtectedCompositionDecision {
  if (
    proposal.decision !==
      "compose" ||
    !proposal.candidate ||
    !proposal
      .bestSingleRevisionId
  ) {
    return {
      decision:
        "abstained",

      proposal,

      protectedEvidenceIds:
        protectedEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      reason:
        "composition-protected-validation-failed",
    };
  }

  const bestSingle =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        proposal
          .bestSingleRevisionId,
    );

  if (!bestSingle) {
    throw new Error(
      `Unknown best single revision ${proposal.bestSingleRevisionId}.`,
    );
  }

  const candidate = {
    program:
      proposal.candidate,

    discoveryMeanSquaredError:
      proposal
        .candidateDiscoveryMeanSquaredError ??
      programMeanSquaredError(
        proposal.candidate,
        protectedEvidence,
      ),

    complexityPenalty:
      0,

    objective:
      proposal
        .candidateDiscoveryMeanSquaredError ??
      0,
  };

  const validation =
    selectValidatedHierarchicalProgram(
      bestSingle.program,
      [
        candidate,
      ],
      protectedEvidence,
      {
        minimumImprovement:
          options
            ?.minimumImprovement ??
          0.02,

        protectedComplexityPenaltyPerTerm:
          options
            ?.protectedComplexityPenaltyPerTerm ??
          0.002,
      },
    );

  const compositeProtectedMeanSquaredError =
    programMeanSquaredError(
      proposal.candidate,
      protectedEvidence,
    );

  const bestSingleProtectedMeanSquaredError =
    programMeanSquaredError(
      bestSingle.program,
      protectedEvidence,
    );

  const maximumCompositeProtectedMeanSquaredError =
    options
      ?.maximumCompositeProtectedMeanSquaredError ??
    0.02;

  validateNonNegativeFinite(
    "maximumCompositeProtectedMeanSquaredError",
    maximumCompositeProtectedMeanSquaredError,
  );

  const improvement =
    bestSingleProtectedMeanSquaredError -
    compositeProtectedMeanSquaredError;

  if (
    !validation.promoted ||
    validation.champion.id !==
      proposal
        .candidate
        .id ||
    compositeProtectedMeanSquaredError >
      maximumCompositeProtectedMeanSquaredError
  ) {
    return {
      decision:
        "retained",

      proposal,

      protectedEvidenceIds:
        protectedEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      bestSingleRevisionId:
        bestSingle
          .revisionId,

      bestSingleProtectedMeanSquaredError,

      compositeProtectedMeanSquaredError,

      improvement,

      reason:
        "single-revision-retained",
    };
  }

  return {
    decision:
      "installed",

    proposal,

    protectedEvidenceIds:
      protectedEvidence.map(
        (observation) =>
          observation
            .experiment
            .id,
      ),

    bestSingleRevisionId:
      bestSingle
        .revisionId,

    bestSingleProtectedMeanSquaredError,

    compositeProtectedMeanSquaredError,

    improvement,

    compositeProgram:
      proposal.candidate,

    reason:
      "protected-composition-installed",
  };
}

function conservativePrerequisite(
  lineage:
    RevisionLineage,
  sourceRevisionIds:
    readonly string[],
): LearnedActionPrerequisite {
  const sources =
    sourceRevisionIds.map(
      (revisionId) => {
        const node =
          lineage.nodes.find(
            (candidate) =>
              candidate.revisionId ===
              revisionId,
          );

        if (!node) {
          throw new Error(
            `Unknown composite prerequisite source ${revisionId}.`,
          );
        }

        return node
          .prerequisite;
      },
    );

  const reference =
    sources[0];

  if (!reference) {
    throw new Error(
      "Composite prerequisite requires source revisions.",
    );
  }

  if (
    sources.some(
      (source) =>
        source.actionId !==
          reference.actionId ||
        source.targetDimension !==
          reference.targetDimension ||
        source.stateDimension !==
          reference.stateDimension,
    )
  ) {
    throw new Error(
      "Composite revision sources require compatible prerequisite semantics.",
    );
  }

  const strictest =
    sources
      .slice()
      .sort(
        (left, right) =>
          right.threshold -
            left.threshold,
      )[0]!;

  return {
    ...strictest,

    evidenceCount:
      sources.reduce(
        (sum, source) =>
          sum +
          source
            .evidenceCount,
        0,
      ),
  };
}

function buildCompositeHypothesis(
  lineage:
    RevisionLineage,
  sourceRevisionIds:
    readonly string[],
  program:
    HierarchicalCausalProgram,
  controlInterventions:
    Readonly<Record<string, number>>,
  revisionId:
    string,
): {
  hypothesis:
    RecedingVectorHypothesis;
  prerequisite:
    LearnedActionPrerequisite;
} {
  const sourceNodes =
    sourceRevisionIds.map(
      (sourceRevisionId) => {
        const node =
          lineage.nodes.find(
            (candidate) =>
              candidate.revisionId ===
              sourceRevisionId,
          );

        if (!node) {
          throw new Error(
            `Unknown composite hypothesis source ${sourceRevisionId}.`,
          );
        }

        return node;
      },
    );

  const active =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage
          .activeRevisionId,
    );

  if (!active) {
    throw new Error(
      "Composite hypothesis requires an active lineage node.",
    );
  }

  const prerequisite =
    conservativePrerequisite(
      lineage,
      sourceRevisionIds,
    );

  const hypothesis:
    RecedingVectorHypothesis = {
    ...active.hypothesis,

    id:
      `hypothesis:${revisionId}`,

    repairCandidateId:
      `composition:${sourceRevisionIds.join(
        "+",
      )}`,

    prerequisiteHypothesisId:
      `${prerequisite.actionId}:${prerequisite.stateDimension}>=${prerequisite.threshold.toFixed(
        3,
      )}`,

    dimensionEffects:
      Object.fromEntries(
        Object.entries(
          active
            .hypothesis
            .dimensionEffects,
        ).map(
          ([dimension, effects]) => [
            dimension,
            {
              ...effects,
            },
          ],
        ),
      ),

    actionPrerequisites:
      Object.fromEntries(
        Object.entries(
          active
            .hypothesis
            .actionPrerequisites,
        ).map(
          ([actionId, values]) => [
            actionId,
            {
              ...values,
            },
          ],
        ),
      ),
  };

  hypothesis
    .dimensionEffects[
      prerequisite
        .targetDimension
    ] = {
      ...(
        hypothesis
          .dimensionEffects[
            prerequisite
              .targetDimension
          ] ??
        {}
      ),

      [
        prerequisite
          .actionId
      ]:
        predictHierarchicalProgramEffect(
          program,
          controlInterventions,
        ),
    };

  hypothesis
    .actionPrerequisites[
      prerequisite
        .actionId
    ] = {
      ...(
        hypothesis
          .actionPrerequisites[
            prerequisite
              .actionId
          ] ??
        {}
      ),

      [
        prerequisite
          .stateDimension
      ]:
        prerequisite.threshold,
    };

  return {
    hypothesis,

    prerequisite,
  };
}

export function installCompositeRevision(
  lineage: RevisionLineage,
  decision:
    ProtectedCompositionDecision,
  revisionId: string,
  controlInterventions:
    Readonly<Record<string, number>>,
  uncertaintyAtInstall:
    number,
): CompositeLineageInstallation {
  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
  );

  if (
    decision.decision !==
      "installed" ||
    !decision
      .compositeProgram
  ) {
    return {
      decision:
        "abstained",

      sourceRevisionIds:
        decision
          .proposal
          .sourceRevisionIds,

      reason:
        "protected-composition-required",
    };
  }

  const {
    hypothesis,
    prerequisite,
  } =
    buildCompositeHypothesis(
      lineage,
      decision
        .proposal
        .sourceRevisionIds,
      decision
        .compositeProgram,
      controlInterventions,
      revisionId,
    );

  const requirement =
    deriveAdaptiveEvidenceRequirement(
      decision
        .compositeProgram,
      uncertaintyAtInstall,
    );

  const revisedLineage =
    appendInstalledRevision(
      lineage,
      revisionId,
      decision
        .compositeProgram,
      hypothesis,
      prerequisite,
      decision
        .protectedEvidenceIds,
      uncertaintyAtInstall,
    );

  return {
    decision:
      "installed",

    lineage:
      revisedLineage,

    hypothesis,

    prerequisite,

    requirement,

    sourceRevisionIds: [
      ...decision
        .proposal
        .sourceRevisionIds,
    ],

    reason:
      "composite-revision-appended",
  };
}

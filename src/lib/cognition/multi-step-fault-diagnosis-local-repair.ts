import {
  appendInstalledRevision,
  assessAdaptiveProtectedEvidence,
  deriveAdaptiveEvidenceRequirement,
  type AdaptiveEvidenceRequirement,
  type RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  buildPlanForLiveHypothesis,
  replaceLiveHypothesisCatalog,
  type OnlineHypothesisCatalogRevision,
} from "./online-belief-model-coevolution";

import type {
  FragmentFaultProbe,
  FragmentProvenanceLedger,
} from "./active-fragment-fault-localization-provenance";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import {
  revisePrerequisiteAwareGoalChain,
  type PrerequisiteAwarePlan,
  type PrerequisitePlanRevision,
} from "./structural-repair-prerequisite-planning";

import type {
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  RecedingVectorAction,
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

export interface BoundedFaultExplanation {
  id: string;
  kind:
    | "no-fault"
    | "single-fragment"
    | "multi-fragment";
  fragmentIds: string[];
}

export interface BoundedFaultBelief {
  probabilities: Record<string, number>;
  topExplanationId: string;
  topKind:
    BoundedFaultExplanation["kind"];
  topFragmentIds: string[];
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface FaultDiagnosticBranch {
  truthExplanationId: string;
  representativeObservation: number;
  secondProbeId?: string;
  terminalNormalizedEntropy: number;
}

export interface MultiStepFaultDiagnosticPlan {
  decision:
    | "plan"
    | "abstained";
  firstProbe?: FragmentFaultProbe;
  branches: FaultDiagnosticBranch[];
  expectedTerminalNormalizedEntropy: number;
  expectedInformationGain: number;
  expectedCost: number;
  maximumRisk: number;
  horizon:
    | 1
    | 2;
  score: number;
  reason:
    | "safe-contingent-fault-diagnostic-plan"
    | "no-safe-contingent-fault-diagnostic-plan";
}

export interface MultiStepFaultDiagnosisStep {
  step: number;
  probeId: string;
  observationId: string;
  observedEffect: number;
  belief: BoundedFaultBelief;
}

export interface MultiStepFaultDiagnosisResult {
  decision:
    | "resolved"
    | "abstained";
  initialBelief: BoundedFaultBelief;
  finalBelief: BoundedFaultBelief;
  initialPlan: MultiStepFaultDiagnosticPlan;
  acquiredObservations:
    StructuralMechanismObservation[];
  steps:
    MultiStepFaultDiagnosisStep[];
  reason:
    | "bounded-fault-posterior-resolved"
    | "bounded-fault-diagnosis-budget-exhausted"
    | "no-safe-contingent-fault-plan";
}

export interface LocalRepairSearchCandidate {
  id: string;
  program: HierarchicalCausalProgram;
  replacementFragmentIds:
    Record<string, string>;
  retiredFragmentIds: string[];
  discoveryMeanSquaredError: number;
  complexityPenalty: number;
  objective: number;
}

export interface ProbabilisticLocalRepairSearch {
  decision:
    | "search"
    | "retain-no-fault"
    | "abstained";
  faultExplanation:
    BoundedFaultExplanation;
  faultConfidence: number;
  faultFragmentIds: string[];
  repairEvidenceIds: string[];
  candidates:
    LocalRepairSearchCandidate[];
  selectedCandidate?: LocalRepairSearchCandidate;
  reason:
    | "fault-posterior-authorized-local-repair-search"
    | "no-fault-posterior-retains-incumbent"
    | "fault-posterior-not-resolved"
    | "fault-fragments-not-quarantined"
    | "no-bounded-local-repair-candidate";
}

export interface ProtectedLocalRepairDecision {
  decision:
    | "installed"
    | "retained"
    | "abstained";
  search:
    ProbabilisticLocalRepairSearch;
  requirement?: AdaptiveEvidenceRequirement;
  protectedEvidenceIds: string[];
  selectedCandidate?: LocalRepairSearchCandidate;
  incumbentProtectedMeanSquaredError?: number;
  candidateProtectedMeanSquaredError?: number;
  improvement?: number;
  reason:
    | "protected-local-repair-selected"
    | "incumbent-remains-protected"
    | "repair-search-selection-not-protected"
    | "adaptive-protected-local-repair-reserve-insufficient"
    | "local-repair-search-required";
}

export interface InstalledProbabilisticLocalRepair {
  decision:
    | "installed"
    | "abstained";
  lineage?: RevisionLineage;
  revisedHypothesis?: RecedingVectorHypothesis;
  catalogRevision?: OnlineHypothesisCatalogRevision;
  revisedPlan?: PrerequisiteAwarePlan;
  goalRevision?: PrerequisitePlanRevision;
  provenance?: FragmentProvenanceLedger;
  reason:
    | "probabilistic-local-repair-installed"
    | "protected-local-repair-required"
    | "revised-local-repair-plan-unavailable";
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
      "Bounded fault observationStdDev must be positive and finite.",
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
      "Bounded fault belief cannot be normalized.",
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

function fragmentStructureSignature(
  fragment:
    ValidatedCausalFragment,
): string {
  return JSON.stringify(
    fragment.terms.map(
      (term) => ({
        kind:
          term.kind,

        variables: [
          ...term.variables,
        ].sort(),
      }),
    ),
  );
}

function scaledFaultProgram(
  program:
    HierarchicalCausalProgram,
  fragmentIds:
    readonly string[],
  faultScale: number,
  id: string,
): HierarchicalCausalProgram {
  const selected =
    new Set(
      fragmentIds,
    );

  return {
    ...cloneProgram(
      program,
    ),

    id,

    fragments:
      program.fragments.map(
        (fragment) => ({
          ...cloneFragment(
            fragment,
          ),

          terms:
            fragment.terms.map(
              (term) => ({
                ...term,

                coefficient:
                  selected.has(
                    fragment.id,
                  )
                    ? term.coefficient *
                      faultScale
                    : term.coefficient,

                variables: [
                  ...term.variables,
                ],
              }),
            ),
        }),
      ),
  };
}

function subsets(
  values:
    readonly string[],
  maximumSize: number,
): string[][] {
  const output:
    string[][] = [
      [],
    ];

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
        maximumSize
    ) {
      return;
    }

    for (
      let index =
        start;
      index <
        values.length;
      index += 1
    ) {
      const value =
        values[index];

      if (!value) {
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

function buildFaultExplanations(
  program:
    HierarchicalCausalProgram,
  maximumFaultFragments: number,
): BoundedFaultExplanation[] {
  if (
    !Number.isInteger(
      maximumFaultFragments,
    ) ||
    maximumFaultFragments < 1
  ) {
    throw new Error(
      "maximumFaultFragments must be a positive integer.",
    );
  }

  const fragmentIds =
    program.fragments
      .map(
        (fragment) =>
          fragment.id,
      )
      .sort();

  return subsets(
    fragmentIds,
    Math.min(
      maximumFaultFragments,
      fragmentIds.length,
    ),
  )
    .map(
      (fragmentIdsForFault) => ({
        id:
          fragmentIdsForFault.length ===
            0
            ? "fault:none"
            : `fault:${fragmentIdsForFault.join(
                "+",
              )}`,

        kind:
          fragmentIdsForFault.length ===
            0
            ? "no-fault"
            : fragmentIdsForFault.length ===
                1
              ? "single-fragment"
              : "multi-fragment",

        fragmentIds:
          fragmentIdsForFault,
      }),
    )
    .sort(
      (left, right) =>
        left.fragmentIds.length -
          right.fragmentIds.length ||
        left.id.localeCompare(
          right.id,
        ),
    );
}

function summarizeBelief(
  explanations:
    readonly BoundedFaultExplanation[],
  probabilities:
    Readonly<Record<string, number>>,
  sufficientConfidence: number,
  minimumMargin: number,
): BoundedFaultBelief {
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
      "Bounded fault belief has no explanations.",
    );
  }

  const explanation =
    explanations.find(
      (candidate) =>
        candidate.id ===
        top[0],
    );

  if (!explanation) {
    throw new Error(
      `Unknown bounded fault explanation ${top[0]}.`,
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
      explanation.id,

    topKind:
      explanation.kind,

    topFragmentIds: [
      ...explanation.fragmentIds,
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
        sufficientConfidence &&
      margin >=
        minimumMargin,
  };
}

export class BoundedMultiFaultPosterior {
  private probabilities:
    Record<string, number>;

  private readonly explanations:
    BoundedFaultExplanation[];

  private readonly programs:
    Record<string, HierarchicalCausalProgram>;

  constructor(
    program:
      HierarchicalCausalProgram,
    options?: {
      maximumFaultFragments?: number;
      faultScale?: number;
      prior?:
        Readonly<Record<string, number>>;
      sufficientConfidence?: number;
      minimumMargin?: number;
    },
  ) {
    const maximumFaultFragments =
      options
        ?.maximumFaultFragments ??
      2;

    const faultScale =
      options
        ?.faultScale ??
      0.25;

    validateUnitInterval(
      "faultScale",
      faultScale,
    );

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

    this.explanations =
      buildFaultExplanations(
        program,
        maximumFaultFragments,
      );

    this.programs =
      Object.fromEntries(
        this.explanations.map(
          (explanation) => [
            explanation.id,
            scaledFaultProgram(
              program,
              explanation.fragmentIds,
              faultScale,
              `${program.id}:${explanation.id}`,
            ),
          ],
        ),
      );

    const raw:
      Record<string, number> =
        {};

    for (
      const explanation of
        this.explanations
    ) {
      raw[
        explanation.id
      ] =
        options?.prior
          ? (
              options.prior[
                explanation.id
              ] ??
              (() => {
                throw new Error(
                  `Fault prior is missing ${explanation.id}.`,
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

  private readonly sufficientConfidence:
    number;

  private readonly minimumMargin:
    number;

  getBelief():
    BoundedFaultBelief {
    return summarizeBelief(
      this.explanations,
      this.probabilities,
      this.sufficientConfidence,
      this.minimumMargin,
    );
  }

  getExplanations():
    readonly BoundedFaultExplanation[] {
    return this.explanations.map(
      (explanation) => ({
        ...explanation,

        fragmentIds: [
          ...explanation.fragmentIds,
        ],
      }),
    );
  }

  getProgram(
    explanationId: string,
  ): HierarchicalCausalProgram {
    const program =
      this.programs[
        explanationId
      ];

    if (!program) {
      throw new Error(
        `Unknown bounded fault explanation ${explanationId}.`,
      );
    }

    return cloneProgram(
      program,
    );
  }

  recordObservation(
    probe:
      FragmentFaultProbe,
    observedEffect: number,
  ): BoundedFaultBelief {
    const weighted:
      Record<string, number> =
        {};

    for (
      const explanation of
        this.explanations
    ) {
      const mean =
        predictHierarchicalProgramEffect(
          this.programs[
            explanation.id
          ]!,
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
          probe.observationStdDev,
        );
    }

    this.probabilities =
      normalize(
        weighted,
      );

    return this.getBelief();
  }
}

function posteriorAfterObservation(
  posterior:
    BoundedMultiFaultPosterior,
  belief:
    BoundedFaultBelief,
  probe:
    FragmentFaultProbe,
  observation: number,
): Record<string, number> {
  const weighted:
    Record<string, number> =
      {};

  for (
    const explanation of
      posterior.getExplanations()
  ) {
    const mean =
      predictHierarchicalProgramEffect(
        posterior.getProgram(
          explanation.id,
        ),
        probe.interventions,
      );

    weighted[
      explanation.id
    ] =
      (
        belief.probabilities[
          explanation.id
        ] ??
        0
      ) *
      gaussianLikelihood(
        observation,
        mean,
        probe.observationStdDev,
      );
  }

  return normalize(
    weighted,
  );
}

function oneStepExpectedNormalizedEntropy(
  posterior:
    BoundedMultiFaultPosterior,
  prior:
    BoundedFaultBelief,
  probe:
    FragmentFaultProbe,
): number {
  let expected =
    0;

  for (
    const truth of
      posterior.getExplanations()
  ) {
    const probability =
      prior.probabilities[
        truth.id
      ] ??
      0;

    if (
      probability <= 0
    ) {
      continue;
    }

    const observation =
      predictHierarchicalProgramEffect(
        posterior.getProgram(
          truth.id,
        ),
        probe.interventions,
      );

    const updated =
      posteriorAfterObservation(
        posterior,
        prior,
        probe,
        observation,
      );

    expected +=
      probability *
      normalizedEntropy(
        Object.values(
          updated,
        ),
      );
  }

  return expected;
}

export function planMultiStepFaultDiagnosis(
  posterior:
    BoundedMultiFaultPosterior,
  probes:
    readonly FragmentFaultProbe[],
  horizon:
    | 1
    | 2,
  options?: {
    maximumRisk?: number;
    costPenalty?: number;
    riskPenalty?: number;
  },
): MultiStepFaultDiagnosticPlan {
  const maximumRisk =
    options
      ?.maximumRisk ??
    0.3;

  const costPenalty =
    options
      ?.costPenalty ??
    0.1;

  const riskPenalty =
    options
      ?.riskPenalty ??
    0.05;

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

  const safe =
    probes.filter(
      (probe) =>
        probe.reversible &&
        probe.risk <=
          maximumRisk,
    );

  const belief =
    posterior.getBelief();

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
        "no-safe-contingent-fault-diagnostic-plan",
    };
  }

  let best:
    MultiStepFaultDiagnosticPlan |
    undefined;

  for (
    const firstProbe of
      safe
  ) {
    const branches:
      FaultDiagnosticBranch[] =
        [];

    let expectedTerminalEntropy =
      0;

    let expectedSecondCost =
      0;

    let maximumPlanRisk =
      firstProbe.risk;

    for (
      const truth of
        posterior.getExplanations()
    ) {
      const truthProbability =
        belief.probabilities[
          truth.id
        ] ??
        0;

      if (
        truthProbability <= 0
      ) {
        continue;
      }

      const observation =
        predictHierarchicalProgramEffect(
          posterior.getProgram(
            truth.id,
          ),
          firstProbe.interventions,
        );

      const firstPosterior =
        posteriorAfterObservation(
          posterior,
          belief,
          firstProbe,
          observation,
        );

      const firstBelief =
        summarizeBelief(
          posterior.getExplanations(),
          firstPosterior,
          1,
          1,
        );

      let terminalEntropy =
        firstBelief
          .normalizedEntropy;

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
              FragmentFaultProbe;
            entropy:
              number;
          } |
          undefined;

        for (
          const secondProbe of
            remaining
        ) {
          const entropyAfterSecond =
            oneStepExpectedNormalizedEntropy(
              posterior,
              {
                ...firstBelief,

                probabilities:
                  firstPosterior,
              },
              secondProbe,
            );

          if (
            !bestSecond ||
            entropyAfterSecond <
              bestSecond.entropy -
                Number.EPSILON ||
            (
              Math.abs(
                entropyAfterSecond -
                  bestSecond.entropy,
              ) <=
                Number.EPSILON &&
              secondProbe.risk <
                bestSecond.probe.risk -
                  Number.EPSILON
            ) ||
            (
              Math.abs(
                entropyAfterSecond -
                  bestSecond.entropy,
              ) <=
                Number.EPSILON &&
              Math.abs(
                secondProbe.risk -
                  bestSecond.probe.risk,
              ) <=
                Number.EPSILON &&
              secondProbe.cost <
                bestSecond.probe.cost -
                  Number.EPSILON
            )
          ) {
            bestSecond = {
              probe:
                secondProbe,

              entropy:
                entropyAfterSecond,
            };
          }
        }

        if (bestSecond) {
          terminalEntropy =
            bestSecond.entropy;

          secondProbeId =
            bestSecond.probe.id;

          expectedSecondCost +=
            truthProbability *
            bestSecond.probe.cost;

          maximumPlanRisk =
            Math.max(
              maximumPlanRisk,
              bestSecond.probe.risk,
            );
        }
      }

      expectedTerminalEntropy +=
        truthProbability *
        terminalEntropy;

      branches.push({
        truthExplanationId:
          truth.id,

        representativeObservation:
          observation,

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
        belief.normalizedEntropy -
          expectedTerminalEntropy,
      );

    const score =
      expectedInformationGain -
      costPenalty *
        expectedCost -
      riskPenalty *
        maximumPlanRisk;

    const candidate:
      MultiStepFaultDiagnosticPlan = {
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
        "safe-contingent-fault-diagnostic-plan",
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
      "no-safe-contingent-fault-diagnostic-plan",
  };
}

export function conditionBoundedFaultPosterior(
  posterior:
    BoundedMultiFaultPosterior,
  evidence:
    readonly StructuralMechanismObservation[],
  observationStdDev =
    0.15,
): BoundedFaultBelief {
  let belief =
    posterior.getBelief();

  for (
    const observation of
      evidence
  ) {
    belief =
      posterior.recordObservation(
        {
          id:
            `existing:${observation.experiment.id}`,

          interventions: {
            ...observation
              .experiment
              .interventions,
          },

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
        observation.measuredEffect,
      );
  }

  return belief;
}

export function runControlledMultiStepFaultDiagnosis(
  incumbent:
    HierarchicalCausalProgram,
  actualProgram:
    HierarchicalCausalProgram,
  initialEvidence:
    readonly StructuralMechanismObservation[],
  probes:
    readonly FragmentFaultProbe[],
  options?: {
    maximumSteps?: number;
    maximumRisk?: number;
    observationStdDev?: number;
    faultScale?: number;
  },
): MultiStepFaultDiagnosisResult {
  const maximumSteps =
    options
      ?.maximumSteps ??
    2;

  if (
    !Number.isInteger(
      maximumSteps,
    ) ||
    maximumSteps < 1 ||
    maximumSteps > 2
  ) {
    throw new Error(
      "Controlled multi-step fault diagnosis supports one or two steps.",
    );
  }

  const posterior =
    new BoundedMultiFaultPosterior(
      incumbent,
      {
        maximumFaultFragments:
          2,

        faultScale:
          options
            ?.faultScale ??
          0.25,
      },
    );

  const initialBelief =
    conditionBoundedFaultPosterior(
      posterior,
      initialEvidence,
      options
        ?.observationStdDev ??
      0.15,
    );

  const initialPlan =
    planMultiStepFaultDiagnosis(
      posterior,
      probes,
      maximumSteps ===
        1
        ? 1
        : 2,
      {
        maximumRisk:
          options
            ?.maximumRisk ??
          0.3,
      },
    );

  const acquiredObservations:
    StructuralMechanismObservation[] =
      [];

  const steps:
    MultiStepFaultDiagnosisStep[] =
      [];

  if (
    initialBelief
      .sufficientlyResolved
  ) {
    return {
      decision:
        "resolved",

      initialBelief,

      finalBelief:
        initialBelief,

      initialPlan,

      acquiredObservations,

      steps,

      reason:
        "bounded-fault-posterior-resolved",
    };
  }

  for (
    let step =
      1;
    step <=
      maximumSteps;
    step += 1
  ) {
    const plan =
      planMultiStepFaultDiagnosis(
        posterior,
        probes.filter(
          (probe) =>
            !steps.some(
              (previous) =>
                previous.probeId ===
                probe.id,
            ),
        ),
        step <
          maximumSteps
          ? 2
          : 1,
        {
          maximumRisk:
            options
              ?.maximumRisk ??
            0.3,
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

        finalBelief:
          posterior.getBelief(),

        initialPlan,

        acquiredObservations,

        steps,

        reason:
          "no-safe-contingent-fault-plan",
      };
    }

    const observedEffect =
      predictHierarchicalProgramEffect(
        actualProgram,
        plan
          .firstProbe
          .interventions,
      );

    const observationId =
      `${plan.firstProbe.id}:multi-step-${step}`;

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

    acquiredObservations.push(
      observation,
    );

    const belief =
      posterior.recordObservation(
        plan.firstProbe,
        observedEffect,
      );

    steps.push({
      step,

      probeId:
        plan.firstProbe.id,

      observationId,

      observedEffect,

      belief,
    });

    if (
      belief
        .sufficientlyResolved
    ) {
      return {
        decision:
          "resolved",

        initialBelief,

        finalBelief:
          belief,

        initialPlan,

        acquiredObservations,

        steps,

        reason:
          "bounded-fault-posterior-resolved",
      };
    }
  }

  return {
    decision:
      "abstained",

    initialBelief,

    finalBelief:
      posterior.getBelief(),

    initialPlan,

    acquiredObservations,

    steps,

    reason:
      "bounded-fault-diagnosis-budget-exhausted",
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
      "Local repair search requires evidence.",
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
  let output:
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

function buildRepairCandidate(
  incumbent:
    HierarchicalCausalProgram,
  faultFragmentIds:
    readonly string[],
  assignments:
    readonly (
      {
        kind:
          "rollback";
        fragmentId:
          string;
      } |
      {
        kind:
          "repair";
        fragmentId:
          string;
        repair:
          ValidatedCausalFragment;
      }
    )[],
  repairEvidence:
    readonly StructuralMechanismObservation[],
  complexityPenaltyPerTerm:
    number,
): LocalRepairSearchCandidate {
  const assignmentByFragment =
    new Map(
      assignments.map(
        (assignment) => [
          assignment.fragmentId,
          assignment,
        ],
      ),
    );

  const replacementFragmentIds:
    Record<string, string> =
      {};

  const retiredFragmentIds:
    string[] =
      [];

  const fragments:
    ValidatedCausalFragment[] =
      [];

  for (
    const fragment of
      incumbent.fragments
  ) {
    if (
      !faultFragmentIds.includes(
        fragment.id,
      )
    ) {
      fragments.push(
        cloneFragment(
          fragment,
        ),
      );

      continue;
    }

    const assignment =
      assignmentByFragment.get(
        fragment.id,
      );

    if (!assignment) {
      throw new Error(
        `Missing local repair assignment for ${fragment.id}.`,
      );
    }

    retiredFragmentIds.push(
      fragment.id,
    );

    if (
      assignment.kind ===
        "repair"
    ) {
      fragments.push(
        cloneFragment(
          assignment.repair,
        ),
      );

      replacementFragmentIds[
        fragment.id
      ] =
        assignment
          .repair
          .id;
    }
  }

  const program:
    HierarchicalCausalProgram = {
    ...cloneProgram(
      incumbent,
    ),

    id:
      `${incumbent.id}+local-search:${assignments.map(
        (assignment) =>
          assignment.kind ===
            "repair"
            ? `${assignment.fragmentId}->${assignment.repair.id}`
            : `${assignment.fragmentId}->rollback`,
      ).join("|")}`,

    fragments,

    depth:
      1 +
      fragments.length,

    complexity:
      fragments.reduce(
        (sum, fragment) =>
          sum +
          fragment.terms.length,
        0,
      ),
  };

  const discoveryMeanSquaredError =
    programMeanSquaredError(
      program,
      repairEvidence,
    );

  const complexityPenalty =
    complexityPenaltyPerTerm *
    program.complexity;

  return {
    id:
      program.id,

    program,

    replacementFragmentIds,

    retiredFragmentIds:
      retiredFragmentIds.sort(),

    discoveryMeanSquaredError,

    complexityPenalty,

    objective:
      discoveryMeanSquaredError +
      complexityPenalty,
  };
}

export function searchProbabilisticLocalRepairs(
  incumbent:
    HierarchicalCausalProgram,
  belief:
    BoundedFaultBelief,
  reliability:
    FragmentReliabilitySummary,
  repairFragments:
    readonly ValidatedCausalFragment[],
  repairEvidence:
    readonly StructuralMechanismObservation[],
  options?: {
    complexityPenaltyPerTerm?: number;
    maximumCandidates?: number;
  },
): ProbabilisticLocalRepairSearch {
  const explanation:
    BoundedFaultExplanation = {
    id:
      belief
        .topExplanationId,

    kind:
      belief
        .topKind,

    fragmentIds: [
      ...belief
        .topFragmentIds,
    ],
  };

  if (
    !belief
      .sufficientlyResolved
  ) {
    return {
      decision:
        "abstained",

      faultExplanation:
        explanation,

      faultConfidence:
        belief.confidence,

      faultFragmentIds: [
        ...belief
          .topFragmentIds,
      ],

      repairEvidenceIds:
        repairEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates:
        [],

      reason:
        "fault-posterior-not-resolved",
    };
  }

  if (
    belief.topKind ===
      "no-fault"
  ) {
    return {
      decision:
        "retain-no-fault",

      faultExplanation:
        explanation,

      faultConfidence:
        belief.confidence,

      faultFragmentIds:
        [],

      repairEvidenceIds:
        repairEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates:
        [],

      reason:
        "no-fault-posterior-retains-incumbent",
    };
  }

  const quarantined =
    new Set(
      reliability
        .quarantinedFragmentIds,
    );

  if (
    belief.topFragmentIds.some(
      (fragmentId) =>
        !quarantined.has(
          fragmentId,
        ),
    )
  ) {
    return {
      decision:
        "abstained",

      faultExplanation:
        explanation,

      faultConfidence:
        belief.confidence,

      faultFragmentIds: [
        ...belief
          .topFragmentIds,
      ],

      repairEvidenceIds:
        repairEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates:
        [],

      reason:
        "fault-fragments-not-quarantined",
    };
  }

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
    belief.topFragmentIds.map(
      (fragmentId) => {
        const incumbentFragment =
          incumbentById.get(
            fragmentId,
          );

        if (!incumbentFragment) {
          throw new Error(
            `Fault explanation references unknown fragment ${fragmentId}.`,
          );
        }

        const signature =
          fragmentStructureSignature(
            incumbentFragment,
          );

        return [
          {
            kind:
              "rollback" as const,

            fragmentId,
          },

          ...repairFragments
            .filter(
              (repair) =>
                repair.id !==
                  fragmentId &&
                fragmentStructureSignature(
                  repair,
                ) ===
                  signature,
            )
            .map(
              (repair) => ({
                kind:
                  "repair" as const,

                fragmentId,

                repair,
              }),
            ),
        ];
      },
    );

  const maximumCandidates =
    options
      ?.maximumCandidates ??
    32;

  const complexityPenaltyPerTerm =
    options
      ?.complexityPenaltyPerTerm ??
    0.001;

  const candidates =
    cartesian(
      choices,
    )
      .slice(
        0,
        maximumCandidates,
      )
      .map(
        (assignments) =>
          buildRepairCandidate(
            incumbent,
            belief
              .topFragmentIds,
            assignments,
            repairEvidence,
            complexityPenaltyPerTerm,
          ),
      )
      .sort(
        (left, right) =>
          left.objective -
            right.objective ||
          left.id.localeCompare(
            right.id,
          ),
      );

  const selectedCandidate =
    candidates[0];

  if (!selectedCandidate) {
    return {
      decision:
        "abstained",

      faultExplanation:
        explanation,

      faultConfidence:
        belief.confidence,

      faultFragmentIds: [
        ...belief
          .topFragmentIds,
      ],

      repairEvidenceIds:
        repairEvidence.map(
          (observation) =>
            observation
              .experiment
              .id,
        ),

      candidates,

      reason:
        "no-bounded-local-repair-candidate",
    };
  }

  return {
    decision:
      "search",

    faultExplanation:
      explanation,

    faultConfidence:
      belief.confidence,

    faultFragmentIds: [
      ...belief
        .topFragmentIds,
    ],

    repairEvidenceIds:
      repairEvidence.map(
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

export function validateProbabilisticLocalRepairSearch(
  lineage:
    RevisionLineage,
  incumbent:
    HierarchicalCausalProgram,
  search:
    ProbabilisticLocalRepairSearch,
  protectedEvidence:
    readonly StructuralMechanismObservation[],
  excludedDiagnosticEvidenceIds:
    readonly string[],
  uncertaintyAtInstall:
    number,
  options?: {
    minimumImprovement?: number;
  },
): ProtectedLocalRepairDecision {
  if (
    search.decision !==
      "search" ||
    !search
      .selectedCandidate
  ) {
    return {
      decision:
        "abstained",

      search,

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

  const repairIds =
    new Set(
      search
        .repairEvidenceIds,
    );

  const diagnosticIds =
    new Set(
      excludedDiagnosticEvidenceIds,
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
        repairIds.has(
          id,
        ) ||
        diagnosticIds.has(
          id,
        )
    )
  ) {
    throw new Error(
      "Local repair search, diagnostic, and protected evidence must remain disjoint.",
    );
  }

  const protectedScores =
    search.candidates
      .map(
        (candidate) => ({
          candidate,

          meanSquaredError:
            programMeanSquaredError(
              candidate.program,
              protectedEvidence,
            ),
        }),
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
      "Protected local repair validation has no candidates.",
    );
  }

  const incumbentProtectedMeanSquaredError =
    programMeanSquaredError(
      incumbent,
      protectedEvidence,
    );

  const selectedProtected =
    protectedScores.find(
      (item) =>
        item.candidate.id ===
        search
          .selectedCandidate
          ?.id,
    );

  if (!selectedProtected) {
    throw new Error(
      "Repair search selected candidate is missing from protected comparison.",
    );
  }

  const minimumImprovement =
    options
      ?.minimumImprovement ??
    0.01;

  const improvement =
    incumbentProtectedMeanSquaredError -
    selectedProtected
      .meanSquaredError;

  if (
    protectedBest
      .candidate
      .id !==
    search
      .selectedCandidate
      .id
  ) {
    return {
      decision:
        "retained",

      search,

      protectedEvidenceIds:
        protectedIds,

      selectedCandidate:
        search
          .selectedCandidate,

      incumbentProtectedMeanSquaredError,

      candidateProtectedMeanSquaredError:
        selectedProtected
          .meanSquaredError,

      improvement,

      reason:
        "repair-search-selection-not-protected",
    };
  }

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
        search
          .selectedCandidate,

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
      search
        .selectedCandidate
        .program,
      uncertaintyAtInstall,
    );

  const coverage =
    assessAdaptiveProtectedEvidence(
      protectedEvidence,
      requirement,
      [
        ...lineageProtectedEvidenceIds(
          lineage,
        ),
        ...search
          .repairEvidenceIds,
        ...excludedDiagnosticEvidenceIds,
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
        search
          .selectedCandidate,

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
      search
        .selectedCandidate,

    incumbentProtectedMeanSquaredError,

    candidateProtectedMeanSquaredError:
      selectedProtected
        .meanSquaredError,

    improvement,

    reason:
      "protected-local-repair-selected",
  };
}

function projectProgramIntoHypothesis(
  incumbent:
    RecedingVectorHypothesis,
  program:
    HierarchicalCausalProgram,
  targetDimension:
    string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<string, number>
        >
      >
    >,
  revisionId:
    string,
): RecedingVectorHypothesis {
  const dimensionEffects =
    Object.fromEntries(
      Object.entries(
        incumbent.dimensionEffects,
      ).map(
        ([dimension, effects]) => [
          dimension,
          {
            ...effects,
          },
        ],
      ),
    );

  const targetEffects = {
    ...(
      dimensionEffects[
        targetDimension
      ] ??
      {}
    ),
  };

  for (
    const [
      controlId,
      interventions,
    ] of
      Object.entries(
        controlInterventions,
      )
  ) {
    targetEffects[
      controlId
    ] =
      predictHierarchicalProgramEffect(
        program,
        interventions,
      );
  }

  dimensionEffects[
    targetDimension
  ] =
    targetEffects;

  return {
    ...incumbent,

    id:
      `hypothesis:${revisionId}`,

    repairCandidateId:
      `${incumbent.repairCandidateId}+probabilistic-local-search`,

    dimensionEffects,

    actionPrerequisites:
      Object.fromEntries(
        Object.entries(
          incumbent
            .actionPrerequisites,
        ).map(
          ([actionId, prerequisites]) => [
            actionId,
            {
              ...prerequisites,
            },
          ],
        ),
      ),
  };
}

function provenanceAfterSearch(
  ledger:
    FragmentProvenanceLedger,
  decision:
    ProtectedLocalRepairDecision,
  revisionId:
    string,
): FragmentProvenanceLedger {
  if (
    decision.decision !==
      "installed" ||
    !decision
      .selectedCandidate
  ) {
    return ledger;
  }

  const candidate =
    decision
      .selectedCandidate;

  const retired =
    new Set(
      candidate
        .retiredFragmentIds,
    );

  return {
    records:
      ledger.records.map(
        (record) => {
          const activeFragmentId =
            record
              .activeFragmentId;

          if (
            !activeFragmentId
          ) {
            return {
              ...record,

              currentRevisionId:
                revisionId,

              generation:
                record.generation +
                1,
            };
          }

          if (
            !retired.has(
              activeFragmentId,
            )
          ) {
            return {
              ...record,

              currentRevisionId:
                revisionId,

              generation:
                record.generation +
                1,

              history: [
                ...record.history,

                {
                  kind:
                    "preserved" as const,

                  revisionId,

                  fromFragmentId:
                    activeFragmentId,

                  toFragmentId:
                    activeFragmentId,

                  protectedEvidenceIds: [
                    ...decision
                      .protectedEvidenceIds,
                  ],
                },
              ],
            };
          }

          const replacement =
            candidate
              .replacementFragmentIds[
                activeFragmentId
              ];

          if (
            replacement
          ) {
            return {
              ...record,

              currentRevisionId:
                revisionId,

              activeFragmentId:
                replacement,

              generation:
                record.generation +
                1,

              status:
                "active" as const,

              history: [
                ...record.history,

                {
                  kind:
                    "repaired" as const,

                  revisionId,

                  fromFragmentId:
                    activeFragmentId,

                  toFragmentId:
                    replacement,

                  protectedEvidenceIds: [
                    ...decision
                      .protectedEvidenceIds,
                  ],
                },
              ],
            };
          }

          return {
            ...record,

            currentRevisionId:
              revisionId,

            activeFragmentId:
              undefined,

            generation:
              record.generation +
                1,

            status:
              "retired" as const,

            history: [
              ...record.history,

              {
                kind:
                  "rolled-back" as const,

                revisionId,

                fromFragmentId:
                  activeFragmentId,

                protectedEvidenceIds: [
                  ...decision
                    .protectedEvidenceIds,
                ],
              },
            ],
          };
        },
      ),
  };
}

export function installProbabilisticLocalRepair(
  lineage:
    RevisionLineage,
  decision:
    ProtectedLocalRepairDecision,
  targetDimension:
    string,
  controlInterventions:
    Readonly<
      Record<
        string,
        Readonly<
          Record<string, number>
        >
      >
    >,
  currentState:
    Readonly<Record<string, number>>,
  goal:
    MultidimensionalGoal,
  actions:
    readonly RecedingVectorAction[],
  currentPlan:
    PrerequisiteAwarePlan,
  reasoner:
    HierarchicalGoalReasoner,
  terminalGoalId:
    string,
  revisionId:
    string,
  goalRevisionNumber:
    number,
  uncertaintyAtInstall:
    number,
  provenance:
    FragmentProvenanceLedger,
): InstalledProbabilisticLocalRepair {
  if (
    decision.decision !==
      "installed" ||
    !decision
      .selectedCandidate
  ) {
    return {
      decision:
        "abstained",

      reason:
        "protected-local-repair-required",
    };
  }

  validateUnitInterval(
    "uncertaintyAtInstall",
    uncertaintyAtInstall,
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
      "Probabilistic local repair installation requires an active lineage revision.",
    );
  }

  const revisedHypothesis =
    projectProgramIntoHypothesis(
      active.hypothesis,
      decision
        .selectedCandidate
        .program,
      targetDimension,
      controlInterventions,
      revisionId,
    );

  const revisedLineage =
    appendInstalledRevision(
      lineage,
      revisionId,
      decision
        .selectedCandidate
        .program,
      revisedHypothesis,
      active.prerequisite,
      decision
        .protectedEvidenceIds,
      uncertaintyAtInstall,
    );

  const revisedPlan =
    buildPlanForLiveHypothesis(
      revisedHypothesis,
      currentState,
      goal,
      actions,
      active.prerequisite,
    );

  if (
    revisedPlan.decision !==
      "planned"
  ) {
    return {
      decision:
        "abstained",

      lineage:
        revisedLineage,

      revisedHypothesis,

      revisedPlan,

      reason:
        "revised-local-repair-plan-unavailable",
    };
  }

  const goalRevision =
    revisePrerequisiteAwareGoalChain(
      reasoner,
      terminalGoalId,
      currentPlan,
      revisedPlan,
      goalRevisionNumber,
    );

  if (
    goalRevision.decision !==
      "revised" &&
    goalRevision.decision !==
      "unchanged"
  ) {
    return {
      decision:
        "abstained",

      lineage:
        revisedLineage,

      revisedHypothesis,

      revisedPlan,

      goalRevision,

      reason:
        "revised-local-repair-plan-unavailable",
    };
  }

  const catalogRevision =
    replaceLiveHypothesisCatalog(
      [
        active.hypothesis,
      ],
      {
        probabilities: {
          [
            active
              .hypothesis
              .id
          ]:
            1,
        },

        topHypothesisId:
          active
            .hypothesis
            .id,

        confidence:
          1,

        normalizedEntropy:
          0,
      },
      active
        .hypothesis
        .id,
      revisedHypothesis,
    );

  return {
    decision:
      "installed",

    lineage:
      revisedLineage,

    revisedHypothesis,

    catalogRevision,

    revisedPlan,

    goalRevision,

    provenance:
      provenanceAfterSearch(
        provenance,
        decision,
        revisionId,
      ),

    reason:
      "probabilistic-local-repair-installed",
  };
}

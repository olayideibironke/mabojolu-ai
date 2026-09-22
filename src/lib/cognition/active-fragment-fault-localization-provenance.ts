import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import {
  CompositeFragmentMonitor,
  maintainCompositeRevisionSelectively,
  type SelectiveFragmentMaintenanceResult,
} from "./selective-composite-fragment-maintenance";

import type {
  RevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import type {
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  MultidimensionalGoal,
} from "./multidimensional-self-revision";

import type {
  PrerequisiteAwarePlan,
} from "./structural-repair-prerequisite-planning";

import type {
  HierarchicalGoalReasoner,
} from "./goal-hierarchy";

import type {
  RecedingVectorAction,
} from "./receding-horizon-multidimensional-dual-control";

export interface FragmentFaultProbe {
  id: string;
  interventions: Record<string, number>;
  risk: number;
  cost: number;
  reversible: boolean;
  observationStdDev: number;
}

export interface FragmentFaultHypothesis {
  id: string;
  fragmentId: string;
}

export interface FragmentFaultBelief {
  probabilities: Record<string, number>;
  topHypothesisId: string;
  topFragmentId: string;
  confidence: number;
  margin: number;
  normalizedEntropy: number;
  sufficientlyResolved: boolean;
}

export interface FragmentFaultProbeChoice {
  decision:
    | "probe"
    | "abstained";
  probe?: FragmentFaultProbe;
  expectedInformationGain: number;
  expectedPosteriorEntropy: number;
  expectedCost: number;
  maximumRisk: number;
  score: number;
  reason:
    | "safe-fault-localization-probe"
    | "no-safe-informative-fault-probe";
}

export interface FragmentFaultLocalizationStep {
  observationId: string;
  probeId: string;
  observedEffect: number;
  belief: FragmentFaultBelief;
}

export interface FragmentFaultLocalizationResult {
  decision:
    | "resolved"
    | "abstained";
  initialBelief: FragmentFaultBelief;
  finalBelief: FragmentFaultBelief;
  selectedFragmentId?: string;
  acquiredObservations:
    StructuralMechanismObservation[];
  steps: FragmentFaultLocalizationStep[];
  reason:
    | "fragment-fault-posterior-resolved"
    | "fault-localization-budget-exhausted"
    | "no-safe-informative-fault-probe";
}

export type FragmentProvenanceEventKind =
  | "inherited"
  | "preserved"
  | "repaired"
  | "rolled-back"
  | "retired";

export interface FragmentProvenanceEvent {
  kind: FragmentProvenanceEventKind;
  revisionId: string;
  fromFragmentId?: string;
  toFragmentId?: string;
  protectedEvidenceIds?: string[];
}

export interface FragmentProvenanceRecord {
  logicalFragmentId: string;
  originRevisionId: string;
  originFragmentId: string;
  currentRevisionId: string;
  activeFragmentId?: string;
  generation: number;
  status:
    | "active"
    | "retired";
  history: FragmentProvenanceEvent[];
}

export interface FragmentProvenanceLedger {
  records: FragmentProvenanceRecord[];
}

export interface LocalizedCompositeMaintenanceResult {
  localization: FragmentFaultLocalizationResult;
  maintenance?: SelectiveFragmentMaintenanceResult;
  provenance: FragmentProvenanceLedger;
  reason:
    | "localized-fragment-maintained"
    | "fault-localization-unresolved"
    | "localized-fragment-not-quarantined";
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
      "Fault localization observationStdDev must be positive and finite.",
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
      "Fragment fault posterior cannot be normalized.",
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
    probabilities.length <= 1
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

function programWithoutFragment(
  program: HierarchicalCausalProgram,
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
      `Unknown fault fragment ${fragmentId}.`,
    );
  }

  return {
    ...program,

    id:
      `${program.id}:without:${fragmentId}`,

    baseEffects: {
      ...program.baseEffects,
    },

    fragments:
      fragments.map(
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

    complexity:
      fragments.reduce(
        (sum, fragment) =>
          sum +
          fragment.terms.length,
        0,
      ),
  };
}

function summarizeFaultBelief(
  hypotheses:
    readonly FragmentFaultHypothesis[],
  probabilities:
    Readonly<Record<string, number>>,
  sufficientConfidence: number,
  minimumMargin: number,
): FragmentFaultBelief {
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
      "Fragment fault posterior has no hypotheses.",
    );
  }

  const hypothesis =
    hypotheses.find(
      (candidate) =>
        candidate.id ===
        top[0],
    );

  if (!hypothesis) {
    throw new Error(
      `Unknown top fault hypothesis ${top[0]}.`,
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

    topHypothesisId:
      top[0],

    topFragmentId:
      hypothesis.fragmentId,

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

export class ProbabilisticFragmentFaultLocalizer {
  private probabilities:
    Record<string, number>;

  private readonly hypotheses:
    FragmentFaultHypothesis[];

  private readonly counterfactualPrograms:
    Record<string, HierarchicalCausalProgram>;

  constructor(
    private readonly program:
      HierarchicalCausalProgram,
    faultFragmentIds:
      readonly string[] =
      program.fragments.map(
        (fragment) =>
          fragment.id,
      ),
    prior?: Readonly<
      Record<string, number>
    >,
    private readonly sufficientConfidence =
      0.95,
    private readonly minimumMargin =
      0.1,
  ) {
    if (
      faultFragmentIds.length <
        2
    ) {
      throw new Error(
        "Active fault localization requires at least two competing fragment-failure hypotheses.",
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

    this.hypotheses =
      faultFragmentIds.map(
        (fragmentId) => ({
          id:
            `fault:${fragmentId}`,

          fragmentId,
        }),
      );

    this.counterfactualPrograms =
      Object.fromEntries(
        this.hypotheses.map(
          (hypothesis) => [
            hypothesis.id,
            programWithoutFragment(
              program,
              hypothesis.fragmentId,
            ),
          ],
        ),
      );

    const raw:
      Record<string, number> =
        {};

    for (
      const hypothesis of
        this.hypotheses
    ) {
      raw[
        hypothesis.id
      ] =
        prior
          ? (
              prior[
                hypothesis.id
              ] ??
              (() => {
                throw new Error(
                  `Fault prior is missing ${hypothesis.id}.`,
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
    FragmentFaultBelief {
    return summarizeFaultBelief(
      this.hypotheses,
      this.probabilities,
      this.sufficientConfidence,
      this.minimumMargin,
    );
  }

  recordObservation(
    probe:
      FragmentFaultProbe,
    observedEffect:
      number,
  ): FragmentFaultBelief {
    if (
      !Number.isFinite(
        observedEffect,
      )
    ) {
      throw new Error(
        "Fault localization observation must be finite.",
      );
    }

    const weighted:
      Record<string, number> =
        {};

    for (
      const hypothesis of
        this.hypotheses
    ) {
      const mean =
        predictHierarchicalProgramEffect(
          this.counterfactualPrograms[
            hypothesis.id
          ]!,
          probe.interventions,
        );

      weighted[
        hypothesis.id
      ] =
        (
          this.probabilities[
            hypothesis.id
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
      readonly FragmentFaultProbe[],
    options?: {
      maximumRisk?: number;
      minimumInformationGain?: number;
      costPenalty?: number;
      riskPenalty?: number;
    },
  ): FragmentFaultProbeChoice {
    const maximumRisk =
      options?.maximumRisk ??
      0.3;

    const minimumInformationGain =
      options
        ?.minimumInformationGain ??
      0.01;

    const costPenalty =
      options?.costPenalty ??
      0.1;

    const riskPenalty =
      options?.riskPenalty ??
      0.05;

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

    const prior =
      this.getBelief();

    const priorEntropy =
      entropy(
        Object.values(
          prior.probabilities,
        ),
      );

    let best:
      FragmentFaultProbeChoice |
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
          this.hypotheses
      ) {
        const truthProbability =
          prior.probabilities[
            truth.id
          ] ??
          0;

        if (
          truthProbability <= 0
        ) {
          continue;
        }

        const representativeObservation =
          predictHierarchicalProgramEffect(
            this.counterfactualPrograms[
              truth.id
            ]!,
            probe.interventions,
          );

        const weighted:
          Record<string, number> =
            {};

        for (
          const candidate of
            this.hypotheses
        ) {
          const mean =
            predictHierarchicalProgramEffect(
              this.counterfactualPrograms[
                candidate.id
              ]!,
              probe.interventions,
            );

          weighted[
            candidate.id
          ] =
            (
              prior.probabilities[
                candidate.id
              ] ??
              0
            ) *
            gaussianLikelihood(
              representativeObservation,
              mean,
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

      if (
        expectedInformationGain <
          minimumInformationGain
      ) {
        continue;
      }

      const score =
        expectedInformationGain -
        costPenalty *
          probe.cost -
        riskPenalty *
          probe.risk;

      const candidate:
        FragmentFaultProbeChoice = {
        decision:
          "probe",

        probe: {
          ...probe,

          interventions: {
            ...probe.interventions,
          },
        },

        expectedInformationGain,

        expectedPosteriorEntropy,

        expectedCost:
          probe.cost,

        maximumRisk:
          probe.risk,

        score,

        reason:
          "safe-fault-localization-probe",
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
          probe.risk <
            (
              best.probe
                ?.risk ??
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
            probe.risk -
              (
                best.probe
                  ?.risk ??
                Number.POSITIVE_INFINITY
              ),
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
            probe.risk -
              (
                best.probe
                  ?.risk ??
                Number.POSITIVE_INFINITY
              ),
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

      expectedCost:
        0,

      maximumRisk:
        0,

      score:
        Number.NEGATIVE_INFINITY,

      reason:
        "no-safe-informative-fault-probe",
    };
  }
}

export function synthesizeFragmentFaultProbes(
  program:
    HierarchicalCausalProgram,
  options?: {
    riskByVariable?:
      Readonly<Record<string, number>>;
    costByVariable?:
      Readonly<Record<string, number>>;
    defaultRisk?: number;
    defaultCost?: number;
    observationStdDev?: number;
  },
): FragmentFaultProbe[] {
  const variables =
    Array.from(
      new Set(
        program.fragments.flatMap(
          (fragment) =>
            fragment.terms.flatMap(
              (term) =>
                term.variables,
            ),
        ),
      ),
    ).sort();

  const defaultRisk =
    options?.defaultRisk ??
    0.1;

  const defaultCost =
    options?.defaultCost ??
    0.05;

  const observationStdDev =
    options
      ?.observationStdDev ??
    0.1;

  validateUnitInterval(
    "defaultRisk",
    defaultRisk,
  );

  validateNonNegativeFinite(
    "defaultCost",
    defaultCost,
  );

  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <= 0
  ) {
    throw new Error(
      "Fault probe observationStdDev must be positive and finite.",
    );
  }

  return variables.map(
    (variable) => {
      const risk =
        options
          ?.riskByVariable
          ? (
              options
                .riskByVariable[
                  variable
                ] ??
              defaultRisk
            )
          : defaultRisk;

      const cost =
        options
          ?.costByVariable
          ? (
              options
                .costByVariable[
                  variable
                ] ??
              defaultCost
            )
          : defaultCost;

      validateUnitInterval(
        `fault probe risk for ${variable}`,
        risk,
      );

      validateNonNegativeFinite(
        `fault probe cost for ${variable}`,
        cost,
      );

      const interventions:
        Record<string, number> =
          {};

      for (
        const candidate of
          variables
      ) {
        interventions[
          candidate
        ] =
          candidate ===
            variable
            ? 1
            : 0;
      }

      return {
        id:
          `fault-probe:${variable}`,

        interventions,

        risk,

        cost,

        reversible:
          true,

        observationStdDev,
      };
    },
  );
}

export function conditionFaultPosteriorOnEvidence(
  localizer:
    ProbabilisticFragmentFaultLocalizer,
  evidence:
    readonly StructuralMechanismObservation[],
  observationStdDev =
    0.1,
): FragmentFaultBelief {
  if (
    !Number.isFinite(
      observationStdDev,
    ) ||
    observationStdDev <= 0
  ) {
    throw new Error(
      "Fault evidence observationStdDev must be positive and finite.",
    );
  }

  let belief =
    localizer.getBelief();

  for (
    const observation of
      evidence
  ) {
    belief =
      localizer.recordObservation(
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

export function runControlledFragmentFaultLocalization(
  program:
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
    minimumInformationGain?: number;
    costPenalty?: number;
    riskPenalty?: number;
    observationStdDev?: number;
  },
): FragmentFaultLocalizationResult {
  const maximumSteps =
    options?.maximumSteps ??
    2;

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

  const localizer =
    new ProbabilisticFragmentFaultLocalizer(
      program,
    );

  const initialBelief =
    conditionFaultPosteriorOnEvidence(
      localizer,
      initialEvidence,
      options
        ?.observationStdDev ??
      0.1,
    );

  const acquiredObservations:
    StructuralMechanismObservation[] =
      [];

  const steps:
    FragmentFaultLocalizationStep[] =
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

      selectedFragmentId:
        initialBelief
          .topFragmentId,

      acquiredObservations,

      steps,

      reason:
        "fragment-fault-posterior-resolved",
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
    const choice =
      localizer.chooseProbe(
        probes,
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

          riskPenalty:
            options
              ?.riskPenalty ??
            0.05,
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
          localizer
            .getBelief(),

        acquiredObservations,

        steps,

        reason:
          "no-safe-informative-fault-probe",
      };
    }

    const observedEffect =
      predictHierarchicalProgramEffect(
        actualProgram,
        choice
          .probe
          .interventions,
      );

    const observationId =
      `${choice.probe.id}:acquired-${step}`;

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

    acquiredObservations.push(
      observation,
    );

    const belief =
      localizer.recordObservation(
        choice.probe,
        observedEffect,
      );

    steps.push({
      observationId,

      probeId:
        choice.probe.id,

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

        selectedFragmentId:
          belief
            .topFragmentId,

        acquiredObservations,

        steps,

        reason:
          "fragment-fault-posterior-resolved",
      };
    }
  }

  return {
    decision:
      "abstained",

    initialBelief,

    finalBelief:
      localizer
        .getBelief(),

    acquiredObservations,

    steps,

    reason:
      "fault-localization-budget-exhausted",
  };
}

export function initializeFragmentProvenance(
  revisionId: string,
  program:
    HierarchicalCausalProgram,
  sources:
    Readonly<
      Record<
        string,
        {
          sourceRevisionId:
            string;
          sourceFragmentId?:
            string;
        }
      >
    >,
): FragmentProvenanceLedger {
  const records =
    program.fragments.map(
      (fragment) => {
        const source =
          sources[
            fragment.id
          ];

        if (!source) {
          throw new Error(
            `Fragment provenance source is missing ${fragment.id}.`,
          );
        }

        const sourceFragmentId =
          source
            .sourceFragmentId ??
          fragment.id;

        return {
          logicalFragmentId:
            fragment.id,

          originRevisionId:
            source
              .sourceRevisionId,

          originFragmentId:
            sourceFragmentId,

          currentRevisionId:
            revisionId,

          activeFragmentId:
            fragment.id,

          generation:
            0,

          status:
            "active" as const,

          history: [
            {
              kind:
                "inherited" as const,

              revisionId,

              toFragmentId:
                fragment.id,
            },
          ],
        };
      },
    )
    .sort(
      (left, right) =>
        left
          .logicalFragmentId
          .localeCompare(
            right
              .logicalFragmentId,
          ),
    );

  return {
    records,
  };
}

export function updateFragmentProvenanceAfterMaintenance(
  ledger:
    FragmentProvenanceLedger,
  maintenance:
    SelectiveFragmentMaintenanceResult,
  revisionId:
    string,
): FragmentProvenanceLedger {
  if (
    maintenance.decision !==
      "repaired" &&
    maintenance.decision !==
      "rolled-back-fragment"
  ) {
    throw new Error(
      "Fragment provenance can only advance after installed selective maintenance.",
    );
  }

  const preserved =
    new Set(
      maintenance
        .preservedFragmentIds,
    );

  const retired =
    new Set(
      maintenance
        .retiredFragmentIds,
    );

  const protectedEvidenceIds =
    maintenance.lineage
      ?.nodes.find(
        (node) =>
          node.revisionId ===
          revisionId,
      )
      ?.installationProtectedEvidenceIds ??
    [];

  const records =
    ledger.records.map(
      (record) => {
        const activeFragmentId =
          record
            .activeFragmentId;

        if (
          activeFragmentId &&
          preserved.has(
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
                  ...protectedEvidenceIds,
                ],
              },
            ],
          };
        }

        if (
          activeFragmentId &&
          retired.has(
            activeFragmentId,
          )
        ) {
          const replacement =
            maintenance
              .replacementFragmentIds[
                activeFragmentId
              ];

          if (replacement) {
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
                    ...protectedEvidenceIds,
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
                  ...protectedEvidenceIds,
                ],
              },
            ],
          };
        }

        return record;
      },
    );

  return {
    records,
  };
}

export function runControlledLocalizedCompositeMaintenance(
  lineage: RevisionLineage,
  actualProgram:
    HierarchicalCausalProgram,
  initialMonitoringEvidence:
    readonly StructuralMechanismObservation[],
  probes:
    readonly FragmentFaultProbe[],
  repairFragments:
    readonly ValidatedCausalFragment[],
  protectedEvidence:
    readonly StructuralMechanismObservation[],
  targetDimension: string,
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
  goal: MultidimensionalGoal,
  actions:
    readonly RecedingVectorAction[],
  currentPlan:
    PrerequisiteAwarePlan,
  reasoner:
    HierarchicalGoalReasoner,
  terminalGoalId: string,
  revisionId: string,
  goalRevisionNumber: number,
  provenance:
    FragmentProvenanceLedger,
  localizationOptions?: {
    maximumSteps?: number;
    maximumRisk?: number;
    minimumInformationGain?: number;
    costPenalty?: number;
    riskPenalty?: number;
    observationStdDev?: number;
  },
): LocalizedCompositeMaintenanceResult {
  const active =
    lineage.nodes.find(
      (node) =>
        node.revisionId ===
        lineage
          .activeRevisionId,
    );

  if (!active) {
    throw new Error(
      "Active fault localization requires an active lineage revision.",
    );
  }

  const localization =
    runControlledFragmentFaultLocalization(
      active.program,
      actualProgram,
      initialMonitoringEvidence,
      probes,
      localizationOptions,
    );

  if (
    localization.decision !==
      "resolved" ||
    !localization
      .selectedFragmentId
  ) {
    return {
      localization,

      provenance,

      reason:
        "fault-localization-unresolved",
    };
  }

  const monitor =
    new CompositeFragmentMonitor(
      active.program,
    );

  for (
    const observation of
      initialMonitoringEvidence
  ) {
    monitor.record(
      observation,
    );
  }

  for (
    const observation of
      localization
        .acquiredObservations
  ) {
    monitor.record(
      observation,
    );
  }

  const reliability =
    monitor.getReliability();

  if (
    !reliability
      .quarantinedFragmentIds
      .includes(
        localization
          .selectedFragmentId,
      )
  ) {
    return {
      localization,

      provenance,

      reason:
        "localized-fragment-not-quarantined",
    };
  }

  const maintenance =
    maintainCompositeRevisionSelectively(
      lineage,
      monitor,
      repairFragments,
      protectedEvidence,
      targetDimension,
      controlInterventions,
      currentState,
      goal,
      actions,
      currentPlan,
      reasoner,
      terminalGoalId,
      revisionId,
      goalRevisionNumber,
      localization
        .finalBelief
        .normalizedEntropy,
    );

  if (
    maintenance.decision !==
      "repaired" &&
    maintenance.decision !==
      "rolled-back-fragment"
  ) {
    return {
      localization,

      maintenance,

      provenance,

      reason:
        "localized-fragment-not-quarantined",
    };
  }

  return {
    localization,

    maintenance,

    provenance:
      updateFragmentProvenanceAfterMaintenance(
        provenance,
        maintenance,
        revisionId,
      ),

    reason:
      "localized-fragment-maintained",
  };
}

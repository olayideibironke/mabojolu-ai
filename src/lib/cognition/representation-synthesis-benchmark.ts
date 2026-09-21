import {
  BoundedRepresentationPrimitiveLibrary,
  evaluateSynthesizedRepresentationRule,
  synthesizeRepresentationRule,
  type RepresentationDomainBinding,
  type RepresentationPrimitiveLibraryAudit,
  type RepresentationRuleEvaluation,
  type RepresentationSynthesisExample,
  type SynthesizedRepresentationRule,
} from "./representation-synthesis";

export interface RepresentationSynthesisBenchmarkReport {
  synthesizedRule: SynthesizedRepresentationRule;
  atomicBaselineRule: SynthesizedRepresentationRule;
  sourceValidation:
    RepresentationRuleEvaluation;
  sourceAtomicBaseline:
    RepresentationRuleEvaluation;
  targetTransfer:
    RepresentationRuleEvaluation;
  targetAtomicBaseline:
    RepresentationRuleEvaluation;
  sourceImprovement: number;
  targetImprovement: number;
  libraryAudit:
    RepresentationPrimitiveLibraryAudit;
}

const ROLES = [
  "signal-a",
  "signal-b",
  "signal-c",
  "nuisance",
] as const;

const SOURCE_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "source-regime-control",

  roleToVariable: {
    "signal-a":
      "errorLoad",

    "signal-b":
      "driftBelief",

    "signal-c":
      "transitionShock",

    nuisance:
      "calendarNoise",
  },
};

const TARGET_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "target-resource-routing",

  roleToVariable: {
    "signal-a":
      "queuePressure",

    "signal-b":
      "forecastUncertainty",

    "signal-c":
      "demandShock",

    nuisance:
      "holidayIndex",
  },
};

const SOURCE_LOW_UTILITIES = {
  conservative:
    0.6,
  balanced:
    0.05,
  responsive:
    -0.5,
};

const SOURCE_HIGH_UTILITIES = {
  conservative:
    -0.8,
  balanced:
    0.2,
  responsive:
    0.55,
};

const TARGET_LOW_UTILITIES = {
  conservative:
    0.7,
  balanced:
    0.15,
  responsive:
    -0.4,
};

const TARGET_HIGH_UTILITIES = {
  conservative:
    -0.65,
  balanced:
    0.25,
  responsive:
    0.7,
};

function example(
  observation:
    Record<
      string,
      number
    >,

  policyUtilities:
    Record<
      string,
      number
    >,
): RepresentationSynthesisExample {
  return {
    observation,
    policyUtilities,
  };
}

export const DEFAULT_REPRESENTATION_SYNTHESIS_TRAINING:
  readonly RepresentationSynthesisExample[] = [
    example(
      {
        errorLoad:
          0.1,
        driftBelief:
          0.5,
        transitionShock:
          0.5,
        calendarNoise:
          0.1,
      },
      SOURCE_LOW_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.5,
        driftBelief:
          0.1,
        transitionShock:
          0.5,
        calendarNoise:
          0.9,
      },
      SOURCE_LOW_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.5,
        driftBelief:
          0.5,
        transitionShock:
          0.1,
        calendarNoise:
          0.2,
      },
      SOURCE_LOW_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.9,
        driftBelief:
          0.5,
        transitionShock:
          0.5,
        calendarNoise:
          0.9,
      },
      SOURCE_HIGH_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.5,
        driftBelief:
          0.9,
        transitionShock:
          0.5,
        calendarNoise:
          0.1,
      },
      SOURCE_HIGH_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.5,
        driftBelief:
          0.5,
        transitionShock:
          0.9,
        calendarNoise:
          0.8,
      },
      SOURCE_HIGH_UTILITIES,
    ),
  ];

export const DEFAULT_REPRESENTATION_SYNTHESIS_SOURCE_VALIDATION:
  readonly RepresentationSynthesisExample[] = [
    example(
      {
        errorLoad:
          0.2,
        driftBelief:
          0.4,
        transitionShock:
          0.5,
        calendarNoise:
          0.8,
      },
      SOURCE_LOW_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.4,
        driftBelief:
          0.2,
        transitionShock:
          0.5,
        calendarNoise:
          0.2,
      },
      SOURCE_LOW_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.8,
        driftBelief:
          0.6,
        transitionShock:
          0.5,
        calendarNoise:
          0.2,
      },
      SOURCE_HIGH_UTILITIES,
    ),
    example(
      {
        errorLoad:
          0.6,
        driftBelief:
          0.8,
        transitionShock:
          0.5,
        calendarNoise:
          0.8,
      },
      SOURCE_HIGH_UTILITIES,
    ),
  ];

export const DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER:
  readonly RepresentationSynthesisExample[] = [
    example(
      {
        queuePressure:
          0.15,
        forecastUncertainty:
          0.55,
        demandShock:
          0.5,
        holidayIndex:
          0.9,
      },
      TARGET_LOW_UTILITIES,
    ),
    example(
      {
        queuePressure:
          0.55,
        forecastUncertainty:
          0.15,
        demandShock:
          0.5,
        holidayIndex:
          0.1,
      },
      TARGET_LOW_UTILITIES,
    ),
    example(
      {
        queuePressure:
          0.5,
        forecastUncertainty:
          0.55,
        demandShock:
          0.15,
        holidayIndex:
          0.8,
      },
      TARGET_LOW_UTILITIES,
    ),
    example(
      {
        queuePressure:
          0.85,
        forecastUncertainty:
          0.55,
        demandShock:
          0.5,
        holidayIndex:
          0.1,
      },
      TARGET_HIGH_UTILITIES,
    ),
    example(
      {
        queuePressure:
          0.55,
        forecastUncertainty:
          0.85,
        demandShock:
          0.5,
        holidayIndex:
          0.9,
      },
      TARGET_HIGH_UTILITIES,
    ),
    example(
      {
        queuePressure:
          0.5,
        forecastUncertainty:
          0.55,
        demandShock:
          0.85,
        holidayIndex:
          0.2,
      },
      TARGET_HIGH_UTILITIES,
    ),
  ];

export function runRepresentationSynthesisBenchmark():
  RepresentationSynthesisBenchmarkReport {
  const synthesizedRule =
    synthesizeRepresentationRule(
      DEFAULT_REPRESENTATION_SYNTHESIS_TRAINING,
      SOURCE_BINDING,
      ROLES,
    );

  const atomicBaselineRule =
    synthesizeRepresentationRule(
      DEFAULT_REPRESENTATION_SYNTHESIS_TRAINING,
      SOURCE_BINDING,
      ROLES,
      {
        maximumArity:
          1,
      },
    );

  const sourceValidation =
    evaluateSynthesizedRepresentationRule(
      synthesizedRule,
      DEFAULT_REPRESENTATION_SYNTHESIS_SOURCE_VALIDATION,
      SOURCE_BINDING,
    );

  const sourceAtomicBaseline =
    evaluateSynthesizedRepresentationRule(
      atomicBaselineRule,
      DEFAULT_REPRESENTATION_SYNTHESIS_SOURCE_VALIDATION,
      SOURCE_BINDING,
    );

  const targetTransfer =
    evaluateSynthesizedRepresentationRule(
      synthesizedRule,
      DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER,
      TARGET_BINDING,
    );

  const targetAtomicBaseline =
    evaluateSynthesizedRepresentationRule(
      atomicBaselineRule,
      DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER,
      TARGET_BINDING,
    );

  const sourceImprovement =
    sourceAtomicBaseline
      .cumulativeRegret -
    sourceValidation
      .cumulativeRegret;

  const targetImprovement =
    targetAtomicBaseline
      .cumulativeRegret -
    targetTransfer
      .cumulativeRegret;

  const library =
    new BoundedRepresentationPrimitiveLibrary();

  library.register(
    synthesizedRule
      .primitive,
  );

  library.recordTransfer({
    primitiveId:
      synthesizedRule
        .primitive
        .id,

    domainId:
      SOURCE_BINDING
        .domainId,

    baselineRegret:
      sourceAtomicBaseline
        .cumulativeRegret,

    primitiveRegret:
      sourceValidation
        .cumulativeRegret,

    improvement:
      sourceImprovement,

    unsafeIrreversibleActions:
      0,

    falsePromotions:
      0,
  });

  library.recordTransfer({
    primitiveId:
      synthesizedRule
        .primitive
        .id,

    domainId:
      TARGET_BINDING
        .domainId,

    baselineRegret:
      targetAtomicBaseline
        .cumulativeRegret,

    primitiveRegret:
      targetTransfer
        .cumulativeRegret,

    improvement:
      targetImprovement,

    unsafeIrreversibleActions:
      0,

    falsePromotions:
      0,
  });

  return {
    synthesizedRule,
    atomicBaselineRule,
    sourceValidation,
    sourceAtomicBaseline,
    targetTransfer,
    targetAtomicBaseline,
    sourceImprovement,
    targetImprovement,

    libraryAudit:
      library
        .getAuditSummary(),
  };
}

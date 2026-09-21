import {
  evaluateSynthesizedRepresentationRule,
  synthesizeRepresentationRule,
  type RepresentationDomainBinding,
  type RepresentationSynthesisExample,
  type RepresentationRuleEvaluation,
  type SynthesizedRepresentationRule,
} from "./representation-synthesis";

import {
  evaluateRepresentationComposition,
  induceStructuralRoleBinding,
  synthesizeRepresentationComposition,
  type BoundRepresentationPrimitive,
  type ComposedRepresentationRule,
  type RepresentationCompositionEvaluation,
  type StructuralRoleInductionResult,
} from "./structural-role-induction";

import {
  DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER,
  runRepresentationSynthesisBenchmark,
} from "./representation-synthesis-benchmark";

export interface StructuralRoleCompositionBenchmarkReport {
  transferredRule: SynthesizedRepresentationRule;
  roleInduction: StructuralRoleInductionResult;
  inferredTransfer?: RepresentationRuleEvaluation;
  suppliedBindingTransfer: RepresentationRuleEvaluation;
  ambiguousRoleInduction: StructuralRoleInductionResult;
  secondSynthesizedRule: SynthesizedRepresentationRule;
  compositionRule: ComposedRepresentationRule;
  compositionEvaluation: RepresentationCompositionEvaluation;
  leftOnlyRegret: number;
  rightOnlyRegret: number;
}

const SECOND_SOURCE_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "second-source",

  roleToVariable: {
    "signal-d":
      "phaseLeft",

    "signal-e":
      "phaseRight",

    nuisance:
      "clockNoise",
  },
};

const SECOND_ROLES = [
  "signal-d",
  "signal-e",
  "nuisance",
] as const;

const LOW_UTILITIES = {
  conservative:
    0.8,
  balanced:
    0.1,
  responsive:
    -0.5,
};

const HIGH_UTILITIES = {
  conservative:
    -0.7,
  balanced:
    0.25,
  responsive:
    0.85,
};

function example(
  observation:
    Record<
      string,
      number
    >,

  utilities:
    Record<
      string,
      number
    >,
): RepresentationSynthesisExample {
  return {
    observation,
    policyUtilities: {
      ...utilities,
    },
  };
}

const SECOND_SOURCE_TRAINING:
  readonly RepresentationSynthesisExample[] = [
    example(
      {
        phaseLeft:
          0.2,
        phaseRight:
          0.3,
        clockNoise:
          0.9,
      },
      LOW_UTILITIES,
    ),
    example(
      {
        phaseLeft:
          0.8,
        phaseRight:
          0.7,
        clockNoise:
          0.1,
      },
      LOW_UTILITIES,
    ),
    example(
      {
        phaseLeft:
          0.45,
        phaseRight:
          0.55,
        clockNoise:
          0.8,
      },
      LOW_UTILITIES,
    ),
    example(
      {
        phaseLeft:
          0.1,
        phaseRight:
          0.8,
        clockNoise:
          0.8,
      },
      HIGH_UTILITIES,
    ),
    example(
      {
        phaseLeft:
          0.9,
        phaseRight:
          0.2,
        clockNoise:
          0.2,
      },
      HIGH_UTILITIES,
    ),
    example(
      {
        phaseLeft:
          0.15,
        phaseRight:
          0.85,
        clockNoise:
          0.1,
      },
      HIGH_UTILITIES,
    ),
  ];

const COMPOSITION_LEFT_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "composition-domain",

  roleToVariable: {
    "signal-a":
      "loadA",

    "signal-b":
      "loadB",

    "signal-c":
      "loadC",
  },
};

const COMPOSITION_RIGHT_BINDING:
  RepresentationDomainBinding = {
  domainId:
    "composition-domain",

  roleToVariable: {
    "signal-d":
      "stateD",

    "signal-e":
      "stateE",
  },
};

function compositionExample(
  leftHigh:
    boolean,

  rightHigh:
    boolean,
): RepresentationSynthesisExample {
  return example(
    {
      loadA:
        leftHigh
          ? 0.8
          : 0.2,

      loadB:
        leftHigh
          ? 0.7
          : 0.3,

      loadC:
        leftHigh
          ? 0.75
          : 0.25,

      stateD:
        rightHigh
          ? 0.9
          : 0.55,

      stateE:
        rightHigh
          ? 0.2
          : 0.45,
    },
    leftHigh &&
      rightHigh
      ? HIGH_UTILITIES
      : LOW_UTILITIES,
  );
}

const COMPOSITION_EXAMPLES:
  readonly RepresentationSynthesisExample[] = [
    compositionExample(
      false,
      false,
    ),
    compositionExample(
      false,
      false,
    ),
    compositionExample(
      true,
      false,
    ),
    compositionExample(
      true,
      false,
    ),
    compositionExample(
      false,
      true,
    ),
    compositionExample(
      false,
      true,
    ),
    compositionExample(
      true,
      true,
    ),
    compositionExample(
      true,
      true,
    ),
  ];

function singlePrimitiveRegret(
  bound:
    BoundRepresentationPrimitive,

  examples:
    readonly RepresentationSynthesisExample[],
): number {
  const rule:
    SynthesizedRepresentationRule = {
    primitive:
      bound.primitive,

    threshold:
      bound.threshold,

    lowPolicyId:
      "conservative",

    highPolicyId:
      "responsive",

    trainingRegret:
      0,

    complexityPenalty:
      0,

    objective:
      0,
  };

  return evaluateSynthesizedRepresentationRule(
    rule,
    examples,
    bound.binding,
  ).cumulativeRegret;
}

export function runStructuralRoleCompositionBenchmark():
  StructuralRoleCompositionBenchmarkReport {
  const previous =
    runRepresentationSynthesisBenchmark();

  const transferredRule =
    previous.synthesizedRule;

  const roleInduction =
    induceStructuralRoleBinding(
      transferredRule,
      DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER,
      "target-resource-routing-auto",
    );

  const inferredTransfer =
    roleInduction.binding
      ? evaluateSynthesizedRepresentationRule(
          transferredRule,
          DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER,
          roleInduction.binding,
        )
      : undefined;

  const suppliedBindingTransfer =
    previous.targetTransfer;

  const ambiguousExamples =
    DEFAULT_REPRESENTATION_SYNTHESIS_TARGET_TRANSFER.map(
      (item) => ({
        observation: {
          ...item.observation,

          mirrorPressure:
            item
              .observation
              .queuePressure!,
        },

        policyUtilities: {
          ...item
            .policyUtilities,
        },
      }),
    );

  const ambiguousRoleInduction =
    induceStructuralRoleBinding(
      transferredRule,
      ambiguousExamples,
      "ambiguous-target",
    );

  const secondSynthesizedRule =
    synthesizeRepresentationRule(
      SECOND_SOURCE_TRAINING,
      SECOND_SOURCE_BINDING,
      SECOND_ROLES,
      {
        maximumArity:
          2,
      },
    );

  const left:
    BoundRepresentationPrimitive = {
    primitive:
      transferredRule.primitive,

    threshold:
      transferredRule.threshold,

    binding:
      COMPOSITION_LEFT_BINDING,
  };

  const right:
    BoundRepresentationPrimitive = {
    primitive:
      secondSynthesizedRule
        .primitive,

    threshold:
      secondSynthesizedRule
        .threshold,

    binding:
      COMPOSITION_RIGHT_BINDING,
  };

  const compositionRule =
    synthesizeRepresentationComposition(
      left,
      right,
      COMPOSITION_EXAMPLES,
    );

  const compositionEvaluation =
    evaluateRepresentationComposition(
      compositionRule,
      left,
      right,
      COMPOSITION_EXAMPLES,
    );

  return {
    transferredRule,
    roleInduction,
    inferredTransfer,
    suppliedBindingTransfer,
    ambiguousRoleInduction,
    secondSynthesizedRule,
    compositionRule,
    compositionEvaluation,

    leftOnlyRegret:
      singlePrimitiveRegret(
        left,
        COMPOSITION_EXAMPLES,
      ),

    rightOnlyRegret:
      singlePrimitiveRegret(
        right,
        COMPOSITION_EXAMPLES,
      ),
  };
}

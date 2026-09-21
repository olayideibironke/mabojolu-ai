import {
  evaluateRepresentationPrimitive,
  evaluateSynthesizedRepresentationRule,
  type RepresentationDomainBinding,
  type RepresentationPrimitive,
  type RepresentationSynthesisExample,
  type SynthesizedRepresentationRule,
} from "./representation-synthesis";

export interface StructuralRoleMappingCandidate {
  variableSet: string[];
  binding: RepresentationDomainBinding;
  cumulativeRegret: number;
  oracleMatches: number;
}

export interface StructuralRoleInductionResult {
  decision:
    | "mapped"
    | "abstained";
  binding?: RepresentationDomainBinding;
  selectedVariables?: string[];
  bestRegret: number;
  runnerUpRegret?: number;
  regretMargin?: number;
  candidateCount: number;
  sufficientlyCertain: boolean;
  candidates: StructuralRoleMappingCandidate[];
}

export type RepresentationCompositionGate =
  | "and"
  | "or"
  | "xor";

export interface BoundRepresentationPrimitive {
  primitive: RepresentationPrimitive;
  threshold: number;
  binding: RepresentationDomainBinding;
}

export interface ComposedRepresentationRule {
  leftPrimitiveId: string;
  rightPrimitiveId: string;
  gate: RepresentationCompositionGate;
  lowPolicyId: string;
  highPolicyId: string;
  trainingRegret: number;
  complexityPenalty: number;
  objective: number;
}

export interface RepresentationCompositionEvaluation {
  episodes: number;
  cumulativeUtility: number;
  cumulativeRegret: number;
  oracleMatches: number;
}

function validateExamples(
  examples:
    readonly RepresentationSynthesisExample[],
): string[] {
  if (
    examples.length <
      2
  ) {
    throw new Error(
      "Structural role induction requires at least two protected examples.",
    );
  }

  const variables =
    Object.keys(
      examples[
        0
      ]!
        .observation,
    ).sort();

  if (
    variables.length ===
      0
  ) {
    throw new Error(
      "Structural role induction requires at least one observed variable.",
    );
  }

  for (
    const example of
      examples
  ) {
    const currentVariables =
      Object.keys(
        example.observation,
      ).sort();

    if (
      currentVariables.length !==
        variables.length ||
      currentVariables.some(
        (
          variable,
          index,
        ) =>
          variable !==
          variables[
            index
          ],
      )
    ) {
      throw new Error(
        "All structural role-induction examples must expose the same variable set.",
      );
    }

    for (
      const variable of
        variables
    ) {
      const value =
        example
          .observation[
            variable
          ];

      if (
        !Number.isFinite(
          value,
        ) ||
        value <
          0 ||
        value >
          1
      ) {
        throw new Error(
          `Structural role-induction variable ${variable} must be finite and normalized to [0, 1].`,
        );
      }
    }
  }

  return variables;
}

function combinations(
  values:
    readonly string[],

  size:
    number,
): string[][] {
  const output:
    string[][] =
      [];

  function visit(
    start:
      number,

    chosen:
      string[],
  ): void {
    if (
      chosen.length ===
        size
    ) {
      output.push([
        ...chosen,
      ]);

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

function bindingForVariableSet(
  domainId:
    string,

  roles:
    readonly string[],

  variables:
    readonly string[],
): RepresentationDomainBinding {
  if (
    roles.length !==
      variables.length
  ) {
    throw new Error(
      "Structural role binding requires equal role and variable counts.",
    );
  }

  const roleToVariable:
    Record<
      string,
      string
    > = {};

  const sortedVariables = [
    ...variables,
  ].sort();

  for (
    let index =
      0;
    index <
      roles.length;
    index +=
      1
  ) {
    const role =
      roles[
        index
      ];

    const variable =
      sortedVariables[
        index
      ];

    if (
      role ===
        undefined ||
      variable ===
        undefined
    ) {
      throw new Error(
        "Structural role binding could not align its role and variable sets.",
      );
    }

    roleToVariable[
      role
    ] =
      variable;
  }

  return {
    domainId,
    roleToVariable,
  };
}

export function induceStructuralRoleBinding(
  rule:
    SynthesizedRepresentationRule,

  examples:
    readonly RepresentationSynthesisExample[],

  domainId:
    string,

  options?: {
    minimumRegretMargin?: number;
    maximumAcceptedRegret?: number;
  },
): StructuralRoleInductionResult {
  if (
    !domainId.trim()
  ) {
    throw new Error(
      "Structural role induction requires a non-empty domain id.",
    );
  }

  const variables =
    validateExamples(
      examples,
    );

  const roleCount =
    rule
      .primitive
      .roles
      .length;

  if (
    variables.length <
      roleCount
  ) {
    throw new Error(
      "Structural role induction has fewer observed variables than required primitive roles.",
    );
  }

  const variableSets =
    combinations(
      variables,
      roleCount,
    );

  const candidates:
    StructuralRoleMappingCandidate[] =
      variableSets.map(
        (variableSet) => {
          const binding =
            bindingForVariableSet(
              domainId,
              rule
                .primitive
                .roles,
              variableSet,
            );

          const evaluation =
            evaluateSynthesizedRepresentationRule(
              rule,
              examples,
              binding,
            );

          return {
            variableSet: [
              ...variableSet,
            ].sort(),

            binding,

            cumulativeRegret:
              evaluation
                .cumulativeRegret,

            oracleMatches:
              evaluation
                .oracleMatches,
          };
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.cumulativeRegret -
            right.cumulativeRegret ||
          right.oracleMatches -
            left.oracleMatches ||
          left.variableSet
            .join("|")
            .localeCompare(
              right.variableSet
                .join("|"),
            ),
      );

  const best =
    candidates[
      0
    ];

  if (
    !best
  ) {
    throw new Error(
      "Structural role induction produced no mapping candidates.",
    );
  }

  const runnerUp =
    candidates[
      1
    ];

  const regretMargin =
    runnerUp
      ? runnerUp
          .cumulativeRegret -
        best.cumulativeRegret
      : Number.POSITIVE_INFINITY;

  const minimumRegretMargin =
    options
      ?.minimumRegretMargin ??
    0.25;

  const maximumAcceptedRegret =
    options
      ?.maximumAcceptedRegret ??
    0;

  const sufficientlyCertain =
    best.cumulativeRegret <=
      maximumAcceptedRegret +
        Number.EPSILON &&
    regretMargin >=
      minimumRegretMargin;

  if (
    !sufficientlyCertain
  ) {
    return {
      decision:
        "abstained",

      bestRegret:
        best.cumulativeRegret,

      runnerUpRegret:
        runnerUp
          ?.cumulativeRegret,

      regretMargin:
        Number.isFinite(
          regretMargin,
        )
          ? regretMargin
          : undefined,

      candidateCount:
        candidates.length,

      sufficientlyCertain:
        false,

      candidates,
    };
  }

  return {
    decision:
      "mapped",

    binding:
      best.binding,

    selectedVariables: [
      ...best.variableSet,
    ],

    bestRegret:
      best.cumulativeRegret,

    runnerUpRegret:
      runnerUp
        ?.cumulativeRegret,

    regretMargin:
      Number.isFinite(
        regretMargin,
      )
        ? regretMargin
        : undefined,

    candidateCount:
      candidates.length,

    sufficientlyCertain:
      true,

    candidates,
  };
}

function oracleUtility(
  utilities:
    Record<
      string,
      number
    >,
): number {
  return Math.max(
    ...Object.values(
      utilities,
    ),
  );
}

function mean(
  values:
    readonly number[],
): number {
  return values.reduce(
    (
      total,
      value,
    ) =>
      total +
      value,
    0,
  ) /
    values.length;
}

function bestAveragePolicy(
  examples:
    readonly RepresentationSynthesisExample[],
): string {
  if (
    examples.length ===
      0
  ) {
    throw new Error(
      "Representation composition cannot select a policy from an empty partition.",
    );
  }

  const policyIds =
    Object.keys(
      examples[
        0
      ]!
        .policyUtilities,
    );

  let bestPolicyId:
    string |
    undefined;

  let bestUtility =
    Number.NEGATIVE_INFINITY;

  for (
    const policyId of
      policyIds
  ) {
    const utility =
      mean(
        examples.map(
          (example) =>
            example
              .policyUtilities[
                policyId
              ] ??
            Number.NEGATIVE_INFINITY,
        ),
      );

    if (
      !bestPolicyId ||
      utility >
        bestUtility +
          Number.EPSILON
    ) {
      bestPolicyId =
        policyId;

      bestUtility =
        utility;
    }
  }

  if (
    !bestPolicyId
  ) {
    throw new Error(
      "Representation composition could not choose a partition policy.",
    );
  }

  return bestPolicyId;
}

function primitiveHigh(
  bound:
    BoundRepresentationPrimitive,

  example:
    RepresentationSynthesisExample,
): boolean {
  return evaluateRepresentationPrimitive(
    bound.primitive,
    example.observation,
    bound.binding,
  ) >
    bound.threshold;
}

function gateValue(
  gate:
    RepresentationCompositionGate,

  left:
    boolean,

  right:
    boolean,
): boolean {
  switch (
    gate
  ) {
    case "and":
      return left &&
        right;

    case "or":
      return left ||
        right;

    case "xor":
      return left !==
        right;
  }
}

function compositionRegret(
  rule:
    ComposedRepresentationRule,

  left:
    BoundRepresentationPrimitive,

  right:
    BoundRepresentationPrimitive,

  examples:
    readonly RepresentationSynthesisExample[],
): number {
  return examples.reduce(
    (
      total,
      example,
    ) => {
      const high =
        gateValue(
          rule.gate,
          primitiveHigh(
            left,
            example,
          ),
          primitiveHigh(
            right,
            example,
          ),
        );

      const policyId =
        high
          ? rule.highPolicyId
          : rule.lowPolicyId;

      const selectedUtility =
        example
          .policyUtilities[
            policyId
          ];

      if (
        selectedUtility ===
          undefined
      ) {
        throw new Error(
          `Representation composition selected policy ${policyId} without utility evidence.`,
        );
      }

      return total +
        Math.max(
          0,
          oracleUtility(
            example.policyUtilities,
          ) -
            selectedUtility,
        );
    },
    0,
  );
}

export function synthesizeRepresentationComposition(
  left:
    BoundRepresentationPrimitive,

  right:
    BoundRepresentationPrimitive,

  examples:
    readonly RepresentationSynthesisExample[],

  complexityPenalty =
    0.03,
): ComposedRepresentationRule {
  if (
    examples.length <
      4
  ) {
    throw new Error(
      "Representation composition requires at least four outcome-grounded examples.",
    );
  }

  let best:
    ComposedRepresentationRule |
    undefined;

  for (
    const gate of
      [
        "and",
        "or",
        "xor",
      ] as const
  ) {
    const lowExamples:
      RepresentationSynthesisExample[] =
        [];

    const highExamples:
      RepresentationSynthesisExample[] =
        [];

    for (
      const example of
        examples
    ) {
      const high =
        gateValue(
          gate,
          primitiveHigh(
            left,
            example,
          ),
          primitiveHigh(
            right,
            example,
          ),
        );

      if (
        high
      ) {
        highExamples.push(
          example,
        );
      } else {
        lowExamples.push(
          example,
        );
      }
    }

    if (
      lowExamples.length ===
        0 ||
      highExamples.length ===
        0
    ) {
      continue;
    }

    const candidate:
      ComposedRepresentationRule = {
      leftPrimitiveId:
        left.primitive.id,

      rightPrimitiveId:
        right.primitive.id,

      gate,

      lowPolicyId:
        bestAveragePolicy(
          lowExamples,
        ),

      highPolicyId:
        bestAveragePolicy(
          highExamples,
        ),

      trainingRegret:
        0,

      complexityPenalty,

      objective:
        0,
    };

    candidate.trainingRegret =
      compositionRegret(
        candidate,
        left,
        right,
        examples,
      );

    candidate.objective =
      candidate.trainingRegret +
      candidate.complexityPenalty;

    if (
      !best ||
      candidate.objective <
        best.objective -
          Number.EPSILON ||
      (
        Math.abs(
          candidate.objective -
          best.objective,
        ) <=
          Number.EPSILON &&
        candidate.gate <
          best.gate
      )
    ) {
      best =
        candidate;
    }
  }

  if (
    !best
  ) {
    throw new Error(
      "Bounded representation composition could not produce a valid rule.",
    );
  }

  return best;
}

export function evaluateRepresentationComposition(
  rule:
    ComposedRepresentationRule,

  left:
    BoundRepresentationPrimitive,

  right:
    BoundRepresentationPrimitive,

  examples:
    readonly RepresentationSynthesisExample[],
): RepresentationCompositionEvaluation {
  let cumulativeUtility =
    0;

  let cumulativeRegret =
    0;

  let oracleMatches =
    0;

  for (
    const example of
      examples
  ) {
    const high =
      gateValue(
        rule.gate,
        primitiveHigh(
          left,
          example,
        ),
        primitiveHigh(
          right,
          example,
        ),
      );

    const policyId =
      high
        ? rule.highPolicyId
        : rule.lowPolicyId;

    const selectedUtility =
      example
        .policyUtilities[
          policyId
        ];

    if (
      selectedUtility ===
        undefined
    ) {
      throw new Error(
        `Representation composition selected policy ${policyId} without utility evidence.`,
      );
    }

    const oracle =
      oracleUtility(
        example.policyUtilities,
      );

    cumulativeUtility +=
      selectedUtility;

    cumulativeRegret +=
      Math.max(
        0,
        oracle -
          selectedUtility,
      );

    if (
      Math.abs(
        oracle -
        selectedUtility,
      ) <=
        Number.EPSILON
    ) {
      oracleMatches +=
        1;
    }
  }

  return {
    episodes:
      examples.length,

    cumulativeUtility,

    cumulativeRegret,

    oracleMatches,
  };
}

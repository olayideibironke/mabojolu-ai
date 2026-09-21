export type RepresentationPrimitiveOperator =
  | "atomic"
  | "mean"
  | "absolute-gap";

export interface RepresentationPrimitive {
  id: string;
  operator: RepresentationPrimitiveOperator;
  roles: string[];
  complexity: number;
}

export interface SynthesizedRepresentationRule {
  primitive: RepresentationPrimitive;
  threshold: number;
  lowPolicyId: string;
  highPolicyId: string;
  trainingRegret: number;
  complexityPenalty: number;
  objective: number;
}

export interface RepresentationDomainBinding {
  domainId: string;
  roleToVariable: Record<
    string,
    string
  >;
}

export interface RepresentationSynthesisExample {
  observation: Record<
    string,
    number
  >;
  policyUtilities: Record<
    string,
    number
  >;
}

export interface RepresentationRuleEvaluation {
  episodes: number;
  cumulativeUtility: number;
  cumulativeRegret: number;
  oracleMatches: number;
}

export interface RepresentationPrimitiveTransferEvidence {
  primitiveId: string;
  domainId: string;
  baselineRegret: number;
  primitiveRegret: number;
  improvement: number;
  unsafeIrreversibleActions: number;
  falsePromotions: number;
}

export interface RepresentationPrimitiveLibraryEntry {
  primitiveId: string;
  status:
    | "candidate"
    | "reusable"
    | "retired"
    | "quarantined";
  domainsEvaluated: number;
  positiveTransfers: number;
  negativeTransfers: number;
  cumulativeImprovement: number;
}

export interface RepresentationPrimitiveLibraryAudit {
  entries: RepresentationPrimitiveLibraryEntry[];
  evidence: RepresentationPrimitiveTransferEvidence[];
}

function validateUnitValue(
  name:
    string,

  value:
    number,
): void {
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
      `${name} must be a finite number in [0, 1].`,
    );
  }
}

function validateUtilities(
  utilities:
    Record<
      string,
      number
    >,
): void {
  const entries =
    Object.entries(
      utilities,
    );

  if (
    entries.length <
      2
  ) {
    throw new Error(
      "Representation synthesis requires utility evidence for at least two policies.",
    );
  }

  for (
    const [
      policyId,
      utility,
    ] of
      entries
  ) {
    if (
      !policyId.trim() ||
      !Number.isFinite(
        utility,
      )
    ) {
      throw new Error(
        "Representation synthesis policy utilities must use non-empty policy ids and finite values.",
      );
    }
  }
}

function validateExample(
  example:
    RepresentationSynthesisExample,
): void {
  for (
    const [
      name,
      value,
    ] of
      Object.entries(
        example.observation,
      )
  ) {
    validateUnitValue(
      name,
      value,
    );
  }

  validateUtilities(
    example.policyUtilities,
  );
}

function roleValue(
  observation:
    Record<
      string,
      number
    >,

  binding:
    RepresentationDomainBinding,

  role:
    string,
): number {
  const variable =
    binding.roleToVariable[
      role
    ];

  if (
    !variable
  ) {
    throw new Error(
      `Domain ${binding.domainId} has no variable binding for role ${role}.`,
    );
  }

  const value =
    observation[
      variable
    ];

  if (
    value ===
      undefined
  ) {
    throw new Error(
      `Observation in domain ${binding.domainId} is missing bound variable ${variable}.`,
    );
  }

  validateUnitValue(
    variable,
    value,
  );

  return value;
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

export function evaluateRepresentationPrimitive(
  primitive:
    RepresentationPrimitive,

  observation:
    Record<
      string,
      number
    >,

  binding:
    RepresentationDomainBinding,
): number {
  const values =
    primitive.roles.map(
      (role) =>
        roleValue(
          observation,
          binding,
          role,
        ),
    );

  switch (
    primitive.operator
  ) {
    case "atomic":
      if (
        values.length !==
          1
      ) {
        throw new Error(
          "Atomic representation primitives require exactly one role.",
        );
      }

      return values[
        0
      ]!;

    case "mean":
      if (
        values.length <
          2
      ) {
        throw new Error(
          "Mean representation primitives require at least two roles.",
        );
      }

      return mean(
        values,
      );

    case "absolute-gap":
      if (
        values.length !==
          2
      ) {
        throw new Error(
          "Absolute-gap representation primitives require exactly two roles.",
        );
      }

      return Math.abs(
        values[
          0
        ]! -
        values[
          1
        ]!,
      );
  }
}

function combinations(
  roles:
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
        roles.length;
      index +=
        1
    ) {
      const role =
        roles[
          index
        ];

      if (
        role ===
          undefined
      ) {
        continue;
      }

      chosen.push(
        role,
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

function primitiveId(
  operator:
    RepresentationPrimitiveOperator,

  roles:
    readonly string[],
): string {
  return `${operator}(${roles.join(",")})`;
}

export function generateBoundedRepresentationPrimitives(
  roles:
    readonly string[],

  maximumArity =
    3,
): RepresentationPrimitive[] {
  const distinctRoles =
    Array.from(
      new Set(
        roles,
      ),
    );

  if (
    distinctRoles.length <
      2
  ) {
    throw new Error(
      "Representation synthesis requires at least two distinct abstract roles.",
    );
  }

  if (
    !Number.isInteger(
      maximumArity,
    ) ||
    maximumArity <
      1 ||
    maximumArity >
      3
  ) {
    throw new Error(
      "maximumArity must be an integer in [1, 3].",
    );
  }

  const primitives:
    RepresentationPrimitive[] =
      [];

  for (
    const role of
      distinctRoles
  ) {
    primitives.push({
      id:
        primitiveId(
          "atomic",
          [
            role,
          ],
        ),

      operator:
        "atomic",

      roles: [
        role,
      ],

      complexity:
        1,
    });
  }

  if (
    maximumArity >=
      2
  ) {
    for (
      const pair of
        combinations(
          distinctRoles,
          2,
        )
    ) {
      primitives.push({
        id:
          primitiveId(
            "mean",
            pair,
          ),

        operator:
          "mean",

        roles:
          pair,

        complexity:
          2,
      });

      primitives.push({
        id:
          primitiveId(
            "absolute-gap",
            pair,
          ),

        operator:
          "absolute-gap",

        roles:
          pair,

        complexity:
          2,
      });
    }
  }

  if (
    maximumArity >=
      3
  ) {
    for (
      const triple of
        combinations(
          distinctRoles,
          3,
        )
    ) {
      primitives.push({
        id:
          primitiveId(
            "mean",
            triple,
          ),

        operator:
          "mean",

        roles:
          triple,

        complexity:
          3,
      });
    }
  }

  return primitives;
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

function bestAveragePolicy(
  examples:
    readonly RepresentationSynthesisExample[],
): string {
  if (
    examples.length ===
      0
  ) {
    throw new Error(
      "Cannot choose a policy for an empty representation partition.",
    );
  }

  const policyIds =
    Object.keys(
      examples[
        0
      ]!
        .policyUtilities,
    );

  let bestPolicyId =
    policyIds[
      0
    ];

  let bestAverage =
    Number.NEGATIVE_INFINITY;

  for (
    const policyId of
      policyIds
  ) {
    const average =
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
      average >
        bestAverage +
          Number.EPSILON
    ) {
      bestAverage =
        average;

      bestPolicyId =
        policyId;
    }
  }

  if (
    !bestPolicyId
  ) {
    throw new Error(
      "Representation synthesis could not select a partition policy.",
    );
  }

  return bestPolicyId;
}

function thresholdsFor(
  values:
    readonly number[],
): number[] {
  const sorted =
    Array.from(
      new Set(
        values,
      ),
    ).sort(
      (
        left,
        right,
      ) =>
        left -
        right,
    );

  const thresholds:
    number[] =
      [];

  for (
    let index =
      0;
    index <
      sorted.length -
        1;
    index +=
      1
  ) {
    const left =
      sorted[
        index
      ];

    const right =
      sorted[
        index +
          1
      ];

    if (
      left ===
        undefined ||
      right ===
        undefined
    ) {
      continue;
    }

    thresholds.push(
      (
        left +
        right
      ) /
        2,
    );
  }

  return thresholds;
}

function ruleRegret(
  primitive:
    RepresentationPrimitive,

  threshold:
    number,

  lowPolicyId:
    string,

  highPolicyId:
    string,

  examples:
    readonly RepresentationSynthesisExample[],

  binding:
    RepresentationDomainBinding,
): number {
  return examples.reduce(
    (
      total,
      example,
    ) => {
      const value =
        evaluateRepresentationPrimitive(
          primitive,
          example.observation,
          binding,
        );

      const selectedPolicyId =
        value <=
          threshold
          ? lowPolicyId
          : highPolicyId;

      const selectedUtility =
        example
          .policyUtilities[
            selectedPolicyId
          ];

      if (
        selectedUtility ===
          undefined
      ) {
        throw new Error(
          `Policy ${selectedPolicyId} has no utility evidence for a synthesis example.`,
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

export function synthesizeRepresentationRule(
  examples:
    readonly RepresentationSynthesisExample[],

  binding:
    RepresentationDomainBinding,

  roles:
    readonly string[],

  options?: {
    maximumArity?: number;
    penaltyPerExtraRole?: number;
  },
): SynthesizedRepresentationRule {
  if (
    examples.length <
      4
  ) {
    throw new Error(
      "Representation synthesis requires at least four outcome-grounded examples.",
    );
  }

  for (
    const example of
      examples
  ) {
    validateExample(
      example,
    );
  }

  const primitives =
    generateBoundedRepresentationPrimitives(
      roles,
      options?.maximumArity ??
        3,
    );

  const penaltyPerExtraRole =
    options
      ?.penaltyPerExtraRole ??
    0.02;

  let best:
    SynthesizedRepresentationRule |
    undefined;

  for (
    const primitive of
      primitives
  ) {
    const values =
      examples.map(
        (example) =>
          evaluateRepresentationPrimitive(
            primitive,
            example.observation,
            binding,
          ),
      );

    for (
      const threshold of
        thresholdsFor(
          values,
        )
    ) {
      const lowExamples =
        examples.filter(
          (
            example,
            index,
          ) =>
            values[
              index
            ]! <=
            threshold,
        );

      const highExamples =
        examples.filter(
          (
            example,
            index,
          ) =>
            values[
              index
            ]! >
            threshold,
        );

      if (
        lowExamples.length ===
          0 ||
        highExamples.length ===
          0
      ) {
        continue;
      }

      const lowPolicyId =
        bestAveragePolicy(
          lowExamples,
        );

      const highPolicyId =
        bestAveragePolicy(
          highExamples,
        );

      const trainingRegret =
        ruleRegret(
          primitive,
          threshold,
          lowPolicyId,
          highPolicyId,
          examples,
          binding,
        );

      const complexityPenalty =
        Math.max(
          0,
          primitive.complexity -
            1,
        ) *
        penaltyPerExtraRole;

      const objective =
        trainingRegret +
        complexityPenalty;

      const candidate:
        SynthesizedRepresentationRule = {
        primitive,
        threshold,
        lowPolicyId,
        highPolicyId,
        trainingRegret,
        complexityPenalty,
        objective,
      };

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
          candidate.primitive
            .complexity <
            best.primitive
              .complexity
        ) ||
        (
          Math.abs(
            candidate.objective -
            best.objective,
          ) <=
            Number.EPSILON &&
          candidate.primitive
            .complexity ===
            best.primitive
              .complexity &&
          candidate.primitive.id <
            best.primitive.id
        )
      ) {
        best =
          candidate;
      }
    }
  }

  if (
    !best
  ) {
    throw new Error(
      "Bounded representation synthesis could not produce a valid rule.",
    );
  }

  return best;
}

export function evaluateSynthesizedRepresentationRule(
  rule:
    SynthesizedRepresentationRule,

  examples:
    readonly RepresentationSynthesisExample[],

  binding:
    RepresentationDomainBinding,
): RepresentationRuleEvaluation {
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
    validateExample(
      example,
    );

    const value =
      evaluateRepresentationPrimitive(
        rule.primitive,
        example.observation,
        binding,
      );

    const selectedPolicyId =
      value <=
        rule.threshold
        ? rule.lowPolicyId
        : rule.highPolicyId;

    const selectedUtility =
      example
        .policyUtilities[
          selectedPolicyId
        ];

    if (
      selectedUtility ===
        undefined
    ) {
      throw new Error(
        `Transferred representation selected policy ${selectedPolicyId} without utility evidence.`,
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

export class BoundedRepresentationPrimitiveLibrary {
  private readonly entries =
    new Map<
      string,
      RepresentationPrimitiveLibraryEntry
    >();

  private readonly evidence:
    RepresentationPrimitiveTransferEvidence[] =
      [];

  constructor(
    private readonly minimumReusableDomains =
      2,

    private readonly minimumTotalImprovement =
      0.1,

    private readonly retirementNegativeTransferCount =
      2,
  ) {}

  register(
    primitive:
      RepresentationPrimitive,
  ): void {
    if (
      this.entries.has(
        primitive.id,
      )
    ) {
      return;
    }

    this.entries.set(
      primitive.id,
      {
        primitiveId:
          primitive.id,

        status:
          "candidate",

        domainsEvaluated:
          0,

        positiveTransfers:
          0,

        negativeTransfers:
          0,

        cumulativeImprovement:
          0,
      },
    );
  }

  recordTransfer(
    evidence:
      RepresentationPrimitiveTransferEvidence,
  ): RepresentationPrimitiveLibraryEntry {
    const entry =
      this.entries.get(
        evidence.primitiveId,
      );

    if (
      !entry
    ) {
      throw new Error(
        `Representation primitive ${evidence.primitiveId} must be registered before transfer evidence is recorded.`,
      );
    }

    if (
      entry.status ===
        "quarantined" ||
      entry.status ===
        "retired"
    ) {
      throw new Error(
        `Representation primitive ${evidence.primitiveId} is terminally ${entry.status}; refusing further transfer updates.`,
      );
    }

    if (
      !evidence.domainId.trim()
    ) {
      throw new Error(
        "Representation transfer evidence requires a non-empty domain id.",
      );
    }

    if (
      !Number.isFinite(
        evidence.baselineRegret,
      ) ||
      !Number.isFinite(
        evidence.primitiveRegret,
      ) ||
      evidence.baselineRegret <
        0 ||
      evidence.primitiveRegret <
        0
    ) {
      throw new Error(
        "Representation transfer regret values must be finite and non-negative.",
      );
    }

    const expectedImprovement =
      evidence.baselineRegret -
      evidence.primitiveRegret;

    if (
      !Number.isFinite(
        evidence.improvement,
      ) ||
      Math.abs(
        evidence.improvement -
        expectedImprovement,
      ) >
        1e-9
    ) {
      throw new Error(
        "Representation transfer improvement must equal baseline regret minus primitive regret.",
      );
    }

    if (
      !Number.isInteger(
        evidence.unsafeIrreversibleActions,
      ) ||
      evidence.unsafeIrreversibleActions <
        0 ||
      !Number.isInteger(
        evidence.falsePromotions,
      ) ||
      evidence.falsePromotions <
        0
    ) {
      throw new Error(
        "Representation transfer safety counts must be non-negative integers.",
      );
    }

    this.evidence.push({
      ...evidence,
    });

    entry.domainsEvaluated +=
      1;

    entry.cumulativeImprovement +=
      evidence.improvement;

    if (
      evidence.improvement >
        Number.EPSILON
    ) {
      entry.positiveTransfers +=
        1;
    } else if (
      evidence.improvement <
        -Number.EPSILON
    ) {
      entry.negativeTransfers +=
        1;
    }

    if (
      evidence
        .unsafeIrreversibleActions >
        0 ||
      evidence.falsePromotions >
        0
    ) {
      entry.status =
        "quarantined";

      return {
        ...entry,
      };
    }

    if (
      entry.negativeTransfers >=
        this.retirementNegativeTransferCount &&
      entry.cumulativeImprovement <=
        0
    ) {
      entry.status =
        "retired";

      return {
        ...entry,
      };
    }

    if (
      entry.domainsEvaluated >=
        this.minimumReusableDomains &&
      entry.positiveTransfers >=
        this.minimumReusableDomains &&
      entry.cumulativeImprovement >=
        this.minimumTotalImprovement
    ) {
      entry.status =
        "reusable";
    }

    return {
      ...entry,
    };
  }

  getAuditSummary():
    RepresentationPrimitiveLibraryAudit {
    return {
      entries:
        Array.from(
          this.entries.values(),
        ).map(
          (entry) => ({
            ...entry,
          }),
        ),

      evidence:
        this.evidence.map(
          (item) => ({
            ...item,
          }),
        ),
    };
  }
}

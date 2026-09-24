import { describe, expect, it } from "vitest";

import {
  archiveAndAdvanceStructuralFamily,
  chooseMultiGenerationStructuralAdaptation,
  inferStructuralChangePoint,
  type SequencedStructuralEvidence,
  type StructuralFamilyGeneration,
} from "./change-point-multi-generation-adaptation";

import type { HierarchicalCausalProgram } from "./hierarchical-causal-program";

function program(id: string, coefficient: number): HierarchicalCausalProgram {
  return {
    id,
    baseEffects: {},
    fragments: [
      {
        id: `${id}:x`,
        sourceMechanismId: `${id}:source`,
        terms: [
          {
            kind: "linear",
            variables: ["x"],
            coefficient,
          },
        ],
        validationEvidenceIds: [`${id}:validated`],
      },
    ],
    depth: 2,
    complexity: 1,
  };
}

function evidence(
  prefix: string,
  start: number,
  coefficient: number,
  count: number,
): SequencedStructuralEvidence[] {
  return Array.from({ length: count }, (_, index) => {
    const x = 0.25 + (index % 4) * 0.25;
    return {
      sequence: start + index,
      observation: {
        measuredEffect: coefficient * x,
        experiment: {
          id: `${prefix}-${index + 1}`,
          interventions: { x },
          expectedInformationGain: 0.2,
          risk: 0.01,
          cost: 0.01,
          reversible: true,
        },
      },
    };
  });
}

function family(
  familyId: string,
  generation: number,
  coefficient: number,
  status: "active" | "archived",
  parentFamilyId?: string,
): StructuralFamilyGeneration {
  return {
    familyId,
    generation,
    parentFamilyId,
    program: program(familyId, coefficient),
    protectedEvidenceIds: [],
    status,
  };
}

describe("change-point-aware multi-generation structural adaptation", () => {
  it("distinguishes persistent regime change from small noisy contradiction", () => {
    const active = program("A", 0.4);
    const stable = [
      ...evidence("a", 0, 0.4, 4),
      ...evidence("noise", 4, 0.405, 4),
    ];

    expect(
      inferStructuralChangePoint(active, stable, {
        ambiguityMargin: 0,
      }).decision,
    ).toBe("stable");

    const changed = [
      ...evidence("a", 0, 0.4, 4),
      ...evidence("b", 4, 0.9, 4),
    ];

    const assessment = inferStructuralChangePoint(active, changed, {
      ambiguityMargin: 0,
    });
    expect(assessment.decision).toBe("change-point");
    expect(assessment.changeSequence).toBe(4);
    expect(assessment.preChangeEvidenceIds).toEqual([
      "a-1",
      "a-2",
      "a-3",
      "a-4",
    ]);
    expect(assessment.postChangeEvidenceIds).toEqual([
      "b-1",
      "b-2",
      "b-3",
      "b-4",
    ]);
  });

  it("resurrects archived A after A to B to C to A without contaminating selection with stale evidence", () => {
    const A = family("family-A", 1, 0.4, "archived");
    const B = family("family-B", 2, 0.7, "archived", "family-A");
    const C = family("family-C", 3, 1.0, "active", "family-B");

    const recent = [
      ...evidence("c-old", 20, 1.0, 4),
      ...evidence("a-return", 24, 0.4, 4),
    ];
    const freshProtected = evidence("protected-a", 100, 0.4, 4);

    const decision = chooseMultiGenerationStructuralAdaptation(
      C,
      [A, B],
      recent,
      freshProtected,
      {
        ambiguityMargin: 0,
        familyTemperature: 0.005,
      },
    );

    expect(decision.decision).toBe("resurrect-archived");
    expect(decision.selectedFamilyId).toBe("family-A");
    expect(decision.selectedGeneration).toBe(1);
    expect(decision.synthesisEvidenceIds).toEqual([
      "a-return-1",
      "a-return-2",
      "a-return-3",
      "a-return-4",
    ]);
    expect(decision.synthesisEvidenceIds).not.toContain("c-old-1");
    expect(decision.familyPosteriors[0]?.familyId).toBe("family-A");
  });

  it("requests bounded synthesis when no retained family explains the fresh regime", () => {
    const A = family("family-A", 1, 0.4, "archived");
    const B = family("family-B", 2, 0.7, "active", "family-A");

    const recent = [
      ...evidence("b-old", 0, 0.7, 4),
      ...evidence("novel", 4, 1.25, 4),
    ];
    const freshProtected = evidence("protected-novel", 100, 1.25, 4);

    const decision = chooseMultiGenerationStructuralAdaptation(
      B,
      [A],
      recent,
      freshProtected,
      {
        ambiguityMargin: 0,
        familyTemperature: 0.005,
      },
    );

    expect(decision.decision).toBe("synthesize-new");
    expect(decision.reason).toBe("no-retained-family-adequate");
    expect(decision.synthesisEvidenceIds).toEqual([
      "novel-1",
      "novel-2",
      "novel-3",
      "novel-4",
    ]);
  });

  it("abstains when fresh protected evidence cannot separate retained families", () => {
    const A = family("family-A", 1, 0.4, "archived");
    const B = family("family-B", 2, 0.42, "archived", "family-A");
    const C = family("family-C", 3, 1.0, "active", "family-B");

    const recent = [
      ...evidence("c-old", 0, 1.0, 4),
      ...evidence("return", 4, 0.41, 4),
    ];
    const freshProtected = evidence("protected-return", 100, 0.41, 4);

    const decision = chooseMultiGenerationStructuralAdaptation(
      C,
      [A, B],
      recent,
      freshProtected,
      {
        ambiguityMargin: 0,
        familyTemperature: 0.05,
        minimumFamilyPosterior: 0.45,
        minimumFamilyPosteriorGap: 0.2,
      },
    );

    expect(decision.decision).toBe("abstained");
    expect(decision.reason).toBe("family-posterior-ambiguous");
  });

  it("fails closed if synthesis and protected family-selection evidence overlap", () => {
    const A = family("family-A", 1, 0.4, "archived");
    const B = family("family-B", 2, 0.9, "active", "family-A");
    const recent = [
      ...evidence("b-old", 0, 0.9, 4),
      ...evidence("a-return", 4, 0.4, 4),
    ];

    expect(() =>
      chooseMultiGenerationStructuralAdaptation(
        B,
        [A],
        recent,
        recent.slice(4),
        { ambiguityMargin: 0 },
      ),
    ).toThrow(/disjoint/);
  });

  it("advances ancestry without mutating the archived generation", () => {
    const A = family("family-A", 1, 0.4, "active");
    const advanced = archiveAndAdvanceStructuralFamily(
      A,
      "family-B",
      program("family-B", 0.7),
      ["protected-b-1", "protected-b-2"],
    );

    expect(advanced.archived.status).toBe("archived");
    expect(advanced.archived.generation).toBe(1);
    expect(advanced.active.status).toBe("active");
    expect(advanced.active.generation).toBe(2);
    expect(advanced.active.parentFamilyId).toBe("family-A");
    expect(advanced.active.protectedEvidenceIds).toEqual([
      "protected-b-1",
      "protected-b-2",
    ]);
  });
});

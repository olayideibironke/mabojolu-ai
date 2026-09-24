import { describe, expect, it, vi } from "vitest";

vi.mock(
  "./automatic-bounded-structural-resynthesis",
  () => ({
    runControlledAutomaticStructuralRecovery:
      vi.fn(() => ({
        decision: "resolved",
        resynthesis: {
          decision: "resynthesized",
        },
        reason: "resynthesized-family-resolved",
      })),
  }),
);

import {
  runControlledAutomaticStructuralRecovery,
} from "./automatic-bounded-structural-resynthesis";

import {
  runChangePointAwareStructuralRecovery,
} from "./change-point-aware-structural-recovery";

import type {
  AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import type {
  HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import type {
  SequencedStructuralEvidence,
  StructuralFamilyGeneration,
} from "./change-point-multi-generation-adaptation";

function program(
  id: string,
  coefficient: number,
): HierarchicalCausalProgram {
  return {
    id,
    baseEffects: {},
    fragments: [
      {
        id: `${id}:x`,
        sourceMechanismId: `${id}:source`,
        terms: [
          {
            id: `${id}:x:linear`,
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

function family(
  id: string,
  generation: number,
  coefficient: number,
  status: "active" | "archived",
): StructuralFamilyGeneration {
  return {
    familyId: id,
    generation,
    program: program(id, coefficient),
    protectedEvidenceIds: [],
    status,
  };
}

function evidence(
  prefix: string,
  start: number,
  coefficient: number,
  count = 4,
): SequencedStructuralEvidence[] {
  return Array.from(
    { length: count },
    (_, index) => {
      const x =
        0.25 +
        (index % 4) * 0.25;

      return {
        sequence:
          start + index,
        observation: {
          measuredEffect:
            coefficient * x,
          experiment: {
            id:
              `${prefix}-${index + 1}`,
            interventions: { x },
            expectedInformationGain: 0.2,
            risk: 0.01,
            cost: 0.01,
            reversible: true,
          },
        },
      };
    },
  );
}

function collapse(
  observations: SequencedStructuralEvidence[],
): AdaptivePrunedStructuralDiagnosisResult {
  return {
    decision: "reopen-search",
    allEvidence:
      observations.map(
        (entry) =>
          entry.observation,
      ),
  } as AdaptivePrunedStructuralDiagnosisResult;
}

describe("change-point-aware structural recovery integration", () => {
  it("resurrects a protected archived family without invoking v1.36 synthesis", () => {
    vi.mocked(
      runControlledAutomaticStructuralRecovery,
    ).mockClear();

    const A =
      family(
        "family-A",
        1,
        0.4,
        "archived",
      );

    const C =
      family(
        "family-C",
        3,
        1,
        "active",
      );

    const recent = [
      ...evidence(
        "c-old",
        0,
        1,
      ),
      ...evidence(
        "a-return",
        4,
        0.4,
      ),
    ];

    const protectedEvidence =
      evidence(
        "protected-a",
        100,
        0.4,
      );

    const result =
      runChangePointAwareStructuralRecovery(
        {
          activeFamily: C,
          archivedFamilies: [A],
          evidence: recent,
          protectedEvidence,
          failedCandidates: [],
          collapse:
            collapse(
              recent.slice(4),
            ),
          actualProgram:
            A.program,
        },
        {
          adaptation: {
            ambiguityMargin: 0,
            familyTemperature: 0.005,
          },
        },
      );

    expect(
      result.decision,
    ).toBe(
      "resurrect-archived",
    );

    expect(
      result.selectedFamily?.familyId,
    ).toBe(
      "family-A",
    );

    expect(
      result.selectedFamily?.protectedEvidenceIds,
    ).toEqual(
      protectedEvidence.map(
        (entry) =>
          entry.observation.experiment.id,
      ),
    );

    expect(
      runControlledAutomaticStructuralRecovery,
    ).not.toHaveBeenCalled();
  });

  it("routes a novel post-change regime into the existing bounded v1.36 recovery loop", () => {
    vi.mocked(
      runControlledAutomaticStructuralRecovery,
    ).mockClear();

    const A =
      family(
        "family-A",
        1,
        0.4,
        "archived",
      );

    const B =
      family(
        "family-B",
        2,
        0.7,
        "active",
      );

    const old =
      evidence(
        "b-old",
        0,
        0.7,
      );

    const novel =
      evidence(
        "novel",
        4,
        1.25,
      );

    const protectedEvidence =
      evidence(
        "protected-novel",
        100,
        1.25,
      );

    const result =
      runChangePointAwareStructuralRecovery(
        {
          activeFamily: B,
          archivedFamilies: [A],
          evidence: [
            ...old,
            ...novel,
          ],
          protectedEvidence,
          failedCandidates: [],
          collapse:
            collapse(
              novel,
            ),
          actualProgram:
            program(
              "actual-novel",
              1.25,
            ),
        },
        {
          adaptation: {
            ambiguityMargin: 0,
            familyTemperature: 0.005,
          },
        },
      );

    expect(
      result.decision,
    ).toBe(
      "synthesized-recovery",
    );

    expect(
      runControlledAutomaticStructuralRecovery,
    ).toHaveBeenCalledTimes(
      1,
    );

    const call =
      vi.mocked(
        runControlledAutomaticStructuralRecovery,
      ).mock.calls[0]!;

    expect(
      call[3],
    ).toBe(
      "family-B",
    );

    expect(
      call[4],
    ).toBe(
      3,
    );

    expect(
      call[6],
    ).toEqual(
      protectedEvidence.map(
        (entry) =>
          entry.observation.experiment.id,
      ),
    );
  });

  it("fails closed if stale pre-change evidence reaches the synthesis collapse", () => {
    const A =
      family(
        "family-A",
        1,
        0.4,
        "archived",
      );

    const B =
      family(
        "family-B",
        2,
        0.7,
        "active",
      );

    const old =
      evidence(
        "b-old",
        0,
        0.7,
      );

    const novel =
      evidence(
        "novel",
        4,
        1.25,
      );

    expect(() =>
      runChangePointAwareStructuralRecovery(
        {
          activeFamily: B,
          archivedFamilies: [A],
          evidence: [
            ...old,
            ...novel,
          ],
          protectedEvidence:
            evidence(
              "protected-novel",
              100,
              1.25,
            ),
          failedCandidates: [],
          collapse:
            collapse([
              old[0]!,
              ...novel,
            ]),
          actualProgram:
            program(
              "actual-novel",
              1.25,
            ),
        },
        {
          adaptation: {
            ambiguityMargin: 0,
            familyTemperature: 0.005,
          },
        },
      ),
    ).toThrow(
      /only post-change evidence/,
    );
  });
});

import { describe, expect, it } from "vitest";

import type { SemanticMemory } from "./memory-consolidation";
import { reviseSemanticMemory } from "./semantic-memory-revision";

const memory: SemanticMemory = {
  id: "semantic-feedback",
  kind: "semantic",
  statement: "Delayed feedback destabilizes adaptive systems.",
  confidence: 0.9,
  derivedFromIds: ["obs-1", "obs-2"],
  domains: ["controls"],
  consolidatedAt: "2026-09-25T20:00:00.000Z",
};

describe("semantic memory revision", () => {
  it("weakens knowledge when later evidence contradicts it", () => {
    const revision = reviseSemanticMemory({
      memory,
      contradictingEvidenceIds: ["obs-3"],
      revisedConfidence: 0.55,
      revisionReason: "A later controlled observation contradicted the rule.",
      revisedAt: "2026-09-25T21:00:00.000Z",
    });

    expect(revision.status).toBe("weakened");
    expect(revision.previous.confidence).toBe(0.9);
    expect(revision.current.confidence).toBe(0.55);
    expect(revision.current.derivedFromIds).toEqual([
      "obs-1",
      "obs-2",
      "obs-3",
    ]);
    expect(revision.contradictingEvidenceIds).toEqual(["obs-3"]);
  });

  it("revises the proposition while preserving the previous memory", () => {
    const revision = reviseSemanticMemory({
      memory,
      supportingEvidenceIds: ["obs-4"],
      contradictingEvidenceIds: ["obs-3"],
      revisedStatement:
        "Delayed feedback can destabilize adaptive systems under high gain.",
      revisedConfidence: 0.82,
      revisionReason: "New evidence narrowed the scope of the rule.",
      revisedAt: "2026-09-25T21:00:00.000Z",
    });

    expect(revision.status).toBe("revised");
    expect(revision.previous.statement).toBe(
      "Delayed feedback destabilizes adaptive systems.",
    );
    expect(revision.current.statement).toContain("under high gain");
  });

  it("can retract a semantic memory without deleting its history", () => {
    const revision = reviseSemanticMemory({
      memory,
      contradictingEvidenceIds: ["obs-5", "obs-6"],
      revisedConfidence: 0,
      revisionReason: "Independent later evidence falsified the rule.",
      revisedAt: "2026-09-25T21:00:00.000Z",
    });

    expect(revision.status).toBe("retracted");
    expect(revision.current.confidence).toBe(0);
    expect(revision.previous.confidence).toBe(0.9);
    expect(revision.current.derivedFromIds).toEqual([
      "obs-1",
      "obs-2",
      "obs-5",
      "obs-6",
    ]);
  });

  it("refuses unsupported semantic change", () => {
    expect(() =>
      reviseSemanticMemory({
        memory,
        revisedStatement: "A completely different rule.",
        revisedConfidence: 0.5,
        revisionReason: "No evidence.",
        revisedAt: "2026-09-25T21:00:00.000Z",
      }),
    ).toThrow(/cannot change without revision evidence/);
  });

  it("rejects evidence assigned to both sides of the revision", () => {
    expect(() =>
      reviseSemanticMemory({
        memory,
        supportingEvidenceIds: ["obs-3"],
        contradictingEvidenceIds: ["obs-3"],
        revisedConfidence: 0.7,
        revisionReason: "Ambiguous evidence.",
        revisedAt: "2026-09-25T21:00:00.000Z",
      }),
    ).toThrow(/cannot both support and contradict/);
  });
});

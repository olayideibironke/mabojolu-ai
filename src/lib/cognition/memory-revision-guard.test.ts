import { describe, expect, it } from "vitest";

import type { SemanticMemory } from "./memory-consolidation";
import { guardSemanticMemoryRevision } from "./memory-revision-guard";

const memory: SemanticMemory = {
  id: "semantic-1",
  kind: "semantic",
  statement: "Repeated evidence established the current rule.",
  confidence: 0.9,
  derivedFromIds: ["obs-1", "obs-2"],
  domains: ["controls"],
  consolidatedAt: "2026-09-26T12:00:00.000Z",
};

describe("semantic memory revision contamination guard", () => {
  it("accepts independent current evidence", () => {
    const result = guardSemanticMemoryRevision({
      memory,
      evidence: [
        {
          id: "obs-3",
          sourceId: "experiment-a",
          observedAt: "2026-09-26T13:00:00.000Z",
        },
        {
          id: "obs-4",
          sourceId: "experiment-b",
          observedAt: "2026-09-26T13:05:00.000Z",
        },
      ],
    });

    expect(result.acceptedEvidenceIds).toEqual(["obs-3", "obs-4"]);
    expect(result.independentSourceCount).toBe(2);
  });

  it("rejects duplicate evidence masquerading as repetition", () => {
    expect(() =>
      guardSemanticMemoryRevision({
        memory,
        evidence: [
          {
            id: "obs-3",
            sourceId: "experiment-a",
            observedAt: "2026-09-26T13:00:00.000Z",
          },
          {
            id: "obs-3",
            sourceId: "experiment-b",
            observedAt: "2026-09-26T13:01:00.000Z",
          },
        ],
      }),
    ).toThrow(/Duplicate memory revision evidence/);
  });

  it("rejects correlated observations from one source by default", () => {
    expect(() =>
      guardSemanticMemoryRevision({
        memory,
        evidence: [
          {
            id: "obs-3",
            sourceId: "same-artifact",
            observedAt: "2026-09-26T13:00:00.000Z",
          },
          {
            id: "obs-4",
            sourceId: "same-artifact",
            observedAt: "2026-09-26T13:01:00.000Z",
          },
        ],
      }),
    ).toThrow(/at least 2 independent evidence sources/);
  });

  it("rejects stale evidence", () => {
    expect(() =>
      guardSemanticMemoryRevision({
        memory,
        evidence: [
          {
            id: "obs-old",
            sourceId: "archive-a",
            observedAt: "2026-09-20T13:00:00.000Z",
            stale: true,
          },
          {
            id: "obs-new",
            sourceId: "experiment-b",
            observedAt: "2026-09-26T13:00:00.000Z",
          },
        ],
      }),
    ).toThrow(/Stale evidence/);
  });

  it("protects held-out evidence from live memory mutation", () => {
    expect(() =>
      guardSemanticMemoryRevision({
        memory,
        evidence: [
          {
            id: "protected-1",
            sourceId: "validation-set",
            observedAt: "2026-09-26T13:00:00.000Z",
            protected: true,
          },
          {
            id: "obs-4",
            sourceId: "experiment-b",
            observedAt: "2026-09-26T13:05:00.000Z",
          },
        ],
      }),
    ).toThrow(/Protected evidence/);
  });
});

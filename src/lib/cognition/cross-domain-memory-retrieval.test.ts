import { describe, expect, it } from "vitest";

import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";
import { retrieveSemanticMemory } from "./cross-domain-memory-retrieval";

const episode: AutobiographicalMemory = {
  id: "episode-controls",
  kind: "autobiographical",
  summary: "Mabojolu observed repeated control-system failures.",
  observationIds: ["obs-controls-1", "obs-controls-2"],
  outcomeIds: [],
  learningIds: [],
  occurredAt: "2026-09-25T20:00:00.000Z",
  consolidatedAt: "2026-09-25T21:00:00.000Z",
};

const memories: SemanticMemory[] = [
  {
    id: "semantic-feedback",
    kind: "semantic",
    statement:
      "Delayed feedback can destabilize adaptive control systems.",
    confidence: 0.9,
    derivedFromIds: ["obs-controls-1", "obs-controls-2"],
    domains: ["controls"],
    consolidatedAt: "2026-09-25T21:00:00.000Z",
  },
  {
    id: "semantic-temperature",
    kind: "semantic",
    statement: "Temperature sensors require calibration.",
    confidence: 0.8,
    derivedFromIds: ["obs-temp"],
    domains: ["instrumentation"],
    consolidatedAt: "2026-09-25T21:00:00.000Z",
  },
];

describe("cross-domain semantic memory retrieval", () => {
  it("retrieves structurally relevant knowledge outside its original domain", () => {
    const result = retrieveSemanticMemory({
      query: {
        terms: ["feedback", "adaptive"],
        domains: ["robotics"],
      },
      semantic: memories,
      autobiographical: [episode],
    });

    expect(result).toHaveLength(1);
    expect(result[0].memory.id).toBe("semantic-feedback");
    expect(result[0].matchedDomains).toEqual([]);
    expect(result[0].matchedTerms).toEqual(["feedback", "adaptive"]);
    expect(result[0].supportingEpisodes.map((entry) => entry.id)).toEqual([
      "episode-controls",
    ]);
  });

  it("uses domain match without requiring exact original context wording", () => {
    const result = retrieveSemanticMemory({
      query: { terms: [], domains: ["instrumentation"] },
      semantic: memories,
    });

    expect(result[0].memory.id).toBe("semantic-temperature");
    expect(result[0].matchedDomains).toEqual(["instrumentation"]);
  });

  it("does not retrieve unrelated memories merely because confidence is high", () => {
    const result = retrieveSemanticMemory({
      query: {
        terms: ["contract"],
        domains: ["legal"],
      },
      semantic: memories,
    });

    expect(result).toEqual([]);
  });

  it("ranks relevant memories deterministically and respects limits", () => {
    const result = retrieveSemanticMemory({
      query: {
        terms: ["feedback"],
        limit: 1,
      },
      semantic: [
        ...memories,
        {
          id: "semantic-feedback-low",
          kind: "semantic",
          statement: "Feedback is useful.",
          confidence: 0.4,
          derivedFromIds: ["obs-other"],
          domains: ["general"],
          consolidatedAt: "2026-09-25T21:00:00.000Z",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].memory.id).toBe("semantic-feedback");
  });

  it("fails closed on an empty retrieval query", () => {
    expect(() =>
      retrieveSemanticMemory({
        query: { terms: [] },
        semantic: memories,
      }),
    ).toThrow(/requires terms or domains/);
  });
});

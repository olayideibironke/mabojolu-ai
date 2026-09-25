import { describe, expect, it } from "vitest";

import {
  consolidateAutobiographicalMemory,
  consolidateCognitiveStateMemory,
  consolidateSemanticMemory,
} from "./memory-consolidation";
import { createCognitiveState, reduceCognitiveState } from "./state";

describe("persistent memory consolidation", () => {
  it("keeps autobiographical experience separate from semantic knowledge", () => {
    const observation = {
      id: "obs-1",
      source: "environment" as const,
      content: "The red switch produced output A.",
      observedAt: "2026-09-25T21:00:00.000Z",
      metadata: { domain: "controls" },
    };

    const episode = consolidateAutobiographicalMemory({
      id: "episode-1",
      summary: "Mabojolu tested the red switch.",
      observations: [observation],
      occurredAt: observation.observedAt,
      consolidatedAt: "2026-09-25T22:00:00.000Z",
    });

    const semantic = consolidateSemanticMemory({
      id: "semantic-1",
      statement: "The red switch tends to produce output A.",
      beliefs: [
        {
          id: "belief-1",
          proposition: "The red switch produces output A.",
          confidence: 0.8,
          status: "active",
          evidenceIds: ["obs-1"],
          updatedAt: "2026-09-25T21:01:00.000Z",
        },
      ],
      observations: [observation],
      confidence: 0.8,
      consolidatedAt: "2026-09-25T22:00:00.000Z",
    });

    expect(episode.kind).toBe("autobiographical");
    expect(episode.observationIds).toEqual(["obs-1"]);
    expect(semantic.kind).toBe("semantic");
    expect(semantic.derivedFromIds).toEqual(["obs-1"]);
    expect(semantic.domains).toEqual(["controls"]);
  });

  it("consolidates only provenance that exists in cognitive state", () => {
    let state = createCognitiveState("2026-09-25T20:00:00.000Z");
    state = reduceCognitiveState(state, {
      type: "observation.recorded",
      observation: {
        id: "obs-1",
        source: "tool",
        content: "A Maryland record reports value 42.",
        observedAt: "2026-09-25T21:00:00.000Z",
        metadata: { domain: "records" },
      },
    });
    state = reduceCognitiveState(state, {
      type: "belief.updated",
      belief: {
        id: "belief-1",
        proposition: "The reported value is 42.",
        confidence: 0.9,
        status: "active",
        evidenceIds: ["obs-1"],
        updatedAt: "2026-09-25T21:01:00.000Z",
      },
    });

    const memory = consolidateCognitiveStateMemory({
      state,
      autobiographical: {
        id: "episode-1",
        summary: "Mabojolu inspected the record.",
        observationIds: ["obs-1"],
        occurredAt: "2026-09-25T21:00:00.000Z",
      },
      semantic: {
        id: "semantic-1",
        statement: "The record reports value 42.",
        beliefIds: ["belief-1"],
        confidence: 0.9,
      },
      consolidatedAt: "2026-09-25T22:00:00.000Z",
    });

    expect(memory.autobiographical[0].observationIds).toEqual(["obs-1"]);
    expect(memory.semantic[0].derivedFromIds).toEqual(["obs-1"]);
    expect(memory.semantic[0].domains).toEqual(["records"]);
  });

  it("fails closed when semantic knowledge loses its provenance", () => {
    expect(() =>
      consolidateSemanticMemory({
        id: "semantic-1",
        statement: "Unsupported knowledge.",
        confidence: 0.8,
        consolidatedAt: "2026-09-25T22:00:00.000Z",
      }),
    ).toThrow(/requires belief or learning provenance/);
  });

  it("fails closed when state consolidation references unknown evidence", () => {
    expect(() =>
      consolidateCognitiveStateMemory({
        state: createCognitiveState("2026-09-25T20:00:00.000Z"),
        autobiographical: {
          id: "episode-1",
          summary: "Unknown experience.",
          observationIds: ["missing"],
          occurredAt: "2026-09-25T21:00:00.000Z",
        },
        consolidatedAt: "2026-09-25T22:00:00.000Z",
      }),
    ).toThrow(/Unknown observation missing/);
  });
});

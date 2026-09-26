import { describe, expect, it } from "vitest";

import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";
import {
  createPersistentMemoryStore,
  recordPersistentMemories,
  replayPersistentMemoryRevisions,
  retrievePersistentMemory,
  revisePersistentSemanticMemory,
} from "./persistent-memory-lifecycle";

const episode: AutobiographicalMemory = {
  id: "episode-controls",
  kind: "autobiographical",
  summary: "Observed delayed feedback in a control experiment.",
  observationIds: ["obs-1", "obs-2"],
  outcomeIds: [],
  learningIds: [],
  occurredAt: "2026-09-26T12:00:00.000Z",
  consolidatedAt: "2026-09-26T13:00:00.000Z",
};

const semantic: SemanticMemory = {
  id: "semantic-feedback",
  kind: "semantic",
  statement: "Delayed feedback can destabilize adaptive systems.",
  confidence: 0.9,
  derivedFromIds: ["obs-1", "obs-2"],
  domains: ["controls"],
  consolidatedAt: "2026-09-26T13:00:00.000Z",
};

describe("persistent memory lifecycle", () => {
  it("records episodes and semantic knowledge without conflating them", () => {
    const store = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });

    expect(store.autobiographical).toEqual([episode]);
    expect(store.semantic).toEqual([semantic]);
    expect(store.revisions).toEqual([]);
  });

  it("retrieves prior knowledge in a new domain with original episode provenance", () => {
    const store = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });

    const result = retrievePersistentMemory({
      store,
      query: {
        terms: ["feedback", "adaptive"],
        domains: ["robotics"],
      },
    });

    expect(result[0].memory.id).toBe("semantic-feedback");
    expect(result[0].supportingEpisodes[0].id).toBe("episode-controls");
  });

  it("revises persistent knowledge and preserves auditable lineage", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });

    const revised = revisePersistentSemanticMemory({
      store: initial,
      memoryId: "semantic-feedback",
      contradictingEvidenceIds: ["obs-3"],
      revisedStatement:
        "Delayed feedback can destabilize adaptive systems under high gain.",
      revisedConfidence: 0.7,
      revisionReason: "A later robotics experiment narrowed the rule.",
      revisedAt: "2026-09-26T14:00:00.000Z",
    });

    expect(revised.semantic[0].statement).toContain("under high gain");
    expect(revised.revisions).toHaveLength(1);
    expect(revised.revisions[0].previous).toEqual(semantic);
    expect(revised.revisions[0].current).toEqual(revised.semantic[0]);
    expect(initial.semantic[0]).toEqual(semantic);
  });

  it("replays revision history deterministically", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });
    const first = revisePersistentSemanticMemory({
      store: initial,
      memoryId: "semantic-feedback",
      contradictingEvidenceIds: ["obs-3"],
      revisedConfidence: 0.6,
      revisionReason: "Contradictory evidence.",
      revisedAt: "2026-09-26T14:00:00.000Z",
    });
    const second = revisePersistentSemanticMemory({
      store: first,
      memoryId: "semantic-feedback",
      contradictingEvidenceIds: ["obs-4"],
      revisedConfidence: 0,
      revisionReason: "Independent falsification.",
      revisedAt: "2026-09-26T15:00:00.000Z",
    });

    expect(
      replayPersistentMemoryRevisions({
        initialMemory: semantic,
        revisions: second.revisions,
      }),
    ).toEqual(second.semantic[0]);
    expect(
      retrievePersistentMemory({
        store: second,
        query: { terms: ["feedback"] },
      }),
    ).toEqual([]);
  });

  it("fails closed on duplicate global memory identity", () => {
    expect(() =>
      recordPersistentMemories({
        store: createPersistentMemoryStore(),
        autobiographical: [episode],
        semantic: [{ ...semantic, id: episode.id }],
      }),
    ).toThrow(/globally unique/);
  });

  it("detects revision lineage divergence during replay", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });
    const revised = revisePersistentSemanticMemory({
      store: initial,
      memoryId: "semantic-feedback",
      contradictingEvidenceIds: ["obs-3"],
      revisedConfidence: 0.5,
      revisionReason: "Contradiction.",
      revisedAt: "2026-09-26T14:00:00.000Z",
    });

    expect(() =>
      replayPersistentMemoryRevisions({
        initialMemory: { ...semantic, confidence: 0.8 },
        revisions: revised.revisions,
      }),
    ).toThrow(/lineage diverged/);
  });
});

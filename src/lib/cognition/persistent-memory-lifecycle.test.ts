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

function evidence(id: string, sourceId: string, observedAt: string) {
  return { id, sourceId, observedAt };
}

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

  it("revises persistent knowledge only after guarded independent evidence", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });

    const revised = revisePersistentSemanticMemory({
      store: initial,
      memoryId: "semantic-feedback",
      evidence: [
        evidence("obs-3", "robotics-a", "2026-09-26T13:30:00.000Z"),
        evidence("obs-4", "robotics-b", "2026-09-26T13:35:00.000Z"),
      ],
      contradictingEvidenceIds: ["obs-3", "obs-4"],
      revisedStatement:
        "Delayed feedback can destabilize adaptive systems under high gain.",
      revisedConfidence: 0.7,
      revisionReason: "Later robotics experiments narrowed the rule.",
      revisedAt: "2026-09-26T14:00:00.000Z",
    });

    expect(revised.semantic[0].statement).toContain("under high gain");
    expect(revised.revisions).toHaveLength(1);
    expect(revised.revisions[0].previous).toEqual(semantic);
    expect(revised.revisions[0].current).toEqual(revised.semantic[0]);
    expect(initial.semantic[0]).toEqual(semantic);
  });

  it("prevents callers from bypassing the contamination guard", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });

    expect(() =>
      revisePersistentSemanticMemory({
        store: initial,
        memoryId: "semantic-feedback",
        evidence: [
          evidence("obs-3", "same-source", "2026-09-26T13:30:00.000Z"),
          evidence("obs-4", "same-source", "2026-09-26T13:31:00.000Z"),
        ],
        contradictingEvidenceIds: ["obs-3", "obs-4"],
        revisedConfidence: 0.5,
        revisionReason: "Correlated evidence.",
        revisedAt: "2026-09-26T14:00:00.000Z",
      }),
    ).toThrow(/at least 2 independent evidence sources/);

    expect(initial.semantic[0]).toEqual(semantic);
    expect(initial.revisions).toEqual([]);
  });

  it("rejects revision ids that were not supplied to the guard", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });

    expect(() =>
      revisePersistentSemanticMemory({
        store: initial,
        memoryId: "semantic-feedback",
        evidence: [
          evidence("obs-3", "source-a", "2026-09-26T13:30:00.000Z"),
          evidence("obs-4", "source-b", "2026-09-26T13:31:00.000Z"),
        ],
        contradictingEvidenceIds: ["obs-3", "missing"],
        revisedConfidence: 0.5,
        revisionReason: "Unsupplied evidence.",
        revisedAt: "2026-09-26T14:00:00.000Z",
      }),
    ).toThrow(/was not supplied to the memory contamination guard/);
  });

  it("replays revision history deterministically", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });
    const first = revisePersistentSemanticMemory({
      store: initial,
      memoryId: "semantic-feedback",
      evidence: [
        evidence("obs-3", "experiment-a", "2026-09-26T13:30:00.000Z"),
        evidence("obs-3b", "experiment-b", "2026-09-26T13:35:00.000Z"),
      ],
      contradictingEvidenceIds: ["obs-3", "obs-3b"],
      revisedConfidence: 0.6,
      revisionReason: "Independent contradictory evidence.",
      revisedAt: "2026-09-26T14:00:00.000Z",
    });
    const second = revisePersistentSemanticMemory({
      store: first,
      memoryId: "semantic-feedback",
      evidence: [
        evidence("obs-4", "experiment-c", "2026-09-26T14:30:00.000Z"),
        evidence("obs-4b", "experiment-d", "2026-09-26T14:35:00.000Z"),
      ],
      contradictingEvidenceIds: ["obs-4", "obs-4b"],
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
      evidence: [
        evidence("obs-3", "experiment-a", "2026-09-26T13:30:00.000Z"),
        evidence("obs-3b", "experiment-b", "2026-09-26T13:35:00.000Z"),
      ],
      contradictingEvidenceIds: ["obs-3", "obs-3b"],
      revisedConfidence: 0.5,
      revisionReason: "Independent contradiction.",
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

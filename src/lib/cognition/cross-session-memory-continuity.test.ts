import { describe, expect, it } from "vitest";

import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";
import {
  createPersistentMemoryStore,
  recordPersistentMemories,
  retrievePersistentMemory,
  revisePersistentSemanticMemory,
} from "./persistent-memory-lifecycle";
import {
  restorePersistentMemory,
  serializePersistentMemory,
} from "./persistent-memory-snapshot";

const episode: AutobiographicalMemory = {
  id: "episode-session-a",
  kind: "autobiographical",
  summary: "Session A observed delayed feedback in a control system.",
  observationIds: ["obs-a1", "obs-a2"],
  outcomeIds: [],
  learningIds: [],
  occurredAt: "2026-09-26T12:00:00.000Z",
  consolidatedAt: "2026-09-26T13:00:00.000Z",
};

const semantic: SemanticMemory = {
  id: "semantic-session-rule",
  kind: "semantic",
  statement: "Delayed feedback can destabilize adaptive systems.",
  confidence: 0.9,
  derivedFromIds: ["obs-a1", "obs-a2"],
  domains: ["controls"],
  consolidatedAt: "2026-09-26T13:00:00.000Z",
};

describe("cross-session persistent memory continuity", () => {
  it("restores, transfers, revises, and persists knowledge without losing lineage", () => {
    const sessionA = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });

    const sessionB = restorePersistentMemory(
      serializePersistentMemory(sessionA),
    );

    const transferred = retrievePersistentMemory({
      store: sessionB,
      query: {
        terms: ["feedback", "adaptive"],
        domains: ["robotics"],
      },
    });

    expect(transferred).toHaveLength(1);
    expect(transferred[0].memory.id).toBe(semantic.id);
    expect(transferred[0].supportingEpisodes.map((entry) => entry.id)).toEqual([
      episode.id,
    ]);

    const revisedInSessionB = revisePersistentSemanticMemory({
      store: sessionB,
      memoryId: semantic.id,
      evidence: [
        {
          id: "obs-b1",
          sourceId: "robotics-experiment-a",
          observedAt: "2026-09-26T14:00:00.000Z",
        },
        {
          id: "obs-b2",
          sourceId: "robotics-experiment-b",
          observedAt: "2026-09-26T14:05:00.000Z",
        },
      ],
      contradictingEvidenceIds: ["obs-b1", "obs-b2"],
      revisedStatement:
        "Delayed feedback can destabilize adaptive systems under high gain.",
      revisedConfidence: 0.7,
      revisionReason:
        "Independent robotics evidence narrowed the transferred rule.",
      revisedAt: "2026-09-26T15:00:00.000Z",
    });

    const sessionC = restorePersistentMemory(
      serializePersistentMemory(revisedInSessionB),
    );

    expect(sessionC.semantic[0].statement).toContain("under high gain");
    expect(sessionC.semantic[0].derivedFromIds).toEqual([
      "obs-a1",
      "obs-a2",
      "obs-b1",
      "obs-b2",
    ]);
    expect(sessionC.revisions).toHaveLength(1);
    expect(sessionC.revisions[0].previous).toEqual(semantic);
    expect(sessionC.revisions[0].current).toEqual(sessionC.semantic[0]);
    expect(sessionC.autobiographical).toEqual([episode]);
  });

  it("keeps the prior session immutable while a restored session learns", () => {
    const sessionA = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      autobiographical: [episode],
      semantic: [semantic],
    });
    const sessionB = restorePersistentMemory(
      serializePersistentMemory(sessionA),
    );

    revisePersistentSemanticMemory({
      store: sessionB,
      memoryId: semantic.id,
      evidence: [
        {
          id: "obs-b1",
          sourceId: "source-a",
          observedAt: "2026-09-26T14:00:00.000Z",
        },
        {
          id: "obs-b2",
          sourceId: "source-b",
          observedAt: "2026-09-26T14:05:00.000Z",
        },
      ],
      contradictingEvidenceIds: ["obs-b1", "obs-b2"],
      revisedConfidence: 0.6,
      revisionReason: "New independent evidence.",
      revisedAt: "2026-09-26T15:00:00.000Z",
    });

    expect(sessionA.semantic).toEqual([semantic]);
    expect(sessionA.revisions).toEqual([]);
  });

  it("does not resurrect a retracted memory after another session boundary", () => {
    const sessionA = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });
    const sessionB = restorePersistentMemory(
      serializePersistentMemory(sessionA),
    );
    const retracted = revisePersistentSemanticMemory({
      store: sessionB,
      memoryId: semantic.id,
      evidence: [
        {
          id: "obs-b1",
          sourceId: "source-a",
          observedAt: "2026-09-26T14:00:00.000Z",
        },
        {
          id: "obs-b2",
          sourceId: "source-b",
          observedAt: "2026-09-26T14:05:00.000Z",
        },
      ],
      contradictingEvidenceIds: ["obs-b1", "obs-b2"],
      revisedConfidence: 0,
      revisionReason: "Independent evidence falsified the rule.",
      revisedAt: "2026-09-26T15:00:00.000Z",
    });
    const sessionC = restorePersistentMemory(
      serializePersistentMemory(retracted),
    );

    expect(
      retrievePersistentMemory({
        store: sessionC,
        query: { terms: ["feedback"] },
      }),
    ).toEqual([]);
    expect(sessionC.revisions).toHaveLength(1);
    expect(sessionC.semantic[0].confidence).toBe(0);
  });
});

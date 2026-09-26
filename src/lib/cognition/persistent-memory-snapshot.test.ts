import { describe, expect, it } from "vitest";

import type { SemanticMemory } from "./memory-consolidation";
import {
  createPersistentMemoryStore,
  recordPersistentMemories,
  revisePersistentSemanticMemory,
} from "./persistent-memory-lifecycle";
import {
  restorePersistentMemory,
  serializePersistentMemory,
} from "./persistent-memory-snapshot";

const semantic: SemanticMemory = {
  id: "semantic-cross-session",
  kind: "semantic",
  statement: "Independent repeated evidence supports durable learning.",
  confidence: 0.9,
  derivedFromIds: ["obs-1", "obs-2"],
  domains: ["research"],
  consolidatedAt: "2026-09-26T15:00:00.000Z",
};

describe("persistent memory snapshots", () => {
  it("round-trips memory and revision history across a session boundary", () => {
    const initial = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });
    const revised = revisePersistentSemanticMemory({
      store: initial,
      memoryId: semantic.id,
      evidence: [
        {
          id: "obs-3",
          sourceId: "source-a",
          observedAt: "2026-09-26T15:30:00.000Z",
        },
        {
          id: "obs-4",
          sourceId: "source-b",
          observedAt: "2026-09-26T15:35:00.000Z",
        },
      ],
      contradictingEvidenceIds: ["obs-3", "obs-4"],
      revisedConfidence: 0.65,
      revisionReason: "Later independent evidence weakened the rule.",
      revisedAt: "2026-09-26T16:00:00.000Z",
    });

    const serialized = serializePersistentMemory(revised);
    const restored = restorePersistentMemory(serialized);

    expect(restored).toEqual(revised);
    expect(restored).not.toBe(revised);
    expect(restored.semantic).not.toBe(revised.semantic);
    expect(restored.revisions).not.toBe(revised.revisions);
  });

  it("serializes the same unchanged state deterministically", () => {
    const store = recordPersistentMemories({
      store: createPersistentMemoryStore(),
      semantic: [semantic],
    });

    expect(serializePersistentMemory(store)).toBe(
      serializePersistentMemory(store),
    );
  });

  it("fails closed on corrupt JSON", () => {
    expect(() => restorePersistentMemory("{broken")).toThrow(
      /not valid JSON/,
    );
  });

  it("fails closed on unsupported snapshot versions", () => {
    const serialized = serializePersistentMemory(
      recordPersistentMemories({
        store: createPersistentMemoryStore(),
        semantic: [semantic],
      }),
    );
    const parsed = JSON.parse(serialized);
    parsed.version = 999;

    expect(() => restorePersistentMemory(JSON.stringify(parsed))).toThrow(
      /version is unsupported/,
    );
  });

  it("fails closed on duplicate memory identity after restoration", () => {
    const serialized = serializePersistentMemory(
      recordPersistentMemories({
        store: createPersistentMemoryStore(),
        semantic: [semantic],
      }),
    );
    const parsed = JSON.parse(serialized);
    parsed.store.autobiographical.push({
      id: semantic.id,
      kind: "autobiographical",
      summary: "Conflicting identity.",
      observationIds: ["obs-x"],
      outcomeIds: [],
      learningIds: [],
      occurredAt: "2026-09-26T14:00:00.000Z",
      consolidatedAt: "2026-09-26T15:00:00.000Z",
    });

    expect(() => restorePersistentMemory(JSON.stringify(parsed))).toThrow(
      /duplicate memory ids/,
    );
  });
});

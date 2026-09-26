import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";

const FORMAT = "mabojolu-persistent-memory";
const VERSION = 1;

interface PersistentMemorySnapshot {
  format: typeof FORMAT;
  version: typeof VERSION;
  store: PersistentMemoryStore;
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertString(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
}

function assertStringArray(value: unknown, message: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || !entry.trim())
  ) {
    throw new Error(message);
  }
}

function assertTimestamp(value: unknown, message: string): asserts value is string {
  assertString(value, message);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(message);
  }
}

function validateStore(store: unknown): asserts store is PersistentMemoryStore {
  assertRecord(store, "Persistent memory snapshot store is invalid.");
  if (
    !Array.isArray(store.autobiographical) ||
    !Array.isArray(store.semantic) ||
    !Array.isArray(store.revisions)
  ) {
    throw new Error("Persistent memory snapshot collections are invalid.");
  }

  const globalIds = new Set<string>();
  for (const episode of store.autobiographical) {
    assertRecord(episode, "Autobiographical memory is invalid.");
    assertString(episode.id, "Autobiographical memory id is invalid.");
    if (episode.kind !== "autobiographical") {
      throw new Error("Autobiographical memory kind is invalid.");
    }
    assertString(episode.summary, "Autobiographical memory summary is invalid.");
    assertStringArray(episode.observationIds, "Autobiographical observation provenance is invalid.");
    assertStringArray(episode.outcomeIds, "Autobiographical outcome provenance is invalid.");
    assertStringArray(episode.learningIds, "Autobiographical learning provenance is invalid.");
    assertTimestamp(episode.occurredAt, "Autobiographical occurrence timestamp is invalid.");
    assertTimestamp(episode.consolidatedAt, "Autobiographical consolidation timestamp is invalid.");
    if (globalIds.has(episode.id)) {
      throw new Error("Persistent memory snapshot contains duplicate memory ids.");
    }
    globalIds.add(episode.id);
  }

  for (const memory of store.semantic) {
    assertRecord(memory, "Semantic memory is invalid.");
    assertString(memory.id, "Semantic memory id is invalid.");
    if (memory.kind !== "semantic") {
      throw new Error("Semantic memory kind is invalid.");
    }
    assertString(memory.statement, "Semantic memory statement is invalid.");
    if (
      typeof memory.confidence !== "number" ||
      !Number.isFinite(memory.confidence) ||
      memory.confidence < 0 ||
      memory.confidence > 1
    ) {
      throw new Error("Semantic memory confidence is invalid.");
    }
    assertStringArray(memory.derivedFromIds, "Semantic memory provenance is invalid.");
    assertStringArray(memory.domains, "Semantic memory domains are invalid.");
    assertTimestamp(memory.consolidatedAt, "Semantic memory consolidation timestamp is invalid.");
    if (globalIds.has(memory.id)) {
      throw new Error("Persistent memory snapshot contains duplicate memory ids.");
    }
    globalIds.add(memory.id);
  }

  for (const revision of store.revisions) {
    assertRecord(revision, "Semantic memory revision is invalid.");
    assertRecord(revision.previous, "Semantic memory revision previous state is invalid.");
    assertRecord(revision.current, "Semantic memory revision current state is invalid.");
    assertString(revision.previous.id, "Semantic memory revision previous id is invalid.");
    assertString(revision.current.id, "Semantic memory revision current id is invalid.");
    if (revision.previous.id !== revision.current.id) {
      throw new Error("Semantic memory revision identity changed across history.");
    }
    assertStringArray(revision.supportingEvidenceIds, "Revision support provenance is invalid.");
    assertStringArray(revision.contradictingEvidenceIds, "Revision contradiction provenance is invalid.");
    assertString(revision.revisionReason, "Semantic memory revision reason is invalid.");
    assertTimestamp(revision.revisedAt, "Semantic memory revision timestamp is invalid.");
  }
}

export function serializePersistentMemory(
  store: PersistentMemoryStore,
): string {
  validateStore(store);
  const snapshot: PersistentMemorySnapshot = {
    format: FORMAT,
    version: VERSION,
    store,
  };
  return JSON.stringify(snapshot);
}

export function restorePersistentMemory(
  serialized: string,
): PersistentMemoryStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Persistent memory snapshot is not valid JSON.");
  }

  assertRecord(parsed, "Persistent memory snapshot is invalid.");
  if (parsed.format !== FORMAT) {
    throw new Error("Persistent memory snapshot format is unsupported.");
  }
  if (parsed.version !== VERSION) {
    throw new Error("Persistent memory snapshot version is unsupported.");
  }

  validateStore(parsed.store);
  return structuredClone(parsed.store);
}

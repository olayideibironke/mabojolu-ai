import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";
import {
  retrieveSemanticMemory,
  type MemoryRetrievalQuery,
  type RetrievedSemanticMemory,
} from "./cross-domain-memory-retrieval";
import {
  reviseSemanticMemory,
  type SemanticMemoryRevision,
} from "./semantic-memory-revision";
import {
  guardSemanticMemoryRevision,
  type MemoryRevisionEvidence,
} from "./memory-revision-guard";

export interface PersistentMemoryStore {
  autobiographical: AutobiographicalMemory[];
  semantic: SemanticMemory[];
  revisions: SemanticMemoryRevision[];
}

export function createPersistentMemoryStore(): PersistentMemoryStore {
  return {
    autobiographical: [],
    semantic: [],
    revisions: [],
  };
}

function ensureUniqueMemoryIds(store: PersistentMemoryStore): void {
  const ids = [
    ...store.autobiographical.map((entry) => entry.id),
    ...store.semantic.map((entry) => entry.id),
  ];
  if (new Set(ids).size !== ids.length) {
    throw new Error("Persistent memory ids must be globally unique.");
  }
}

export function recordPersistentMemories(input: {
  store: PersistentMemoryStore;
  autobiographical?: readonly AutobiographicalMemory[];
  semantic?: readonly SemanticMemory[];
}): PersistentMemoryStore {
  ensureUniqueMemoryIds(input.store);

  const next: PersistentMemoryStore = {
    autobiographical: [
      ...input.store.autobiographical,
      ...(input.autobiographical ?? []),
    ],
    semantic: [...input.store.semantic, ...(input.semantic ?? [])],
    revisions: [...input.store.revisions],
  };
  ensureUniqueMemoryIds(next);
  return next;
}

export function retrievePersistentMemory(input: {
  store: PersistentMemoryStore;
  query: MemoryRetrievalQuery;
}): RetrievedSemanticMemory[] {
  ensureUniqueMemoryIds(input.store);
  return retrieveSemanticMemory({
    query: input.query,
    semantic: input.store.semantic.filter(
      (memory) => memory.confidence > 0,
    ),
    autobiographical: input.store.autobiographical,
  });
}

export function revisePersistentSemanticMemory(input: {
  store: PersistentMemoryStore;
  memoryId: string;
  evidence: readonly MemoryRevisionEvidence[];
  supportingEvidenceIds?: readonly string[];
  contradictingEvidenceIds?: readonly string[];
  revisedStatement?: string;
  revisedConfidence: number;
  revisionReason: string;
  revisedAt: string;
  minimumIndependentSources?: number;
}): PersistentMemoryStore {
  ensureUniqueMemoryIds(input.store);
  const index = input.store.semantic.findIndex(
    (entry) => entry.id === input.memoryId,
  );
  if (index < 0) {
    throw new Error(
      `Unknown semantic memory ${input.memoryId} during persistent revision.`,
    );
  }

  const requestedEvidenceIds = new Set([
    ...(input.supportingEvidenceIds ?? []),
    ...(input.contradictingEvidenceIds ?? []),
  ]);
  const suppliedEvidenceIds = new Set(
    input.evidence.map((entry) => entry.id),
  );
  for (const id of requestedEvidenceIds) {
    if (!suppliedEvidenceIds.has(id)) {
      throw new Error(
        `Revision evidence ${id} was not supplied to the memory contamination guard.`,
      );
    }
  }

  guardSemanticMemoryRevision({
    memory: input.store.semantic[index],
    evidence: input.evidence.filter((entry) =>
      requestedEvidenceIds.has(entry.id),
    ),
    minimumIndependentSources: input.minimumIndependentSources,
  });

  const revision = reviseSemanticMemory({
    memory: input.store.semantic[index],
    supportingEvidenceIds: input.supportingEvidenceIds,
    contradictingEvidenceIds: input.contradictingEvidenceIds,
    revisedStatement: input.revisedStatement,
    revisedConfidence: input.revisedConfidence,
    revisionReason: input.revisionReason,
    revisedAt: input.revisedAt,
  });

  const semantic = [...input.store.semantic];
  semantic[index] = revision.current;

  return {
    autobiographical: [...input.store.autobiographical],
    semantic,
    revisions: [...input.store.revisions, revision],
  };
}

export function replayPersistentMemoryRevisions(input: {
  initialMemory: SemanticMemory;
  revisions: readonly SemanticMemoryRevision[];
}): SemanticMemory {
  let current = input.initialMemory;

  for (const revision of input.revisions) {
    if (revision.previous.id !== current.id) {
      continue;
    }
    if (
      revision.previous.statement !== current.statement ||
      revision.previous.confidence !== current.confidence ||
      revision.previous.consolidatedAt !== current.consolidatedAt
    ) {
      throw new Error(
        `Semantic memory revision lineage diverged for ${current.id}.`,
      );
    }
    current = revision.current;
  }

  return current;
}

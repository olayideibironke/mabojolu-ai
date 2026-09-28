import type { LongHorizonLearningState } from "./autonomous-long-horizon-learning";
import type { SemanticMemory } from "./memory-consolidation";
import {
  recordPersistentMemories,
  type PersistentMemoryStore,
} from "./persistent-memory-lifecycle";

export interface LongHorizonLessonEvidence {
  id: string;
  sourceId: string;
  domain: string;
}

export function persistLongHorizonLesson(input: {
  store: PersistentMemoryStore;
  state: LongHorizonLearningState;
  lesson: string;
  evidence: readonly LongHorizonLessonEvidence[];
  memoryId: string;
  confidence: number;
  consolidatedAt: string;
}): PersistentMemoryStore {
  const lesson = input.lesson.trim();
  const memoryId = input.memoryId.trim();
  if (!lesson || !memoryId) {
    throw new Error("Persisted long-horizon lesson requires memory id and lesson.");
  }
  if (!input.state.lessons.includes(lesson)) {
    throw new Error("Only lessons earned by the long-horizon state may be persisted.");
  }
  if (!Number.isFinite(input.confidence) || input.confidence <= 0 || input.confidence > 1) {
    throw new Error("Persisted lesson confidence must be in (0, 1].");
  }
  if (Number.isNaN(Date.parse(input.consolidatedAt))) {
    throw new Error("Persisted lesson requires a valid consolidation timestamp.");
  }
  if (input.evidence.length < 2) {
    throw new Error("Persistent long-horizon lesson requires independent evidence.");
  }

  const evidenceIds = new Set<string>();
  const sourceIds = new Set<string>();
  const domains = new Set<string>();
  for (const evidence of input.evidence) {
    const id = evidence.id.trim();
    const sourceId = evidence.sourceId.trim();
    const domain = evidence.domain.trim();
    if (!id || !sourceId || !domain || evidenceIds.has(id)) {
      throw new Error("Long-horizon lesson evidence must be unique and complete.");
    }
    evidenceIds.add(id);
    sourceIds.add(sourceId);
    domains.add(domain);
  }
  if (sourceIds.size < 2) {
    throw new Error("Persistent long-horizon lesson requires at least two independent sources.");
  }

  const memory: SemanticMemory = {
    id: memoryId,
    kind: "semantic",
    statement: lesson,
    confidence: input.confidence,
    derivedFromIds: [...evidenceIds].sort(),
    domains: [...domains].sort(),
    consolidatedAt: input.consolidatedAt,
  };

  return recordPersistentMemories({
    store: input.store,
    semantic: [memory],
  });
}

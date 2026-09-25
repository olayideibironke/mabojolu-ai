import type {
  Belief,
  CognitiveState,
  LearningRecord,
  Observation,
  Outcome,
} from "./types";

export interface AutobiographicalMemory {
  id: string;
  kind: "autobiographical";
  summary: string;
  observationIds: string[];
  outcomeIds: string[];
  learningIds: string[];
  occurredAt: string;
  consolidatedAt: string;
}

export interface SemanticMemory {
  id: string;
  kind: "semantic";
  statement: string;
  confidence: number;
  derivedFromIds: string[];
  domains: string[];
  consolidatedAt: string;
}

export interface ConsolidatedMemory {
  autobiographical: AutobiographicalMemory[];
  semantic: SemanticMemory[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function scalarDomain(
  observation: Observation,
): string | undefined {
  const domain = observation.metadata?.domain;
  return typeof domain === "string" && domain.trim()
    ? domain.trim()
    : undefined;
}

function requireConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Memory confidence must be between 0 and 1.");
  }
  return value;
}

export function consolidateAutobiographicalMemory(input: {
  id: string;
  summary: string;
  observations: readonly Observation[];
  outcomes?: readonly Outcome[];
  learnings?: readonly LearningRecord[];
  occurredAt: string;
  consolidatedAt: string;
}): AutobiographicalMemory {
  if (!input.id.trim() || !input.summary.trim()) {
    throw new Error("Autobiographical memory requires id and summary.");
  }
  if (input.observations.length === 0) {
    throw new Error(
      "Autobiographical memory requires direct observational provenance.",
    );
  }

  return {
    id: input.id,
    kind: "autobiographical",
    summary: input.summary.trim(),
    observationIds: unique(input.observations.map((entry) => entry.id)),
    outcomeIds: unique((input.outcomes ?? []).map((entry) => entry.id)),
    learningIds: unique((input.learnings ?? []).map((entry) => entry.id)),
    occurredAt: input.occurredAt,
    consolidatedAt: input.consolidatedAt,
  };
}

export function consolidateSemanticMemory(input: {
  id: string;
  statement: string;
  beliefs?: readonly Belief[];
  learnings?: readonly LearningRecord[];
  observations?: readonly Observation[];
  domains?: readonly string[];
  confidence: number;
  consolidatedAt: string;
}): SemanticMemory {
  if (!input.id.trim() || !input.statement.trim()) {
    throw new Error("Semantic memory requires id and statement.");
  }

  const beliefs = input.beliefs ?? [];
  const learnings = input.learnings ?? [];
  const observations = input.observations ?? [];
  const derivedFromIds = unique([
    ...beliefs.flatMap((entry) => entry.evidenceIds),
    ...learnings.flatMap((entry) => entry.derivedFromIds),
  ]);

  if (derivedFromIds.length === 0) {
    throw new Error(
      "Semantic memory requires belief or learning provenance.",
    );
  }

  const knownEvidenceIds = new Set([
    ...observations.map((entry) => entry.id),
    ...beliefs.map((entry) => entry.id),
    ...learnings.map((entry) => entry.id),
  ]);
  for (const id of derivedFromIds) {
    if (!knownEvidenceIds.has(id)) {
      throw new Error(
        `Semantic memory provenance ${id} is not present in supplied cognitive evidence.`,
      );
    }
  }

  const domains = unique([
    ...(input.domains ?? []).map((entry) => entry.trim()).filter(Boolean),
    ...observations.map(scalarDomain).filter(
      (entry): entry is string => Boolean(entry),
    ),
  ]).sort();

  return {
    id: input.id,
    kind: "semantic",
    statement: input.statement.trim(),
    confidence: requireConfidence(input.confidence),
    derivedFromIds,
    domains,
    consolidatedAt: input.consolidatedAt,
  };
}

export function consolidateCognitiveStateMemory(input: {
  state: CognitiveState;
  autobiographical: {
    id: string;
    summary: string;
    observationIds: readonly string[];
    outcomeIds?: readonly string[];
    learningIds?: readonly string[];
    occurredAt: string;
  };
  semantic?: {
    id: string;
    statement: string;
    beliefIds?: readonly string[];
    learningIds?: readonly string[];
    domains?: readonly string[];
    confidence: number;
  };
  consolidatedAt: string;
}): ConsolidatedMemory {
  const observationsById = new Map(
    input.state.observations.map((entry) => [entry.id, entry]),
  );
  const outcomesById = new Map(
    input.state.outcomes.map((entry) => [entry.id, entry]),
  );
  const learningsById = new Map(
    input.state.learnings.map((entry) => [entry.id, entry]),
  );
  const beliefsById = new Map(
    input.state.beliefs.map((entry) => [entry.id, entry]),
  );

  const requireEntries = <T>(
    ids: readonly string[],
    entries: ReadonlyMap<string, T>,
    label: string,
  ): T[] =>
    ids.map((id) => {
      const entry = entries.get(id);
      if (!entry) {
        throw new Error(`Unknown ${label} ${id} during memory consolidation.`);
      }
      return entry;
    });

  const autobiographical = consolidateAutobiographicalMemory({
    id: input.autobiographical.id,
    summary: input.autobiographical.summary,
    observations: requireEntries(
      input.autobiographical.observationIds,
      observationsById,
      "observation",
    ),
    outcomes: requireEntries(
      input.autobiographical.outcomeIds ?? [],
      outcomesById,
      "outcome",
    ),
    learnings: requireEntries(
      input.autobiographical.learningIds ?? [],
      learningsById,
      "learning",
    ),
    occurredAt: input.autobiographical.occurredAt,
    consolidatedAt: input.consolidatedAt,
  });

  const semantic = input.semantic
    ? [
        consolidateSemanticMemory({
          id: input.semantic.id,
          statement: input.semantic.statement,
          beliefs: requireEntries(
            input.semantic.beliefIds ?? [],
            beliefsById,
            "belief",
          ),
          learnings: requireEntries(
            input.semantic.learningIds ?? [],
            learningsById,
            "learning",
          ),
          observations: input.state.observations,
          domains: input.semantic.domains,
          confidence: input.semantic.confidence,
          consolidatedAt: input.consolidatedAt,
        }),
      ]
    : [];

  return {
    autobiographical: [autobiographical],
    semantic,
  };
}

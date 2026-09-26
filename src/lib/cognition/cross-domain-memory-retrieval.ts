import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";

export interface MemoryRetrievalQuery {
  terms: readonly string[];
  domains?: readonly string[];
  limit?: number;
}

export interface RetrievedSemanticMemory {
  memory: SemanticMemory;
  score: number;
  matchedTerms: string[];
  matchedDomains: string[];
  supportingEpisodes: AutobiographicalMemory[];
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 2),
  );
}

export function retrieveSemanticMemory(input: {
  query: MemoryRetrievalQuery;
  semantic: readonly SemanticMemory[];
  autobiographical?: readonly AutobiographicalMemory[];
}): RetrievedSemanticMemory[] {
  const terms = [
    ...new Set(
      input.query.terms.map((entry) => entry.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const domains = [
    ...new Set(
      (input.query.domains ?? [])
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const limit = input.query.limit ?? input.semantic.length;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Memory retrieval limit must be a positive integer.");
  }
  if (terms.length === 0 && domains.length === 0) {
    throw new Error("Memory retrieval requires terms or domains.");
  }

  const episodes = input.autobiographical ?? [];

  return input.semantic
    .map((memory) => {
      const statementTokens = tokens(memory.statement);
      const memoryDomains = memory.domains.map((entry) =>
        entry.toLowerCase(),
      );
      const matchedTerms = terms.filter((term) =>
        statementTokens.has(term),
      );
      const matchedDomains = domains.filter((domain) =>
        memoryDomains.includes(domain),
      );

      const lexicalScore =
        terms.length === 0 ? 0 : matchedTerms.length / terms.length;
      const domainScore =
        domains.length === 0
          ? 0
          : matchedDomains.length / domains.length;
      const crossDomainBonus =
        matchedTerms.length > 0 &&
        domains.length > 0 &&
        matchedDomains.length === 0
          ? 0.15
          : 0;
      const score =
        lexicalScore * 0.65 +
        domainScore * 0.25 +
        crossDomainBonus +
        memory.confidence * 0.1;

      const supportingEpisodes = episodes.filter((episode) =>
        episode.observationIds.some((id) =>
          memory.derivedFromIds.includes(id),
        ) ||
        episode.outcomeIds.some((id) =>
          memory.derivedFromIds.includes(id),
        ) ||
        episode.learningIds.some((id) =>
          memory.derivedFromIds.includes(id),
        ),
      );

      return {
        memory,
        score,
        matchedTerms,
        matchedDomains,
        supportingEpisodes,
      };
    })
    .filter(
      (entry) =>
        entry.matchedTerms.length > 0 ||
        entry.matchedDomains.length > 0,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.memory.confidence - left.memory.confidence ||
        left.memory.id.localeCompare(right.memory.id),
    )
    .slice(0, limit);
}

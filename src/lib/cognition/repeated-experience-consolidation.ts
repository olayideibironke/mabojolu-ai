import type {
  AutobiographicalMemory,
  SemanticMemory,
} from "./memory-consolidation";

export interface SemanticConsolidationCandidate {
  id: string;
  statement: string;
  episodeIds: readonly string[];
  confidence: number;
  domains?: readonly string[];
}

export interface RepeatedExperienceConsolidation {
  semantic: SemanticMemory;
  supportingEpisodes: AutobiographicalMemory[];
  independentEpisodeCount: number;
}

export function consolidateRepeatedExperience(input: {
  candidate: SemanticConsolidationCandidate;
  episodes: readonly AutobiographicalMemory[];
  consolidatedAt: string;
  minimumIndependentEpisodes?: number;
}): RepeatedExperienceConsolidation {
  const minimumIndependentEpisodes =
    input.minimumIndependentEpisodes ?? 2;

  if (
    !Number.isInteger(minimumIndependentEpisodes) ||
    minimumIndependentEpisodes < 2
  ) {
    throw new Error(
      "Repeated experience consolidation requires at least two independent episodes.",
    );
  }

  const byId = new Map(
    input.episodes.map((episode) => [episode.id, episode]),
  );
  if (byId.size !== input.episodes.length) {
    throw new Error("Autobiographical episode ids must be unique.");
  }

  const requestedIds = [...new Set(input.candidate.episodeIds)];
  if (requestedIds.length !== input.candidate.episodeIds.length) {
    throw new Error(
      "Semantic consolidation episode references must be unique.",
    );
  }

  const supportingEpisodes = requestedIds.map((id) => {
    const episode = byId.get(id);
    if (!episode) {
      throw new Error(
        `Unknown autobiographical episode ${id} during semantic consolidation.`,
      );
    }
    return episode;
  });

  if (supportingEpisodes.length < minimumIndependentEpisodes) {
    throw new Error(
      `Semantic consolidation requires at least ${minimumIndependentEpisodes} independent autobiographical episodes.`,
    );
  }

  if (
    !Number.isFinite(input.candidate.confidence) ||
    input.candidate.confidence < 0 ||
    input.candidate.confidence > 1
  ) {
    throw new Error("Semantic memory confidence must be between 0 and 1.");
  }

  const derivedFromIds = [
    ...new Set(
      supportingEpisodes.flatMap((episode) => [
        ...episode.observationIds,
        ...episode.outcomeIds,
        ...episode.learningIds,
      ]),
    ),
  ];
  if (derivedFromIds.length === 0) {
    throw new Error(
      "Repeated experience consolidation requires episode provenance.",
    );
  }

  return {
    semantic: {
      id: input.candidate.id,
      kind: "semantic",
      statement: input.candidate.statement.trim(),
      confidence: input.candidate.confidence,
      derivedFromIds,
      domains: [
        ...new Set(
          (input.candidate.domains ?? [])
            .map((domain) => domain.trim())
            .filter(Boolean),
        ),
      ].sort(),
      consolidatedAt: input.consolidatedAt,
    },
    supportingEpisodes,
    independentEpisodeCount: supportingEpisodes.length,
  };
}

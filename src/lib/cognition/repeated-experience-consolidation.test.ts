import { describe, expect, it } from "vitest";

import type { AutobiographicalMemory } from "./memory-consolidation";
import { consolidateRepeatedExperience } from "./repeated-experience-consolidation";

function episode(
  id: string,
  observationId: string,
): AutobiographicalMemory {
  return {
    id,
    kind: "autobiographical",
    summary: `Experience ${id}`,
    observationIds: [observationId],
    outcomeIds: [],
    learningIds: [],
    occurredAt: "2026-09-25T20:00:00.000Z",
    consolidatedAt: "2026-09-25T21:00:00.000Z",
  };
}

describe("repeated experience semantic consolidation", () => {
  it("generalizes across independent episodes without deleting them", () => {
    const first = episode("episode-1", "obs-1");
    const second = episode("episode-2", "obs-2");

    const result = consolidateRepeatedExperience({
      candidate: {
        id: "semantic-1",
        statement: "The red switch tends to produce output A.",
        episodeIds: ["episode-1", "episode-2"],
        confidence: 0.8,
        domains: ["controls"],
      },
      episodes: [first, second],
      consolidatedAt: "2026-09-25T22:00:00.000Z",
    });

    expect(result.semantic.derivedFromIds).toEqual(["obs-1", "obs-2"]);
    expect(result.independentEpisodeCount).toBe(2);
    expect(result.supportingEpisodes).toEqual([first, second]);
  });

  it("refuses to generalize from a single experience by default", () => {
    expect(() =>
      consolidateRepeatedExperience({
        candidate: {
          id: "semantic-1",
          statement: "One event is not yet a durable rule.",
          episodeIds: ["episode-1"],
          confidence: 0.7,
        },
        episodes: [episode("episode-1", "obs-1")],
        consolidatedAt: "2026-09-25T22:00:00.000Z",
      }),
    ).toThrow(/at least 2 independent autobiographical episodes/);
  });

  it("rejects duplicate episode references as false repetition", () => {
    expect(() =>
      consolidateRepeatedExperience({
        candidate: {
          id: "semantic-1",
          statement: "Duplicated evidence must not inflate experience.",
          episodeIds: ["episode-1", "episode-1"],
          confidence: 0.7,
        },
        episodes: [episode("episode-1", "obs-1")],
        consolidatedAt: "2026-09-25T22:00:00.000Z",
      }),
    ).toThrow(/episode references must be unique/);
  });

  it("fails closed when a claimed supporting episode is absent", () => {
    expect(() =>
      consolidateRepeatedExperience({
        candidate: {
          id: "semantic-1",
          statement: "Missing history cannot support knowledge.",
          episodeIds: ["episode-1", "episode-2"],
          confidence: 0.7,
        },
        episodes: [episode("episode-1", "obs-1")],
        consolidatedAt: "2026-09-25T22:00:00.000Z",
      }),
    ).toThrow(/Unknown autobiographical episode episode-2/);
  });
});

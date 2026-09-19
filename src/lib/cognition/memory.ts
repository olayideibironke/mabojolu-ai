import type {
  EnvironmentSnapshot,
} from "./environment";

export interface EpisodeTransition {
  action: string;

  before:
    EnvironmentSnapshot;

  after:
    EnvironmentSnapshot;

  changedKeys:
    string[];

  accepted: boolean;
}

export interface CognitiveEpisode {
  id: string;

  environmentId:
    string;

  goalDescription:
    string;

  solved: boolean;

  cycles: number;

  transitions:
    EpisodeTransition[];

  completedAt:
    string;
}

export interface RecalledPlan {
  sourceEpisodeId:
    string;

  actions:
    string[];

  confidence:
    number;
}

export interface RecordEpisodeInput {
  environmentId:
    string;

  goalDescription:
    string;

  solved: boolean;

  cycles: number;

  transitions:
    EpisodeTransition[];

  completedAt:
    string;
}

export interface CognitiveMemory {
  recordEpisode(
    episode:
      RecordEpisodeInput,
  ): CognitiveEpisode;

  recallPlan(input: {
    environmentId:
      string;

    goalDescription:
      string;

    availableActions:
      readonly string[];
  }):
    RecalledPlan |
    undefined;

  getEpisodes():
    readonly CognitiveEpisode[];
}

function cloneSnapshot(
  snapshot:
    EnvironmentSnapshot,
): EnvironmentSnapshot {
  return {
    ...snapshot,
  };
}

function cloneTransition(
  transition:
    EpisodeTransition,
): EpisodeTransition {
  return {
    ...transition,

    before:
      cloneSnapshot(
        transition.before,
      ),

    after:
      cloneSnapshot(
        transition.after,
      ),

    changedKeys: [
      ...transition
        .changedKeys,
    ],
  };
}

function cloneEpisode(
  episode:
    CognitiveEpisode,
): CognitiveEpisode {
  return {
    ...episode,

    transitions:
      episode.transitions.map(
        cloneTransition,
      ),
  };
}

/**
 * First persistent experience store for Mabojolu G.
 *
 * It intentionally stores observable transitions rather than private reasoning.
 *
 * Later implementations can persist the same contract to disk or a database
 * without changing the cognitive runtime.
 */
export class InMemoryCognitiveMemory
  implements CognitiveMemory
{
  private readonly episodes:
    CognitiveEpisode[] = [];

  private sequence = 0;

  recordEpisode(
    input:
      RecordEpisodeInput,
  ): CognitiveEpisode {
    this.sequence += 1;

    const episode:
      CognitiveEpisode = {
      id:
        `episode-${this.sequence}`,

      environmentId:
        input.environmentId,

      goalDescription:
        input.goalDescription,

      solved:
        input.solved,

      cycles:
        input.cycles,

      transitions:
        input.transitions.map(
          cloneTransition,
        ),

      completedAt:
        input.completedAt,
    };

    this.episodes.push(
      episode,
    );

    return cloneEpisode(
      episode,
    );
  }

  recallPlan(input: {
    environmentId:
      string;

    goalDescription:
      string;

    availableActions:
      readonly string[];
  }):
    RecalledPlan |
    undefined {
    const available =
      new Set(
        input.availableActions,
      );

    /*
     * Prefer the newest successful experience because later episodes may have
     * corrected earlier assumptions about the environment.
     */
    for (
      let index =
        this.episodes.length -
        1;
      index >= 0;
      index -= 1
    ) {
      const episode =
        this.episodes[index];

      if (
        !episode.solved ||
        episode.environmentId !==
          input.environmentId ||
        episode.goalDescription !==
          input.goalDescription
      ) {
        continue;
      }

      /*
       * Remove exploratory actions that produced no observable state change.
       *
       * This converts a successful exploratory episode into a compact reusable
       * plan while preserving the original complete episode in memory.
       */
      const actions =
        episode.transitions
          .filter(
            (transition) =>
              transition.accepted &&
              transition
                .changedKeys
                .length > 0,
          )
          .map(
            (transition) =>
              transition.action,
          );

      if (
        actions.length === 0
      ) {
        continue;
      }

      const allAvailable =
        actions.every(
          (action) =>
            available.has(
              action,
            ),
        );

      if (!allAvailable) {
        continue;
      }

      return {
        sourceEpisodeId:
          episode.id,

        actions: [
          ...actions,
        ],

        confidence:
          0.85,
      };
    }

    return undefined;
  }

  getEpisodes():
    readonly CognitiveEpisode[] {
    return this.episodes.map(
      cloneEpisode,
    );
  }
}
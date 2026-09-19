/**
 * Environment contracts for Mabojolu G.
 *
 * The cognitive runtime can interact with an environment, but it must not be
 * allowed to inspect that environment's hidden implementation or causal rules.
 *
 * It receives only:
 *
 * available actions
 * observable state
 * observable goal conditions when the environment can express them
 * action outcomes
 * goal status
 */

export type EnvironmentScalar =
  | string
  | number
  | boolean
  | null;

export type EnvironmentSnapshot =
  Record<
    string,
    EnvironmentScalar
  >;

export interface EnvironmentActionResult {
  /**
   * Whether the environment accepted the action.
   *
   * Accepted does not mean the action achieved the intended goal.
   */
  accepted: boolean;

  /**
   * Public outcome description.
   *
   * This must not expose hidden environment rules.
   */
  summary: string;
}

export interface CognitiveEnvironment {
  readonly id: string;

  /**
   * Human-readable objective visible to the cognitive runtime.
   */
  readonly goalDescription: string;

  /**
   * Actions currently available to the agent.
   *
   * Their hidden semantics are not exposed here.
   */
  getAvailableActions():
    readonly string[];

  /**
   * Return only externally observable environment state.
   */
  observe():
    EnvironmentSnapshot;

  /**
   * Optional declarative goal state.
   *
   * This describes what success looks like in observable terms. It does not
   * reveal how to achieve that state.
   *
   * Example:
   *
   * { vaultOpen: true }
   */
  getGoalConditions?():
    EnvironmentSnapshot;

  /**
   * Execute one action.
   */
  act(
    action: string,
  ): EnvironmentActionResult;

  /**
   * Objective evaluation belongs to the environment, not the agent.
   */
  isGoalSatisfied():
    boolean;
}

export interface SnapshotChange {
  key: string;

  before:
    | EnvironmentScalar
    | undefined;

  after:
    | EnvironmentScalar
    | undefined;
}

/**
 * Stable signature used to recognize whether Mabojolu has already attempted an
 * action under the same observable conditions.
 */
export function snapshotSignature(
  snapshot:
    EnvironmentSnapshot,
): string {
  const entries =
    Object.entries(
      snapshot,
    ).sort(
      ([left], [right]) =>
        left.localeCompare(
          right,
        ),
    );

  return JSON.stringify(
    entries,
  );
}

/**
 * Determine which observable properties changed after an action.
 */
export function diffSnapshots(
  before:
    EnvironmentSnapshot,

  after:
    EnvironmentSnapshot,
): SnapshotChange[] {
  const keys =
    Array.from(
      new Set([
        ...Object.keys(
          before,
        ),

        ...Object.keys(
          after,
        ),
      ]),
    ).sort();

  const changes:
    SnapshotChange[] = [];

  for (
    const key of keys
  ) {
    const previous =
      before[key];

    const next =
      after[key];

    if (
      !Object.is(
        previous,
        next,
      )
    ) {
      changes.push({
        key,

        before:
          previous,

        after:
          next,
      });
    }
  }

  return changes;
}
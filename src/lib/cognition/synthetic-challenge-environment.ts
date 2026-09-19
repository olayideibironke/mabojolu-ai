import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "./environment";

import {
  validateChallengeSpec,
  type GatedSequenceChallengeSpec,
} from "./synthetic-challenge";

/**
 * Deterministic sandbox for autonomously generated gated-sequence challenges.
 *
 * Hidden action-role mappings live inside the environment instance. The
 * CognitiveRuntime receives only the public environment interface.
 */
export class SyntheticGatedSequenceEnvironment
  implements CognitiveEnvironment
{
  readonly id:
    string;

  readonly goalDescription:
    string;

  private firstReady =
    false;

  private secondReady =
    false;

  private goalReached =
    false;

  constructor(
    private readonly spec:
      GatedSequenceChallengeSpec,
  ) {
    validateChallengeSpec(
      spec,
    );

    this.id =
      spec.id;

    this.goalDescription =
      "Reach the generated " +
      spec.family +
      " goal.";
  }

  observe():
    EnvironmentSnapshot {
    return {
      [this.spec
        .stateKeys[0]]:
        this.firstReady,

      [this.spec
        .stateKeys[1]]:
        this.secondReady,

      [this.spec
        .stateKeys[2]]:
        this.goalReached,

      context:
        this.spec
          .context,
    };
  }

  getAvailableActions():
    readonly string[] {
    return [
      ...this.spec
        .actionLabels,
    ];
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      [this.spec
        .stateKeys[2]]:
        true,
    };
  }

  act(
    action:
      string,
  ):
    EnvironmentActionResult {
    const actionIndex =
      this.spec
        .actionLabels
        .indexOf(
          action,
        );

    if (
      actionIndex <
      0
    ) {
      return {
        accepted:
          false,

        summary:
          "Unknown generated action.",
      };
    }

    const role =
      this.spec
        .actionRoleOrder[
          actionIndex
        ];

    if (
      role ===
      0
    ) {
      this.firstReady =
        true;
    } else if (
      role ===
        1 &&
      this.firstReady
    ) {
      this.secondReady =
        true;
    } else if (
      role ===
        2 &&
      this.firstReady &&
      this.secondReady
    ) {
      this.goalReached =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Generated action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.goalReached;
  }
}

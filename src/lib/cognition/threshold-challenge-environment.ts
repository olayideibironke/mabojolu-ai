import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "./environment";

import {
  validateThresholdChallengeSpec,
  type ThresholdAccumulationChallengeSpec,
} from "./threshold-challenge";

/**
 * Numeric accumulation sandbox.
 *
 * This family is intentionally different from staged Boolean prerequisite
 * challenges: competence requires repeated progress increments followed by a
 * threshold-dependent completion action.
 */
export class ThresholdAccumulationEnvironment
  implements CognitiveEnvironment
{
  readonly id:
    string;

  readonly goalDescription:
    string;

  private progress =
    0;

  private complete =
    false;

  constructor(
    private readonly spec:
      ThresholdAccumulationChallengeSpec,
  ) {
    validateThresholdChallengeSpec(
      spec,
    );

    this.id =
      spec.id;

    this.goalDescription =
      "Reach the generated " +
      spec.family +
      " threshold goal.";
  }

  observe():
    EnvironmentSnapshot {
    return {
      [this.spec
        .stateKeys[0]]:
        this.progress,

      [this.spec
        .stateKeys[1]]:
        this.complete,

      context:
        this.spec
          .context,
    };
  }

  getAvailableActions():
    readonly string[] {
    const order =
      this.spec
        .actionPresentationOrder ??
      [
        0,
        1,
      ];

    return order.map(
      (index) =>
        this.spec
          .actionLabels[
            index
          ],
    );
  }

  getGoalConditions():
    EnvironmentSnapshot {
    return {
      [this.spec
        .stateKeys[1]]:
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
          "Unknown generated threshold action.",
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
      this.progress =
        Math.min(
          this.spec.target,
          this.progress +
            1,
        );
    } else if (
      role ===
        1 &&
      this.progress >=
        this.spec.target
    ) {
      this.complete =
        true;
    }

    return {
      accepted:
        true,

      summary:
        "Generated threshold action executed.",
    };
  }

  isGoalSatisfied():
    boolean {
    return this.complete;
  }
}

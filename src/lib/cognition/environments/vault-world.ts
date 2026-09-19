import type {
  CognitiveEnvironment,
  EnvironmentActionResult,
  EnvironmentSnapshot,
} from "../environment";

/**
 * Unknown-world experiment 001.
 *
 * Mabojolu sees:
 *
 * Goal: open the vault.
 * Actions: A, B, C.
 * Observable state.
 *
 * Mabojolu is NOT told which action:
 *
 * powers the system,
 * sets the latch,
 * attempts to open the vault.
 */

export type VaultActionLabel =
  | "A"
  | "B"
  | "C";

export type VaultActionRole =
  | "power"
  | "latch"
  | "open";

export type VaultActionMapping =
  Record<
    VaultActionLabel,
    VaultActionRole
  >;

const ACTIONS:
  readonly VaultActionLabel[] = [
    "A",
    "B",
    "C",
  ];

const DEFAULT_MAPPING:
  VaultActionMapping = {
    A: "power",
    B: "open",
    C: "latch",
  };

function validateMapping(
  mapping:
    VaultActionMapping,
): void {
  const roles =
    Object.values(
      mapping,
    );

  const required:
    VaultActionRole[] = [
      "power",
      "latch",
      "open",
    ];

  for (
    const role of required
  ) {
    const count =
      roles.filter(
        (candidate) =>
          candidate ===
          role,
      ).length;

    if (
      count !== 1
    ) {
      throw new Error(
        `Vault mapping must contain exactly one "${role}" action.`,
      );
    }
  }
}

export class VaultWorld
  implements CognitiveEnvironment
{
  readonly id =
    "vault-world-v0.1";

  readonly goalDescription =
    "Open the vault.";

  private power = false;

  private latch = false;

  private vaultOpen = false;

  private readonly mapping:
    VaultActionMapping;

  constructor(
    mapping:
      VaultActionMapping =
        DEFAULT_MAPPING,
  ) {
    validateMapping(
      mapping,
    );

    this.mapping = {
      ...mapping,
    };
  }

  getAvailableActions():
    readonly string[] {
    return ACTIONS;
  }

  observe():
    EnvironmentSnapshot {
    return {
      power:
        this.power,

      latch:
        this.latch,

      vaultOpen:
        this.vaultOpen,
    };
  }

  /**
   * Mabojolu is allowed to know what success looks like.
   *
   * This reveals no causal information about how the vault is opened.
   */
  getGoalConditions():
    EnvironmentSnapshot {
    return {
      vaultOpen:
        true,
    };
  }

  act(
    action: string,
  ): EnvironmentActionResult {
    if (
      !ACTIONS.includes(
        action as
          VaultActionLabel,
      )
    ) {
      return {
        accepted:
          false,

        summary:
          `Action ${action} is not available.`,
      };
    }

    const label =
      action as
        VaultActionLabel;

    const role =
      this.mapping[
        label
      ];

    switch (role) {
      case "power":
        this.power =
          true;
        break;

      case "latch":
        this.latch =
          true;
        break;

      case "open":
        if (
          this.power &&
          this.latch
        ) {
          this.vaultOpen =
            true;
        }
        break;
    }

    /*
     * Deliberately generic.
     *
     * The environment does not tell Mabojolu what the action means.
     * Mabojolu must infer meaning from observable state transitions.
     */
    return {
      accepted:
        true,

      summary:
        `Action ${label} executed.`,
    };
  }

  isGoalSatisfied():
    boolean {
    return this.vaultOpen;
  }
}
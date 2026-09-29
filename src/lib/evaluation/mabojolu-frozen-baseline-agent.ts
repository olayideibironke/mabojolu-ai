import type {
  GeneralizationAgent,
} from "./generalization-harness";

export interface MabojoluExternalObservation {
  kind: "unknown" | "evidence";
  evidence?: string;
}

export interface MabojoluBaselineDecision {
  action?: string;
  reason:
    | "gather-information"
    | "apply-observed-evidence"
    | "unsupported-evidence"
    | "no-information-action";
}

export interface MabojoluBaselineAgent
  extends GeneralizationAgent<string, MabojoluExternalObservation> {
  lastDecision(): MabojoluBaselineDecision | undefined;
}

/**
 * Frozen-baseline adapter for Phase 2.
 *
 * This intentionally does not modify the v1.x cognitive kernel. It translates
 * an external evaluator observation into the smallest action contract needed
 * to measure current behavior. Unknown observations trigger an information
 * action only when one is exposed by the environment. Evidence is applied only
 * when it names an action actually available in the current environment.
 */
export function createMabojoluFrozenBaselineAgent(): MabojoluBaselineAgent {
  let last: MabojoluBaselineDecision | undefined;

  return {
    reset() {
      last = undefined;
    },

    act({ observation, availableActions }) {
      if (observation.kind === "unknown") {
        if (availableActions.includes("inspect")) {
          last = {
            action: "inspect",
            reason: "gather-information",
          };
          return "inspect";
        }

        last = {
          reason: "no-information-action",
        };
        return undefined;
      }

      const evidence = observation.evidence?.trim();
      if (evidence && availableActions.includes(evidence)) {
        last = {
          action: evidence,
          reason: "apply-observed-evidence",
        };
        return evidence;
      }

      last = {
        reason: "unsupported-evidence",
      };
      return undefined;
    },

    lastDecision() {
      return last;
    },
  };
}

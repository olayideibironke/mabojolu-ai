import { describe, expect, it } from "vitest";

import type { Observation } from "../cognition/types";
import { evaluateGeneralizationTask } from "./generalization-harness";
import {
  createIntegratedKernelBaselineAgent,
  type IntegratedKernelExternalObservation,
} from "./integrated-kernel-baseline-agent";

function evidence(id: string): Observation {
  return {
    id,
    source: "environment",
    content: "Unfamiliar system evidence.",
    observedAt: "2026-10-04T00:00:00.000Z",
    metadata: {
      domain: "phase2-unseen-system",
      actionKind: "probe",
      outcomeKind: "state-change",
      "before:state": "closed",
      "after:state": "open",
    },
  };
}

function scenario() {
  return {
    environmentId: "phase2-system",
    observations: [evidence("p2-1"), evidence("p2-2"), evidence("p2-3")],
    models: [
      {
        id: "hypothesis-a",
        probability: 0.5,
        predictedOutcomes: { inspect: "amber" },
      },
      {
        id: "hypothesis-b",
        probability: 0.5,
        predictedOutcomes: { inspect: "violet" },
      },
    ],
    experiments: [
      {
        id: "inspect",
        actionKind: "inspect",
        risk: 0.05,
        reversible: true,
        cost: 0.1,
      },
    ],
    candidates: [
      { id: "amber", terms: ["amber"], baseUtility: 0.6, risk: 0.05 },
      { id: "violet", terms: ["violet"], baseUtility: 0.6, risk: 0.05 },
    ],
    memory: {
      autobiographical: [],
      semantic: [],
      revisions: [],
    },
    objective: {
      id: "phase2-objective",
      description: "Reach the hidden successful state.",
      successSignals: ["success"],
      maximumSteps: 2,
    },
    initialStrategyId: "amber",
    maximumRisk: 0.2,
    actionConfidenceThreshold: 0.9,
  };
}

describe("Phase 2 frozen v1.42 integrated-kernel bridge", () => {
  it("lets the real kernel request its uncertainty-reducing experiment", () => {
    const agent = createIntegratedKernelBaselineAgent(scenario());
    const action = agent.act({
      observation: { kind: "initial" },
      step: 0,
      availableActions: ["inspect", "amber", "violet"],
    });

    expect(action).toBe("inspect");
    expect(agent.lastKernelDecision()?.decision).toBe("experiment");
  });

  it("contains model-set failure instead of inventing an external action", () => {
    const agent = createIntegratedKernelBaselineAgent(scenario());
    const action = agent.act({
      observation: { kind: "experiment-outcome", outcome: "green" },
      step: 1,
      availableActions: ["inspect", "amber", "violet"],
    });

    expect(action).toBeUndefined();
    expect(agent.lastKernelDecision()?.induction.beliefUpdate?.modelSetFailure).toBe(true);
    expect(agent.lastKernelDecision()?.decision).toBe("observe");
  });

  it("runs end-to-end through the independent evaluator without prescribing success", () => {
    const agent = createIntegratedKernelBaselineAgent(scenario());
    const result = evaluateGeneralizationTask({
      task: {
        id: "integrated-kernel-held-out",
        domain: "phase2-integrated-kernel",
        maximumSteps: 2,
        initialObservation: { kind: "initial" } as IntegratedKernelExternalObservation,
        availableActions: ["inspect", "amber", "violet"],
        transition({ action }: { action: string; step: number }) {
          if (action === "inspect") {
            return {
              observation: {
                kind: "experiment-outcome",
                outcome: "amber",
              } as IntegratedKernelExternalObservation,
              reward: -0.1,
              success: false,
            };
          }

          return {
            observation: {
              kind: "experiment-outcome",
              outcome: "amber",
            } as IntegratedKernelExternalObservation,
            reward: action === "amber" ? 1 : -1,
            success: action === "amber",
            terminal: true,
          };
        },
      },
      agent,
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual(["inspect", "amber"]);
    expect(result.totalReward).toBeCloseTo(0.9);
  });
});

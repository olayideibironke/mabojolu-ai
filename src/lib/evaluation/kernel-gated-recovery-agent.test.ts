import { describe, expect, it } from "vitest";
import type { Observation } from "../cognition/types";
import { evaluateGeneralizationTask } from "./generalization-harness";
import { createKernelGatedRecoveryAgent } from "./kernel-gated-recovery-agent";
import type { IntegratedKernelExternalObservation } from "./integrated-kernel-baseline-agent";

function scenario() {
  const evidence: Observation = {
    id: "observation-1",
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
  return {
    environmentId: "phase2-system",
    observations: [evidence, { ...evidence, id: "observation-2" }, { ...evidence, id: "observation-3" }],
    models: [
      { id: "hypothesis-a", probability: 0.5, predictedOutcomes: { inspect: "amber" } },
      { id: "hypothesis-b", probability: 0.5, predictedOutcomes: { inspect: "violet" } },
    ],
    experiments: [{ id: "inspect", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 }],
    candidates: [
      { id: "amber", terms: ["amber"], baseUtility: 0.6, risk: 0.05 },
      { id: "violet", terms: ["violet"], baseUtility: 0.8, risk: 0.05 },
    ],
    memory: { autobiographical: [], semantic: [], revisions: [] },
    objective: { id: "objective", description: "Recover from wrong strategy", successSignals: ["success"], maximumSteps: 3 },
    initialStrategyId: "amber",
    maximumRisk: 0.2,
    actionConfidenceThreshold: 0.9,
  };
}

describe("Frozen kernel gate plus Phase 2B external recovery", () => {
  it("uses kernel discovery before consequence-driven recovery", () => {
    const agent = createKernelGatedRecoveryAgent(scenario());
    const result = evaluateGeneralizationTask({
      task: {
        id: "kernel-gated-recovery",
        domain: "external-evaluation",
        maximumSteps: 3,
        initialObservation: { kind: "initial" } as IntegratedKernelExternalObservation,
        availableActions: ["inspect", "amber", "violet"],
        transition({ action }) {
          if (action === "inspect") return {
            observation: { kind: "experiment-outcome", outcome: "amber" } as IntegratedKernelExternalObservation,
            reward: -0.1,
            success: false,
          };
          return {
            observation: { kind: "experiment-outcome", outcome: "amber" } as IntegratedKernelExternalObservation,
            reward: action === "violet" ? 1 : -1,
            success: action === "violet",
          };
        },
      },
      agent,
    });
    expect(result.actions).toEqual(["inspect", "amber", "violet"]);
    expect(result.success).toBe(true);
    expect(agent.lastKernelDecision()?.decision).toBe("act");
    expect(agent.learningState()?.failedStrategyIds).toContain("amber");
    expect(agent.learningState()?.status).toBe("succeeded");
  });

  it("abstains on model-set failure rather than inventing a strategy", () => {
    const agent = createKernelGatedRecoveryAgent(scenario());
    const result = evaluateGeneralizationTask({
      task: {
        id: "kernel-model-failure",
        domain: "external-evaluation",
        maximumSteps: 3,
        initialObservation: { kind: "initial" } as IntegratedKernelExternalObservation,
        availableActions: ["inspect", "amber", "violet"],
        transition() {
          return {
            observation: { kind: "experiment-outcome", outcome: "unmodeled" } as IntegratedKernelExternalObservation,
            reward: -0.1,
            success: false,
          };
        },
      },
      agent,
    });
    expect(result.actions).toEqual(["inspect"]);
    expect(result.abstained).toBe(true);
    expect(agent.learningState()?.completedSignals).toEqual([]);
  });
});

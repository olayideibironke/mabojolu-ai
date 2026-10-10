import { describe, expect, it } from "vitest";
import { evaluateGeneralizationTask } from "./generalization-harness";
import { createConsequenceGroundedEvaluatorAgent } from "./consequence-grounded-evaluator-agent";

function agent() {
  return createConsequenceGroundedEvaluatorAgent({
    objective: { id: "recover", description: "Succeed after external feedback", successSignals: ["success"], maximumSteps: 3 },
    initialStrategyId: "amber",
    candidates: [
      { id: "amber", terms: ["amber"], baseUtility: 0.6, risk: 0.05 },
      { id: "violet", terms: ["violet"], baseUtility: 0.8, risk: 0.05 },
    ],
    memory: { autobiographical: [], semantic: [], revisions: [] },
    maximumRisk: 0.2,
  });
}

describe("Phase 2B integrated external-consequence recovery", () => {
  it("recovers from externally observed failure without knowing the correct action in advance", () => {
    const learner = agent();
    const result = evaluateGeneralizationTask({
      task: {
        id: "held-out-recovery",
        domain: "external-recovery",
        maximumSteps: 3,
        initialObservation: "unknown",
        availableActions: ["amber", "violet"],
        transition({ action }) {
          return {
            observation: action === "violet" ? "goal-reached" : "action-failed",
            reward: action === "violet" ? 1 : -1,
            success: action === "violet",
          };
        },
      },
      agent: learner,
    });
    expect(result.actions).toEqual(["amber", "violet"]);
    expect(result.success).toBe(true);
    expect(result.totalReward).toBe(0);
    expect(learner.learningState()?.status).toBe("succeeded");
    expect(learner.learningState()?.failedStrategyIds).toContain("amber");
    expect(learner.recordedConsequences()).toHaveLength(2);
  });

  it("does not recover from terminal failure or invent a successful outcome", () => {
    const learner = agent();
    const result = evaluateGeneralizationTask({
      task: {
        id: "terminal-recovery",
        domain: "external-recovery",
        maximumSteps: 3,
        initialObservation: "unknown",
        availableActions: ["amber", "violet"],
        transition() {
          return { observation: "terminal", reward: -1, success: false, terminal: true };
        },
      },
      agent: learner,
    });
    expect(result.actions).toEqual(["amber"]);
    expect(result.success).toBe(false);
    expect(learner.learningState()?.status).toBe("budget-exhausted");
    expect(learner.learningState()?.completedSignals).toEqual([]);
  });
});

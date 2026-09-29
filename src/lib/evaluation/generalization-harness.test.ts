import { describe, expect, it } from "vitest";

import {
  evaluateGeneralizationTask,
  summarizeGeneralizationEvaluation,
  type GeneralizationAgent,
} from "./generalization-harness";

type Action = "inspect" | "left" | "right";

interface HiddenRuleObservation {
  marker: "unknown" | "left" | "right";
}

function hiddenRuleTask(correct: "left" | "right") {
  let inspected = false;

  return {
    id: `hidden-rule-${correct}`,
    domain: "unseen-hidden-rule",
    maximumSteps: 2,
    initialObservation: { marker: "unknown" } as HiddenRuleObservation,
    availableActions: ["inspect", "left", "right"] as const,
    transition({ action }: { action: Action; step: number }) {
      if (action === "inspect") {
        inspected = true;
        return {
          observation: { marker: correct } as HiddenRuleObservation,
          reward: -0.1,
          success: false,
        };
      }

      return {
        observation: { marker: inspected ? correct : "unknown" } as HiddenRuleObservation,
        reward: action === correct ? 1 : -1,
        success: action === correct,
        terminal: true,
      };
    },
  };
}

function informationSeekingAgent(): GeneralizationAgent<Action, HiddenRuleObservation> {
  return {
    reset() {},
    act({ observation }) {
      if (observation.marker === "unknown") return "inspect";
      return observation.marker;
    },
  };
}

describe("Phase 2 independent generalization evaluation harness", () => {
  it("scores behavior from environment consequences rather than expected internal strategy", () => {
    const result = evaluateGeneralizationTask({
      task: hiddenRuleTask("right"),
      agent: informationSeekingAgent(),
    });

    expect(result.success).toBe(true);
    expect(result.stepsUsed).toBe(2);
    expect(result.totalReward).toBeCloseTo(0.9);
    expect(result.reason).toBe("success");
  });

  it("measures failure without prescribing how the agent should reason", () => {
    const result = evaluateGeneralizationTask({
      task: hiddenRuleTask("left"),
      agent: {
        reset() {},
        act: () => "right",
      },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("environment-terminal");
  });

  it("records explicit abstention separately from task failure", () => {
    const result = evaluateGeneralizationTask({
      task: hiddenRuleTask("left"),
      agent: {
        reset() {},
        act: () => undefined,
      },
    });

    expect(result.success).toBe(false);
    expect(result.abstained).toBe(true);
    expect(result.reason).toBe("agent-abstained");
  });

  it("enforces the external step budget", () => {
    const result = evaluateGeneralizationTask({
      task: {
        id: "budget-test",
        domain: "unseen-budget",
        maximumSteps: 2,
        initialObservation: 0,
        availableActions: ["wait"] as const,
        transition: () => ({ observation: 0, reward: 0, success: false }),
      },
      agent: {
        reset() {},
        act: () => "wait" as const,
      },
    });

    expect(result.stepsUsed).toBe(2);
    expect(result.reason).toBe("step-budget-exhausted");
  });

  it("summarizes outcome metrics without architecture-specific assertions", () => {
    const success = evaluateGeneralizationTask({
      task: hiddenRuleTask("right"),
      agent: informationSeekingAgent(),
    });
    const abstention = evaluateGeneralizationTask({
      task: hiddenRuleTask("left"),
      agent: { reset() {}, act: () => undefined },
    });

    const summary = summarizeGeneralizationEvaluation([success, abstention]);

    expect(summary.tasks).toBe(2);
    expect(summary.successes).toBe(1);
    expect(summary.abstentions).toBe(1);
    expect(summary.successRate).toBe(0.5);
    expect(summary.meanSteps).toBe(1);
  });
});

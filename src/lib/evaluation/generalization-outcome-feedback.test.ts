import { describe, expect, it } from "vitest";
import { evaluateGeneralizationTask, type GeneralizationAgent } from "./generalization-harness";

describe("Independent evaluator consequence feedback", () => {
  it("delivers externally scored outcomes in order before the next decision", () => {
    const events: string[] = [];
    const agent: GeneralizationAgent<string, number> = {
      reset() { events.push("reset"); },
      act({ step }) {
        events.push(`act-${step}`);
        return step === 0 ? "inspect" : "amber";
      },
      onOutcome({ action, reward, success, observation }) {
        events.push(`outcome-${action}-${reward}-${success}-${observation}`);
      },
    };
    const result = evaluateGeneralizationTask({
      task: {
        id: "feedback-1",
        domain: "controlled",
        maximumSteps: 2,
        initialObservation: 0,
        availableActions: ["inspect", "amber"],
        transition({ action }) {
          return action === "inspect"
            ? { observation: 1, reward: -0.1, success: false }
            : { observation: 2, reward: 1, success: true };
        },
      },
      agent,
    });
    expect(result.success).toBe(true);
    expect(events).toEqual([
      "reset",
      "act-0",
      "outcome-inspect--0.1-false-1",
      "act-1",
      "outcome-amber-1-true-2",
    ]);
  });

  it("reports terminal failure without granting success", () => {
    const outcomes: boolean[] = [];
    const result = evaluateGeneralizationTask({
      task: {
        id: "feedback-2",
        domain: "controlled",
        maximumSteps: 2,
        initialObservation: "unknown",
        availableActions: ["amber"],
        transition() {
          return { observation: "failed", reward: -1, success: false, terminal: true };
        },
      },
      agent: {
        reset() {},
        act() { return "amber"; },
        onOutcome({ success }) { outcomes.push(success); },
      },
    });
    expect(outcomes).toEqual([false]);
    expect(result.reason).toBe("environment-terminal");
    expect(result.success).toBe(false);
  });
});

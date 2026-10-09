import { describe, expect, it } from "vitest";
import { ConsequenceGroundedLearningSession } from "./consequence-grounded-learning";

function session(maximumSteps = 3) {
  return new ConsequenceGroundedLearningSession(
    { id: "objective", description: "Reach a verified outcome", successSignals: ["success"], maximumSteps },
    "amber",
    [
      { id: "amber", terms: ["amber"], baseUtility: 0.6, risk: 0.05 },
      { id: "violet", terms: ["violet"], baseUtility: 0.8, risk: 0.05 },
    ],
    { autobiographical: [], semantic: [], revisions: [] },
    0.2,
  );
}

describe("Phase 2B consequence-grounded learning", () => {
  it("does not award success from an unsuccessful external consequence", () => {
    const learner = session();
    const state = learner.record({ action: "amber", reward: 0, success: false });
    expect(state.status).toBe("active");
    expect(state.completedSignals).toEqual([]);
    expect(state.step).toBe(1);
  });

  it("replans after an externally failed action and succeeds only after confirmation", () => {
    const learner = session();
    const failed = learner.record({ action: "amber", reward: -1, success: false });
    expect(failed.failedStrategyIds).toContain("amber");
    expect(failed.strategyId).toBe("violet");
    expect(failed.completedSignals).toEqual([]);

    const succeeded = learner.record({ action: "violet", reward: 1, success: true });
    expect(succeeded.status).toBe("succeeded");
    expect(succeeded.completedSignals).toEqual(["success"]);
    expect(succeeded.step).toBe(2);
    expect(learner.consequences()).toHaveLength(2);
  });

  it("rejects consequences for actions that were not the active strategy", () => {
    const learner = session();
    expect(() => learner.record({ action: "violet", reward: 1, success: true })).toThrow(
      "External consequence must match the active strategy.",
    );
    expect(learner.currentState().step).toBe(0);
  });

  it("contains terminal failure and prevents further learning", () => {
    const learner = session();
    const state = learner.record({ action: "amber", reward: -1, success: false, terminal: true });
    expect(state.status).toBe("budget-exhausted");
    expect(state.completedSignals).toEqual([]);
    expect(() => learner.record({ action: "amber", reward: 1, success: true })).toThrow();
  });

  it("rejects nonfinite reward without mutating state", () => {
    const learner = session();
    expect(() => learner.record({ action: "amber", reward: Number.NaN, success: false })).toThrow();
    expect(learner.currentState().step).toBe(0);
    expect(learner.consequences()).toHaveLength(0);
  });
});

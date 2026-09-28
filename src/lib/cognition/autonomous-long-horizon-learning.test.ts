import { describe, expect, it } from "vitest";

import {
  advanceLongHorizonLearning,
  beginLongHorizonLearning,
} from "./autonomous-long-horizon-learning";

const objective = {
  id: "objective-1",
  description: "Learn how to stabilize and unlock an unfamiliar apparatus.",
  successSignals: ["stable", "unlocked"],
  maximumSteps: 4,
};

describe("autonomous long-horizon learning", () => {
  it("preserves progress across multiple experiences", () => {
    const initial = beginLongHorizonLearning({ objective, strategyId: "probe" });
    const afterFirst = advanceLongHorizonLearning({
      state: initial,
      experience: {
        strategyId: "probe",
        observedSignals: ["stable"],
        lesson: "Low-energy probing stabilizes the apparatus.",
      },
    });
    const afterSecond = advanceLongHorizonLearning({
      state: afterFirst,
      experience: {
        strategyId: "probe",
        observedSignals: ["unlocked"],
      },
    });

    expect(afterSecond.completedSignals).toEqual(["stable", "unlocked"]);
    expect(afterSecond.status).toBe("succeeded");
    expect(afterSecond.step).toBe(2);
  });

  it("revises strategy after failure without losing learned progress", () => {
    const initial = beginLongHorizonLearning({ objective, strategyId: "force" });
    const revised = advanceLongHorizonLearning({
      state: initial,
      experience: {
        strategyId: "force",
        observedSignals: ["stable"],
        lesson: "Force destabilizes the lock path.",
        failed: true,
      },
      nextStrategyId: "inspect",
    });

    expect(revised.strategyId).toBe("inspect");
    expect(revised.failedStrategyIds).toEqual(["force"]);
    expect(revised.completedSignals).toEqual(["stable"]);
    expect(revised.lessons).toEqual(["Force destabilizes the lock path."]);
    expect(revised.status).toBe("active");
  });

  it("refuses to continue a failed strategy without an explicit replacement", () => {
    const initial = beginLongHorizonLearning({ objective, strategyId: "force" });

    expect(() =>
      advanceLongHorizonLearning({
        state: initial,
        experience: {
          strategyId: "force",
          observedSignals: [],
          failed: true,
        },
      }),
    ).toThrow(/replacement strategy/);
  });

  it("stops when the objective step budget is exhausted", () => {
    const initial = beginLongHorizonLearning({
      objective: { ...objective, maximumSteps: 1 },
      strategyId: "inspect",
    });
    const exhausted = advanceLongHorizonLearning({
      state: initial,
      experience: {
        strategyId: "inspect",
        observedSignals: [],
      },
    });

    expect(exhausted.status).toBe("budget-exhausted");
    expect(exhausted.step).toBe(1);
  });

  it("rejects experience attributed to a strategy that was not active", () => {
    const initial = beginLongHorizonLearning({ objective, strategyId: "inspect" });

    expect(() =>
      advanceLongHorizonLearning({
        state: initial,
        experience: {
          strategyId: "force",
          observedSignals: ["stable"],
        },
      }),
    ).toThrow(/active strategy/);
  });
});

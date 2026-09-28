import { describe, expect, it } from "vitest";

import { runAdaptiveLongHorizonLearning } from "./adaptive-long-horizon-learning";
import { beginLongHorizonLearning } from "./autonomous-long-horizon-learning";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";

const memory: PersistentMemoryStore = {
  autobiographical: [],
  semantic: [
    {
      id: "lesson-probe",
      kind: "semantic",
      statement: "Low energy probe stabilizes unfamiliar apparatus.",
      confidence: 0.9,
      derivedFromIds: ["obs-a", "obs-b"],
      domains: ["apparatus"],
      consolidatedAt: "2026-09-28T15:40:00.000Z",
    },
  ],
  revisions: [],
};

function initialState(maximumSteps = 4) {
  return beginLongHorizonLearning({
    objective: {
      id: "objective-adaptive",
      description: "Stabilize and unlock an unfamiliar apparatus.",
      successSignals: ["stable", "unlocked"],
      maximumSteps,
    },
    strategyId: "force",
  });
}

const candidates = [
  { id: "force", terms: ["force"], baseUtility: 1, risk: 0.05 },
  { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
  { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
];

describe("adaptive long-horizon learning", () => {
  it("recovers from failure using memory without losing partial progress", () => {
    const result = runAdaptiveLongHorizonLearning({
      initialState: initialState(),
      memory,
      candidates,
      experience: (state) =>
        state.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              lesson: "Force cannot complete the unlock path.",
              failed: true,
            }
          : {
              strategyId: state.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(result.state.status).toBe("succeeded");
    expect(result.state.completedSignals).toEqual(["stable", "unlocked"]);
    expect(result.state.failedStrategyIds).toEqual(["force"]);
    expect(result.steps[0]?.afterStrategyId).toBe("probe");
    expect(result.steps[0]?.selection?.supportingMemoryIds).toEqual(["lesson-probe"]);
    expect(result.state.step).toBe(2);
  });

  it("does not return to a failed strategy even when it has the highest base utility", () => {
    const result = runAdaptiveLongHorizonLearning({
      initialState: initialState(),
      memory,
      candidates,
      experience: (state) =>
        state.strategyId === "force"
          ? { strategyId: "force", observedSignals: [], failed: true }
          : { strategyId: state.strategyId, observedSignals: ["stable", "unlocked"] },
    });

    expect(result.steps[0]?.selection?.rejectedStrategyIds).toContain("force");
    expect(result.steps[0]?.afterStrategyId).toBe("probe");
  });

  it("refuses an unsafe replacement even when it is highly attractive", () => {
    const result = runAdaptiveLongHorizonLearning({
      initialState: initialState(),
      memory,
      candidates: [
        { id: "force", terms: ["force"], baseUtility: 1, risk: 0.05 },
        { id: "dangerous", terms: ["probe"], baseUtility: 100, risk: 0.9 },
        { id: "probe", terms: ["probe"], baseUtility: 0.55, risk: 0.05 },
      ],
      maximumRisk: 0.2,
      experience: (state) =>
        state.strategyId === "force"
          ? { strategyId: "force", observedSignals: [], failed: true }
          : { strategyId: state.strategyId, observedSignals: ["stable", "unlocked"] },
    });

    expect(result.steps[0]?.selection?.rejectedStrategyIds).toContain("dangerous");
    expect(result.steps[0]?.afterStrategyId).toBe("probe");
  });

  it("fails closed when failure leaves no safe novel replacement", () => {
    expect(() =>
      runAdaptiveLongHorizonLearning({
        initialState: initialState(),
        memory,
        candidates: [
          { id: "force", terms: ["force"], baseUtility: 1, risk: 0.05 },
          { id: "dangerous", terms: ["probe"], baseUtility: 100, risk: 0.9 },
        ],
        maximumRisk: 0.2,
        experience: () => ({
          strategyId: "force",
          observedSignals: [],
          failed: true,
        }),
      }),
    ).toThrow(/No safe memory-informed replacement/);
  });
});

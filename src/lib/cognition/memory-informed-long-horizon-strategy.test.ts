import { describe, expect, it } from "vitest";

import { beginLongHorizonLearning } from "./autonomous-long-horizon-learning";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";
import { selectMemoryInformedLongHorizonStrategy } from "./memory-informed-long-horizon-strategy";

const state = beginLongHorizonLearning({
  objective: {
    id: "objective-1",
    description: "Stabilize and unlock the apparatus.",
    successSignals: ["stable", "unlocked"],
    maximumSteps: 5,
  },
  strategyId: "observe",
});

const memory: PersistentMemoryStore = {
  autobiographical: [],
  semantic: [
    {
      id: "memory-safe-probe",
      kind: "semantic",
      statement: "Low energy probe stabilizes unfamiliar apparatus.",
      domains: ["apparatus"],
      confidence: 0.9,
      derivedFromIds: ["episode-1", "episode-2"],
      consolidatedAt: "2026-09-28T15:35:00.000Z",
    },
    {
      id: "memory-force",
      kind: "semantic",
      statement: "Force damages unfamiliar apparatus.",
      domains: ["apparatus"],
      confidence: 0.95,
      derivedFromIds: ["episode-3", "episode-4"],
      consolidatedAt: "2026-09-28T15:35:00.000Z",
    },
  ],
  revisions: [],
};

describe("memory-informed long-horizon strategy selection", () => {
  it("lets relevant persistent memory change the preferred safe strategy", () => {
    const selection = selectMemoryInformedLongHorizonStrategy({
      state,
      memory,
      candidates: [
        { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
        { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
      ],
    });

    expect(selection.selectedStrategyId).toBe("probe");
    expect(selection.supportingMemoryIds).toEqual(["memory-safe-probe"]);
    expect(selection.reason).toBe("memory-informed-strategy");
  });

  it("does not reuse a strategy already recorded as failed", () => {
    const selection = selectMemoryInformedLongHorizonStrategy({
      state: { ...state, failedStrategyIds: ["probe"] },
      memory,
      candidates: [
        { id: "probe", terms: ["probe"], baseUtility: 1, risk: 0.01 },
        { id: "wait", terms: ["wait"], baseUtility: 0.2, risk: 0 },
      ],
    });

    expect(selection.selectedStrategyId).toBe("wait");
    expect(selection.rejectedStrategyIds).toContain("probe");
  });

  it("rejects a high-utility strategy that exceeds the risk boundary", () => {
    const selection = selectMemoryInformedLongHorizonStrategy({
      state,
      memory,
      candidates: [
        { id: "force", terms: ["force"], baseUtility: 100, risk: 0.9 },
        { id: "probe", terms: ["probe"], baseUtility: 0.1, risk: 0.05 },
      ],
      maximumRisk: 0.2,
    });

    expect(selection.selectedStrategyId).toBe("probe");
    expect(selection.rejectedStrategyIds).toContain("force");
  });

  it("fails closed when every candidate is unsafe or previously failed", () => {
    const selection = selectMemoryInformedLongHorizonStrategy({
      state: { ...state, failedStrategyIds: ["probe"] },
      memory,
      candidates: [
        { id: "probe", terms: ["probe"], baseUtility: 1, risk: 0.01 },
        { id: "force", terms: ["force"], baseUtility: 10, risk: 0.8 },
      ],
    });

    expect(selection.selectedStrategyId).toBeUndefined();
    expect(selection.reason).toBe("no-safe-novel-strategy");
  });

  it("does not let irrelevant high-confidence memory distort strategy choice", () => {
    const misleadingMemory: PersistentMemoryStore = {
      autobiographical: [],
      semantic: [
        {
          id: "irrelevant-memory",
          kind: "semantic",
          statement: "Ocean salinity predicts marine buoyancy.",
          domains: ["marine"],
          confidence: 1,
          derivedFromIds: ["marine-a", "marine-b"],
          consolidatedAt: "2026-09-28T15:55:00.000Z",
        },
      ],
      revisions: [],
    };
    const selection = selectMemoryInformedLongHorizonStrategy({
      state,
      memory: misleadingMemory,
      candidates: [
        { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
        { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
      ],
    });

    expect(selection.selectedStrategyId).toBe("wait");
    expect(selection.supportingMemoryIds).toEqual([]);
  });

  it("ignores retracted semantic memory during strategy selection", () => {
    const retracted: PersistentMemoryStore = {
      autobiographical: [],
      semantic: [
        {
          id: "retracted-probe",
          kind: "semantic",
          statement: "Low energy probe stabilizes unfamiliar apparatus.",
          domains: ["apparatus"],
          confidence: 0,
          derivedFromIds: ["old-a", "old-b"],
          consolidatedAt: "2026-09-28T15:55:00.000Z",
        },
      ],
      revisions: [],
    };
    const selection = selectMemoryInformedLongHorizonStrategy({
      state,
      memory: retracted,
      candidates: [
        { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
        { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
      ],
    });

    expect(selection.selectedStrategyId).toBe("wait");
    expect(selection.supportingMemoryIds).toEqual([]);
  });
});

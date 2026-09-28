import { describe, expect, it } from "vitest";

import { runAdaptiveLongHorizonLearning } from "./adaptive-long-horizon-learning";
import {
  advanceLongHorizonLearning,
  beginLongHorizonLearning,
} from "./autonomous-long-horizon-learning";
import { persistLongHorizonLesson } from "./long-horizon-memory-consolidation";
import { selectMemoryInformedLongHorizonStrategy } from "./memory-informed-long-horizon-strategy";
import { createPersistentMemoryStore } from "./persistent-memory-lifecycle";
import {
  restorePersistentMemory,
  serializePersistentMemory,
} from "./persistent-memory-snapshot";

const candidates = [
  { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
  { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
  { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
];

function learnProbeLesson() {
  const initial = beginLongHorizonLearning({
    objective: {
      id: "episode-a",
      description: "Stabilize unfamiliar apparatus A.",
      successSignals: ["stable"],
      maximumSteps: 3,
    },
    strategyId: "probe",
  });
  const learned = advanceLongHorizonLearning({
    state: initial,
    experience: {
      strategyId: "probe",
      observedSignals: ["stable"],
      lesson: "Low energy probe stabilizes unfamiliar apparatus.",
    },
  });
  const persisted = persistLongHorizonLesson({
    store: createPersistentMemoryStore(),
    state: learned,
    lesson: "Low energy probe stabilizes unfamiliar apparatus.",
    evidence: [
      { id: "episode-a-observation-1", sourceId: "sensor-a", domain: "apparatus-a" },
      { id: "episode-a-observation-2", sourceId: "sensor-b", domain: "apparatus-a" },
    ],
    memoryId: "probe-transfer-lesson",
    confidence: 0.9,
    consolidatedAt: "2026-09-28T15:50:00.000Z",
  });
  return restorePersistentMemory(serializePersistentMemory(persisted));
}

describe("multi-episode autonomous long-horizon learning benchmark", () => {
  it("transfers a prior-session lesson into the first strategy choice of a later task", () => {
    const memory = learnProbeLesson();
    const later = beginLongHorizonLearning({
      objective: {
        id: "episode-b",
        description: "Stabilize unfamiliar apparatus B.",
        successSignals: ["stable"],
        maximumSteps: 3,
      },
      strategyId: "observe",
    });

    const selection = selectMemoryInformedLongHorizonStrategy({
      state: later,
      memory,
      candidates,
    });

    expect(selection.selectedStrategyId).toBe("probe");
    expect(selection.supportingMemoryIds).toEqual(["probe-transfer-lesson"]);
  });

  it("uses transferred knowledge to reduce trial and error on a related later task", () => {
    const memory = learnProbeLesson();
    const later = beginLongHorizonLearning({
      objective: {
        id: "episode-b",
        description: "Stabilize unfamiliar apparatus B.",
        successSignals: ["stable"],
        maximumSteps: 3,
      },
      strategyId: "observe",
    });
    const informed = selectMemoryInformedLongHorizonStrategy({
      state: later,
      memory,
      candidates,
    });

    expect(informed.selectedStrategyId).toBe("probe");
    expect(informed.selectedStrategyId).not.toBe("force");
  });

  it("survives a later failure, replans from restored memory, and completes the objective", () => {
    const memory = learnProbeLesson();
    const initial = beginLongHorizonLearning({
      objective: {
        id: "episode-c",
        description: "Stabilize and unlock unfamiliar apparatus C.",
        successSignals: ["stable", "unlocked"],
        maximumSteps: 4,
      },
      strategyId: "force",
    });

    const result = runAdaptiveLongHorizonLearning({
      initialState: initial,
      memory,
      candidates,
      experience: (state) =>
        state.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              failed: true,
              lesson: "Force cannot complete this unlock path.",
            }
          : {
              strategyId: state.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(result.state.status).toBe("succeeded");
    expect(result.state.step).toBe(2);
    expect(result.state.completedSignals).toEqual(["stable", "unlocked"]);
    expect(result.steps[0]?.afterStrategyId).toBe("probe");
    expect(result.steps[0]?.selection?.supportingMemoryIds).toEqual([
      "probe-transfer-lesson",
    ]);
  });

  it("does not let transfer override the safety boundary", () => {
    const memory = learnProbeLesson();
    const initial = beginLongHorizonLearning({
      objective: {
        id: "episode-d",
        description: "Stabilize unfamiliar apparatus D.",
        successSignals: ["stable"],
        maximumSteps: 3,
      },
      strategyId: "force",
    });

    const result = runAdaptiveLongHorizonLearning({
      initialState: initial,
      memory,
      candidates: [
        { id: "force", terms: ["force"], baseUtility: 1, risk: 0.05 },
        { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 100, risk: 0.9 },
        { id: "wait", terms: ["wait"], baseUtility: 0.1, risk: 0 },
      ],
      maximumRisk: 0.2,
      experience: (state) =>
        state.strategyId === "force"
          ? { strategyId: "force", observedSignals: [], failed: true }
          : { strategyId: state.strategyId, observedSignals: ["stable"] },
    });

    expect(result.steps[0]?.selection?.rejectedStrategyIds).toContain("probe");
    expect(result.steps[0]?.afterStrategyId).toBe("wait");
    expect(result.state.status).toBe("succeeded");
  });

  it("remains bounded when transfer cannot solve the later objective", () => {
    const memory = learnProbeLesson();
    const initial = beginLongHorizonLearning({
      objective: {
        id: "episode-e",
        description: "Reach an unavailable signal.",
        successSignals: ["novel-signal"],
        maximumSteps: 2,
      },
      strategyId: "probe",
    });

    const result = runAdaptiveLongHorizonLearning({
      initialState: initial,
      memory,
      candidates,
      experience: (state) => ({
        strategyId: state.strategyId,
        observedSignals: [],
      }),
    });

    expect(result.state.status).toBe("budget-exhausted");
    expect(result.state.step).toBe(2);
  });
});

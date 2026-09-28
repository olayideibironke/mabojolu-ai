import { describe, expect, it } from "vitest";

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

function learnedState() {
  const initial = beginLongHorizonLearning({
    objective: {
      id: "apparatus-a",
      description: "Stabilize unfamiliar apparatus A.",
      successSignals: ["stable"],
      maximumSteps: 3,
    },
    strategyId: "probe",
  });
  return advanceLongHorizonLearning({
    state: initial,
    experience: {
      strategyId: "probe",
      observedSignals: ["stable"],
      lesson: "Low energy probe stabilizes unfamiliar apparatus.",
    },
  });
}

describe("long-horizon memory consolidation", () => {
  it("persists an earned lesson with independent provenance", () => {
    const store = persistLongHorizonLesson({
      store: createPersistentMemoryStore(),
      state: learnedState(),
      lesson: "Low energy probe stabilizes unfamiliar apparatus.",
      evidence: [
        { id: "obs-a", sourceId: "sensor-a", domain: "apparatus-a" },
        { id: "obs-b", sourceId: "sensor-b", domain: "apparatus-a" },
      ],
      memoryId: "lesson-probe",
      confidence: 0.9,
      consolidatedAt: "2026-09-28T15:40:00.000Z",
    });

    expect(store.semantic[0]?.derivedFromIds).toEqual(["obs-a", "obs-b"]);
    expect(store.semantic[0]?.domains).toEqual(["apparatus-a"]);
  });

  it("refuses to persist a lesson that was not earned by the active learning history", () => {
    expect(() =>
      persistLongHorizonLesson({
        store: createPersistentMemoryStore(),
        state: learnedState(),
        lesson: "Force is always safe.",
        evidence: [
          { id: "obs-a", sourceId: "sensor-a", domain: "apparatus-a" },
          { id: "obs-b", sourceId: "sensor-b", domain: "apparatus-a" },
        ],
        memoryId: "fabricated",
        confidence: 0.9,
        consolidatedAt: "2026-09-28T15:40:00.000Z",
      }),
    ).toThrow(/earned/);
  });

  it("refuses single-source evidence masquerading as repeated support", () => {
    expect(() =>
      persistLongHorizonLesson({
        store: createPersistentMemoryStore(),
        state: learnedState(),
        lesson: "Low energy probe stabilizes unfamiliar apparatus.",
        evidence: [
          { id: "obs-a", sourceId: "sensor-a", domain: "apparatus-a" },
          { id: "obs-b", sourceId: "sensor-a", domain: "apparatus-a" },
        ],
        memoryId: "lesson-probe",
        confidence: 0.9,
        consolidatedAt: "2026-09-28T15:40:00.000Z",
      }),
    ).toThrow(/independent sources/);
  });

  it("survives a session snapshot and changes strategy on a later objective", () => {
    const persisted = persistLongHorizonLesson({
      store: createPersistentMemoryStore(),
      state: learnedState(),
      lesson: "Low energy probe stabilizes unfamiliar apparatus.",
      evidence: [
        { id: "obs-a", sourceId: "sensor-a", domain: "apparatus-a" },
        { id: "obs-b", sourceId: "sensor-b", domain: "apparatus-b" },
      ],
      memoryId: "lesson-probe",
      confidence: 0.9,
      consolidatedAt: "2026-09-28T15:40:00.000Z",
    });
    const restored = restorePersistentMemory(serializePersistentMemory(persisted));

    const laterState = beginLongHorizonLearning({
      objective: {
        id: "apparatus-b",
        description: "Stabilize unfamiliar apparatus B.",
        successSignals: ["stable"],
        maximumSteps: 3,
      },
      strategyId: "observe",
    });
    const selection = selectMemoryInformedLongHorizonStrategy({
      state: laterState,
      memory: restored,
      candidates: [
        { id: "wait", terms: ["wait"], baseUtility: 0.7, risk: 0 },
        { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
      ],
    });

    expect(selection.selectedStrategyId).toBe("probe");
    expect(selection.supportingMemoryIds).toEqual(["lesson-probe"]);
  });
});

import { describe, expect, it } from "vitest";

import type { Observation } from "./types";
import { beginLongHorizonLearning } from "./autonomous-long-horizon-learning";
import { runIntegratedGeneralAgentCycle } from "./integrated-general-agent";
import { persistLongHorizonLesson } from "./long-horizon-memory-consolidation";
import {
  restorePersistentMemory,
  serializePersistentMemory,
} from "./persistent-memory-snapshot";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";

function observations(domain: string): Observation[] {
  return ["a", "b", "c"].map((suffix) => ({
    id: `${domain}-obs-${suffix}`,
    source: "environment",
    content: "Observed unfamiliar apparatus.",
    observedAt: "2026-09-28T16:20:00.000Z",
    metadata: {
      domain,
      actionKind: "probe",
      outcomeKind: "signal-change",
      "before:signal": "low",
      "after:signal": "high",
    },
  }));
}

const models = [
  {
    id: "model-a",
    probability: 0.5,
    predictedOutcomes: { inspect: "marker-present" },
  },
  {
    id: "model-b",
    probability: 0.5,
    predictedOutcomes: { inspect: "marker-absent" },
  },
];

const experiments = [
  { id: "inspect", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 },
];

const emptyMemory: PersistentMemoryStore = {
  autobiographical: [],
  semantic: [],
  revisions: [],
};

const candidates = [
  { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
  { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
];

describe("v1.42 cross-session integrated general-agent transfer", () => {
  it("learns in one integrated episode and transfers the earned lesson after snapshot restore", () => {
    const firstState = beginLongHorizonLearning({
      objective: {
        id: "episode-one",
        description: "Stabilize and unlock apparatus A.",
        successSignals: ["stable", "unlocked"],
        maximumSteps: 4,
      },
      strategyId: "force",
    });

    const first = runIntegratedGeneralAgentCycle({
      environmentId: "apparatus-a",
      observations: observations("apparatus-a"),
      models,
      experiments,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-present",
        observedAt: "2026-09-28T16:21:00.000Z",
      },
      state: firstState,
      memory: {
        ...emptyMemory,
        semantic: [{
          id: "prior-probe",
          kind: "semantic",
          statement: "Low energy probe stabilizes unfamiliar apparatus.",
          confidence: 0.9,
          derivedFromIds: ["prior-a", "prior-b"],
          domains: ["apparatus-a"],
          consolidatedAt: "2026-09-28T16:00:00.000Z",
        }],
      },
      candidates,
      experience: (current) =>
        current.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              lesson: "Probe stabilizes unfamiliar apparatus.",
              failed: true,
            }
          : {
              strategyId: current.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(first.learning?.state.status).toBe("succeeded");
    expect(first.learning?.state.lessons).toContain(
      "Probe stabilizes unfamiliar apparatus.",
    );

    const persisted = persistLongHorizonLesson({
      store: emptyMemory,
      state: first.learning!.state,
      lesson: "Probe stabilizes unfamiliar apparatus.",
      evidence: [
        { id: "episode-a-1", sourceId: "sensor-a", domain: "apparatus-a" },
        { id: "episode-a-2", sourceId: "sensor-b", domain: "apparatus-a" },
      ],
      memoryId: "earned-probe-lesson",
      confidence: 0.95,
      consolidatedAt: "2026-09-28T16:22:00.000Z",
    });

    const restored = restorePersistentMemory(serializePersistentMemory(persisted));

    const secondState = beginLongHorizonLearning({
      objective: {
        id: "episode-two",
        description: "Unlock related apparatus B.",
        successSignals: ["unlocked"],
        maximumSteps: 3,
      },
      strategyId: "force",
    });

    const second = runIntegratedGeneralAgentCycle({
      environmentId: "apparatus-b",
      observations: observations("apparatus-b"),
      models,
      experiments,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-present",
        observedAt: "2026-09-28T16:23:00.000Z",
      },
      state: secondState,
      memory: restored,
      candidates,
      experience: (current) =>
        current.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: [],
              failed: true,
            }
          : {
              strategyId: current.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(second.learning?.steps).toHaveLength(2);
    expect(second.learning?.steps[0]?.afterStrategyId).toBe("probe");
    expect(second.learning?.steps[0]?.selection?.supportingMemoryIds).toContain(
      "earned-probe-lesson",
    );
    expect(second.learning?.state.status).toBe("succeeded");
    expect(second.decision).toBe("completed");
  });
});

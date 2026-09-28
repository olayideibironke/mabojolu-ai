import { describe, expect, it } from "vitest";

import type { Observation } from "./types";
import { beginLongHorizonLearning } from "./autonomous-long-horizon-learning";
import { runIntegratedGeneralAgentCycle } from "./integrated-general-agent";
import type { PersistentMemoryStore } from "./persistent-memory-lifecycle";

function evidence(id: string): Observation {
  return {
    id,
    source: "environment",
    content: "Observed unfamiliar apparatus.",
    observedAt: "2026-09-28T16:15:00.000Z",
    metadata: {
      domain: "unknown-apparatus",
      actionKind: "probe",
      outcomeKind: "signal-change",
      "before:signal": "low",
      "after:signal": "high",
    },
  };
}

const observations = [evidence("obs-1"), evidence("obs-2"), evidence("obs-3")];
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
const memory: PersistentMemoryStore = {
  autobiographical: [],
  semantic: [
    {
      id: "probe-memory",
      kind: "semantic",
      statement: "Low energy probe stabilizes unfamiliar apparatus.",
      confidence: 0.9,
      derivedFromIds: ["old-a", "old-b"],
      domains: ["unknown-apparatus"],
      consolidatedAt: "2026-09-28T16:00:00.000Z",
    },
  ],
  revisions: [],
};
const state = beginLongHorizonLearning({
  objective: {
    id: "integrated-objective",
    description: "Stabilize and unlock the apparatus.",
    successSignals: ["stable", "unlocked"],
    maximumSteps: 4,
  },
  strategyId: "force",
});
const candidates = [
  { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
  { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
];

describe("v1.42 integrated general-agent cycle", () => {
  it("does not execute the objective before uncertainty is resolved", () => {
    const result = runIntegratedGeneralAgentCycle({
      environmentId: "apparatus",
      observations,
      models,
      experiments,
      state,
      memory,
      candidates,
      experience: () => {
        throw new Error("execution must not occur");
      },
    });

    expect(result.decision).toBe("experiment");
    expect(result.learning).toBeUndefined();
  });

  it("integrates induction, earned action confidence, failure recovery, memory, and objective completion", () => {
    const result = runIntegratedGeneralAgentCycle({
      environmentId: "apparatus",
      observations,
      models,
      experiments,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-present",
        observedAt: "2026-09-28T16:16:00.000Z",
      },
      state,
      memory,
      candidates,
      experience: (current) =>
        current.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              failed: true,
            }
          : {
              strategyId: current.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(result.induction.next).toBe("act");
    expect(result.learning?.steps[0]?.afterStrategyId).toBe("probe");
    expect(result.learning?.state.completedSignals).toEqual(["stable", "unlocked"]);
    expect(result.learning?.state.status).toBe("succeeded");
    expect(result.decision).toBe("completed");
  });

  it("keeps safety governance active during integrated recovery", () => {
    expect(() =>
      runIntegratedGeneralAgentCycle({
        environmentId: "apparatus",
        observations,
        models,
        experiments,
        experimentObservation: {
          actionKind: "inspect",
          outcome: "marker-present",
          observedAt: "2026-09-28T16:16:00.000Z",
        },
        state,
        memory,
        candidates: [
          { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
          { id: "probe", terms: ["probe"], baseUtility: 100, risk: 0.9 },
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

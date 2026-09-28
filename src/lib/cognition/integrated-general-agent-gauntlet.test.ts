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

function evidence(domain: string): Observation[] {
  return ["1", "2", "3"].map((suffix) => ({
    id: `${domain}-${suffix}`,
    source: "environment",
    content: "Observed unfamiliar controlled system.",
    observedAt: "2026-09-28T17:45:00.000Z",
    metadata: {
      domain,
      actionKind: "probe",
      outcomeKind: "state-change",
      "before:signal": "low",
      "after:signal": "high",
    },
  }));
}

const models = [
  { id: "model-a", probability: 0.5, predictedOutcomes: { inspect: "marker-a" } },
  { id: "model-b", probability: 0.5, predictedOutcomes: { inspect: "marker-b" } },
];

const discovery = [
  { id: "inspect", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 },
];

const candidates = [
  { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
  { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
  { id: "wait", terms: ["wait"], baseUtility: 0.4, risk: 0 },
];

const seedMemory: PersistentMemoryStore = {
  autobiographical: [],
  semantic: [{
    id: "seed-probe",
    kind: "semantic",
    statement: "Probe stabilizes unfamiliar controlled system.",
    confidence: 0.95,
    derivedFromIds: ["seed-a", "seed-b"],
    domains: ["system-a"],
    consolidatedAt: "2026-09-28T17:40:00.000Z",
  }],
  revisions: [],
};

function planning(actionRisk = 0.05) {
  return {
    mechanisms: [
      { id: "mechanism-a", effects: { advance: 1 }, observationStdDev: 0.1 },
      { id: "mechanism-b", effects: { advance: 1 }, observationStdDev: 0.1 },
    ],
    prior: new Map([["mechanism-a", 0.5], ["mechanism-b", 0.5]]),
    initialState: 0,
    goalState: 1,
    experiments: [],
    actions: [{
      id: "advance",
      interventions: { advance: 1 },
      risk: actionRisk,
      cost: 0,
      reversible: true,
    }],
    horizon: 2,
  };
}

describe("v1.42 integrated general-agent gauntlet", () => {
  it("completes a bounded unfamiliar task through induction, planning, failure recovery, and memory", () => {
    const result = runIntegratedGeneralAgentCycle({
      environmentId: "system-a",
      observations: evidence("system-a"),
      models,
      experiments: discovery,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-a",
        observedAt: "2026-09-28T17:46:00.000Z",
      },
      state: beginLongHorizonLearning({
        objective: {
          id: "gauntlet-a",
          description: "Stabilize then unlock the unfamiliar system.",
          successSignals: ["stable", "unlocked"],
          maximumSteps: 4,
        },
        strategyId: "force",
      }),
      memory: seedMemory,
      candidates,
      planning: planning(),
      maximumRisk: 0.2,
      experience: (state) =>
        state.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              lesson: "Probe stabilizes unfamiliar controlled system.",
              failed: true,
            }
          : {
              strategyId: state.strategyId,
              observedSignals: ["unlocked"],
            },
    });

    expect(result.induction.beliefUpdate?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.plan?.decision).toBe("plan");
    expect(result.learning?.steps[0]?.afterStrategyId).toBe("probe");
    expect(result.learning?.state.status).toBe("succeeded");
    expect(result.learning?.state.step).toBeLessThanOrEqual(4);
    expect(result.decision).toBe("completed");
  });

  it("transfers an earned lesson across a restored session and still respects the new task boundary", () => {
    const learned = runIntegratedGeneralAgentCycle({
      environmentId: "system-a",
      observations: evidence("system-a"),
      models,
      experiments: discovery,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-a",
        observedAt: "2026-09-28T17:47:00.000Z",
      },
      state: beginLongHorizonLearning({
        objective: {
          id: "learn-source",
          description: "Learn a recovery strategy.",
          successSignals: ["stable", "unlocked"],
          maximumSteps: 4,
        },
        strategyId: "force",
      }),
      memory: seedMemory,
      candidates,
      planning: planning(),
      maximumRisk: 0.2,
      experience: (state) =>
        state.strategyId === "force"
          ? {
              strategyId: "force",
              observedSignals: ["stable"],
              lesson: "Probe stabilizes unfamiliar controlled system.",
              failed: true,
            }
          : { strategyId: state.strategyId, observedSignals: ["unlocked"] },
    });

    const persisted = persistLongHorizonLesson({
      store: { autobiographical: [], semantic: [], revisions: [] },
      state: learned.learning!.state,
      lesson: "Probe stabilizes unfamiliar controlled system.",
      evidence: [
        { id: "earned-a", sourceId: "sensor-a", domain: "system-a" },
        { id: "earned-b", sourceId: "sensor-b", domain: "system-a" },
      ],
      memoryId: "earned-transfer",
      confidence: 0.95,
      consolidatedAt: "2026-09-28T17:48:00.000Z",
    });
    const restored = restorePersistentMemory(serializePersistentMemory(persisted));

    const transferred = runIntegratedGeneralAgentCycle({
      environmentId: "system-b",
      observations: evidence("system-b"),
      models,
      experiments: discovery,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-a",
        observedAt: "2026-09-28T17:49:00.000Z",
      },
      state: beginLongHorizonLearning({
        objective: {
          id: "transfer-target",
          description: "Unlock a related but separately induced system.",
          successSignals: ["unlocked"],
          maximumSteps: 3,
        },
        strategyId: "force",
      }),
      memory: restored,
      candidates,
      planning: planning(),
      maximumRisk: 0.2,
      experience: (state) =>
        state.strategyId === "force"
          ? { strategyId: "force", observedSignals: [], failed: true }
          : { strategyId: state.strategyId, observedSignals: ["unlocked"] },
    });

    expect(transferred.induction.environment.id).toBe("system-b");
    expect(transferred.learning?.steps[0]?.selection?.supportingMemoryIds).toContain(
      "earned-transfer",
    );
    expect(transferred.learning?.steps[0]?.afterStrategyId).toBe("probe");
    expect(transferred.decision).toBe("completed");
  });

  it("contains model-set failure before planning or execution", () => {
    let executed = false;
    const result = runIntegratedGeneralAgentCycle({
      environmentId: "failure-system",
      observations: evidence("failure-system"),
      models,
      experiments: discovery,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "unmodeled-outcome",
        observedAt: "2026-09-28T17:50:00.000Z",
      },
      state: beginLongHorizonLearning({
        objective: {
          id: "failure-objective",
          description: "Must not execute under broken environment models.",
          successSignals: ["done"],
          maximumSteps: 2,
        },
        strategyId: "force",
      }),
      memory: seedMemory,
      candidates,
      planning: planning(),
      maximumRisk: 0.2,
      experience: (state) => {
        executed = true;
        return { strategyId: state.strategyId, observedSignals: ["done"] };
      },
    });

    expect(result.induction.beliefUpdate?.modelSetFailure).toBe(true);
    expect(result.decision).toBe("observe");
    expect(result.plan).toBeUndefined();
    expect(result.learning).toBeUndefined();
    expect(executed).toBe(false);
  });

  it("abstains when causal planning cannot find a safe policy", () => {
    let executed = false;
    const result = runIntegratedGeneralAgentCycle({
      environmentId: "unsafe-system",
      observations: evidence("unsafe-system"),
      models,
      experiments: discovery,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-a",
        observedAt: "2026-09-28T17:51:00.000Z",
      },
      state: beginLongHorizonLearning({
        objective: {
          id: "unsafe-objective",
          description: "Do not bypass causal safety.",
          successSignals: ["done"],
          maximumSteps: 2,
        },
        strategyId: "force",
      }),
      memory: seedMemory,
      candidates,
      planning: planning(0.9),
      maximumRisk: 0.2,
      experience: (state) => {
        executed = true;
        return { strategyId: state.strategyId, observedSignals: ["done"] };
      },
    });

    expect(result.plan?.decision).toBe("abstained");
    expect(result.decision).toBe("abstain");
    expect(result.learning).toBeUndefined();
    expect(executed).toBe(false);
  });

  it("fails closed when repeated strategy failure exhausts every safe novel recovery", () => {
    expect(() =>
      runIntegratedGeneralAgentCycle({
        environmentId: "exhaustion-system",
        observations: evidence("exhaustion-system"),
        models,
        experiments: discovery,
        experimentObservation: {
          actionKind: "inspect",
          outcome: "marker-a",
          observedAt: "2026-09-28T17:52:00.000Z",
        },
        state: beginLongHorizonLearning({
          objective: {
            id: "exhaustion-objective",
            description: "Exercise bounded recovery exhaustion.",
            successSignals: ["done"],
            maximumSteps: 4,
          },
          strategyId: "force",
        }),
        memory: seedMemory,
        candidates: [
          { id: "force", terms: ["force"], baseUtility: 0.8, risk: 0.05 },
          { id: "probe", terms: ["probe", "stabilizes"], baseUtility: 0.55, risk: 0.05 },
        ],
        planning: planning(),
        maximumRisk: 0.2,
        experience: (state) => ({
          strategyId: state.strategyId,
          observedSignals: [],
          failed: true,
        }),
      }),
    ).toThrow(/No safe memory-informed replacement/);
  });
});

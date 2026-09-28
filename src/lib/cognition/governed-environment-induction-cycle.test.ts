import { describe, expect, it } from "vitest";

import type { Observation } from "./types";
import { runGovernedInductionCycle } from "./governed-environment-induction-cycle";

function evidence(
  id: string,
  actionKind: string,
  outcomeKind: string,
  beforeSignal: string,
  afterSignal: string,
): Observation {
  return {
    id,
    source: "environment",
    content: `Observed ${actionKind} in unfamiliar environment.`,
    observedAt: "2026-09-28T15:20:00.000Z",
    metadata: {
      domain: "unknown-apparatus",
      "feature:signal": beforeSignal,
      actionKind,
      outcomeKind,
      "before:signal": beforeSignal,
      "after:signal": afterSignal,
    },
  };
}

const observations = [
  evidence("obs-1", "probe", "signal-change", "low", "high"),
  evidence("obs-2", "probe", "signal-change", "low", "high"),
  evidence("obs-3", "wait", "stable", "high", "high"),
];

const models = [
  {
    id: "model-a",
    probability: 0.5,
    predictedOutcomes: { inspect: "marker-present", wait: "stable" },
  },
  {
    id: "model-b",
    probability: 0.5,
    predictedOutcomes: { inspect: "marker-absent", wait: "stable" },
  },
];

const experiments = [
  { id: "wait", actionKind: "wait", risk: 0, reversible: true, cost: 0 },
  { id: "inspect", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 },
];

describe("governed open-ended induction cycle", () => {
  it("integrates structure induction and selects the informative next experiment", () => {
    const cycle = runGovernedInductionCycle({
      environmentId: "apparatus-1",
      observations,
      models,
      experiments,
    });

    expect(cycle.environment.domains).toEqual(["unknown-apparatus"]);
    expect(cycle.task.relevantFeatures).toEqual(["signal"]);
    expect(cycle.discovery.experiment?.id).toBe("inspect");
    expect(cycle.next).toBe("experiment");
  });

  it("updates beliefs from the selected experiment and permits action when earned", () => {
    const cycle = runGovernedInductionCycle({
      environmentId: "apparatus-1",
      observations,
      models,
      experiments,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-present",
        observedAt: "2026-09-28T15:21:00.000Z",
      },
    });

    expect(cycle.beliefUpdate?.models[0]?.id).toBe("model-a");
    expect(cycle.beliefUpdate?.confidence).toBeCloseTo(0.95);
    expect(cycle.next).toBe("act");
  });

  it("continues experimentation when evidence has not earned action confidence", () => {
    const cycle = runGovernedInductionCycle({
      environmentId: "apparatus-1",
      observations,
      models,
      experiments,
      experimentObservation: {
        actionKind: "inspect",
        outcome: "marker-present",
        observedAt: "2026-09-28T15:21:00.000Z",
      },
      actionConfidenceThreshold: 0.99,
    });

    expect(cycle.next).toBe("experiment");
  });

  it("refuses an outcome from an experiment it did not select", () => {
    expect(() =>
      runGovernedInductionCycle({
        environmentId: "apparatus-1",
        observations,
        models,
        experiments,
        experimentObservation: {
          actionKind: "wait",
          outcome: "stable",
          observedAt: "2026-09-28T15:21:00.000Z",
        },
      }),
    ).toThrow(/selected discovery experiment/);
  });

  it("falls back to observation when no safe discriminating experiment exists", () => {
    const cycle = runGovernedInductionCycle({
      environmentId: "apparatus-1",
      observations,
      models,
      experiments: [
        { id: "unsafe", actionKind: "inspect", risk: 0.9, reversible: true, cost: 0 },
        { id: "wait", actionKind: "wait", risk: 0, reversible: true, cost: 0 },
      ],
      maximumRisk: 0.2,
    });

    expect(cycle.discovery.experiment).toBeUndefined();
    expect(cycle.next).toBe("observe");
  });
});

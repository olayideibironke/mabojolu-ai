import { describe, expect, it } from "vitest";

import { selectUncertaintyReducingExperiment } from "./active-environment-discovery";

const models = [
  {
    id: "model-a",
    probability: 0.5,
    predictedOutcomes: {
      inspect: "signal-high",
      wait: "unchanged",
      force: "opened",
    },
  },
  {
    id: "model-b",
    probability: 0.5,
    predictedOutcomes: {
      inspect: "signal-low",
      wait: "unchanged",
      force: "blocked",
    },
  },
];

describe("active environment discovery", () => {
  it("selects a safe experiment that distinguishes competing models", () => {
    const decision = selectUncertaintyReducingExperiment({
      models,
      experiments: [
        { id: "wait", actionKind: "wait", risk: 0, reversible: true, cost: 0 },
        { id: "inspect", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 },
      ],
    });

    expect(decision.experiment?.id).toBe("inspect");
    expect(decision.informationGain).toBeCloseTo(1);
    expect(decision.reason).toBe("safe-discriminating-experiment");
  });

  it("rejects informative experiments that exceed the risk boundary", () => {
    const decision = selectUncertaintyReducingExperiment({
      models,
      experiments: [
        { id: "force", actionKind: "force", risk: 0.8, reversible: true, cost: 0 },
        { id: "wait", actionKind: "wait", risk: 0, reversible: true, cost: 0 },
      ],
      maximumRisk: 0.2,
    });

    expect(decision.experiment).toBeUndefined();
    expect(decision.reason).toBe("no-safe-discriminating-experiment");
  });

  it("rejects irreversible experiments even when they are informative", () => {
    const decision = selectUncertaintyReducingExperiment({
      models,
      experiments: [
        { id: "inspect", actionKind: "inspect", risk: 0.01, reversible: false, cost: 0 },
      ],
    });

    expect(decision.reason).toBe("no-safe-discriminating-experiment");
  });

  it("prefers useful information after accounting for experiment cost", () => {
    const decision = selectUncertaintyReducingExperiment({
      models,
      experiments: [
        { id: "expensive", actionKind: "inspect", risk: 0.05, reversible: true, cost: 10 },
        { id: "cheap", actionKind: "inspect", risk: 0.05, reversible: true, cost: 0.1 },
      ],
      costPenalty: 0.2,
    });

    expect(decision.experiment?.id).toBe("cheap");
  });

  it("fails closed when model probabilities are invalid", () => {
    expect(() =>
      selectUncertaintyReducingExperiment({
        models: [
          { id: "a", probability: 0.8, predictedOutcomes: { inspect: "x" } },
          { id: "b", probability: 0.8, predictedOutcomes: { inspect: "y" } },
        ],
        experiments: [
          { id: "inspect", actionKind: "inspect", risk: 0, reversible: true, cost: 0 },
        ],
      }),
    ).toThrow(/sum to one/);
  });
});

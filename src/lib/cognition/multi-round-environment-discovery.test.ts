import { describe, expect, it } from "vitest";

import { runMultiRoundEnvironmentDiscovery } from "./multi-round-environment-discovery";

const models = [
  {
    id: "alpha",
    probability: 1 / 3,
    predictedOutcomes: {
      inspectLight: "red",
      inspectTone: "high",
      forceDoor: "opens",
    },
  },
  {
    id: "beta",
    probability: 1 / 3,
    predictedOutcomes: {
      inspectLight: "red",
      inspectTone: "low",
      forceDoor: "blocked",
    },
  },
  {
    id: "gamma",
    probability: 1 / 3,
    predictedOutcomes: {
      inspectLight: "blue",
      inspectTone: "low",
      forceDoor: "damaged",
    },
  },
];

const experiments = [
  { id: "light", actionKind: "inspectLight", risk: 0.01, reversible: true, cost: 0.1 },
  { id: "tone", actionKind: "inspectTone", risk: 0.01, reversible: true, cost: 0.1 },
  { id: "force", actionKind: "forceDoor", risk: 0.9, reversible: false, cost: 0 },
];

describe("multi-round unfamiliar environment discovery", () => {
  it("accumulates evidence across rounds before acting", () => {
    const result = runMultiRoundEnvironmentDiscovery({
      models,
      experiments,
      maximumRounds: 3,
      actionConfidenceThreshold: 0.9,
      observationReliability: 0.8,
      observe: (experiment, round) => ({
        actionKind: experiment.actionKind,
        outcome:
          experiment.actionKind === "inspectLight"
            ? "red"
            : experiment.actionKind === "inspectTone"
              ? "high"
              : "opens",
        observedAt: `2026-09-28T15:3${round}:00.000Z`,
      }),
    });

    expect(result.rounds.length).toBeGreaterThan(1);
    expect(result.rounds.at(-1)?.leadingModelId).toBe("alpha");
    expect(result.models[0]?.id).toBe("alpha");
    expect(result.decision).toBe("act");
  });

  it("never selects the attractive unsafe shortcut", () => {
    const selected: string[] = [];
    const result = runMultiRoundEnvironmentDiscovery({
      models,
      experiments,
      maximumRounds: 3,
      observe: (experiment, round) => {
        selected.push(experiment.id);
        return {
          actionKind: experiment.actionKind,
          outcome: experiment.actionKind === "inspectLight" ? "red" : "high",
          observedAt: `2026-09-28T15:4${round}:00.000Z`,
        };
      },
    });

    expect(selected).not.toContain("force");
    expect(result.rejectedUnsafeExperimentIds).toEqual(["force"]);
  });

  it("does not act when the round budget expires below confidence threshold", () => {
    const result = runMultiRoundEnvironmentDiscovery({
      models,
      experiments,
      maximumRounds: 1,
      actionConfidenceThreshold: 0.99,
      observationReliability: 0.7,
      observe: (experiment) => ({
        actionKind: experiment.actionKind,
        outcome: experiment.actionKind === "inspectLight" ? "red" : "high",
        observedAt: "2026-09-28T15:50:00.000Z",
      }),
    });

    expect(result.rounds).toHaveLength(1);
    expect(result.decision).toBe("observe");
    expect(result.rounds[0]?.confidence).toBeLessThan(0.99);
  });

  it("fails closed when the environment reports the wrong experiment outcome", () => {
    expect(() =>
      runMultiRoundEnvironmentDiscovery({
        models,
        experiments,
        observe: () => ({
          actionKind: "unrelated-action",
          outcome: "unknown",
          observedAt: "2026-09-28T15:55:00.000Z",
        }),
      }),
    ).toThrow(/wrong action/);
  });
});

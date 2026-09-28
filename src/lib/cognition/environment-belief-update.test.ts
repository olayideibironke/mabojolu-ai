import { describe, expect, it } from "vitest";

import { updateEnvironmentModelBeliefs } from "./environment-belief-update";

const models = [
  {
    id: "model-a",
    probability: 0.5,
    predictedOutcomes: { inspect: "signal-high", probe: "stable" },
  },
  {
    id: "model-b",
    probability: 0.5,
    predictedOutcomes: { inspect: "signal-low", probe: "stable" },
  },
];

describe("environment belief update", () => {
  it("raises posterior belief in the model that predicted the observation", () => {
    const update = updateEnvironmentModelBeliefs({
      models,
      observation: {
        actionKind: "inspect",
        outcome: "signal-high",
        observedAt: "2026-09-28T15:15:00.000Z",
      },
    });

    expect(update.models[0]?.id).toBe("model-a");
    expect(update.models[0]?.probability).toBeCloseTo(0.95);
    expect(update.contradictedModelIds).toEqual(["model-b"]);
    expect(update.decision).toBe("act");
    expect(update.modelSetFailure).toBe(false);
  });

  it("continues experimentation when posterior confidence is insufficient", () => {
    const update = updateEnvironmentModelBeliefs({
      models,
      observation: {
        actionKind: "inspect",
        outcome: "signal-high",
        observedAt: "2026-09-28T15:15:00.000Z",
      },
      observationReliability: 0.7,
      actionConfidenceThreshold: 0.9,
    });

    expect(update.confidence).toBeCloseTo(0.7);
    expect(update.decision).toBe("experiment-again");
  });

  it("does not manufacture discrimination from a non-discriminating experiment", () => {
    const update = updateEnvironmentModelBeliefs({
      models,
      observation: {
        actionKind: "probe",
        outcome: "stable",
        observedAt: "2026-09-28T15:15:00.000Z",
      },
    });

    expect(update.models.map((model) => model.probability)).toEqual([0.5, 0.5]);
    expect(update.contradictedModelIds).toEqual([]);
    expect(update.decision).toBe("experiment-again");
  });

  it("preserves normalized posterior probabilities", () => {
    const update = updateEnvironmentModelBeliefs({
      models: [
        {
          id: "a",
          probability: 0.6,
          predictedOutcomes: { inspect: "x" },
        },
        {
          id: "b",
          probability: 0.3,
          predictedOutcomes: { inspect: "y" },
        },
        {
          id: "c",
          probability: 0.1,
          predictedOutcomes: { inspect: "z" },
        },
      ],
      observation: {
        actionKind: "inspect",
        outcome: "y",
        observedAt: "2026-09-28T15:15:00.000Z",
      },
    });

    expect(
      update.models.reduce((sum, model) => sum + model.probability, 0),
    ).toBeCloseTo(1);
    expect(update.models[0]?.id).toBe("b");
  });

  it("fails closed when a competing model did not predict the experiment", () => {
    expect(() =>
      updateEnvironmentModelBeliefs({
        models: [
          { id: "a", probability: 0.5, predictedOutcomes: { inspect: "x" } },
          { id: "b", probability: 0.5, predictedOutcomes: {} },
        ],
        observation: {
          actionKind: "inspect",
          outcome: "x",
          observedAt: "2026-09-28T15:15:00.000Z",
        },
      }),
    ).toThrow(/must predict/);
  });

  it("detects when every current model is contradicted by an unexpected outcome", () => {
    const update = updateEnvironmentModelBeliefs({
      models,
      observation: {
        actionKind: "inspect",
        outcome: "signal-purple",
        observedAt: "2026-09-28T15:16:00.000Z",
      },
    });

    expect(update.modelSetFailure).toBe(true);
    expect(update.decision).toBe("model-set-failure");
    expect(update.confidence).toBe(0);
    expect(update.contradictedModelIds).toEqual(["model-a", "model-b"]);
    expect(update.models.map((model) => model.probability)).toEqual([0.5, 0.5]);
  });
});

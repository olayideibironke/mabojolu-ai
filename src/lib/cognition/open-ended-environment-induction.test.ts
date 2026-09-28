import { describe, expect, it } from "vitest";

import type { Observation } from "./types";
import { induceEnvironmentModel } from "./open-ended-environment-induction";

function observation(
  id: string,
  metadata: Observation["metadata"],
): Observation {
  return {
    id,
    source: "environment",
    content: `Observed environment transition ${id}.`,
    observedAt: `2026-09-28T15:0${id.slice(-1)}:00.000Z`,
    metadata,
  };
}

describe("open-ended environment induction", () => {
  it("induces latent environment structure without a predefined task schema", () => {
    const model = induceEnvironmentModel({
      id: "environment-1",
      observations: [
        observation("obs-1", {
          domain: "unknown-grid",
          "feature:surface": "dry",
          "feature:signal": "low",
          actionKind: "probe",
          outcomeKind: "signal-change",
        }),
        observation("obs-2", {
          domain: "unknown-grid",
          "feature:surface": "wet",
          "feature:signal": "high",
          actionKind: "move",
          outcomeKind: "position-change",
        }),
        observation("obs-3", {
          domain: "unknown-grid",
          "feature:surface": "dry",
          "feature:signal": "high",
          actionKind: "probe",
          outcomeKind: "signal-change",
        }),
      ],
    });

    expect(model.domains).toEqual(["unknown-grid"]);
    expect(model.features).toEqual([
      { name: "signal", values: ["high", "low"] },
      { name: "surface", values: ["dry", "wet"] },
    ]);
    expect(model.candidateActionKinds).toEqual(["move", "probe"]);
    expect(model.candidateOutcomeKinds).toEqual([
      "position-change",
      "signal-change",
    ]);
    expect(model.evidenceIds).toEqual(["obs-1", "obs-2", "obs-3"]);
    expect(model.unresolvedQuestions).toEqual([]);
    expect(model.confidence).toBeGreaterThan(0.8);
  });

  it("represents missing structure as unresolved instead of inventing it", () => {
    const model = induceEnvironmentModel({
      id: "environment-partial",
      observations: [
        observation("obs-1", { "feature:temperature": "cold" }),
        observation("obs-2", { "feature:temperature": "warm" }),
        observation("obs-3", { "feature:temperature": "cold" }),
      ],
    });

    expect(model.domains).toEqual([]);
    expect(model.candidateActionKinds).toEqual([]);
    expect(model.candidateOutcomeKinds).toEqual([]);
    expect(model.unresolvedQuestions).toEqual([
      "domain",
      "available-actions",
      "outcome-structure",
    ]);
    expect(model.confidence).toBeLessThan(0.5);
  });

  it("fails closed when evidence is insufficient", () => {
    expect(() =>
      induceEnvironmentModel({
        id: "environment-weak",
        observations: [
          observation("obs-1", { domain: "unknown" }),
          observation("obs-2", { domain: "unknown" }),
        ],
      }),
    ).toThrow(/at least 3 observations/);
  });

  it("rejects duplicate observations masquerading as repeated evidence", () => {
    const duplicate = observation("obs-1", {
      domain: "unknown-grid",
      actionKind: "probe",
    });

    expect(() =>
      induceEnvironmentModel({
        id: "environment-duplicate",
        observations: [duplicate, duplicate, observation("obs-2", {})],
      }),
    ).toThrow(/unique observation evidence/);
  });

  it("is deterministic for the same evidence regardless of metadata insertion order", () => {
    const left = induceEnvironmentModel({
      id: "environment-deterministic",
      observations: [
        observation("obs-1", {
          domain: "lab",
          "feature:z": "2",
          "feature:a": "1",
          actionKind: "inspect",
          outcomeKind: "measurement",
        }),
        observation("obs-2", {
          outcomeKind: "measurement",
          actionKind: "inspect",
          "feature:a": "2",
          "feature:z": "1",
          domain: "lab",
        }),
        observation("obs-3", {
          "feature:a": "1",
          domain: "lab",
          outcomeKind: "measurement",
          "feature:z": "1",
          actionKind: "inspect",
        }),
      ],
    });

    expect(left.features.map((feature) => feature.name)).toEqual(["a", "z"]);
    expect(left.candidateActionKinds).toEqual(["inspect"]);
    expect(left.candidateOutcomeKinds).toEqual(["measurement"]);
  });
});

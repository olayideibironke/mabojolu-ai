import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import {
  classifyMultimodalTemporalEvidence,
  currentMultimodalObservationIds,
} from "./multimodal-temporal-evidence";

function observed(
  id: string,
  observedAt: string,
  temporalSubjectId?: string,
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt,
      metadata: temporalSubjectId ? { temporalSubjectId } : {},
    },
    modality: "text-document",
    attachmentId: id,
    capabilityId: "document-understanding",
    processorId: "processor-v1",
    evidenceRole: "direct",
    warnings: [],
  };
}

describe("multimodal temporal evidence", () => {
  it("supersedes older observations about the same temporal subject", () => {
    const evidence = classifyMultimodalTemporalEvidence([
      observed("old", "2026-09-25T20:00:00.000Z", "pressure"),
      observed("new", "2026-09-25T21:00:00.000Z", "pressure"),
    ]);

    expect(evidence).toEqual([
      {
        observationId: "new",
        sourceKey: "pressure",
        observedAt: "2026-09-25T21:00:00.000Z",
        temporalRole: "current",
      },
      {
        observationId: "old",
        sourceKey: "pressure",
        observedAt: "2026-09-25T20:00:00.000Z",
        temporalRole: "superseded",
        supersededByObservationId: "new",
      },
    ]);
    expect(
      currentMultimodalObservationIds([
        observed("old", "2026-09-25T20:00:00.000Z", "pressure"),
        observed("new", "2026-09-25T21:00:00.000Z", "pressure"),
      ]),
    ).toEqual(["new"]);
  });

  it("does not supersede observations about different subjects", () => {
    const current = currentMultimodalObservationIds([
      observed("pressure", "2026-09-25T20:00:00.000Z", "pressure"),
      observed("temperature", "2026-09-25T21:00:00.000Z", "temperature"),
    ]);

    expect(current.sort()).toEqual(["pressure", "temperature"]);
  });

  it("keeps same-time observations concurrent instead of choosing arbitrarily", () => {
    const evidence = classifyMultimodalTemporalEvidence([
      observed("sensor-a", "2026-09-25T21:00:00.000Z", "pressure"),
      observed("sensor-b", "2026-09-25T21:00:00.000Z", "pressure"),
    ]);

    expect(evidence.map((entry) => entry.temporalRole)).toEqual([
      "concurrent",
      "concurrent",
    ]);
    expect(currentMultimodalObservationIds([
      observed("sensor-a", "2026-09-25T21:00:00.000Z", "pressure"),
      observed("sensor-b", "2026-09-25T21:00:00.000Z", "pressure"),
    ])).toEqual(["sensor-a", "sensor-b"]);
  });

  it("fails closed on invalid timestamps and duplicate observation ids", () => {
    expect(() =>
      classifyMultimodalTemporalEvidence([
        observed("bad", "not-a-time", "pressure"),
      ]),
    ).toThrow(/Invalid multimodal observation timestamp/);

    expect(() =>
      classifyMultimodalTemporalEvidence([
        observed("duplicate", "2026-09-25T20:00:00.000Z", "pressure"),
        observed("duplicate", "2026-09-25T21:00:00.000Z", "pressure"),
      ]),
    ).toThrow(/Duplicate multimodal temporal observation/);
  });
});

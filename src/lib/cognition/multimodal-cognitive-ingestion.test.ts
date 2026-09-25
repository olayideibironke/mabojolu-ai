import { describe, expect, it } from "vitest";

import type { MultimodalEvidencePackage } from "@/lib/attachments/analysis";
import { createCognitiveState } from "./state";
import { ingestMultimodalEvidenceIntoCognitiveState } from "./multimodal-cognitive-ingestion";

function evidence(
  attachmentId: string,
  text: string,
  createdAt: string,
): MultimodalEvidencePackage {
  return {
    schemaVersion: 1,
    attachmentId,
    filename: `${attachmentId}.txt`,
    mimeType: "text/plain",
    modality: "text-document",
    capabilityId: "document-understanding",
    processor: {
      id: "mabojolu-direct-text-v1",
      local: true,
    },
    text,
    metadata: {
      lines: 1,
    },
    warnings: [],
    createdAt,
  };
}

describe("multimodal cognitive ingestion", () => {
  it("records multimodal evidence as ordinary replayable cognitive observation events", () => {
    const initial = createCognitiveState(
      "2026-09-25T18:00:00.000Z",
    );

    const result = ingestMultimodalEvidenceIntoCognitiveState(
      initial,
      [
        evidence(
          "sensor-report",
          "Pressure increased to 42.",
          "2026-09-25T18:00:01.000Z",
        ),
      ],
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("observation.recorded");
    expect(result.state.observations).toHaveLength(1);
    expect(result.state.observations[0]?.content).toBe(
      "Pressure increased to 42.",
    );
    expect(result.state.beliefs).toEqual([]);
    expect(result.state.hypotheses).toEqual([]);
    expect(result.state.cycle).toBe(0);
  });

  it("preserves deterministic batch order and cognitive provenance", () => {
    const initial = createCognitiveState(
      "2026-09-25T18:00:00.000Z",
    );

    const result = ingestMultimodalEvidenceIntoCognitiveState(
      initial,
      [
        evidence(
          "first",
          "First observation.",
          "2026-09-25T18:00:01.000Z",
        ),
        evidence(
          "second",
          "Second observation.",
          "2026-09-25T18:00:02.000Z",
        ),
      ],
    );

    expect(
      result.state.observations.map((entry) => entry.id),
    ).toEqual([
      "multimodal:first:1",
      "multimodal:second:1",
    ]);
    expect(
      result.state.observations[1]?.metadata,
    ).toMatchObject({
      attachmentId: "second",
      capabilityId: "document-understanding",
      processorId: "mabojolu-direct-text-v1",
      evidenceRole: "direct",
    });
    expect(result.state.updatedAt).toBe(
      "2026-09-25T18:00:02.000Z",
    );
  });

  it("fails closed instead of partially mutating state when a batch contains duplicate attachment evidence", () => {
    const initial = createCognitiveState(
      "2026-09-25T18:00:00.000Z",
    );

    expect(() =>
      ingestMultimodalEvidenceIntoCognitiveState(
        initial,
        [
          evidence(
            "duplicate",
            "First copy.",
            "2026-09-25T18:00:01.000Z",
          ),
          evidence(
            "duplicate",
            "Second copy.",
            "2026-09-25T18:00:02.000Z",
          ),
        ],
      ),
    ).toThrow(/Duplicate multimodal attachment evidence duplicate/);

    expect(initial.observations).toEqual([]);
  });

  it("rejects replaying an already-recorded multimodal observation id", () => {
    const initial = createCognitiveState(
      "2026-09-25T18:00:00.000Z",
    );
    const packet = evidence(
      "stable-id",
      "Stable evidence.",
      "2026-09-25T18:00:01.000Z",
    );
    const first = ingestMultimodalEvidenceIntoCognitiveState(
      initial,
      [packet],
    );

    expect(() =>
      ingestMultimodalEvidenceIntoCognitiveState(
        first.state,
        [packet],
      ),
    ).toThrow(
      /Observation with id "multimodal:stable-id:1" already exists/,
    );
  });
});

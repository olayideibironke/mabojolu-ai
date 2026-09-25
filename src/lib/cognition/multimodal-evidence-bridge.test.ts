import { describe, expect, it } from "vitest";

import {
  multimodalEvidenceBatchToCognitiveObservations,
  multimodalEvidenceToCognitiveObservation,
} from "./multimodal-evidence-bridge";

import type { MultimodalEvidencePackage } from "@/lib/attachments/analysis";

function evidence(
  overrides: Partial<MultimodalEvidencePackage> = {},
): MultimodalEvidencePackage {
  return {
    schemaVersion: 1,
    attachmentId: "att-1",
    filename: "observation.txt",
    mimeType: "text/plain",
    modality: "text",
    capabilityId: "document-understanding",
    processor: {
      id: "mabojolu-direct-text-v1",
      local: true,
    },
    text: "The valve pressure increased to 42.",
    metadata: {
      lines: 1,
      labels: ["pressure"],
    },
    warnings: [],
    createdAt: "2026-09-25T18:00:00.000Z",
    ...overrides,
  };
}

describe("multimodal evidence cognitive bridge", () => {
  it("preserves attachment, processor, modality, and capability provenance", () => {
    const converted = multimodalEvidenceToCognitiveObservation(evidence());

    expect(converted.observation.source).toBe("tool");
    expect(converted.observation.content).toBe(
      "The valve pressure increased to 42.",
    );
    expect(converted.observation.observedAt).toBe(
      "2026-09-25T18:00:00.000Z",
    );
    expect(converted.observation.metadata).toMatchObject({
      attachmentId: "att-1",
      filename: "observation.txt",
      mimeType: "text/plain",
      modality: "text",
      capabilityId: "document-understanding",
      processorId: "mabojolu-direct-text-v1",
      processorLocal: true,
      evidenceRole: "direct",
      warningCount: 0,
      lines: 1,
    });
    expect(converted.evidenceRole).toBe("direct");
  });

  it("marks warning-bearing extracted evidence as derived instead of silently treating it as pristine", () => {
    const converted = multimodalEvidenceToCognitiveObservation(
      evidence({
        warnings: ["Extracted text was truncated."],
      }),
    );

    expect(converted.evidenceRole).toBe("derived");
    expect(converted.warnings).toEqual([
      "Extracted text was truncated.",
    ]);
    expect(converted.observation.metadata?.warningCount).toBe(1);
  });

  it("does not hallucinate semantic vision when frames exist without interpreted content", () => {
    const converted = multimodalEvidenceToCognitiveObservation(
      evidence({
        attachmentId: "video-1",
        filename: "trial.mp4",
        mimeType: "video/mp4",
        modality: "video-understanding",
        capabilityId: "video-understanding",
        text: undefined,
        images: [
          {
            name: "frame-1.jpg",
            mimeType: "image/jpeg",
            base64Data: "AA==",
          },
        ],
      }),
    );

    expect(converted.evidenceRole).toBe("incomplete");
    expect(converted.observation.content).toContain(
      "semantic visual interpretation has not been established",
    );
  });

  it("fails closed on duplicate attachment evidence in one cognitive ingestion batch", () => {
    expect(() =>
      multimodalEvidenceBatchToCognitiveObservations([
        evidence(),
        evidence({ filename: "duplicate.txt" }),
      ]),
    ).toThrow(/Duplicate multimodal attachment evidence att-1/);
  });

  it("fails closed when processor provenance is missing", () => {
    expect(() =>
      multimodalEvidenceToCognitiveObservation(
        evidence({
          processor: {
            id: "",
            local: true,
          },
        }),
      ),
    ).toThrow(/requires processor provenance/);
  });
});

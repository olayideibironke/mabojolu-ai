import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import {
  multimodalEvidenceSourceKey,
  summarizeMultimodalEvidenceIndependence,
} from "./multimodal-evidence-independence";
import { assessMultimodalReasoningCandidate } from "./multimodal-evidence-reasoning";

function observed(
  id: string,
  attachmentId: string,
  modality: CognitiveMultimodalObservation["modality"],
  sourceArtifactId?: string,
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt: "2026-09-25T20:30:00.000Z",
      metadata: {
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
      },
    },
    modality,
    attachmentId,
    capabilityId: "document-understanding",
    processorId: "processor-v1",
    evidenceRole: "direct",
    warnings: [],
  };
}

describe("multimodal evidence independence", () => {
  it("groups different derived artifacts from one underlying source", () => {
    const transcript = observed(
      "transcript",
      "audio-transcript",
      "audio-transcription",
      "meeting-recording",
    );
    const document = observed(
      "notes",
      "meeting-notes",
      "text-document",
      "meeting-recording",
    );

    expect(multimodalEvidenceSourceKey(transcript)).toBe("meeting-recording");
    expect(
      summarizeMultimodalEvidenceIndependence([transcript, document]),
    ).toMatchObject({
      independentSourceCount: 1,
      modalityCount: 2,
    });
  });

  it("does not inflate confidence when two modalities originate from one source", () => {
    const first = observed(
      "audio",
      "audio-derived",
      "audio-transcription",
      "recording-1",
    );
    const second = observed(
      "notes",
      "notes-derived",
      "text-document",
      "recording-1",
    );

    const one = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["audio"],
      },
      [first, second],
    );
    const correlated = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["audio", "notes"],
      },
      [first, second],
    );

    expect(correlated.confidence).toBe(one.confidence);
  });

  it("allows genuinely independent sources to add corroborating weight", () => {
    const first = observed(
      "report-a",
      "report-a",
      "text-document",
    );
    const second = observed(
      "recording-b",
      "recording-b",
      "audio-transcription",
    );

    const one = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["report-a"],
      },
      [first, second],
    );
    const independent = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["report-a", "recording-b"],
      },
      [first, second],
    );

    expect(independent.confidence).toBeGreaterThan(one.confidence);
  });

  it("keeps independent contradiction effective across modalities", () => {
    const support = observed(
      "document",
      "document",
      "text-document",
    );
    const against = observed(
      "audio",
      "audio",
      "audio-transcription",
    );

    const assessment = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["document"],
        contradictingObservationIds: ["audio"],
      },
      [support, against],
    );

    expect(assessment.evidenceForIds).toEqual(["document"]);
    expect(assessment.evidenceAgainstIds).toEqual(["audio"]);
    expect(assessment.confidence).toBe(0.5);
  });
});

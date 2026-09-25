import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { assessMultimodalConflict } from "./multimodal-conflict-resolution";

function observed(
  id: string,
  attachmentId: string,
  modality: CognitiveMultimodalObservation["modality"],
  role: CognitiveMultimodalObservation["evidenceRole"] = "direct",
  sourceArtifactId?: string,
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt: "2026-09-25T21:00:00.000Z",
      metadata: sourceArtifactId ? { sourceArtifactId } : {},
    },
    modality,
    attachmentId,
    capabilityId:
      modality === "audio-understanding"
        ? "audio-understanding"
        : "document-understanding",
    processorId: "processor-v1",
    evidenceRole: role,
    warnings: role === "derived" ? ["derived"] : [],
  };
}

describe("multimodal conflict resolution", () => {
  it("marks independent cross-modal disagreement as contested", () => {
    const assessment = assessMultimodalConflict(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["document"],
        contradictingObservationIds: ["audio"],
      },
      [
        observed("document", "document", "text-document"),
        observed("audio", "audio", "audio-understanding"),
      ],
    );

    expect(assessment.decision).toBe("contested");
    expect(assessment.independentSupportSourceCount).toBe(1);
    expect(assessment.independentContradictionSourceCount).toBe(1);
    expect(assessment.supportModalities).toEqual(["text-document"]);
    expect(assessment.contradictionModalities).toEqual([
      "audio-understanding",
    ]);
  });

  it("marks contradiction-only admissible evidence as contradicted", () => {
    const assessment = assessMultimodalConflict(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: [],
        contradictingObservationIds: ["audio"],
      },
      [observed("audio", "audio", "audio-understanding")],
    );

    expect(assessment.decision).toBe("contradicted");
  });

  it("does not treat incomplete visual evidence as contradiction", () => {
    const assessment = assessMultimodalConflict(
      {
        id: "claim",
        statement: "The event occurred.",
        supportingObservationIds: ["document"],
        contradictingObservationIds: ["frame"],
      },
      [
        observed("document", "document", "text-document"),
        observed(
          "frame",
          "frame",
          "image-understanding",
          "incomplete",
        ),
      ],
    );

    expect(assessment.decision).toBe("supported");
    expect(assessment.incompleteEvidenceIds).toEqual(["frame"]);
    expect(assessment.independentContradictionSourceCount).toBe(0);
  });

  it("fails closed when one underlying source is classified on both sides", () => {
    expect(() =>
      assessMultimodalConflict(
        {
          id: "claim",
          statement: "The event occurred.",
          supportingObservationIds: ["transcript"],
          contradictingObservationIds: ["notes"],
        },
        [
          observed(
            "transcript",
            "transcript",
            "audio-understanding",
            "direct",
            "recording-1",
          ),
          observed(
            "notes",
            "notes",
            "text-document",
            "direct",
            "recording-1",
          ),
        ],
      ),
    ).toThrow(/supplies both supporting and contradicting evidence/);
  });

  it("reports insufficient evidence when only incomplete observations exist", () => {
    const assessment = assessMultimodalConflict(
      {
        id: "claim",
        statement: "The image shows a valve.",
        supportingObservationIds: ["frame"],
      },
      [
        observed(
          "frame",
          "frame",
          "image-understanding",
          "incomplete",
        ),
      ],
    );

    expect(assessment.decision).toBe("insufficient");
    expect(assessment.confidence).toBe(0);
  });
});

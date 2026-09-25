import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { runGovernedMultimodalReasoning } from "./governed-multimodal-reasoning";
import { createCognitiveState } from "./state";

function observed(
  id: string,
  observedAt: string,
  subject: string,
  modality: CognitiveMultimodalObservation["modality"] = "text-document",
  role: CognitiveMultimodalObservation["evidenceRole"] = "direct",
  sourceArtifactId?: string,
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt,
      metadata: {
        temporalSubjectId: subject,
        ...(sourceArtifactId ? { sourceArtifactId } : {}),
      },
    },
    modality,
    attachmentId: id,
    capabilityId:
      modality === "audio-understanding"
        ? "audio-understanding"
        : "document-understanding",
    processorId: "processor-v1",
    evidenceRole: role,
    warnings: role === "derived" ? ["derived"] : [],
  };
}

describe("governed multimodal reasoning", () => {
  it("filters stale evidence before revising cognition", () => {
    const result = runGovernedMultimodalReasoning(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "pressure",
        statement: "Pressure is high.",
        supportingObservationIds: ["old-high"],
        contradictingObservationIds: ["new-low"],
      },
      [
        observed("old-high", "2026-09-25T20:00:00.000Z", "pressure"),
        observed("new-low", "2026-09-25T21:00:00.000Z", "pressure"),
      ],
      "2026-09-25T21:01:00.000Z",
    );

    expect(result.supersededObservationIds).toEqual(["old-high"]);
    expect(result.conflictDecision).toBe("contradicted");
    expect(result.belief.evidenceIds).toEqual(["new-low"]);
    expect(result.hypothesis.evidenceAgainst).toEqual(["new-low"]);
  });

  it("preserves genuine current cross-modal conflict", () => {
    const result = runGovernedMultimodalReasoning(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "event",
        statement: "The event occurred.",
        supportingObservationIds: ["document"],
        contradictingObservationIds: ["audio"],
      },
      [
        observed(
          "document",
          "2026-09-25T21:00:00.000Z",
          "document-event",
          "text-document",
        ),
        observed(
          "audio",
          "2026-09-25T21:00:00.000Z",
          "audio-event",
          "audio-understanding",
        ),
      ],
      "2026-09-25T21:01:00.000Z",
    );

    expect(result.conflictDecision).toBe("contested");
    expect(result.hypothesis.evidenceFor).toEqual(["document"]);
    expect(result.hypothesis.evidenceAgainst).toEqual(["audio"]);
  });

  it("prevents incomplete evidence from overturning a current claim", () => {
    const result = runGovernedMultimodalReasoning(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "event",
        statement: "The event occurred.",
        supportingObservationIds: ["document"],
        contradictingObservationIds: ["frame"],
      },
      [
        observed(
          "document",
          "2026-09-25T21:00:00.000Z",
          "document-event",
        ),
        observed(
          "frame",
          "2026-09-25T21:00:00.000Z",
          "visual-event",
          "image-understanding",
          "incomplete",
        ),
      ],
      "2026-09-25T21:01:00.000Z",
    );

    expect(result.conflictDecision).toBe("supported");
    expect(result.hypothesis.evidenceAgainst).toEqual([]);
  });

  it("fails before state revision when correlated artifacts conflict", () => {
    const state = createCognitiveState("2026-09-25T20:00:00.000Z");

    expect(() =>
      runGovernedMultimodalReasoning(
        state,
        {
          id: "event",
          statement: "The event occurred.",
          supportingObservationIds: ["transcript"],
          contradictingObservationIds: ["notes"],
        },
        [
          observed(
            "transcript",
            "2026-09-25T21:00:00.000Z",
            "transcript-subject",
            "audio-understanding",
            "direct",
            "recording-1",
          ),
          observed(
            "notes",
            "2026-09-25T21:00:00.000Z",
            "notes-subject",
            "text-document",
            "direct",
            "recording-1",
          ),
        ],
        "2026-09-25T21:01:00.000Z",
      ),
    ).toThrow(/supplies both supporting and contradicting evidence/);

    expect(state.beliefs).toEqual([]);
    expect(state.hypotheses).toEqual([]);
  });

  it("fails closed before revision when protected evidence contaminates live reasoning", () => {
    const state = createCognitiveState("2026-09-25T20:00:00.000Z");
    const evidence = observed(
      "held-out",
      "2026-09-25T21:00:00.000Z",
      "protected-subject",
    );

    expect(() =>
      runGovernedMultimodalReasoning(
        state,
        {
          id: "protected-claim",
          statement: "Held-out evidence supports this claim.",
          supportingObservationIds: ["held-out"],
        },
        [evidence],
        "2026-09-25T21:01:00.000Z",
        { protectedEvidenceIds: ["held-out"] },
      ),
    ).toThrow(/cannot participate in live belief revision/);

    expect(state.beliefs).toEqual([]);
    expect(state.hypotheses).toEqual([]);
  });

  it("rejects duplicate protected evidence ids", () => {
    const state = createCognitiveState("2026-09-25T20:00:00.000Z");

    expect(() =>
      runGovernedMultimodalReasoning(
        state,
        {
          id: "claim",
          statement: "The event occurred.",
          supportingObservationIds: [],
        },
        [],
        "2026-09-25T21:01:00.000Z",
        { protectedEvidenceIds: ["held-out", "held-out"] },
      ),
    ).toThrow(/must be unique/);
  });
});

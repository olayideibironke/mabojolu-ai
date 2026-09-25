import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { filterMultimodalCandidateToCurrentEvidence } from "./multimodal-current-evidence";
import { assessMultimodalReasoningCandidate } from "./multimodal-evidence-reasoning";

function observed(
  id: string,
  observedAt: string,
  temporalSubjectId: string,
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt,
      metadata: { temporalSubjectId },
    },
    modality: "text-document",
    attachmentId: id,
    capabilityId: "document-understanding",
    processorId: "processor-v1",
    evidenceRole: "direct",
    warnings: [],
  };
}

describe("current multimodal evidence filtering", () => {
  it("removes superseded support before reasoning", () => {
    const filtered = filterMultimodalCandidateToCurrentEvidence(
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
    );

    expect(filtered.candidate.supportingObservationIds).toEqual([]);
    expect(filtered.candidate.contradictingObservationIds).toEqual([
      "new-low",
    ]);
    expect(filtered.supersededObservationIds).toEqual(["old-high"]);

    const assessment = assessMultimodalReasoningCandidate(
      filtered.candidate,
      filtered.observations,
    );
    expect(assessment.evidenceForIds).toEqual([]);
    expect(assessment.evidenceAgainstIds).toEqual(["new-low"]);
  });

  it("keeps concurrent observations available for conflict reasoning", () => {
    const filtered = filterMultimodalCandidateToCurrentEvidence(
      {
        id: "pressure",
        statement: "Pressure is high.",
        supportingObservationIds: ["sensor-a"],
        contradictingObservationIds: ["sensor-b"],
      },
      [
        observed("sensor-a", "2026-09-25T21:00:00.000Z", "pressure"),
        observed("sensor-b", "2026-09-25T21:00:00.000Z", "pressure"),
      ],
    );

    expect(filtered.supersededObservationIds).toEqual([]);
    expect(filtered.observations).toHaveLength(2);
  });

  it("does not let a newer unrelated subject erase older current evidence", () => {
    const filtered = filterMultimodalCandidateToCurrentEvidence(
      {
        id: "system",
        statement: "Pressure is high and temperature is stable.",
        supportingObservationIds: ["pressure", "temperature"],
      },
      [
        observed("pressure", "2026-09-25T20:00:00.000Z", "pressure"),
        observed(
          "temperature",
          "2026-09-25T21:00:00.000Z",
          "temperature",
        ),
      ],
    );

    expect(filtered.candidate.supportingObservationIds).toEqual([
      "pressure",
      "temperature",
    ]);
  });

  it("fails closed when the candidate references evidence outside the supplied set", () => {
    expect(() =>
      filterMultimodalCandidateToCurrentEvidence(
        {
          id: "pressure",
          statement: "Pressure is high.",
          supportingObservationIds: ["missing"],
        },
        [observed("known", "2026-09-25T21:00:00.000Z", "pressure")],
      ),
    ).toThrow(/Unknown multimodal observation missing/);
  });
});

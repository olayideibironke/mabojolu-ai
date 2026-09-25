import { describe, expect, it } from "vitest";

import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { reviseCognitionFromMultimodalEvidence } from "./multimodal-belief-revision";
import { createCognitiveState } from "./state";

function observed(
  id: string,
  role: CognitiveMultimodalObservation["evidenceRole"] = "direct",
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt: "2026-09-25T20:00:00.000Z",
    },
    modality: "text-document",
    attachmentId: id,
    capabilityId: "document-understanding",
    processorId: "processor-v1",
    evidenceRole: role,
    warnings: role === "derived" ? ["derived"] : [],
  };
}

describe("multimodal belief revision", () => {
  it("records evidence-qualified belief and hypothesis revisions through cognitive events", () => {
    const result = reviseCognitionFromMultimodalEvidence(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "pressure",
        statement: "Pressure increased.",
        supportingObservationIds: ["support-1"],
      },
      [observed("support-1")],
      "2026-09-25T20:01:00.000Z",
    );

    expect(result.events.map((event) => event.type)).toEqual([
      "belief.updated",
      "hypothesis.updated",
    ]);
    expect(result.state.beliefs[0]?.evidenceIds).toEqual(["support-1"]);
    expect(result.state.hypotheses[0]?.evidenceFor).toEqual(["support-1"]);
  });

  it("revises confidence downward when later evidence contradicts the same claim", () => {
    const candidate = {
      id: "pressure",
      statement: "Pressure increased.",
      supportingObservationIds: ["support-1"],
    };
    const first = reviseCognitionFromMultimodalEvidence(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      candidate,
      [observed("support-1")],
      "2026-09-25T20:01:00.000Z",
    );

    const revised = reviseCognitionFromMultimodalEvidence(
      first.state,
      {
        ...candidate,
        contradictingObservationIds: ["against-1"],
      },
      [observed("support-1"), observed("against-1")],
      "2026-09-25T20:02:00.000Z",
    );

    expect(revised.state.beliefs).toHaveLength(1);
    expect(revised.state.hypotheses).toHaveLength(1);
    expect(revised.previousConfidence).toBe(first.belief.confidence);
    expect(revised.confidenceDelta).toBeLessThan(0);
    expect(revised.belief.confidence).toBeLessThan(first.belief.confidence);
    expect(revised.hypothesis.evidenceAgainst).toEqual(["against-1"]);
    expect(revised.hypothesis.createdAt).toBe(
      "2026-09-25T20:01:00.000Z",
    );
    expect(revised.hypothesis.updatedAt).toBe(
      "2026-09-25T20:02:00.000Z",
    );
  });

  it("does not let later incomplete evidence change a previously supported claim", () => {
    const first = reviseCognitionFromMultimodalEvidence(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "pressure",
        statement: "Pressure increased.",
        supportingObservationIds: ["support-1"],
      },
      [observed("support-1")],
      "2026-09-25T20:01:00.000Z",
    );

    const revised = reviseCognitionFromMultimodalEvidence(
      first.state,
      {
        id: "pressure",
        statement: "Pressure increased.",
        supportingObservationIds: ["support-1"],
        contradictingObservationIds: ["frame-only"],
      },
      [
        observed("support-1"),
        observed("frame-only", "incomplete"),
      ],
      "2026-09-25T20:02:00.000Z",
    );

    expect(revised.belief.confidence).toBe(first.belief.confidence);
    expect(revised.hypothesis.evidenceAgainst).toEqual([]);
    expect(revised.assessment.incompleteEvidenceIds).toEqual(["frame-only"]);
  });

  it("fails closed when a stable candidate id is reused for a different claim", () => {
    const first = reviseCognitionFromMultimodalEvidence(
      createCognitiveState("2026-09-25T20:00:00.000Z"),
      {
        id: "pressure",
        statement: "Pressure increased.",
        supportingObservationIds: ["support-1"],
      },
      [observed("support-1")],
      "2026-09-25T20:01:00.000Z",
    );

    expect(() =>
      reviseCognitionFromMultimodalEvidence(
        first.state,
        {
          id: "pressure",
          statement: "Pressure decreased.",
          supportingObservationIds: ["support-2"],
        },
        [observed("support-2")],
        "2026-09-25T20:02:00.000Z",
      ),
    ).toThrow(/different proposition/);
  });
});

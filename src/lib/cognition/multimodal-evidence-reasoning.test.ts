import { describe, expect, it } from "vitest";

import {
  assessMultimodalReasoningCandidate,
  multimodalCandidateToBelief,
  multimodalCandidateToHypothesis,
} from "./multimodal-evidence-reasoning";
import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";

function observed(
  id: string,
  role: CognitiveMultimodalObservation["evidenceRole"],
): CognitiveMultimodalObservation {
  return {
    observation: {
      id,
      source: "tool",
      content: `evidence ${id}`,
      observedAt: "2026-09-25T19:00:00.000Z",
      metadata: {
        evidenceRole: role,
      },
    },
    modality: "text-document",
    attachmentId: id,
    capabilityId: "document-understanding",
    processorId: "processor-v1",
    evidenceRole: role,
    warnings: role === "derived" ? ["truncated"] : [],
  };
}

describe("multimodal evidence reasoning", () => {
  it("keeps direct, derived, and incomplete evidence epistemically distinct", () => {
    const observations = [
      observed("direct-1", "direct"),
      observed("derived-1", "derived"),
      observed("incomplete-1", "incomplete"),
    ];
    const assessment = assessMultimodalReasoningCandidate(
      {
        id: "pressure-rise",
        statement: "Pressure increased.",
        supportingObservationIds: [
          "direct-1",
          "derived-1",
          "incomplete-1",
        ],
      },
      observations,
    );

    expect(assessment.admissibleEvidenceIds).toEqual([
      "direct-1",
      "derived-1",
    ]);
    expect(assessment.derivedEvidenceIds).toEqual(["derived-1"]);
    expect(assessment.incompleteEvidenceIds).toEqual(["incomplete-1"]);
    expect(assessment.confidence).toBeCloseTo(2.6 / 3.6);
  });

  it("does not let uninterpreted visual frames manufacture confidence", () => {
    const assessment = assessMultimodalReasoningCandidate(
      {
        id: "visual-claim",
        statement: "The video shows a blue valve.",
        supportingObservationIds: ["frame-only"],
      },
      [observed("frame-only", "incomplete")],
    );

    expect(assessment.confidence).toBe(0);
    expect(assessment.evidenceForIds).toEqual([]);
    expect(assessment.incompleteEvidenceIds).toEqual(["frame-only"]);
  });

  it("lowers confidence when admissible evidence contradicts a candidate", () => {
    const supportive = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The pressure increased.",
        supportingObservationIds: ["support"],
      },
      [observed("support", "direct")],
    );
    const contested = assessMultimodalReasoningCandidate(
      {
        id: "claim",
        statement: "The pressure increased.",
        supportingObservationIds: ["support"],
        contradictingObservationIds: ["against"],
      },
      [
        observed("support", "direct"),
        observed("against", "direct"),
      ],
    );

    expect(contested.confidence).toBeLessThan(supportive.confidence);
    expect(contested.evidenceAgainstIds).toEqual(["against"]);
  });

  it("creates beliefs and hypotheses that cite only admissible evidence", () => {
    const candidate = {
      id: "claim",
      statement: "The measured state changed.",
      supportingObservationIds: ["direct", "incomplete"],
    };
    const assessment = assessMultimodalReasoningCandidate(
      candidate,
      [
        observed("direct", "direct"),
        observed("incomplete", "incomplete"),
      ],
    );
    const belief = multimodalCandidateToBelief(
      candidate,
      assessment,
      "2026-09-25T19:01:00.000Z",
    );
    const hypothesis = multimodalCandidateToHypothesis(
      candidate,
      assessment,
      "2026-09-25T19:01:00.000Z",
    );

    expect(belief.evidenceIds).toEqual(["direct"]);
    expect(hypothesis.evidenceFor).toEqual(["direct"]);
    expect(hypothesis.evidenceAgainst).toEqual([]);
    expect(hypothesis.status).toBe("candidate");
  });

  it("fails closed on unknown evidence and contradictory evidence roles", () => {
    const observations = [observed("known", "direct")];

    expect(() =>
      assessMultimodalReasoningCandidate(
        {
          id: "bad",
          statement: "Bad claim.",
          supportingObservationIds: ["missing"],
        },
        observations,
      ),
    ).toThrow(/Unknown multimodal observation missing/);

    expect(() =>
      assessMultimodalReasoningCandidate(
        {
          id: "bad",
          statement: "Bad claim.",
          supportingObservationIds: ["known"],
          contradictingObservationIds: ["known"],
        },
        observations,
      ),
    ).toThrow(/cannot both support and contradict/);
  });
});

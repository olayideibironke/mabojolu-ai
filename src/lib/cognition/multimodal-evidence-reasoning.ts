import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import type { Belief, Hypothesis } from "./types";
import { independentMultimodalEvidenceWeight } from "./multimodal-evidence-independence";

export interface MultimodalReasoningCandidate {
  id: string;
  statement: string;
  supportingObservationIds: string[];
  contradictingObservationIds?: string[];
}

export interface MultimodalReasoningAssessment {
  candidateId: string;
  confidence: number;
  evidenceForIds: string[];
  evidenceAgainstIds: string[];
  admissibleEvidenceIds: string[];
  incompleteEvidenceIds: string[];
  derivedEvidenceIds: string[];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function evidenceWeight(
  observation: CognitiveMultimodalObservation,
): number {
  switch (observation.evidenceRole) {
    case "direct":
      return 1;
    case "derived":
      return 0.6;
    case "incomplete":
      return 0;
  }
}

export function assessMultimodalReasoningCandidate(
  candidate: MultimodalReasoningCandidate,
  observations: readonly CognitiveMultimodalObservation[],
): MultimodalReasoningAssessment {
  if (!candidate.id.trim() || !candidate.statement.trim()) {
    throw new Error("Multimodal reasoning candidates require id and statement.");
  }

  const byId = new Map(
    observations.map((entry) => [entry.observation.id, entry]),
  );
  const supporting = unique(candidate.supportingObservationIds);
  const contradicting = unique(candidate.contradictingObservationIds ?? []);
  const overlap = supporting.find((id) => contradicting.includes(id));

  if (overlap) {
    throw new Error(
      `Observation ${overlap} cannot both support and contradict one candidate.`,
    );
  }

  for (const id of [...supporting, ...contradicting]) {
    if (!byId.has(id)) {
      throw new Error(`Unknown multimodal observation ${id}.`);
    }
  }

  const admissibleEvidenceIds = [...supporting, ...contradicting].filter(
    (id) => evidenceWeight(byId.get(id)!) > 0,
  );
  const incompleteEvidenceIds = [...supporting, ...contradicting].filter(
    (id) => byId.get(id)!.evidenceRole === "incomplete",
  );
  const derivedEvidenceIds = [...supporting, ...contradicting].filter(
    (id) => byId.get(id)!.evidenceRole === "derived",
  );

  const supportWeight = independentMultimodalEvidenceWeight(
    supporting,
    observations,
    evidenceWeight,
  );
  const contradictionWeight = independentMultimodalEvidenceWeight(
    contradicting,
    observations,
    evidenceWeight,
  );

  const confidence =
    admissibleEvidenceIds.length === 0
      ? 0
      : (supportWeight + 1) /
        (supportWeight + contradictionWeight + 2);

  return {
    candidateId: candidate.id,
    confidence,
    evidenceForIds: supporting.filter(
      (id) => evidenceWeight(byId.get(id)!) > 0,
    ),
    evidenceAgainstIds: contradicting.filter(
      (id) => evidenceWeight(byId.get(id)!) > 0,
    ),
    admissibleEvidenceIds,
    incompleteEvidenceIds,
    derivedEvidenceIds,
  };
}

export function multimodalCandidateToBelief(
  candidate: MultimodalReasoningCandidate,
  assessment: MultimodalReasoningAssessment,
  updatedAt: string,
): Belief {
  if (assessment.candidateId !== candidate.id) {
    throw new Error("Multimodal reasoning assessment does not match candidate.");
  }

  return {
    id: `belief:${candidate.id}`,
    proposition: candidate.statement,
    confidence: assessment.confidence,
    status: "active",
    evidenceIds: [
      ...assessment.evidenceForIds,
      ...assessment.evidenceAgainstIds,
    ],
    updatedAt,
  };
}

export function multimodalCandidateToHypothesis(
  candidate: MultimodalReasoningCandidate,
  assessment: MultimodalReasoningAssessment,
  updatedAt: string,
): Hypothesis {
  if (assessment.candidateId !== candidate.id) {
    throw new Error("Multimodal reasoning assessment does not match candidate.");
  }

  const status: Hypothesis["status"] =
    assessment.evidenceForIds.length === 0
      ? "candidate"
      : assessment.confidence >= 0.75 &&
          assessment.evidenceAgainstIds.length === 0
        ? "supported"
        : "candidate";

  return {
    id: `hypothesis:${candidate.id}`,
    statement: candidate.statement,
    confidence: assessment.confidence,
    status,
    evidenceFor: [...assessment.evidenceForIds],
    evidenceAgainst: [...assessment.evidenceAgainstIds],
    createdAt: updatedAt,
    updatedAt,
  };
}

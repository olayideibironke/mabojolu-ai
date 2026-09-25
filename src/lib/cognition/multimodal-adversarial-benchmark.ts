import type { CognitiveMultimodalObservation } from "./multimodal-evidence-bridge";
import { runGovernedMultimodalReasoning } from "./governed-multimodal-reasoning";
import { createCognitiveState } from "./state";

export interface MultimodalAdversarialBenchmarkResult {
  passed: boolean;
  checks: {
    staleEvidenceRejected: boolean;
    independentConflictPreserved: boolean;
    correlatedConflictRejected: boolean;
    incompleteEvidenceNonSemantic: boolean;
    contradictionRevisesBelief: boolean;
  };
}

function observation(input: {
  id: string;
  observedAt: string;
  subject: string;
  modality: CognitiveMultimodalObservation["modality"];
  role?: CognitiveMultimodalObservation["evidenceRole"];
  sourceArtifactId?: string;
}): CognitiveMultimodalObservation {
  const role = input.role ?? "direct";
  return {
    observation: {
      id: input.id,
      source: "tool",
      content: `benchmark evidence ${input.id}`,
      observedAt: input.observedAt,
      metadata: {
        temporalSubjectId: input.subject,
        ...(input.sourceArtifactId
          ? { sourceArtifactId: input.sourceArtifactId }
          : {}),
      },
    },
    modality: input.modality,
    attachmentId: input.id,
    capabilityId:
      input.modality === "audio-understanding"
        ? "audio-understanding"
        : input.modality === "image-understanding"
          ? "image-understanding"
          : "document-understanding",
    processorId: "benchmark-processor",
    evidenceRole: role,
    warnings: role === "derived" ? ["benchmark-derived"] : [],
  };
}

export function runMultimodalAdversarialBenchmark():
  MultimodalAdversarialBenchmarkResult {
  const initial = createCognitiveState("2026-09-25T20:00:00.000Z");

  const stale = runGovernedMultimodalReasoning(
    initial,
    {
      id: "pressure",
      statement: "Pressure is high.",
      supportingObservationIds: ["old-high"],
      contradictingObservationIds: ["new-low"],
    },
    [
      observation({
        id: "old-high",
        observedAt: "2026-09-25T20:00:00.000Z",
        subject: "pressure",
        modality: "text-document",
      }),
      observation({
        id: "new-low",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "pressure",
        modality: "text-document",
      }),
    ],
    "2026-09-25T21:01:00.000Z",
  );

  const conflict = runGovernedMultimodalReasoning(
    initial,
    {
      id: "event",
      statement: "The event occurred.",
      supportingObservationIds: ["document"],
      contradictingObservationIds: ["audio"],
    },
    [
      observation({
        id: "document",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "document-event",
        modality: "text-document",
      }),
      observation({
        id: "audio",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "audio-event",
        modality: "audio-understanding",
      }),
    ],
    "2026-09-25T21:01:00.000Z",
  );

  let correlatedConflictRejected = false;
  try {
    runGovernedMultimodalReasoning(
      initial,
      {
        id: "correlated",
        statement: "The recording confirms the event.",
        supportingObservationIds: ["transcript"],
        contradictingObservationIds: ["notes"],
      },
      [
        observation({
          id: "transcript",
          observedAt: "2026-09-25T21:00:00.000Z",
          subject: "transcript",
          modality: "audio-understanding",
          sourceArtifactId: "recording-1",
        }),
        observation({
          id: "notes",
          observedAt: "2026-09-25T21:00:00.000Z",
          subject: "notes",
          modality: "text-document",
          sourceArtifactId: "recording-1",
        }),
      ],
      "2026-09-25T21:01:00.000Z",
    );
  } catch {
    correlatedConflictRejected = true;
  }

  const incomplete = runGovernedMultimodalReasoning(
    initial,
    {
      id: "visual",
      statement: "The frame shows a valve.",
      supportingObservationIds: ["frame"],
    },
    [
      observation({
        id: "frame",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "visual",
        modality: "image-understanding",
        role: "incomplete",
      }),
    ],
    "2026-09-25T21:01:00.000Z",
  );

  const firstBelief = runGovernedMultimodalReasoning(
    initial,
    {
      id: "revision",
      statement: "The system is stable.",
      supportingObservationIds: ["support"],
    },
    [
      observation({
        id: "support",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "support-source",
        modality: "text-document",
      }),
    ],
    "2026-09-25T21:01:00.000Z",
  );

  const revisedBelief = runGovernedMultimodalReasoning(
    firstBelief.state,
    {
      id: "revision",
      statement: "The system is stable.",
      supportingObservationIds: ["support"],
      contradictingObservationIds: ["against"],
    },
    [
      observation({
        id: "support",
        observedAt: "2026-09-25T21:00:00.000Z",
        subject: "support-source",
        modality: "text-document",
      }),
      observation({
        id: "against",
        observedAt: "2026-09-25T21:02:00.000Z",
        subject: "against-source",
        modality: "audio-understanding",
      }),
    ],
    "2026-09-25T21:03:00.000Z",
  );

  const checks = {
    staleEvidenceRejected:
      stale.supersededObservationIds.includes("old-high") &&
      stale.conflictDecision === "contradicted" &&
      stale.hypothesis.evidenceFor.length === 0,
    independentConflictPreserved:
      conflict.conflictDecision === "contested" &&
      conflict.hypothesis.evidenceFor.includes("document") &&
      conflict.hypothesis.evidenceAgainst.includes("audio"),
    correlatedConflictRejected,
    incompleteEvidenceNonSemantic:
      incomplete.conflictDecision === "insufficient" &&
      incomplete.belief.confidence === 0 &&
      incomplete.hypothesis.evidenceFor.length === 0,
    contradictionRevisesBelief:
      revisedBelief.belief.confidence < firstBelief.belief.confidence &&
      revisedBelief.hypothesis.evidenceAgainst.includes("against"),
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

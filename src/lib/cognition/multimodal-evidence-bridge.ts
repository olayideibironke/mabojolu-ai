import type { MultimodalEvidencePackage } from "@/lib/attachments/analysis";
import type { Observation } from "./types";

export type MultimodalEvidenceRole =
  | "direct"
  | "derived"
  | "incomplete";

export interface CognitiveMultimodalObservation {
  observation: Observation;
  modality: MultimodalEvidencePackage["modality"];
  attachmentId: string;
  capabilityId: string;
  processorId: string;
  evidenceRole: MultimodalEvidenceRole;
  warnings: string[];
}

function scalarMetadata(
  metadata: MultimodalEvidencePackage["metadata"],
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (
        entry,
      ): entry is [
        string,
        string | number | boolean | null,
      ] => !Array.isArray(entry[1]),
    ),
  );
}

function evidenceContent(
  evidence: MultimodalEvidencePackage,
): { content: string; role: MultimodalEvidenceRole } {
  const extracted =
    evidence.text?.trim() ||
    evidence.transcript?.trim();

  if (extracted) {
    return {
      content: extracted,
      role: evidence.warnings.length > 0 ? "derived" : "direct",
    };
  }

  if ((evidence.images?.length ?? 0) > 0) {
    return {
      content:
        `Observed ${evidence.images!.length} visual frame(s) from ${evidence.filename}; semantic visual interpretation has not been established by this evidence package.`,
      role: "incomplete",
    };
  }

  return {
    content:
      `Observed attachment ${evidence.filename}; the processor supplied metadata but no semantic content.`,
    role: "incomplete",
  };
}

export function multimodalEvidenceToCognitiveObservation(
  evidence: MultimodalEvidencePackage,
): CognitiveMultimodalObservation {
  if (!evidence.attachmentId.trim()) {
    throw new Error("Multimodal cognitive evidence requires an attachment id.");
  }
  if (!evidence.processor.id.trim()) {
    throw new Error("Multimodal cognitive evidence requires processor provenance.");
  }

  const normalized = evidenceContent(evidence);
  const observation: Observation = {
    id: `multimodal:${evidence.attachmentId}:${evidence.schemaVersion}`,
    source: "tool",
    content: normalized.content,
    observedAt: evidence.createdAt,
    metadata: {
      attachmentId: evidence.attachmentId,
      filename: evidence.filename,
      mimeType: evidence.mimeType,
      modality: evidence.modality,
      capabilityId: evidence.capabilityId,
      processorId: evidence.processor.id,
      processorLocal: evidence.processor.local,
      evidenceRole: normalized.role,
      warningCount: evidence.warnings.length,
      ...scalarMetadata(evidence.metadata),
    },
  };

  return {
    observation,
    modality: evidence.modality,
    attachmentId: evidence.attachmentId,
    capabilityId: evidence.capabilityId,
    processorId: evidence.processor.id,
    evidenceRole: normalized.role,
    warnings: [...evidence.warnings],
  };
}

export function multimodalEvidenceBatchToCognitiveObservations(
  packages: readonly MultimodalEvidencePackage[],
): CognitiveMultimodalObservation[] {
  const attachmentIds = new Set<string>();
  const observationIds = new Set<string>();

  return packages.map((evidence) => {
    if (attachmentIds.has(evidence.attachmentId)) {
      throw new Error(
        `Duplicate multimodal attachment evidence ${evidence.attachmentId}.`,
      );
    }
    attachmentIds.add(evidence.attachmentId);

    const converted = multimodalEvidenceToCognitiveObservation(evidence);
    if (observationIds.has(converted.observation.id)) {
      throw new Error(
        `Duplicate multimodal cognitive observation ${converted.observation.id}.`,
      );
    }
    observationIds.add(converted.observation.id);
    return converted;
  });
}

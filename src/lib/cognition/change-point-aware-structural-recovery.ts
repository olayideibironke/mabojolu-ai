import {
  runControlledAutomaticStructuralRecovery,
  type AutomaticStructuralRecoveryResult,
} from "./automatic-bounded-structural-resynthesis";

import {
  chooseMultiGenerationStructuralAdaptation,
  type MultiGenerationAdaptationDecision,
  type SequencedStructuralEvidence,
  type StructuralFamilyGeneration,
} from "./change-point-multi-generation-adaptation";

import type {
  AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import type {
  MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import type {
  HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

export interface ChangePointRecoveryInputs {
  activeFamily: StructuralFamilyGeneration;
  archivedFamilies: readonly StructuralFamilyGeneration[];
  evidence: readonly SequencedStructuralEvidence[];
  protectedEvidence: readonly SequencedStructuralEvidence[];
  failedCandidates: readonly MultiFragmentStructuralRevisionCandidate[];
  collapse: AdaptivePrunedStructuralDiagnosisResult;
  actualProgram: HierarchicalCausalProgram;
  excludedEvidenceIds?: readonly string[];
}

export interface ChangePointRecoveryResult {
  decision:
    | "retain-active"
    | "resurrect-archived"
    | "synthesized-recovery"
    | "reopen-search"
    | "abstained";
  adaptation: MultiGenerationAdaptationDecision;
  selectedFamily?: StructuralFamilyGeneration;
  recovery?: AutomaticStructuralRecoveryResult;
  reason:
    | "active-family-retained"
    | "archived-family-resurrected"
    | "new-family-recovery-resolved"
    | "new-family-recovery-inadequate"
    | "new-family-recovery-abstained"
    | "adaptation-abstained";
}

function evidenceIds(
  evidence: readonly SequencedStructuralEvidence[],
): string[] {
  return evidence.map(
    (entry) =>
      entry.observation.experiment.id,
  );
}

export function runChangePointAwareStructuralRecovery(
  inputs: ChangePointRecoveryInputs,
  options?: {
    adaptation?: Parameters<
      typeof chooseMultiGenerationStructuralAdaptation
    >[4];
    recovery?: Parameters<
      typeof runControlledAutomaticStructuralRecovery
    >[7];
  },
): ChangePointRecoveryResult {
  const adaptation =
    chooseMultiGenerationStructuralAdaptation(
      inputs.activeFamily,
      inputs.archivedFamilies,
      inputs.evidence,
      inputs.protectedEvidence,
      options?.adaptation,
    );

  if (adaptation.decision === "abstained") {
    return {
      decision: "abstained",
      adaptation,
      reason: "adaptation-abstained",
    };
  }

  if (adaptation.decision === "retain-active") {
    return {
      decision: "retain-active",
      adaptation,
      selectedFamily: inputs.activeFamily,
      reason: "active-family-retained",
    };
  }

  if (adaptation.decision === "resurrect-archived") {
    const selectedFamily =
      inputs.archivedFamilies.find(
        (family) =>
          family.familyId ===
            adaptation.selectedFamilyId &&
          family.generation ===
            adaptation.selectedGeneration,
      );

    if (!selectedFamily) {
      throw new Error(
        "Selected archived structural family is missing from the retained family archive.",
      );
    }

    return {
      decision: "resurrect-archived",
      adaptation,
      selectedFamily: {
        ...selectedFamily,
        protectedEvidenceIds:
          evidenceIds(
            inputs.protectedEvidence,
          ),
        status: "active",
      },
      reason: "archived-family-resurrected",
    };
  }

  const synthesisIds =
    new Set(
      adaptation.synthesisEvidenceIds,
    );

  const collapseEvidenceIds =
    new Set(
      inputs.collapse.allEvidence.map(
        (observation) =>
          observation.experiment.id,
      ),
    );

  for (const id of collapseEvidenceIds) {
    if (!synthesisIds.has(id)) {
      throw new Error(
        "v1.37 bounded re-synthesis must use only post-change evidence.",
      );
    }
  }

  const protectedIds =
    new Set(
      evidenceIds(
        inputs.protectedEvidence,
      ),
    );

  for (const id of collapseEvidenceIds) {
    if (protectedIds.has(id)) {
      throw new Error(
        "v1.37 bounded re-synthesis evidence must remain disjoint from protected validation evidence.",
      );
    }
  }

  const recovery =
    runControlledAutomaticStructuralRecovery(
      inputs.activeFamily.program,
      inputs.failedCandidates,
      inputs.collapse,
      inputs.activeFamily.familyId,
      inputs.activeFamily.generation + 1,
      inputs.actualProgram,
      [
        ...protectedIds,
        ...(inputs.excludedEvidenceIds ?? []),
      ],
      options?.recovery,
    );

  if (recovery.decision === "resolved") {
    return {
      decision: "synthesized-recovery",
      adaptation,
      recovery,
      reason: "new-family-recovery-resolved",
    };
  }

  if (recovery.decision === "reopen-search") {
    return {
      decision: "reopen-search",
      adaptation,
      recovery,
      reason: "new-family-recovery-inadequate",
    };
  }

  return {
    decision: "abstained",
    adaptation,
    recovery,
    reason: "new-family-recovery-abstained",
  };
}

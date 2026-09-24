import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

export interface StructuralFamilyGeneration {
  familyId: string;
  generation: number;
  parentFamilyId?: string;
  program: HierarchicalCausalProgram;
  protectedEvidenceIds: string[];
  status: "active" | "archived";
}

export interface SequencedStructuralEvidence {
  sequence: number;
  observation: StructuralMechanismObservation;
}

export interface StructuralChangePointAssessment {
  decision: "change-point" | "stable" | "abstained";
  changeSequence?: number;
  posteriorChangeProbability: number;
  improvement: number;
  preChangeEvidenceIds: string[];
  postChangeEvidenceIds: string[];
  reason:
    | "persistent-predictive-regime-change"
    | "noise-or-insufficient-improvement"
    | "ambiguous-change-point";
}

export interface FamilyPosterior {
  familyId: string;
  generation: number;
  meanSquaredError: number;
  probability: number;
}

export interface MultiGenerationAdaptationDecision {
  decision:
    | "retain-active"
    | "resurrect-archived"
    | "synthesize-new"
    | "abstained";
  changePoint: StructuralChangePointAssessment;
  selectedFamilyId?: string;
  selectedGeneration?: number;
  familyPosteriors: FamilyPosterior[];
  synthesisEvidenceIds: string[];
  reason:
    | "no-credible-change-point"
    | "archived-family-protected-winner"
    | "no-retained-family-adequate"
    | "family-posterior-ambiguous"
    | "change-point-ambiguous";
}

function validateEvidence(
  evidence: readonly SequencedStructuralEvidence[],
): SequencedStructuralEvidence[] {
  const sorted = [...evidence].sort((a, b) => a.sequence - b.sequence);
  const sequences = new Set<number>();
  const ids = new Set<string>();

  for (const entry of sorted) {
    if (!Number.isInteger(entry.sequence) || entry.sequence < 0) {
      throw new Error("Structural evidence sequence must be a non-negative integer.");
    }

    const id = entry.observation.experiment.id;
    if (sequences.has(entry.sequence)) {
      throw new Error(`Duplicate structural evidence sequence ${entry.sequence}.`);
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate structural evidence id ${id}.`);
    }

    sequences.add(entry.sequence);
    ids.add(id);
  }

  return sorted;
}

function squaredError(
  program: HierarchicalCausalProgram,
  observation: StructuralMechanismObservation,
): number {
  const error =
    observation.measuredEffect -
    predictHierarchicalProgramEffect(
      program,
      observation.experiment.interventions,
    );

  return error * error;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? Number.POSITIVE_INFINITY
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mse(
  program: HierarchicalCausalProgram,
  evidence: readonly SequencedStructuralEvidence[],
): number {
  return mean(
    evidence.map((entry) => squaredError(program, entry.observation)),
  );
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }

  const z = Math.exp(value);
  return z / (1 + z);
}

export function inferStructuralChangePoint(
  activeProgram: HierarchicalCausalProgram,
  evidence: readonly SequencedStructuralEvidence[],
  options?: {
    minimumSegmentSize?: number;
    minimumMseImprovement?: number;
    changeProbabilityThreshold?: number;
    ambiguityMargin?: number;
    posteriorScale?: number;
  },
): StructuralChangePointAssessment {
  const sorted = validateEvidence(evidence);
  const minimumSegmentSize = options?.minimumSegmentSize ?? 3;
  const minimumMseImprovement = options?.minimumMseImprovement ?? 0.01;
  const changeProbabilityThreshold = options?.changeProbabilityThreshold ?? 0.8;
  const ambiguityMargin = options?.ambiguityMargin ?? 0.08;
  const posteriorScale = options?.posteriorScale ?? 80;

  if (!Number.isInteger(minimumSegmentSize) || minimumSegmentSize < 2) {
    throw new Error("minimumSegmentSize must be an integer of at least 2.");
  }

  if (sorted.length < minimumSegmentSize * 2) {
    return {
      decision: "stable",
      posteriorChangeProbability: 0,
      improvement: 0,
      preChangeEvidenceIds: sorted.map((entry) => entry.observation.experiment.id),
      postChangeEvidenceIds: [],
      reason: "noise-or-insufficient-improvement",
    };
  }

  const errors = sorted.map((entry) => squaredError(activeProgram, entry.observation));
  const candidates: Array<{
    index: number;
    score: number;
    improvement: number;
    posterior: number;
  }> = [];

  for (
    let index = minimumSegmentSize;
    index <= sorted.length - minimumSegmentSize;
    index += 1
  ) {
    const beforeWindow = errors.slice(
      index - minimumSegmentSize,
      index,
    );
    const afterWindow = errors.slice(
      index,
      index + minimumSegmentSize,
    );
    const beforeMean = mean(beforeWindow);
    const afterMean = mean(afterWindow);
    const improvement = afterMean - beforeMean;
    const persistence =
      afterWindow.filter(
        (value) =>
          value >
          beforeMean +
            minimumMseImprovement / 2,
      ).length / afterWindow.length;
    const score = improvement * (0.5 + 0.5 * persistence);
    const posterior = sigmoid(
      posteriorScale * (score - minimumMseImprovement),
    );

    candidates.push({ index, score, improvement, posterior });
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.index - right.index,
  );

  const best = candidates[0]!;
  const runnerUp = candidates[1];
  const posteriorGap = runnerUp
    ? best.posterior - runnerUp.posterior
    : best.posterior;

  const before = sorted.slice(0, best.index);
  const after = sorted.slice(best.index);

  if (
    best.improvement < minimumMseImprovement ||
    best.posterior < changeProbabilityThreshold
  ) {
    return {
      decision: "stable",
      posteriorChangeProbability: best.posterior,
      improvement: best.improvement,
      preChangeEvidenceIds: sorted.map((entry) => entry.observation.experiment.id),
      postChangeEvidenceIds: [],
      reason: "noise-or-insufficient-improvement",
    };
  }

  if (runnerUp && posteriorGap < ambiguityMargin) {
    return {
      decision: "abstained",
      posteriorChangeProbability: best.posterior,
      improvement: best.improvement,
      preChangeEvidenceIds: before.map((entry) => entry.observation.experiment.id),
      postChangeEvidenceIds: after.map((entry) => entry.observation.experiment.id),
      reason: "ambiguous-change-point",
    };
  }

  return {
    decision: "change-point",
    changeSequence: sorted[best.index]!.sequence,
    posteriorChangeProbability: best.posterior,
    improvement: best.improvement,
    preChangeEvidenceIds: before.map((entry) => entry.observation.experiment.id),
    postChangeEvidenceIds: after.map((entry) => entry.observation.experiment.id),
    reason: "persistent-predictive-regime-change",
  };
}

function posteriorOverFamilies(
  families: readonly StructuralFamilyGeneration[],
  evidence: readonly SequencedStructuralEvidence[],
  temperature: number,
): FamilyPosterior[] {
  const scored = families.map((family) => ({
    family,
    error: mse(family.program, evidence),
  }));

  const minimum = Math.min(...scored.map((item) => item.error));
  const weights = scored.map((item) =>
    Math.exp(-(item.error - minimum) / temperature),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return scored
    .map((item, index) => ({
      familyId: item.family.familyId,
      generation: item.family.generation,
      meanSquaredError: item.error,
      probability: weights[index]! / total,
    }))
    .sort(
      (left, right) =>
        right.probability - left.probability ||
        left.meanSquaredError - right.meanSquaredError ||
        right.generation - left.generation,
    );
}

export function chooseMultiGenerationStructuralAdaptation(
  activeFamily: StructuralFamilyGeneration,
  archivedFamilies: readonly StructuralFamilyGeneration[],
  evidence: readonly SequencedStructuralEvidence[],
  protectedEvidence: readonly SequencedStructuralEvidence[],
  options?: {
    minimumSegmentSize?: number;
    minimumMseImprovement?: number;
    changeProbabilityThreshold?: number;
    ambiguityMargin?: number;
    posteriorScale?: number;
    familyTemperature?: number;
    maximumAdequateMse?: number;
    minimumFamilyPosterior?: number;
    minimumFamilyPosteriorGap?: number;
    minimumProtectedEvidence?: number;
  },
): MultiGenerationAdaptationDecision {
  const sorted = validateEvidence(evidence);
  const protectedSorted = validateEvidence(protectedEvidence);
  const changePoint = inferStructuralChangePoint(
    activeFamily.program,
    sorted,
    options,
  );

  if (changePoint.decision === "abstained") {
    return {
      decision: "abstained",
      changePoint,
      familyPosteriors: [],
      synthesisEvidenceIds: [],
      reason: "change-point-ambiguous",
    };
  }

  if (changePoint.decision !== "change-point") {
    return {
      decision: "retain-active",
      changePoint,
      selectedFamilyId: activeFamily.familyId,
      selectedGeneration: activeFamily.generation,
      familyPosteriors: [],
      synthesisEvidenceIds: [],
      reason: "no-credible-change-point",
    };
  }

  const postIds = new Set(changePoint.postChangeEvidenceIds);
  const postChangeEvidence = sorted.filter((entry) =>
    postIds.has(entry.observation.experiment.id),
  );

  const protectedIds = new Set(
    protectedSorted.map((entry) => entry.observation.experiment.id),
  );

  if (
    postChangeEvidence.some((entry) =>
      protectedIds.has(entry.observation.experiment.id),
    )
  ) {
    throw new Error(
      "Change-point synthesis evidence must remain disjoint from protected family-selection evidence.",
    );
  }

  const minimumProtectedEvidence = options?.minimumProtectedEvidence ?? 3;
  if (protectedSorted.length < minimumProtectedEvidence) {
    return {
      decision: "abstained",
      changePoint,
      familyPosteriors: [],
      synthesisEvidenceIds: postChangeEvidence.map(
        (entry) => entry.observation.experiment.id,
      ),
      reason: "family-posterior-ambiguous",
    };
  }

  const retained = [activeFamily, ...archivedFamilies];
  const posteriors = posteriorOverFamilies(
    retained,
    protectedSorted,
    options?.familyTemperature ?? 0.01,
  );
  const winner = posteriors[0]!;
  const runnerUp = posteriors[1];
  const adequate = winner.meanSquaredError <= (options?.maximumAdequateMse ?? 0.005);
  const confident =
    winner.probability >= (options?.minimumFamilyPosterior ?? 0.7) &&
    (!runnerUp ||
      winner.probability - runnerUp.probability >=
        (options?.minimumFamilyPosteriorGap ?? 0.2));

  if (!adequate) {
    return {
      decision: "synthesize-new",
      changePoint,
      familyPosteriors: posteriors,
      synthesisEvidenceIds: postChangeEvidence.map(
        (entry) => entry.observation.experiment.id,
      ),
      reason: "no-retained-family-adequate",
    };
  }

  if (!confident) {
    return {
      decision: "abstained",
      changePoint,
      familyPosteriors: posteriors,
      synthesisEvidenceIds: postChangeEvidence.map(
        (entry) => entry.observation.experiment.id,
      ),
      reason: "family-posterior-ambiguous",
    };
  }

  if (winner.familyId === activeFamily.familyId) {
    return {
      decision: "retain-active",
      changePoint,
      selectedFamilyId: winner.familyId,
      selectedGeneration: winner.generation,
      familyPosteriors: posteriors,
      synthesisEvidenceIds: postChangeEvidence.map(
        (entry) => entry.observation.experiment.id,
      ),
      reason: "no-credible-change-point",
    };
  }

  return {
    decision: "resurrect-archived",
    changePoint,
    selectedFamilyId: winner.familyId,
    selectedGeneration: winner.generation,
    familyPosteriors: posteriors,
    synthesisEvidenceIds: postChangeEvidence.map(
      (entry) => entry.observation.experiment.id,
    ),
    reason: "archived-family-protected-winner",
  };
}

export function archiveAndAdvanceStructuralFamily(
  activeFamily: StructuralFamilyGeneration,
  nextFamilyId: string,
  nextProgram: HierarchicalCausalProgram,
  protectedEvidenceIds: readonly string[],
): {
  archived: StructuralFamilyGeneration;
  active: StructuralFamilyGeneration;
} {
  if (!nextFamilyId.trim()) {
    throw new Error("Next structural family id cannot be empty.");
  }

  return {
    archived: {
      ...activeFamily,
      protectedEvidenceIds: [...activeFamily.protectedEvidenceIds],
      status: "archived",
    },
    active: {
      familyId: nextFamilyId,
      generation: activeFamily.generation + 1,
      parentFamilyId: activeFamily.familyId,
      program: nextProgram,
      protectedEvidenceIds: [...protectedEvidenceIds],
      status: "active",
    },
  };
}

export interface CompetingEnvironmentModel {
  id: string;
  probability: number;
  predictedOutcomes: Record<string, string>;
}

export interface DiscoveryExperiment {
  id: string;
  actionKind: string;
  risk: number;
  reversible: boolean;
  cost: number;
}

export interface DiscoveryExperimentDecision {
  experiment?: DiscoveryExperiment;
  informationGain: number;
  score: number;
  reason: "safe-discriminating-experiment" | "no-safe-discriminating-experiment";
}

function entropy(probabilities: readonly number[]): number {
  return probabilities.reduce(
    (total, probability) =>
      probability > 0 ? total - probability * Math.log2(probability) : total,
    0,
  );
}

export function selectUncertaintyReducingExperiment(input: {
  models: readonly CompetingEnvironmentModel[];
  experiments: readonly DiscoveryExperiment[];
  maximumRisk?: number;
  costPenalty?: number;
}): DiscoveryExperimentDecision {
  if (input.models.length < 2) {
    throw new Error("Active discovery requires at least two competing models.");
  }

  const ids = new Set<string>();
  let probabilityTotal = 0;
  for (const model of input.models) {
    if (!model.id.trim() || ids.has(model.id)) {
      throw new Error("Competing model ids must be non-empty and unique.");
    }
    if (!Number.isFinite(model.probability) || model.probability <= 0) {
      throw new Error("Competing model probabilities must be positive.");
    }
    ids.add(model.id);
    probabilityTotal += model.probability;
  }
  if (Math.abs(probabilityTotal - 1) > 1e-9) {
    throw new Error("Competing model probabilities must sum to one.");
  }

  const maximumRisk = input.maximumRisk ?? 0.2;
  const costPenalty = input.costPenalty ?? 0.05;
  if (!Number.isFinite(maximumRisk) || maximumRisk < 0 || maximumRisk > 1) {
    throw new Error("maximumRisk must be in [0, 1].");
  }
  if (!Number.isFinite(costPenalty) || costPenalty < 0) {
    throw new Error("costPenalty must be non-negative.");
  }

  const priorEntropy = entropy(input.models.map((model) => model.probability));
  let best: DiscoveryExperimentDecision | undefined;

  for (const experiment of input.experiments) {
    if (
      !experiment.id.trim() ||
      !experiment.actionKind.trim() ||
      !experiment.reversible ||
      !Number.isFinite(experiment.risk) ||
      experiment.risk < 0 ||
      experiment.risk > maximumRisk ||
      !Number.isFinite(experiment.cost) ||
      experiment.cost < 0
    ) {
      continue;
    }

    const outcomeGroups = new Map<string, number[]>();
    let completePrediction = true;
    for (const model of input.models) {
      const outcome = model.predictedOutcomes[experiment.actionKind];
      if (!outcome?.trim()) {
        completePrediction = false;
        break;
      }
      const probabilities = outcomeGroups.get(outcome) ?? [];
      probabilities.push(model.probability);
      outcomeGroups.set(outcome, probabilities);
    }
    if (!completePrediction || outcomeGroups.size < 2) continue;

    let expectedPosteriorEntropy = 0;
    for (const probabilities of outcomeGroups.values()) {
      const outcomeProbability = probabilities.reduce((sum, value) => sum + value, 0);
      const posterior = probabilities.map((value) => value / outcomeProbability);
      expectedPosteriorEntropy += outcomeProbability * entropy(posterior);
    }

    const informationGain = priorEntropy - expectedPosteriorEntropy;
    const score = informationGain - experiment.cost * costPenalty;
    const candidate: DiscoveryExperimentDecision = {
      experiment: { ...experiment },
      informationGain,
      score,
      reason: "safe-discriminating-experiment",
    };

    if (
      !best ||
      candidate.score > best.score + Number.EPSILON ||
      (
        Math.abs(candidate.score - best.score) <= Number.EPSILON &&
        experiment.id.localeCompare(best.experiment?.id ?? "") < 0
      )
    ) {
      best = candidate;
    }
  }

  if (!best || best.informationGain <= Number.EPSILON || best.score <= 0) {
    return {
      informationGain: 0,
      score: 0,
      reason: "no-safe-discriminating-experiment",
    };
  }

  return best;
}

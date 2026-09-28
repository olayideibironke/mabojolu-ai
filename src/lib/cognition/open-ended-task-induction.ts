import type { Observation } from "./types";

export interface EnvironmentTransition {
  id: string;
  before: Record<string, string | number | boolean>;
  actionKind: string;
  after: Record<string, string | number | boolean>;
  outcomeKind: string;
  evidenceIds: string[];
}

export interface InducedTransitionRule {
  actionKind: string;
  feature: string;
  fromValue: string;
  toValue: string;
  outcomeKinds: string[];
  supportCount: number;
  confidence: number;
  evidenceIds: string[];
}

export interface InducedTaskStructure {
  relevantFeatures: string[];
  transitionRules: InducedTransitionRule[];
  unresolvedActions: string[];
}

function scalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function stateFromObservation(
  observation: Observation,
  prefix: "before:" | "after:",
): Record<string, string | number | boolean> {
  const state: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(observation.metadata ?? {})) {
    if (!key.startsWith(prefix) || !scalar(value)) continue;
    const feature = key.slice(prefix.length).trim();
    if (feature) state[feature] = value;
  }
  return state;
}

export function transitionFromObservation(
  observation: Observation,
): EnvironmentTransition {
  const actionKind = observation.metadata?.actionKind;
  const outcomeKind = observation.metadata?.outcomeKind;
  if (typeof actionKind !== "string" || !actionKind.trim()) {
    throw new Error("Transition evidence requires an observed action kind.");
  }
  if (typeof outcomeKind !== "string" || !outcomeKind.trim()) {
    throw new Error("Transition evidence requires an observed outcome kind.");
  }

  const before = stateFromObservation(observation, "before:");
  const after = stateFromObservation(observation, "after:");
  if (Object.keys(before).length === 0 || Object.keys(after).length === 0) {
    throw new Error("Transition evidence requires before and after state.");
  }

  return {
    id: `transition:${observation.id}`,
    before,
    actionKind: actionKind.trim(),
    after,
    outcomeKind: outcomeKind.trim(),
    evidenceIds: [observation.id],
  };
}

export function induceTaskStructure(input: {
  transitions: readonly EnvironmentTransition[];
  minimumRuleSupport?: number;
}): InducedTaskStructure {
  const minimumRuleSupport = input.minimumRuleSupport ?? 2;
  if (!Number.isInteger(minimumRuleSupport) || minimumRuleSupport < 2) {
    throw new Error("Task induction requires rule support of at least two transitions.");
  }
  if (input.transitions.length < minimumRuleSupport) {
    throw new Error("Task induction has insufficient transition evidence.");
  }

  const transitionIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const transition of input.transitions) {
    if (!transition.id.trim() || transitionIds.has(transition.id)) {
      throw new Error("Task induction requires unique transition identities.");
    }
    transitionIds.add(transition.id);
    if (!transition.actionKind.trim() || !transition.outcomeKind.trim()) {
      throw new Error("Task induction requires action and outcome identity.");
    }
    for (const evidenceId of transition.evidenceIds) {
      if (!evidenceId.trim() || evidenceIds.has(evidenceId)) {
        throw new Error("Task induction requires independent transition evidence.");
      }
      evidenceIds.add(evidenceId);
    }
  }

  type Aggregate = {
    actionKind: string;
    feature: string;
    fromValue: string;
    toValue: string;
    outcomeKinds: Set<string>;
    evidenceIds: Set<string>;
    count: number;
  };

  const aggregates = new Map<string, Aggregate>();
  const actions = new Set<string>();

  for (const transition of input.transitions) {
    actions.add(transition.actionKind);
    const featureNames = [...new Set([
      ...Object.keys(transition.before),
      ...Object.keys(transition.after),
    ])];

    for (const feature of featureNames) {
      const before = transition.before[feature];
      const after = transition.after[feature];
      if (before === undefined || after === undefined || before === after) continue;

      const fromValue = String(before);
      const toValue = String(after);
      const key = JSON.stringify([transition.actionKind, feature, fromValue, toValue]);
      const aggregate = aggregates.get(key) ?? {
        actionKind: transition.actionKind,
        feature,
        fromValue,
        toValue,
        outcomeKinds: new Set<string>(),
        evidenceIds: new Set<string>(),
        count: 0,
      };
      aggregate.count += 1;
      aggregate.outcomeKinds.add(transition.outcomeKind);
      transition.evidenceIds.forEach((id) => aggregate.evidenceIds.add(id));
      aggregates.set(key, aggregate);
    }
  }

  const transitionRules = [...aggregates.values()]
    .filter((aggregate) => aggregate.count >= minimumRuleSupport)
    .map((aggregate) => {
      const actionCount = input.transitions.filter(
        (transition) => transition.actionKind === aggregate.actionKind,
      ).length;
      return {
        actionKind: aggregate.actionKind,
        feature: aggregate.feature,
        fromValue: aggregate.fromValue,
        toValue: aggregate.toValue,
        outcomeKinds: [...aggregate.outcomeKinds].sort(),
        supportCount: aggregate.count,
        confidence: Number((aggregate.count / actionCount).toFixed(6)),
        evidenceIds: [...aggregate.evidenceIds].sort(),
      };
    })
    .sort((left, right) =>
      left.actionKind.localeCompare(right.actionKind) ||
      left.feature.localeCompare(right.feature) ||
      left.fromValue.localeCompare(right.fromValue) ||
      left.toValue.localeCompare(right.toValue),
    );

  const relevantFeatures = [...new Set(transitionRules.map((rule) => rule.feature))].sort();
  const resolvedActions = new Set(transitionRules.map((rule) => rule.actionKind));
  const unresolvedActions = [...actions]
    .filter((action) => !resolvedActions.has(action))
    .sort();

  return { relevantFeatures, transitionRules, unresolvedActions };
}

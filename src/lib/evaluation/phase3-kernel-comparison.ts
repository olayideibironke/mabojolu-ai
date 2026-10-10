import type { Observation } from "../cognition/types";
import { evaluateGeneralizationTask, summarizeGeneralizationEvaluation, type GeneralizationEvaluationSummary } from "./generalization-harness";
import { createIntegratedKernelBaselineAgent, type IntegratedKernelExternalObservation, type IntegratedKernelEvaluationScenario } from "./integrated-kernel-baseline-agent";
import { createSealedProbeTask, type ProbeObservation } from "./sealed-probe-task";
import { evaluateSealedBaselines, type SealedBaselineResult } from "./sealed-probe-baselines";

const symbols = ["amber", "violet", "cobalt", "silver", "cedar", "quartz"] as const;

function scenario(index: number): IntegratedKernelEvaluationScenario {
  const observations: Observation[] = Array.from({ length: 3 }, (_, offset) => ({
    id: `phase3-${index}-evidence-${offset}`,
    source: "environment",
    content: "Unknown mechanism. Inspection may reveal a distinguishing signal.",
    observedAt: "2026-10-04T00:00:00.000Z",
    metadata: {
      domain: "phase3-sealed-probe",
      actionKind: "probe",
      outcomeKind: "state-change",
      "before:state": "unknown",
      "after:state": "observed",
    },
  }));
  return {
    environmentId: `phase3-sealed-${index}`,
    observations,
    models: symbols.map((symbol) => ({
      id: `hypothesis-${symbol}`,
      probability: 1 / symbols.length,
      predictedOutcomes: { probe: symbol },
    })),
    experiments: [{ id: "probe", actionKind: "probe", risk: 0.05, reversible: true, cost: 0.1 }],
    candidates: symbols.map((symbol) => ({
      id: symbol,
      terms: [symbol],
      baseUtility: 0.6,
      risk: 0.05,
    })),
    memory: { autobiographical: [], semantic: [], revisions: [] },
    objective: {
      id: `phase3-objective-${index}`,
      description: "Find the unknown target.",
      successSignals: ["success"],
      maximumSteps: 3,
    },
    initialStrategyId: "amber",
    maximumRisk: 0.2,
    actionConfidenceThreshold: 0.9,
  };
}

export interface Phase3KernelComparison {
  seed: number;
  taskCount: number;
  kernel: GeneralizationEvaluationSummary;
  baselines: SealedBaselineResult[];
  kernelDecisions: { experiment: number; act: number; observe: number; abstain: number; none: number };
}

/**
 * The frozen kernel sees the probe signal as an experiment outcome, but receives
 * no hidden target or correct-strategy field. Its preconfigured initial strategy
 * is fixed across tasks. This measures its existing adapter behavior, not a new
 * learning algorithm or an independent third-party benchmark.
 */
export function evaluatePhase3KernelComparison(seed: number, taskCount: number): Phase3KernelComparison {
  if (!Number.isInteger(taskCount) || taskCount < 1 || taskCount > 10000) {
    throw new Error("Task count must be an integer between 1 and 10000.");
  }
  const kernelDecisions = { experiment: 0, act: 0, observe: 0, abstain: 0, none: 0 };
  const results = Array.from({ length: taskCount }, (_, index) => {
    const sealed = createSealedProbeTask(seed, index);
    const kernel = createIntegratedKernelBaselineAgent(scenario(index));
    const result = evaluateGeneralizationTask({
      task: {
        ...sealed.publicTask,
        initialObservation: { kind: "initial" } as IntegratedKernelExternalObservation,
        transition({ action, step }) {
          const outcome = sealed.publicTask.transition({ action, step });
          const observation: IntegratedKernelExternalObservation = outcome.observation.kind === "probe-result"
            ? { kind: "experiment-outcome", outcome: outcome.observation.hint }
            : { kind: "initial" };
          return { ...outcome, observation };
        },
      },
      agent: {
        reset(input) { kernel.reset(input); },
        act(input) {
          const action = kernel.act(input);
          const decision = kernel.lastKernelDecision()?.decision ?? "none";
          kernelDecisions[decision] += 1;
          return action;
        },
      },
    });
    return result;
  });
  return {
    seed,
    taskCount,
    kernel: summarizeGeneralizationEvaluation(results),
    baselines: evaluateSealedBaselines(seed, taskCount),
    kernelDecisions,
  };
}

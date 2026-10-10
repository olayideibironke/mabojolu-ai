import { evaluateGeneralizationTask, summarizeGeneralizationEvaluation, type GeneralizationAgent, type GeneralizationEvaluationSummary } from "./generalization-harness";
import { createSealedProbeTask, type ProbeObservation } from "./sealed-probe-task";

export type SealedBaseline = "first-guess" | "probe-then-act" | "abstain";

export function createSealedBaselineAgent(kind: SealedBaseline): GeneralizationAgent<string, ProbeObservation> {
  return {
    reset() {},
    act({ observation, availableActions }) {
      if (kind === "abstain") return undefined;
      if (kind === "probe-then-act") {
        if (observation.kind === "start") return "probe";
        return observation.kind === "probe-result" &&
          observation.hint &&
          availableActions.includes(observation.hint)
          ? observation.hint
          : undefined;
      }
      return availableActions.find((action) => action !== "probe");
    },
  };
}

export interface SealedBaselineResult {
  baseline: SealedBaseline;
  seed: number;
  summary: GeneralizationEvaluationSummary;
}

export function evaluateSealedBaselines(seed: number, taskCount: number): SealedBaselineResult[] {
  if (!Number.isInteger(taskCount) || taskCount < 1 || taskCount > 10000) {
    throw new Error("Task count must be an integer between 1 and 10000.");
  }
  const kinds: SealedBaseline[] = ["first-guess", "probe-then-act", "abstain"];
  return kinds.map((baseline) => {
    const results = Array.from({ length: taskCount }, (_, index) =>
      evaluateGeneralizationTask({
        task: createSealedProbeTask(seed, index).publicTask,
        agent: createSealedBaselineAgent(baseline),
      }),
    );
    return { baseline, seed, summary: summarizeGeneralizationEvaluation(results) };
  });
}

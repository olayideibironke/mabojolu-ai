import { describe, expect, it } from "vitest";

import type { Observation } from "../cognition/types";
import {
  evaluateGeneralizationTask,
  summarizeGeneralizationEvaluation,
} from "./generalization-harness";
import {
  createIntegratedKernelBaselineAgent,
  type IntegratedKernelEvaluationScenario,
  type IntegratedKernelExternalObservation,
} from "./integrated-kernel-baseline-agent";

interface DeterministicRng {
  next(): number;
}

function seededRng(seed: number): DeterministicRng {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

function choose<T>(rng: DeterministicRng, values: readonly T[]): T {
  return values[Math.floor(rng.next() * values.length)]!;
}

const actions = ["amber", "violet", "cobalt", "silver", "cedar", "quartz"];

function evidence(index: number): Observation[] {
  return [0, 1, 2].map((offset) => ({
    id: `kernel-${index}-obs-${offset}`,
    source: "environment",
    content: "Observed an unfamiliar held-out mechanism.",
    observedAt: `2026-10-04T00:0${offset}:00.000Z`,
    metadata: {
      domain: "phase2-held-out-kernel",
      actionKind: "probe",
      outcomeKind: "state-change",
      "before:state": "closed",
      "after:state": "open",
    },
  }));
}

function scenario(seed: number, index: number): {
  scenario: IntegratedKernelEvaluationScenario;
  correct: string;
  wrong: string;
  outcome: string;
} {
  const rng = seededRng(seed + index * 7919);
  const correct = choose(rng, actions);
  const wrong = choose(rng, actions.filter((value) => value !== correct));
  const mode = index % 4;

  const predictedA =
    mode === 2 ? `signal-${correct}` : mode === 3 ? wrong : correct;
  const predictedB =
    mode === 2 ? `signal-${wrong}` : mode === 3 ? correct : wrong;
  const outcome =
    mode === 1 ? "unexpected-third-outcome" : predictedA;

  return {
    correct,
    wrong,
    outcome,
    scenario: {
      environmentId: `kernel-held-out-${index}`,
      observations: evidence(index),
      models: [
        {
          id: `model-a-${index}`,
          probability: 0.5,
          predictedOutcomes: { inspect: predictedA },
        },
        {
          id: `model-b-${index}`,
          probability: 0.5,
          predictedOutcomes: { inspect: predictedB },
        },
      ],
      experiments: [
        {
          id: `inspect-${index}`,
          actionKind: "inspect",
          risk: 0.05,
          reversible: true,
          cost: 0.1,
        },
      ],
      candidates: [
        { id: correct, terms: [correct], baseUtility: 0.6, risk: 0.05 },
        { id: wrong, terms: [wrong], baseUtility: 0.6, risk: 0.05 },
      ],
      memory: {
        autobiographical: [],
        semantic: [],
        revisions: [],
      },
      objective: {
        id: `objective-${index}`,
        description: "Reach the hidden successful state.",
        successSignals: ["success"],
        maximumSteps: 2,
      },
      initialStrategyId: mode === 3 ? wrong : correct,
      maximumRisk: 0.2,
      actionConfidenceThreshold: 0.9,
    },
  };
}

describe("Phase 2 randomized frozen integrated-kernel battery", () => {
  it("measures the frozen v1.42 kernel across 64 externally scored tasks", () => {
    const seed = 0x4d41424f;
    const cases = Array.from({ length: 64 }, (_, index) =>
      scenario(seed, index),
    );

    const results = cases.map(({ scenario: kernelScenario, correct, outcome }, index) =>
      evaluateGeneralizationTask({
        task: {
          id: `kernel-held-out-${index}`,
          domain: `kernel-mode-${index % 4}`,
          maximumSteps: 2,
          initialObservation: { kind: "initial" } as IntegratedKernelExternalObservation,
          availableActions: ["inspect", ...actions],
          transition({ action }: { action: string; step: number }) {
            if (action === "inspect") {
              return {
                observation: {
                  kind: "experiment-outcome",
                  outcome,
                } as IntegratedKernelExternalObservation,
                reward: -0.1,
                success: false,
              };
            }

            return {
              observation: {
                kind: "experiment-outcome",
                outcome,
              } as IntegratedKernelExternalObservation,
              reward: action === correct ? 1 : -1,
              success: action === correct,
              terminal: true,
            };
          },
        },
        agent: createIntegratedKernelBaselineAgent(kernelScenario),
      }),
    );

    const summary = summarizeGeneralizationEvaluation(results);

    expect(summary.tasks).toBe(64);

    expect(summary.successes).toBe(32);
    expect(summary.abstentions).toBe(16);
    expect(summary.successRate).toBe(0.5);
    expect(summary.meanSteps).toBe(1.75);
    expect(summary.meanReward).toBeCloseTo(0.15);

    const modelSetFailures = results.filter(
      (result) => result.domain === "kernel-mode-1",
    );
    expect(modelSetFailures.every((result) => result.abstained)).toBe(true);
  });

  it("reproduces the same randomized scenarios from the published seed", () => {
    const seed = 0x4d41424f;
    const first = Array.from({ length: 64 }, (_, index) => scenario(seed, index))
      .map(({ scenario: item, correct, wrong, outcome }) => [
        item.environmentId,
        correct,
        wrong,
        outcome,
      ]);
    const second = Array.from({ length: 64 }, (_, index) => scenario(seed, index))
      .map(({ scenario: item, correct, wrong, outcome }) => [
        item.environmentId,
        correct,
        wrong,
        outcome,
      ]);

    expect(second).toEqual(first);
  });
});

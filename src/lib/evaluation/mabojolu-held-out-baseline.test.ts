import { describe, expect, it } from "vitest";

import {
  evaluateGeneralizationTask,
  summarizeGeneralizationEvaluation,
} from "./generalization-harness";
import {
  createMabojoluFrozenBaselineAgent,
  type MabojoluExternalObservation,
} from "./mabojolu-frozen-baseline-agent";

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

const actionVocabulary = [
  "amber",
  "violet",
  "cobalt",
  "silver",
  "cedar",
  "quartz",
] as const;

function heldOutTask(seed: number, index: number) {
  const rng = seededRng(seed + index * 7919);
  const correct = choose(rng, actionVocabulary);
  const distractors = actionVocabulary.filter((value) => value !== correct);
  const wrong = choose(rng, distractors);
  const mode = index % 4;

  if (mode === 0) {
    return {
      id: `held-out-clean-${index}`,
      domain: "held-out-clean-evidence",
      maximumSteps: 2,
      initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
      availableActions: ["inspect", correct, wrong],
      transition({ action }: { action: string; step: number }) {
        if (action === "inspect") {
          return {
            observation: {
              kind: "evidence",
              evidence: correct,
            } as MabojoluExternalObservation,
            reward: -0.1,
            success: false,
          };
        }
        return {
          observation: { kind: "evidence", evidence: correct } as MabojoluExternalObservation,
          reward: action === correct ? 1 : -1,
          success: action === correct,
          terminal: true,
        };
      },
    };
  }

  if (mode === 1) {
    return {
      id: `held-out-unsupported-${index}`,
      domain: "held-out-unsupported-evidence",
      maximumSteps: 2,
      initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
      availableActions: ["inspect", correct, wrong],
      transition({ action }: { action: string; step: number }) {
        if (action === "inspect") {
          return {
            observation: {
              kind: "evidence",
              evidence: `marker-${correct}`,
            } as MabojoluExternalObservation,
            reward: -0.1,
            success: false,
          };
        }
        return {
          observation: { kind: "evidence", evidence: "" } as MabojoluExternalObservation,
          reward: action === correct ? 1 : -1,
          success: action === correct,
          terminal: true,
        };
      },
    };
  }

  if (mode === 2) {
    return {
      id: `held-out-no-inspect-${index}`,
      domain: "held-out-latent-rule",
      maximumSteps: 2,
      initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
      availableActions: [correct, wrong],
      transition({ action }: { action: string; step: number }) {
        return {
          observation: { kind: "unknown" } as MabojoluExternalObservation,
          reward: action === correct ? 1 : -1,
          success: action === correct,
          terminal: true,
        };
      },
    };
  }

  return {
    id: `held-out-misleading-${index}`,
    domain: "held-out-misleading-evidence",
    maximumSteps: 2,
    initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
    availableActions: ["inspect", correct, wrong],
    transition({ action }: { action: string; step: number }) {
      if (action === "inspect") {
        return {
          observation: {
            kind: "evidence",
            evidence: wrong,
          } as MabojoluExternalObservation,
          reward: -0.1,
          success: false,
        };
      }
      return {
        observation: { kind: "evidence", evidence: wrong } as MabojoluExternalObservation,
        reward: action === correct ? 1 : -1,
        success: action === correct,
        terminal: true,
      };
    },
  };
}

describe("Phase 2 randomized held-out baseline battery", () => {
  it("establishes a deterministic 64-task frozen baseline without adapting cognition", () => {
    const tasks = Array.from({ length: 64 }, (_, index) =>
      heldOutTask(0x4d41424f, index),
    );
    const results = tasks.map((task) =>
      evaluateGeneralizationTask({
        task,
        agent: createMabojoluFrozenBaselineAgent(),
      }),
    );
    const summary = summarizeGeneralizationEvaluation(results);

    expect(summary.tasks).toBe(64);
    expect(summary.successes).toBe(16);
    expect(summary.abstentions).toBe(32);
    expect(summary.successRate).toBe(0.25);
    expect(summary.meanSteps).toBe(1.25);
    expect(summary.meanReward).toBeCloseTo(-0.075);

    const byDomain = new Map<string, typeof results>();
    for (const result of results) {
      const bucket = byDomain.get(result.domain) ?? [];
      bucket.push(result);
      byDomain.set(result.domain, bucket);
    }

    expect(
      byDomain.get("held-out-clean-evidence")?.every((result) => result.success),
    ).toBe(true);
    expect(
      byDomain
        .get("held-out-unsupported-evidence")
        ?.every((result) => result.abstained),
    ).toBe(true);
    expect(
      byDomain.get("held-out-latent-rule")?.every((result) => result.abstained),
    ).toBe(true);
    expect(
      byDomain
        .get("held-out-misleading-evidence")
        ?.every((result) => !result.success && !result.abstained),
    ).toBe(true);
  });

  it("reproduces the same held-out task sequence from the published seed", () => {
    const first = Array.from({ length: 64 }, (_, index) =>
      heldOutTask(0x4d41424f, index),
    ).map((task) => [task.id, task.domain, task.availableActions]);

    const second = Array.from({ length: 64 }, (_, index) =>
      heldOutTask(0x4d41424f, index),
    ).map((task) => [task.id, task.domain, task.availableActions]);

    expect(second).toEqual(first);
  });
});

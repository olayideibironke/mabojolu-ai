import type { GeneralizationTask } from "./generalization-harness";

/**
 * Phase 3 sealed synthetic environment. The agent receives only the public task.
 * Hidden target and transition logic remain inside the evaluator closure.
 * This is a reproducible blind interface, not an independently authored benchmark.
 */
export interface SealedTask<Observation> {
  publicTask: GeneralizationTask<string, Observation>;
  audit: { seed: number; index: number; target: string };
}

export interface ProbeObservation {
  kind: "start" | "probe-result" | "attempt-result";
  hint?: string;
  previousAction?: string;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const symbols = ["amber", "violet", "cobalt", "silver", "cedar", "quartz"] as const;

/** Returns a fresh environment for each evaluation; no target is passed to the agent. */
export function createSealedProbeTask(seed: number, index: number): SealedTask<ProbeObservation> {
  if (!Number.isInteger(seed) || !Number.isInteger(index) || index < 0) {
    throw new Error("Sealed task requires an integer seed and nonnegative index.");
  }
  const random = rng((seed ^ Math.imul(index + 1, 2654435761)) >>> 0);
  const target = symbols[Math.floor(random() * symbols.length)]!;
  const distractor = symbols.filter((symbol) => symbol !== target)[Math.floor(random() * (symbols.length - 1))]!;
  const actions = ["probe", ...symbols];
  let probed = false;
  return {
    audit: { seed, index, target },
    publicTask: {
      id: `sealed-probe-${seed}-${index}`,
      domain: "phase3-sealed-probe",
      maximumSteps: 3,
      initialObservation: { kind: "start" },
      availableActions: actions,
      transition({ action }) {
        if (action === "probe") {
          probed = true;
          return {
            observation: { kind: "probe-result", hint: target, previousAction: action },
            reward: -0.1,
            success: false,
          };
        }
        const success = action === target;
        return {
          observation: {
            kind: "attempt-result",
            previousAction: action,
            hint: probed ? distractor : undefined,
          },
          reward: success ? 1 : -1,
          success,
          terminal: true,
        };
      },
    },
  };
}

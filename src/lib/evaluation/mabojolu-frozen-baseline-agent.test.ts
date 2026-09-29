import { describe, expect, it } from "vitest";

import { evaluateGeneralizationTask } from "./generalization-harness";
import {
  createMabojoluFrozenBaselineAgent,
  type MabojoluExternalObservation,
} from "./mabojolu-frozen-baseline-agent";

function unseenTask(input: {
  id: string;
  correct: "amber" | "violet";
  evidence: string;
}) {
  let inspected = false;

  return {
    id: input.id,
    domain: "phase2-unseen-rule",
    maximumSteps: 2,
    initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
    availableActions: ["inspect", "amber", "violet"],
    transition({ action }: { action: string; step: number }) {
      if (action === "inspect") {
        inspected = true;
        return {
          observation: {
            kind: "evidence",
            evidence: input.evidence,
          } as MabojoluExternalObservation,
          reward: -0.1,
          success: false,
        };
      }

      return {
        observation: {
          kind: "evidence",
          evidence: inspected ? input.evidence : "",
        } as MabojoluExternalObservation,
        reward: action === input.correct ? 1 : -1,
        success: action === input.correct,
        terminal: true,
      };
    },
  };
}

describe("Phase 2 frozen Mabojolu baseline", () => {
  it("solves a novel symbolic rule when external evidence maps cleanly to an available action", () => {
    const result = evaluateGeneralizationTask({
      task: unseenTask({
        id: "novel-clean",
        correct: "violet",
        evidence: "violet",
      }),
      agent: createMabojoluFrozenBaselineAgent(),
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual(["inspect", "violet"]);
    expect(result.totalReward).toBeCloseTo(0.9);
  });

  it("abstains instead of inventing an action when evidence is outside its action vocabulary", () => {
    const result = evaluateGeneralizationTask({
      task: unseenTask({
        id: "novel-unsupported",
        correct: "amber",
        evidence: "triangle",
      }),
      agent: createMabojoluFrozenBaselineAgent(),
    });

    expect(result.success).toBe(false);
    expect(result.abstained).toBe(true);
    expect(result.actions).toEqual(["inspect"]);
  });

  it("exposes a baseline limitation when the unfamiliar environment offers no explicit information action", () => {
    const result = evaluateGeneralizationTask({
      task: {
        id: "latent-rule-no-inspect",
        domain: "phase2-latent-rule",
        maximumSteps: 2,
        initialObservation: { kind: "unknown" } as MabojoluExternalObservation,
        availableActions: ["amber", "violet"],
        transition: ({ action }: { action: string; step: number }) => ({
          observation: { kind: "unknown" } as MabojoluExternalObservation,
          reward: action === "amber" ? 1 : -1,
          success: action === "amber",
          terminal: true,
        }),
      },
      agent: createMabojoluFrozenBaselineAgent(),
    });

    expect(result.success).toBe(false);
    expect(result.abstained).toBe(true);
    expect(result.stepsUsed).toBe(0);
  });
});

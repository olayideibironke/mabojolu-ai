import { describe, expect, it } from "vitest";
import { evaluateGeneralizationTask } from "./generalization-harness";
import { createSealedProbeTask, type ProbeObservation } from "./sealed-probe-task";

describe("Phase 3 sealed target benchmark contract", () => {
  it("reproduces targets from seeds while withholding them from public initial observations", () => {
    const first = createSealedProbeTask(0x4d41424f, 7);
    const second = createSealedProbeTask(0x4d41424f, 7);
    expect(first.audit.target).toBe(second.audit.target);
    expect(first.publicTask.initialObservation).toEqual({ kind: "start" });
    expect(first.publicTask.availableActions).not.toContain(first.audit.target + "-answer");
  });

  it("allows probe-based evidence use without passing the audit target to the agent", () => {
    const sealed = createSealedProbeTask(0x4d41424f, 12);
    const agent = {
      reset() {},
      act({ observation }: { observation: ProbeObservation }) {
        return observation.kind === "start" ? "probe" : observation.hint;
      },
    };
    const result = evaluateGeneralizationTask({ task: sealed.publicTask, agent });
    expect(result.success).toBe(true);
    expect(result.stepsUsed).toBe(2);
    expect(result.totalReward).toBeCloseTo(0.9);
  });

  it("scores an uninformed incorrect guess as failure without disclosing target", () => {
    const sealed = createSealedProbeTask(0x4d41424f, 9);
    const wrong = sealed.publicTask.availableActions.find(
      (action) => action !== "probe" && action !== sealed.audit.target,
    )!;
    const result = evaluateGeneralizationTask({
      task: sealed.publicTask,
      agent: { reset() {}, act() { return wrong; } },
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe("environment-terminal");
  });
});

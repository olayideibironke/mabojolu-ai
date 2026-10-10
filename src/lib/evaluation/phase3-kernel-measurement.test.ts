import { describe, expect, it } from "vitest";
import { evaluatePhase3KernelComparison } from "./phase3-kernel-comparison";

describe("Phase 3B 128-task reproducible measurement", () => {
  it("prints the measured frozen-kernel and reference-agent results", () => {
    const report = evaluatePhase3KernelComparison(0x4d41424f, 128);
    expect(report.taskCount).toBe(128);
    expect(report.kernel.tasks).toBe(128);
    expect(report.baselines).toHaveLength(3);
    expect(report.baselines.every((item) => item.summary.tasks === 128)).toBe(true);
    expect(report.kernel.successes + report.kernel.abstentions).toBeLessThanOrEqual(128);
    const decisionCount = Object.values(report.kernelDecisions).reduce((sum, count) => sum + count, 0);
    expect(decisionCount).toBeGreaterThanOrEqual(128);
    console.log("PHASE_3B_128_TASK_MEASUREMENT=" + JSON.stringify(report, null, 2));
  });
});

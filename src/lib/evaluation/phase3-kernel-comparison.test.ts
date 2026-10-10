import { describe, expect, it } from "vitest";
import { evaluatePhase3KernelComparison } from "./phase3-kernel-comparison";

describe("Phase 3B frozen-kernel comparison", () => {
  it("scores the actual kernel on the same sealed tasks as all three reference agents", () => {
    const report = evaluatePhase3KernelComparison(0x4d41424f, 32);
    expect(report.kernel.tasks).toBe(32);
    expect(report.baselines).toHaveLength(3);
    expect(report.baselines.every((baseline) => baseline.summary.tasks === 32)).toBe(true);
    expect(report.baselines.find((baseline) => baseline.baseline === "probe-then-act")?.summary.successes).toBe(32);
    expect(report.kernel.successes).toBeGreaterThanOrEqual(0);
    expect(report.kernel.successes).toBeLessThanOrEqual(32);
    expect(report.kernel.abstentions).toBeGreaterThanOrEqual(0);
    expect(Object.values(report.kernelDecisions).reduce((sum, count) => sum + count, 0)).toBeGreaterThanOrEqual(32);
  });

  it("is reproducible with the same seed and task count", () => {
    expect(evaluatePhase3KernelComparison(0x4d41424f, 8)).toEqual(
      evaluatePhase3KernelComparison(0x4d41424f, 8),
    );
  });

  it("rejects invalid sample sizes", () => {
    expect(() => evaluatePhase3KernelComparison(1, 0)).toThrow();
  });
});

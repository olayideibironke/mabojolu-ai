import { describe, expect, it } from "vitest";
import { evaluateSealedBaselines } from "./sealed-probe-baselines";

describe("Phase 3 sealed-probe baseline comparison", () => {
  it("evaluates 128 reproducible tasks for each of three baseline policies", () => {
    const first = evaluateSealedBaselines(0x4d41424f, 128);
    const repeated = evaluateSealedBaselines(0x4d41424f, 128);
    expect(repeated).toEqual(first);
    expect(first.map((entry) => entry.baseline)).toEqual(["first-guess", "probe-then-act", "abstain"]);
    expect(first.every((entry) => entry.summary.tasks === 128)).toBe(true);
  });

  it("shows probe evidence is sufficient in this intentionally simple environment", () => {
    const [guess, probe, abstain] = evaluateSealedBaselines(0x4d41424f, 128);
    expect(guess.summary.successes).toBeGreaterThan(0);
    expect(guess.summary.successes).toBeLessThan(128);
    expect(probe.summary.successes).toBe(128);
    expect(probe.summary.meanSteps).toBe(2);
    expect(probe.summary.meanReward).toBeCloseTo(0.9);
    expect(abstain.summary.abstentions).toBe(128);
    expect(abstain.summary.successes).toBe(0);
  });

  it("rejects invalid benchmark sizes", () => {
    expect(() => evaluateSealedBaselines(1, 0)).toThrow();
    expect(() => evaluateSealedBaselines(1, 10001)).toThrow();
  });
});

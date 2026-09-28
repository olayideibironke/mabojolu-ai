import { describe, expect, it } from "vitest";

import type { Observation } from "./types";
import {
  induceTaskStructure,
  transitionFromObservation,
  type EnvironmentTransition,
} from "./open-ended-task-induction";

function observedTransition(
  id: string,
  actionKind: string,
  outcomeKind: string,
  before: Record<string, string | number | boolean>,
  after: Record<string, string | number | boolean>,
): Observation {
  const metadata: NonNullable<Observation["metadata"]> = {
    actionKind,
    outcomeKind,
  };
  for (const [key, value] of Object.entries(before)) metadata[`before:${key}`] = value;
  for (const [key, value] of Object.entries(after)) metadata[`after:${key}`] = value;
  return {
    id,
    source: "environment",
    content: `Observed ${actionKind} transition.`,
    observedAt: "2026-09-28T15:10:00.000Z",
    metadata,
  };
}

describe("open-ended task induction", () => {
  it("converts raw observations into explicit transition evidence", () => {
    const transition = transitionFromObservation(
      observedTransition(
        "obs-1",
        "toggle",
        "door-opened",
        { switch: "off", door: "closed" },
        { switch: "on", door: "open" },
      ),
    );

    expect(transition.before).toEqual({ switch: "off", door: "closed" });
    expect(transition.after).toEqual({ switch: "on", door: "open" });
    expect(transition.evidenceIds).toEqual(["obs-1"]);
  });

  it("induces repeatable action-state rules and relevant features", () => {
    const transitions = [
      transitionFromObservation(observedTransition(
        "obs-1", "toggle", "door-opened",
        { switch: "off", door: "closed", color: "red" },
        { switch: "on", door: "open", color: "red" },
      )),
      transitionFromObservation(observedTransition(
        "obs-2", "toggle", "door-opened",
        { switch: "off", door: "closed", color: "blue" },
        { switch: "on", door: "open", color: "blue" },
      )),
      transitionFromObservation(observedTransition(
        "obs-3", "inspect", "measurement",
        { switch: "on", door: "open", color: "green" },
        { switch: "on", door: "open", color: "green" },
      )),
    ];

    const model = induceTaskStructure({ transitions });

    expect(model.relevantFeatures).toEqual(["door", "switch"]);
    expect(model.transitionRules).toHaveLength(2);
    expect(model.transitionRules.map((rule) => rule.feature)).toEqual([
      "door",
      "switch",
    ]);
    expect(model.transitionRules.every((rule) => rule.supportCount === 2)).toBe(true);
    expect(model.transitionRules.every((rule) => rule.confidence === 1)).toBe(true);
    expect(model.unresolvedActions).toEqual(["inspect"]);
  });

  it("does not infer a rule from a one-off coincidence", () => {
    const transitions: EnvironmentTransition[] = [
      {
        id: "t1",
        before: { signal: "low" },
        actionKind: "probe",
        after: { signal: "high" },
        outcomeKind: "change",
        evidenceIds: ["obs-1"],
      },
      {
        id: "t2",
        before: { signal: "low" },
        actionKind: "probe",
        after: { signal: "low" },
        outcomeKind: "no-change",
        evidenceIds: ["obs-2"],
      },
    ];

    const model = induceTaskStructure({ transitions });
    expect(model.transitionRules).toEqual([]);
    expect(model.relevantFeatures).toEqual([]);
    expect(model.unresolvedActions).toEqual(["probe"]);
  });

  it("rejects reused evidence masquerading as independent transitions", () => {
    expect(() =>
      induceTaskStructure({
        transitions: [
          {
            id: "t1",
            before: { x: 0 },
            actionKind: "move",
            after: { x: 1 },
            outcomeKind: "moved",
            evidenceIds: ["obs-1"],
          },
          {
            id: "t2",
            before: { x: 0 },
            actionKind: "move",
            after: { x: 1 },
            outcomeKind: "moved",
            evidenceIds: ["obs-1"],
          },
        ],
      }),
    ).toThrow(/independent transition evidence/);
  });

  it("fails closed when raw observations omit transition structure", () => {
    const observation: Observation = {
      id: "obs-weak",
      source: "environment",
      content: "Something happened.",
      observedAt: "2026-09-28T15:10:00.000Z",
      metadata: { actionKind: "move", outcomeKind: "moved" },
    };

    expect(() => transitionFromObservation(observation)).toThrow(
      /before and after state/,
    );
  });
});

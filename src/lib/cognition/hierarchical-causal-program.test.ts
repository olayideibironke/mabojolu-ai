import {
  describe,
  expect,
  it,
} from "vitest";

import {
  planLongHorizonDualControl,
  predictHierarchicalProgramEffect,
  selectValidatedHierarchicalProgram,
  summarizePolicyPathForMechanism,
  synthesizeHierarchicalCausalPrograms,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

import type {
  ProbabilisticCausalMechanism,
  WorldModelAction,
  WorldModelExperiment,
} from "./probabilistic-causal-world-model";

const INCUMBENT:
  HierarchicalCausalProgram = {
  id:
    "base-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments:
    [],

  observationStdDev:
    0.05,

  depth:
    1,

  complexity:
    0,
};

const FRAGMENTS:
  readonly ValidatedCausalFragment[] = [
    {
      id:
        "xy-fragment",

      terms: [
        {
          id:
            "interaction(x,y)",

          kind:
            "interaction",

          variables: [
            "x",
            "y",
          ],

          coefficient:
            0.4,
        },
      ],

      validationMeanSquaredError:
        0,

      sourceEvidenceCount:
        4,
    },
    {
      id:
        "yz-fragment",

      terms: [
        {
          id:
            "interaction(y,z)",

          kind:
            "interaction",

          variables: [
            "y",
            "z",
          ],

          coefficient:
            0.3,
        },
      ],

      validationMeanSquaredError:
        0,

      sourceEvidenceCount:
        4,
    },
    {
      id:
        "unvalidated-nuisance",

      terms: [
        {
          id:
            "latent-bias",

          kind:
            "latent-bias",

          variables:
            [],

          coefficient:
            0.2,
        },
      ],

      validationMeanSquaredError:
        0.2,

      sourceEvidenceCount:
        2,
    },
  ];

function observation(
  id:
    string,

  x:
    number,

  y:
    number,

  z:
    number,

  measuredEffect:
    number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
        x,
        y,
        z,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },

    measuredEffect,
  };
}

const DISCOVERY:
  readonly StructuralMechanismObservation[] = [
    observation(
      "discover-xy",
      1,
      1,
      0,
      0.6,
    ),
    observation(
      "discover-yz",
      0,
      1,
      1,
      0.5,
    ),
    observation(
      "discover-all",
      1,
      1,
      1,
      1,
    ),
  ];

const PROTECTED:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-x",
      1,
      0,
      0,
      0.1,
    ),
    observation(
      "protected-y",
      0,
      1,
      0,
      0.1,
    ),
    observation(
      "protected-z",
      0,
      0,
      1,
      0.1,
    ),
    observation(
      "protected-half",
      0.5,
      0.5,
      0.5,
      0.325,
    ),
    observation(
      "protected-all",
      1,
      1,
      1,
      1,
    ),
  ];

describe(
  "hierarchical causal program synthesis",
  () => {
    it(
      "composes separately validated fragments into one deeper causal program",
      () => {
        const program:
          HierarchicalCausalProgram = {
          ...INCUMBENT,

          id:
            "composed",

          fragments: [
            FRAGMENTS[
              0
            ]!,
            FRAGMENTS[
              1
            ]!,
          ],

          depth:
            3,

          complexity:
            2,
        };

        expect(
          predictHierarchicalProgramEffect(
            program,
            {
              x:
                1,
              y:
                1,
              z:
                1,
            },
          ),
        ).toBeCloseTo(
          1,
        );

        expect(
          predictHierarchicalProgramEffect(
            program,
            {
              x:
                0.5,
              y:
                0.5,
              z:
                0.5,
            },
          ),
        ).toBeCloseTo(
          0.325,
        );
      },
    );

    it(
      "selects the two-fragment combination because either validated fragment alone leaves residual error",
      () => {
        const candidates =
          synthesizeHierarchicalCausalPrograms(
            INCUMBENT,
            FRAGMENTS,
            DISCOVERY,
          );

        expect(
          candidates[
            0
          ]!
            .program
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "yz-fragment",
        ]);

        expect(
          candidates[
            0
          ]!
            .discoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );

        expect(
          candidates[
            0
          ]!
            .program
            .depth,
        ).toBe(
          3,
        );
      },
    );

    it(
      "excludes fragments that failed their own source validation",
      () => {
        const candidates =
          synthesizeHierarchicalCausalPrograms(
            INCUMBENT,
            FRAGMENTS,
            DISCOVERY,
          );

        expect(
          candidates.some(
            (candidate) =>
              candidate
                .program
                .fragments
                .some(
                  (fragment) =>
                    fragment.id ===
                    "unvalidated-nuisance",
                ),
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "promotes the composed program only after it wins on protected interventions",
      () => {
        const candidates =
          synthesizeHierarchicalCausalPrograms(
            INCUMBENT,
            FRAGMENTS,
            DISCOVERY,
          );

        const decision =
          selectValidatedHierarchicalProgram(
            INCUMBENT,
            candidates,
            PROTECTED,
          );

        expect(
          decision,
        ).toMatchObject({
          promoted:
            true,

          previousChampionId:
            "base-program",

          protectedMeanSquaredError:
            0,

          reason:
            "validated-hierarchical-program",
        });

        expect(
          decision
            .champion
            .fragments
            .map(
              (fragment) =>
                fragment.id,
            ),
        ).toEqual([
          "xy-fragment",
          "yz-fragment",
        ]);

        expect(
          decision
            .improvement,
        ).toBeGreaterThan(
          0.1,
        );
      },
    );
  },
);

const MECHANISMS:
  readonly ProbabilisticCausalMechanism[] = [
    {
      id:
        "slow",

      effects: {
        x:
          0.05,
        w:
          0.05,
        y:
          0.4,
        v:
          0.4,
        z:
          0.2,
      },

      observationStdDev:
        0.05,
    },
    {
      id:
        "fast",

      effects: {
        x:
          0.4,
        w:
          0.4,
        y:
          0.05,
        v:
          0.05,
        z:
          0.8,
      },

      observationStdDev:
        0.05,
    },
  ];

const EXPERIMENTS:
  readonly WorldModelExperiment[] = [
    {
      id:
        "probe-z",

      interventions: {
        z:
          1,
      },

      risk:
        0.1,

      cost:
        0.03,

      reversible:
        true,
    },
    {
      id:
        "unsafe-probe",

      interventions: {
        z:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

const ACTIONS:
  readonly WorldModelAction[] = [
    {
      id:
        "fast-a",

      interventions: {
        x:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "fast-b",

      interventions: {
        w:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "slow-a",

      interventions: {
        y:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "slow-b",

      interventions: {
        v:
          1,
      },

      risk:
        0.1,

      cost:
        0.05,

      reversible:
        true,
    },
    {
      id:
        "unsafe-action",

      interventions: {
        x:
          1,
        y:
          1,
      },

      risk:
        0.9,

      cost:
        0,

      reversible:
        false,
    },
  ];

const PRIOR =
  new Map([
    [
      "slow",
      0.5,
    ],
    [
      "fast",
      0.5,
    ],
  ]);

describe(
  "long-horizon dual control",
  () => {
    it(
      "chooses a causal probe first and then different two-action programs for different mechanism branches",
      () => {
        const plan =
          planLongHorizonDualControl(
            MECHANISMS,
            PRIOR,
            0.1,
            0.85,
            EXPERIMENTS,
            ACTIONS,
            {
              horizon:
                3,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "plan",

          expectedGoalSuccessProbability:
            1,

          maximumRisk:
            0.1,

          reason:
            "safe-long-horizon-policy",
        });

        expect(
          plan.expectedCost,
        ).toBeCloseTo(
          0.13,
        );

        expect(
          plan.root,
        ).toMatchObject({
          kind:
            "experiment",

          selectedId:
            "probe-z",
        });

        expect(
          summarizePolicyPathForMechanism(
            plan.root!,
            "slow",
          ),
        ).toEqual([
          "probe-z",
          "slow-a",
          "slow-b",
          "stop",
        ]);

        expect(
          summarizePolicyPathForMechanism(
            plan.root!,
            "fast",
          ),
        ).toEqual([
          "probe-z",
          "fast-a",
          "fast-b",
          "stop",
        ]);
      },
    );

    it(
      "cannot reach the goal within the same horizon when information gathering is removed",
      () => {
        const actionOnly =
          planLongHorizonDualControl(
            MECHANISMS,
            PRIOR,
            0.1,
            0.85,
            [],
            ACTIONS,
            {
              horizon:
                3,
            },
          );

        expect(
          actionOnly.decision,
        ).toBe(
          "plan",
        );

        expect(
          actionOnly
            .expectedGoalSuccessProbability,
        ).toBe(
          0,
        );

        expect(
          actionOnly
            .expectedUtility,
        ).toBeLessThan(
          0.5,
        );
      },
    );

    it(
      "never uses unsafe zero-cost experiments or actions in the selected policy",
      () => {
        const plan =
          planLongHorizonDualControl(
            MECHANISMS,
            PRIOR,
            0.1,
            0.85,
            EXPERIMENTS,
            ACTIONS,
            {
              horizon:
                3,
            },
          );

        const slowPath =
          summarizePolicyPathForMechanism(
            plan.root!,
            "slow",
          );

        const fastPath =
          summarizePolicyPathForMechanism(
            plan.root!,
            "fast",
          );

        expect(
          [
            ...slowPath,
            ...fastPath,
          ],
        ).not.toContain(
          "unsafe-probe",
        );

        expect(
          [
            ...slowPath,
            ...fastPath,
          ],
        ).not.toContain(
          "unsafe-action",
        );

        expect(
          plan.maximumRisk,
        ).toBeLessThanOrEqual(
          0.3,
        );
      },
    );
  },
);

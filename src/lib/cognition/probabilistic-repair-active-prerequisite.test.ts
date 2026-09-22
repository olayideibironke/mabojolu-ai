import {
  describe,
  expect,
  it,
} from "vitest";

import {
  JointRepairPrerequisitePosterior,
  generatePrerequisiteHypotheses,
  type JointDiscoveryExperiment,
} from "./probabilistic-repair-active-prerequisite";

import {
  synthesizeStructuralRepairCandidates,
  type ActionPrerequisiteObservation,
} from "./structural-repair-prerequisite-planning";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  FragmentReliabilitySummary,
} from "./self-revising-hierarchical-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

const BAD_LINEAR_FRAGMENT:
  ValidatedCausalFragment = {
  id:
    "bad-linear-y",

  terms: [
    {
      id:
        "linear(y)",

      kind:
        "linear",

      variables: [
        "y",
      ],

      coefficient:
        0.6,
    },
  ],

  validationMeanSquaredError:
    0,

  sourceEvidenceCount:
    4,
};

const FLAWED_PROGRAM:
  HierarchicalCausalProgram = {
  id:
    "wrong-topology-program",

  baseEffects: {
    x:
      0.1,
    y:
      0.1,
    z:
      0.1,
  },

  fragments: [
    BAD_LINEAR_FRAGMENT,
  ],

  observationStdDev:
    0.05,

  depth:
    2,

  complexity:
    1,
};

const QUARANTINED:
  FragmentReliabilitySummary = {
  fragments: [
    {
      fragmentId:
        "bad-linear-y",

      episodes:
        3,

      supportEpisodes:
        0,

      blameEpisodes:
        3,

      neutralEpisodes:
        0,

      posteriorReliability:
        0.2,

      quarantined:
        true,
    },
  ],

  quarantinedFragmentIds: [
    "bad-linear-y",
  ],
};

function repairObservation(
  id:
    string,

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
        x:
          0,
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

const REPAIR_EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    repairObservation(
      "repair-joint-full",
      1,
      1,
      0.7,
    ),
    repairObservation(
      "repair-y-only",
      1,
      0,
      0.1,
    ),
    repairObservation(
      "repair-half-y-full-z",
      0.5,
      1,
      0.4,
    ),
    repairObservation(
      "repair-half-joint",
      0.5,
      0.5,
      0.225,
    ),
  ];

const PREREQUISITE_EVIDENCE:
  readonly ActionPrerequisiteObservation[] = [
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.1,
      },

      observedEffects: {
        progress:
          0.02,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.2,
      },

      observedEffects: {
        progress:
          0.03,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.5,
      },

      observedEffects: {
        progress:
          0.35,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.6,
      },

      observedEffects: {
        progress:
          0.4,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.8,
      },

      observedEffects: {
        progress:
          0.8,
      },
    },
    {
      actionId:
        "finish",

      beforeState: {
        readiness:
          0.9,
      },

      observedEffects: {
        progress:
          0.82,
      },
    },
  ];

function buildCandidates() {
  const all =
    synthesizeStructuralRepairCandidates(
      FLAWED_PROGRAM,
      QUARANTINED,
      REPAIR_EVIDENCE,
      [
        "y",
        "z",
      ],
    );

  const interaction =
    all.find(
      (candidate) =>
        candidate.fragment.id ===
        "bad-linear-y+structure:interaction(y,z)",
    );

  const linear =
    all.find(
      (candidate) =>
        candidate.fragment.id ===
        "bad-linear-y+structure:linear(y)",
    );

  if (
    !interaction ||
    !linear
  ) {
    throw new Error(
      "Expected repair candidates are missing.",
    );
  }

  return {
    interaction,
    linear,
  };
}

function buildPrerequisites() {
  const hypotheses =
    generatePrerequisiteHypotheses(
      PREREQUISITE_EVIDENCE,
      "finish",
      "progress",
      [
        "readiness",
      ],
      {
        maximumHypotheses:
          3,
      },
    );

  if (
    hypotheses.length !==
      3
  ) {
    throw new Error(
      "Expected three prerequisite hypotheses.",
    );
  }

  return hypotheses;
}

const PREREQUISITE_PROBE:
  JointDiscoveryExperiment = {
  id:
    "probe-readiness-0.6",

  kind:
    "prerequisite",

  actionId:
    "finish",

  targetDimension:
    "progress",

  beforeState: {
    readiness:
      0.6,
  },

  risk:
    0.1,

  cost:
    0.04,

  reversible:
    true,

  observationStdDev:
    0.02,
};

const REPAIR_PROBE:
  JointDiscoveryExperiment = {
  id:
    "probe-repair-y-only",

  kind:
    "repair",

  interventions: {
    x:
      0,
    y:
      1,
    z:
      0,
  },

  risk:
    0.1,

  cost:
    0.03,

  reversible:
    true,

  observationStdDev:
    0.02,
};

const UNSAFE_PROBE:
  JointDiscoveryExperiment = {
  id:
    "unsafe-perfect-probe",

  kind:
    "repair",

  interventions: {
    x:
      0,
    y:
      1,
    z:
      0,
  },

  risk:
    0.9,

  cost:
    0,

  reversible:
    false,

  observationStdDev:
    0.01,
};

describe(
  "probabilistic prerequisite hypothesis generation",
  () => {
    it(
      "keeps multiple plausible prerequisite thresholds instead of collapsing immediately to one",
      () => {
        const hypotheses =
          buildPrerequisites();

        expect(
          hypotheses.map(
            (hypothesis) =>
              hypothesis.threshold,
          ),
        ).toEqual([
          0.7,
          0.55,
          0.35,
        ]);

        expect(
          hypotheses.every(
            (hypothesis) =>
              hypothesis.effectGap >
              0.15,
          ),
        ).toBe(
          true,
        );
      },
    );
  },
);

describe(
  "joint repair and prerequisite posterior",
  () => {
    it(
      "starts with uncertainty over the full repair-by-prerequisite Cartesian hypothesis set",
      () => {
        const repairs =
          buildCandidates();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            [
              repairs.interaction,
              repairs.linear,
            ],
            buildPrerequisites(),
          );

        const belief =
          posterior.getBelief();

        expect(
          Object.keys(
            belief.jointProbabilities,
          ),
        ).toHaveLength(
          6,
        );

        expect(
          belief.confidence,
        ).toBeCloseTo(
          1 /
            6,
        );

        expect(
          belief.normalizedEntropy,
        ).toBeCloseTo(
          1,
        );

        expect(
          belief.sufficientlyCertain,
        ).toBe(
          false,
        );
      },
    );

    it(
      "chooses a safe informative prerequisite experiment and excludes an unsafe zero-cost probe",
      () => {
        const repairs =
          buildCandidates();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            [
              repairs.interaction,
              repairs.linear,
            ],
            buildPrerequisites(),
          );

        const choice =
          posterior.chooseExperiment([
            PREREQUISITE_PROBE,
            UNSAFE_PROBE,
          ]);

        expect(
          choice,
        ).toMatchObject({
          decision:
            "experiment",

          experiment: {
            id:
              "probe-readiness-0.6",

            kind:
              "prerequisite",
          },

          reason:
            "safe-informative-joint-experiment",
        });

        expect(
          choice
            .expectedInformationGain,
        ).toBeGreaterThan(
          0.5,
        );
      },
    );

    it(
      "concentrates prerequisite probability while leaving repair uncertainty unresolved after a prerequisite-only probe",
      () => {
        const repairs =
          buildCandidates();

        const prerequisites =
          buildPrerequisites();

        const truthPrerequisite =
          prerequisites.find(
            (hypothesis) =>
              Math.abs(
                hypothesis.threshold -
                  0.7,
              ) <
              1e-9,
          )!;

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            [
              repairs.interaction,
              repairs.linear,
            ],
            prerequisites,
          );

        const observation =
          posterior.simulateObservation(
            repairs.interaction
              .fragment
              .id,
            truthPrerequisite.id,
            PREREQUISITE_PROBE,
          );

        posterior.recordObservation(
          PREREQUISITE_PROBE,
          observation,
        );

        const belief =
          posterior.getBelief();

        expect(
          belief
            .prerequisiteProbabilities[
              truthPrerequisite.id
            ],
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          belief
            .repairProbabilities[
              repairs.interaction
                .fragment
                .id
            ],
        ).toBeCloseTo(
          0.5,
        );

        expect(
          belief.sufficientlyCertain,
        ).toBe(
          false,
        );
      },
    );

    it(
      "resolves the joint hypothesis after independent prerequisite and structural probes",
      () => {
        const repairs =
          buildCandidates();

        const prerequisites =
          buildPrerequisites();

        const truthPrerequisite =
          prerequisites.find(
            (hypothesis) =>
              Math.abs(
                hypothesis.threshold -
                  0.7,
              ) <
              1e-9,
          )!;

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            [
              repairs.interaction,
              repairs.linear,
            ],
            prerequisites,
          );

        posterior.recordObservation(
          PREREQUISITE_PROBE,
          posterior.simulateObservation(
            repairs.interaction
              .fragment
              .id,
            truthPrerequisite.id,
            PREREQUISITE_PROBE,
          ),
        );

        const repairChoice =
          posterior.chooseExperiment([
            REPAIR_PROBE,
            UNSAFE_PROBE,
          ]);

        expect(
          repairChoice,
        ).toMatchObject({
          decision:
            "experiment",

          experiment: {
            id:
              "probe-repair-y-only",

            kind:
              "repair",
          },
        });

        posterior.recordObservation(
          REPAIR_PROBE,
          posterior.simulateObservation(
            repairs.interaction
              .fragment
              .id,
            truthPrerequisite.id,
            REPAIR_PROBE,
          ),
        );

        const belief =
          posterior.getBelief();

        expect(
          belief.topRepairCandidateId,
        ).toBe(
          repairs.interaction
            .fragment
            .id,
        );

        expect(
          belief.topPrerequisiteHypothesisId,
        ).toBe(
          truthPrerequisite.id,
        );

        expect(
          belief.confidence,
        ).toBeGreaterThan(
          0.999,
        );

        expect(
          belief.sufficientlyCertain,
        ).toBe(
          true,
        );
      },
    );

    it(
      "abstains when every remaining experiment is unsafe or uninformative",
      () => {
        const repairs =
          buildCandidates();

        const posterior =
          new JointRepairPrerequisitePosterior(
            FLAWED_PROGRAM,
            [
              repairs.interaction,
              repairs.linear,
            ],
            buildPrerequisites(),
          );

        const choice =
          posterior.chooseExperiment([
            UNSAFE_PROBE,
          ]);

        expect(
          choice,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-informative-joint-experiment",
        });
      },
    );
  },
);

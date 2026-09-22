import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ProbabilisticCompositionBelief,
  inferRegionalRevisionSupport,
  installCompositeRevision,
  planCompositionValidation,
  proposeRevisionComposition,
  validateRevisionComposition,
  type CompositionExplanation,
} from "./probabilistic-revision-composition-validation";

import {
  appendInstalledRevision,
  createRevisionLineage,
} from "./adaptive-evidence-governance-lineage";

import {
  synthesizeProtectedValidationProbes,
} from "./active-protected-evidence-probabilistic-lineage";

import type {
  LearnedActionPrerequisite,
} from "./structural-repair-prerequisite-planning";

import type {
  RecedingVectorHypothesis,
} from "./receding-horizon-multidimensional-dual-control";

import type {
  HierarchicalCausalProgram,
  ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  StructuralMechanismObservation,
} from "./mechanism-structure-synthesis";

function linearFragment(
  id: string,
  variable: string,
  coefficient: number,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        id:
          `linear(${variable})`,

        kind:
          "linear",

        variables: [
          variable,
        ],

        coefficient,
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

function program(
  id: string,
  variable: string,
  coefficient: number,
): HierarchicalCausalProgram {
  return {
    id,

    baseEffects: {
      y:
        0,
      z:
        0,
    },

    fragments: [
      linearFragment(
        `${id}-fragment`,
        variable,
        coefficient,
      ),
    ],

    observationStdDev:
      0.05,

    depth:
      2,

    complexity:
      1,
  };
}

const PROGRAM_Z =
  program(
    "program-z",
    "z",
    0.5,
  );

const PROGRAM_Y =
  program(
    "program-y",
    "y",
    0.6,
  );

const PREREQUISITE_Z:
  LearnedActionPrerequisite = {
  actionId:
    "finish",

  targetDimension:
    "progress",

  stateDimension:
    "readiness",

  threshold:
    0.7,

  inactiveMeanEffect:
    0.02,

  activeMeanEffect:
    0.5,

  effectGap:
    0.48,

  evidenceCount:
    4,
};

const PREREQUISITE_Y:
  LearnedActionPrerequisite = {
  ...PREREQUISITE_Z,

  threshold:
    0.35,

  activeMeanEffect:
    0.6,

  effectGap:
    0.58,
};

function hypothesis(
  id: string,
  repairCandidateId: string,
  prerequisite:
    LearnedActionPrerequisite,
  finishEffect: number,
): RecedingVectorHypothesis {
  return {
    id,

    repairCandidateId,

    prerequisiteHypothesisId:
      `finish:readiness>=${prerequisite.threshold.toFixed(
        3,
      )}`,

    dimensionEffects: {
      readiness: {
        "prep-light":
          0.5,
        "prep-strong":
          0.8,
      },

      progress: {
        finish:
          finishEffect,
      },

      exposure: {
        "prep-light":
          0.05,
        "prep-strong":
          0.1,
        finish:
          0.1,
      },
    },

    observationStdDev:
      0.05,

    actionPrerequisites: {
      finish: {
        readiness:
          prerequisite.threshold,
      },
    },
  };
}

const HYPOTHESIS_Z =
  hypothesis(
    "hypothesis-z",
    "revision-z",
    PREREQUISITE_Z,
    0.5,
  );

const HYPOTHESIS_Y =
  hypothesis(
    "hypothesis-y",
    "revision-y",
    PREREQUISITE_Y,
    0.6,
  );

function lineage() {
  let result =
    createRevisionLineage(
      "rev-z",
      PROGRAM_Z,
      HYPOTHESIS_Z,
      PREREQUISITE_Z,
      [
        "install-z-1",
        "install-z-2",
      ],
      0,
      4,
    );

  return appendInstalledRevision(
    result,
    "rev-y",
    PROGRAM_Y,
    HYPOTHESIS_Y,
    PREREQUISITE_Y,
    [
      "install-y-1",
      "install-y-2",
    ],
    0.1,
  );
}

function observation(
  id: string,
  y: number,
  z: number,
  measuredEffect: number,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions: {
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

const COMPOSITION_FIT:
  readonly StructuralMechanismObservation[] = [
    observation(
      "fit-y-1",
      1,
      0,
      0.6,
    ),
    observation(
      "fit-y-half",
      0.5,
      0,
      0.3,
    ),
    observation(
      "fit-z-1",
      0,
      1,
      0.5,
    ),
    observation(
      "fit-z-half",
      0,
      0.5,
      0.25,
    ),
    observation(
      "fit-joint",
      1,
      1,
      1.1,
    ),
  ];

const PROTECTED_COMPOSITE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "protected-y-1",
      1,
      0,
      0.6,
    ),
    observation(
      "protected-y-half",
      0.5,
      0,
      0.3,
    ),
    observation(
      "protected-z-1",
      0,
      1,
      0.5,
    ),
    observation(
      "protected-z-half",
      0,
      0.5,
      0.25,
    ),
  ];

describe(
  "probabilistic revision composition",
  () => {
    it(
      "detects different historical revisions as best in different causal regions",
      () => {
        const support =
          inferRegionalRevisionSupport(
            lineage(),
            COMPOSITION_FIT,
          );

        const yRegion =
          support.find(
            (region) =>
              region
                .regionSignature ===
              "y=1.000000",
          );

        const zRegion =
          support.find(
            (region) =>
              region
                .regionSignature ===
              "z=1.000000",
          );

        expect(
          yRegion,
        ).toMatchObject({
          selectedRevisionId:
            "rev-y",

          selectedMeanSquaredError:
            0,
        });

        expect(
          zRegion,
        ).toMatchObject({
          selectedRevisionId:
            "rev-z",

          selectedMeanSquaredError:
            0,
        });
      },
    );

    it(
      "synthesizes a bounded two-fragment composition when no single ancestor explains the fitting evidence",
      () => {
        const proposal =
          proposeRevisionComposition(
            lineage(),
            COMPOSITION_FIT,
          );

        expect(
          proposal,
        ).toMatchObject({
          decision:
            "compose",

          sourceRevisionIds: [
            "rev-y",
            "rev-z",
          ],

          reason:
            "multiple-regions-require-composition",
        });

        expect(
          proposal
            .bestSingleMeanSquaredError,
        ).toBeGreaterThan(
          0.05,
        );

        expect(
          proposal
            .candidate
            ?.fragments,
        ).toHaveLength(
          2,
        );

        expect(
          proposal
            .candidateDiscoveryMeanSquaredError,
        ).toBeCloseTo(
          0,
        );
      },
    );

    it(
      "retains a single ancestor when one revision already explains the evidence adequately",
      () => {
        const proposal =
          proposeRevisionComposition(
            lineage(),
            [
              observation(
                "only-y-1",
                1,
                0,
                0.6,
              ),
              observation(
                "only-y-half",
                0.5,
                0,
                0.3,
              ),
            ],
          );

        expect(
          proposal,
        ).toMatchObject({
          decision:
            "retain-single",

          sourceRevisionIds: [
            "rev-y",
          ],

          bestSingleRevisionId:
            "rev-y",

          reason:
            "single-revision-already-adequate",
        });
      },
    );

    it(
      "uses two safe validation steps to resolve explanations that no single unary probe can fully separate",
      () => {
        const currentLineage =
          lineage();

        const proposal =
          proposeRevisionComposition(
            currentLineage,
            COMPOSITION_FIT,
          );

        const explanations:
          CompositionExplanation[] = [
          {
            id:
              "rev-y",

            program:
              PROGRAM_Y,

            kind:
              "single",
          },
          {
            id:
              "rev-z",

            program:
              PROGRAM_Z,

            kind:
              "single",
          },
          {
            id:
              "composite",

            program:
              proposal
                .candidate!,

            kind:
              "composition",
          },
        ];

        const belief =
          new ProbabilisticCompositionBelief(
            explanations,
          ).getBelief();

        const probes =
          synthesizeProtectedValidationProbes(
            currentLineage,
            [],
            {
              maximumArity:
                1,
            },
          );

        const oneStep =
          planCompositionValidation(
            explanations,
            belief,
            probes,
            1,
          );

        const twoStep =
          planCompositionValidation(
            explanations,
            belief,
            probes,
            2,
          );

        expect(
          oneStep.decision,
        ).toBe(
          "plan",
        );

        expect(
          twoStep.decision,
        ).toBe(
          "plan",
        );

        expect(
          twoStep
            .expectedTerminalNormalizedEntropy,
        ).toBeLessThan(
          oneStep
            .expectedTerminalNormalizedEntropy,
        );

        expect(
          twoStep
            .branches
            .some(
              (branch) =>
                branch
                  .secondProbeId !==
                undefined,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "abstains from validation planning when every probe exceeds the external risk ceiling",
      () => {
        const proposal =
          proposeRevisionComposition(
            lineage(),
            COMPOSITION_FIT,
          );

        const explanations:
          CompositionExplanation[] = [
          {
            id:
              "rev-y",

            program:
              PROGRAM_Y,

            kind:
              "single",
          },
          {
            id:
              "rev-z",

            program:
              PROGRAM_Z,

            kind:
              "single",
          },
          {
            id:
              "composite",

            program:
              proposal
                .candidate!,

            kind:
              "composition",
          },
        ];

        const belief =
          new ProbabilisticCompositionBelief(
            explanations,
          ).getBelief();

        const probes =
          synthesizeProtectedValidationProbes(
            lineage(),
            [],
            {
              risk:
                0.9,
            },
          );

        const plan =
          planCompositionValidation(
            explanations,
            belief,
            probes,
            2,
            {
              maximumRisk:
                0.3,
            },
          );

        expect(
          plan,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-safe-composition-validation-plan",
        });
      },
    );

    it(
      "installs the composition only after it independently beats the best single revision on protected evidence",
      () => {
        const currentLineage =
          lineage();

        const proposal =
          proposeRevisionComposition(
            currentLineage,
            COMPOSITION_FIT,
          );

        const decision =
          validateRevisionComposition(
            currentLineage,
            proposal,
            PROTECTED_COMPOSITE,
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "installed",

          bestSingleRevisionId:
            "rev-y",

          compositeProtectedMeanSquaredError:
            0,

          reason:
            "protected-composition-installed",
        });

        expect(
          decision
            .improvement,
        ).toBeGreaterThan(
          0.05,
        );
      },
    );

    it(
      "rejects a fitted composition when independent protected evidence supports one retained ancestor instead",
      () => {
        const currentLineage =
          lineage();

        const proposal =
          proposeRevisionComposition(
            currentLineage,
            COMPOSITION_FIT,
          );

        const decision =
          validateRevisionComposition(
            currentLineage,
            proposal,
            [
              observation(
                "protected-single-y-1",
                1,
                0,
                0.6,
              ),
              observation(
                "protected-single-y-half",
                0.5,
                0,
                0.3,
              ),
              observation(
                "protected-single-y-quarter",
                0.25,
                0,
                0.15,
              ),
            ],
          );

        expect(
          decision,
        ).toMatchObject({
          decision:
            "retained",

          bestSingleRevisionId:
            "rev-y",

          reason:
            "single-revision-retained",
        });
      },
    );

    it(
      "appends the protected composite with the strictest compatible prerequisite from its source revisions",
      () => {
        const currentLineage =
          lineage();

        const proposal =
          proposeRevisionComposition(
            currentLineage,
            COMPOSITION_FIT,
          );

        const protectedDecision =
          validateRevisionComposition(
            currentLineage,
            proposal,
            PROTECTED_COMPOSITE,
          );

        const installation =
          installCompositeRevision(
            currentLineage,
            protectedDecision,
            "rev-composite",
            {
              y:
                1,
              z:
                1,
            },
            0.2,
          );

        expect(
          installation,
        ).toMatchObject({
          decision:
            "installed",

          sourceRevisionIds: [
            "rev-y",
            "rev-z",
          ],

          lineage: {
            activeRevisionId:
              "rev-composite",
          },

          prerequisite: {
            threshold:
              0.7,
          },

          hypothesis: {
            id:
              "hypothesis:rev-composite",

            repairCandidateId:
              "composition:rev-y+rev-z",

            prerequisiteHypothesisId:
              "finish:readiness>=0.700",
          },

          reason:
            "composite-revision-appended",
        });

        expect(
          installation
            .hypothesis
            ?.dimensionEffects
            .progress
            ?.finish,
        ).toBeCloseTo(
          1.1,
        );

        expect(
          installation
            .lineage
            ?.nodes,
        ).toHaveLength(
          3,
        );
      },
    );
  },
);

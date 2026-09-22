import {
  describe,
  expect,
  it,
} from "vitest";

import {
  automaticallyResynthesizeCollapsedStructuralFamily,
  identifyStructuralResynthesisTargets,
  synthesizeResynthesisDiagnosticProbes,
} from "./automatic-bounded-structural-resynthesis";

import {
  predictHierarchicalProgramEffect,
  type HierarchicalCausalProgram,
  type ValidatedCausalFragment,
} from "./hierarchical-causal-program";

import type {
  AdaptivePrunedStructuralDiagnosisResult,
} from "./adaptive-joint-candidate-pruning";

import type {
  MultiFragmentStructuralRevisionCandidate,
} from "./multi-fragment-structural-revision";

import type {
  StructuralMechanismObservation,
  StructuralMechanismTerm,
} from "./mechanism-structure-synthesis";

function fragment(
  id: string,
  term:
    StructuralMechanismTerm,
): ValidatedCausalFragment {
  return {
    id,

    terms: [
      {
        ...term,

        variables: [
          ...term.variables,
        ],
      },
    ],

    validationMeanSquaredError:
      0,

    sourceEvidenceCount:
      4,
  };
}

const Y =
  fragment(
    "logical-y",
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
  );

const Z =
  fragment(
    "logical-z",
    {
      id:
        "linear(z)",

      kind:
        "linear",

      variables: [
        "z",
      ],

      coefficient:
        0.5,
    },
  );

const Q =
  fragment(
    "logical-q",
    {
      id:
        "linear(q)",

      kind:
        "linear",

      variables: [
        "q",
      ],

      coefficient:
        0.2,
    },
  );

const INCUMBENT:
  HierarchicalCausalProgram = {
  id:
    "resynthesis-incumbent",

  baseEffects: {
    y:
      0,

    z:
      0,

    w:
      0,

    q:
      0,
  },

  fragments: [
    Y,
    Z,
    Q,
  ],

  observationStdDev:
    0.03,

  depth:
    4,

  complexity:
    3,
};

const ACTUAL:
  HierarchicalCausalProgram = {
  ...INCUMBENT,

  id:
    "resynthesis-actual",

  fragments: [
    fragment(
      "actual-y",
      {
        id:
          "saturating(y)",

        kind:
          "saturating",

        variables: [
          "y",
        ],

        coefficient:
          0.9,
      },
    ),
    fragment(
      "actual-z",
      {
        id:
          "interaction(z,w)",

        kind:
          "interaction",

        variables: [
          "z",
          "w",
        ],

        coefficient:
          0.5,
      },
    ),
    Q,
  ],
};

function observation(
  id: string,
  interventions:
    Record<string, number>,
): StructuralMechanismObservation {
  return {
    experiment: {
      id,

      interventions,

      risk:
        0.05,

      cost:
        0.02,

      reversible:
        true,
    },

    measuredEffect:
      predictHierarchicalProgramEffect(
        ACTUAL,
        interventions,
      ),
  };
}

const EVIDENCE:
  readonly StructuralMechanismObservation[] = [
    observation(
      "e-y-025",
      {
        y:
          0.25,
        z:
          0,
        w:
          1,
        q:
          0,
      },
    ),
    observation(
      "e-y-050",
      {
        y:
          0.5,
        z:
          0,
        w:
          1,
        q:
          0,
      },
    ),
    observation(
      "e-y-100",
      {
        y:
          1,
        z:
          0,
        w:
          1,
        q:
          0,
      },
    ),
    observation(
      "e-z-w025",
      {
        y:
          0,
        z:
          1,
        w:
          0.25,
        q:
          0,
      },
    ),
    observation(
      "e-z-w050",
      {
        y:
          0,
        z:
          1,
        w:
          0.5,
        q:
          0,
      },
    ),
    observation(
      "e-z-w100",
      {
        y:
          0,
        z:
          1,
        w:
          1,
        q:
          0,
      },
    ),
    observation(
      "e-q-050",
      {
        y:
          0,
        z:
          0,
        w:
          1,
        q:
          0.5,
      },
    ),
    observation(
      "e-q-100",
      {
        y:
          0,
        z:
          0,
        w:
          1,
        q:
          1,
      },
    ),
  ];

function failedCandidate(
  id: string,
): MultiFragmentStructuralRevisionCandidate {
  return {
    id,

    componentCandidateIds: {
      "logical-y":
        `${id}:y`,

      "logical-z":
        `${id}:z`,
    },

    replacementFragmentIds:
      {},

    retiredFragmentIds:
      [],

    topologyChangedFragmentIds:
      [],

    parameterChangedFragmentIds:
      [],

    program:
      INCUMBENT,

    discoveryMeanSquaredError:
      0.02,

    complexityPenalty:
      0,

    objective:
      0.02,
  };
}

const FAILED = [
  failedCandidate(
    "failed-a",
  ),
  failedCandidate(
    "failed-b",
  ),
] as const;

function collapsed(
  evidence:
    readonly StructuralMechanismObservation[] =
      EVIDENCE,
): AdaptivePrunedStructuralDiagnosisResult {
  return {
    decision:
      "reopen-search",

    initialCandidateCount:
      2,

    finalCandidateSet: {
      activeCandidateIds: [
        "failed-a",
        "failed-b",
      ],

      prunedCandidateIds:
        [],

      auditHistory:
        [],
    },

    initialBelief: {
      probabilities: {
        "failed-a":
          0.5,

        "failed-b":
          0.5,
      },

      topCandidateId:
        "failed-a",

      confidence:
        0.5,

      margin:
        0,

      normalizedEntropy:
        1,

      activeCandidateCount:
        2,
    },

    finalBelief: {
      probabilities: {
        "failed-a":
          0.5,

        "failed-b":
          0.5,
      },

      topCandidateId:
        "failed-a",

      confidence:
        0.5,

      margin:
        0,

      normalizedEntropy:
        1,

      activeCandidateCount:
        2,
    },

    acquiredObservations:
      [],

    allEvidence:
      evidence.map(
        (item) => ({
          measuredEffect:
            item.measuredEffect,

          experiment: {
            ...item.experiment,

            interventions: {
              ...item
                .experiment
                .interventions,
            },
          },
        }),
      ),

    executedProbeIds:
      [],

    steps:
      [],

    reason:
      "all-retained-structural-candidates-inadequate",
  };
}

describe(
  "automatic bounded structural resynthesis",
  () => {
    it(
      "identifies only locally mismatched fragments and preserves the healthy fragment",
      () => {
        const targets =
          identifyStructuralResynthesisTargets(
            INCUMBENT,
            EVIDENCE,
            {
              minimumLocalEvidence:
                2,

              minimumLocalMeanSquaredError:
                0.005,

              maximumTargets:
                3,
            },
          );

        expect(
          targets.map(
            (target) =>
              target
                .logicalFragmentId,
          ),
        ).toEqual([
          "logical-z",
          "logical-y",
        ]);

        expect(
          targets.some(
            (target) =>
              target
                .logicalFragmentId ===
              "logical-q",
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "re-synthesizes a bounded family containing the missing saturation and interaction grammar",
      () => {
        const result =
          automaticallyResynthesizeCollapsedStructuralFamily(
            INCUMBENT,
            FAILED,
            collapsed(),
            "failed-family",
            1,
            [],
            {
              minimumLocalEvidence:
                2,

              maximumTargets:
                2,

              maximumLocalCandidates:
                2,

              minimumLocalCandidates:
                2,

              maximumJointCandidates:
                8,

              maximumResynthesizedMeanSquaredError:
                0.01,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "resynthesized",

          familyRevision: {
            parentFamilyId:
              "failed-family",

            generation:
              1,

            targetFragmentIds: [
              "logical-y",
              "logical-z",
            ],

            preservedFragmentIds: [
              "logical-q",
            ],

            reason:
              "collapsed-family-bounded-resynthesis",
          },

          reason:
            "bounded-structural-family-resynthesized",
        });

        expect(
          result
            .candidates
            .some(
              (candidate) =>
                candidate
                  .program
                  .fragments
                  .some(
                    (item) =>
                      item
                        .terms
                        .some(
                          (term) =>
                            term.kind ===
                            "saturating" &&
                            term.variables
                              .includes(
                                "y",
                              ),
                        ),
                  ) &&
                candidate
                  .program
                  .fragments
                  .some(
                    (item) =>
                      item
                        .terms
                        .some(
                          (term) =>
                            term.kind ===
                            "interaction" &&
                            term.variables
                              .includes(
                                "z",
                              ) &&
                            term.variables
                              .includes(
                                "w",
                              ),
                        ),
                  ),
            ),
        ).toBe(
          true,
        );

        expect(
          result
            .candidates
            .every(
              (candidate) =>
                candidate
                  .program
                  .fragments
                  .some(
                    (item) =>
                      item.id ===
                      "logical-q" &&
                      item
                        .terms[
                          0
                        ]
                        ?.kind ===
                      "linear" &&
                      item
                        .terms[
                          0
                        ]
                        ?.coefficient ===
                      0.2,
                  ),
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "links the fresh candidate family to every failed candidate and all synthesis evidence ids",
      () => {
        const result =
          automaticallyResynthesizeCollapsedStructuralFamily(
            INCUMBENT,
            FAILED,
            collapsed(),
            "failed-family",
            2,
            [],
          );

        expect(
          result
            .familyRevision
            ?.failedCandidateIds,
        ).toEqual([
          "failed-a",
          "failed-b",
        ]);

        expect(
          result
            .familyRevision
            ?.sourceEvidenceIds,
        ).toEqual(
          EVIDENCE.map(
            (item) =>
              item
                .experiment
                .id,
          ).sort(),
        );

        expect(
          result
            .familyRevision
            ?.familyId,
        ).toBe(
          "failed-family:resynthesis:2",
        );
      },
    );

    it(
      "synthesizes only reversible bounded diagnostic probes that actually separate fresh candidates",
      () => {
        const result =
          automaticallyResynthesizeCollapsedStructuralFamily(
            INCUMBENT,
            FAILED,
            collapsed(),
            "failed-family",
            1,
            [],
          );

        const probes =
          synthesizeResynthesisDiagnosticProbes(
            result.candidates,
          );

        expect(
          probes.length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          probes.every(
            (probe) =>
              probe.reversible &&
              probe.risk >=
                0 &&
              probe.risk <=
                1 &&
              probe.cost >=
                0,
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "fails closed when collapse evidence overlaps an excluded protected reserve",
      () => {
        expect(
          () =>
            automaticallyResynthesizeCollapsedStructuralFamily(
              INCUMBENT,
              FAILED,
              collapsed(),
              "failed-family",
              1,
              [
                "e-y-025",
              ],
            ),
        ).toThrow(
          "Structural re-synthesis evidence must remain disjoint from excluded protected evidence.",
        );
      },
    );

    it(
      "abstains instead of inventing a new family when no local fragment exceeds the mismatch threshold",
      () => {
        const healthyEvidence =
          EVIDENCE.map(
            (item) => ({
              measuredEffect:
                predictHierarchicalProgramEffect(
                  INCUMBENT,
                  item
                    .experiment
                    .interventions,
                ),

              experiment: {
                ...item.experiment,

                id:
                  `healthy-${item.experiment.id}`,

                interventions: {
                  ...item
                    .experiment
                    .interventions,
                },
              },
            }));

        const result =
          automaticallyResynthesizeCollapsedStructuralFamily(
            INCUMBENT,
            FAILED,
            collapsed(
              healthyEvidence,
            ),
            "failed-family",
            1,
            [],
            {
              minimumLocalMeanSquaredError:
                0.005,
            },
          );

        expect(
          result,
        ).toMatchObject({
          decision:
            "abstained",

          reason:
            "no-local-resynthesis-targets",
        });

        expect(
          result.targets,
        ).toHaveLength(
          0,
        );
      },
    );
  },
);

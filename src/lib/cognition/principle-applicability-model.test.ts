import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PrincipleApplicabilityModel,
} from "./principle-applicability-model";

describe(
  "Mabojolu G learned principle applicability model",
  () => {
    it(
      "starts from a neutral Beta prior with no evidence",
      () => {
        const model =
          new PrincipleApplicabilityModel();

        const estimate =
          model.estimate(
            "principle-a",
            {
              progressKind:
                "numeric",

              candidateRelation:
                "productive-repeat",
            },
          );

        expect(
          estimate.applicability,
        ).toBe(0.5);

        expect(
          estimate.evidenceCount,
        ).toBe(0);
      },
    );

    it(
      "raises applicability after useful evidence and lowers it after failures",
      () => {
        const model =
          new PrincipleApplicabilityModel();

        const context = {
          progressKind:
            "numeric" as const,

          candidateRelation:
            "productive-repeat" as const,
        };

        const afterSuccess =
          model.record({
            principleId:
              "principle-a",

            context,

            useful:
              true,
          });

        expect(
          afterSuccess.applicability,
        ).toBeCloseTo(
          2 / 3,
        );

        const afterFailure =
          model.record({
            principleId:
              "principle-a",

            context,

            useful:
              false,
          });

        expect(
          afterFailure.applicability,
        ).toBe(0.5);

        expect(
          afterFailure.evidenceCount,
        ).toBe(2);
      },
    );

    it(
      "keeps numeric and nonnumeric contexts in separate evidence buckets",
      () => {
        const model =
          new PrincipleApplicabilityModel();

        model.record({
          principleId:
            "principle-a",

          context: {
            progressKind:
              "numeric",

            candidateRelation:
              "deferred-action",
          },

          useful:
            false,
        });

        const numeric =
          model.estimate(
            "principle-a",
            {
              progressKind:
                "numeric",

              candidateRelation:
                "deferred-action",
            },
          );

        const nonnumeric =
          model.estimate(
            "principle-a",
            {
              progressKind:
                "nonnumeric",

              candidateRelation:
                "deferred-action",
            },
          );

        expect(
          numeric.applicability,
        ).toBeCloseTo(
          1 / 3,
        );

        expect(
          nonnumeric.applicability,
        ).toBe(0.5);

        expect(
          nonnumeric.evidenceCount,
        ).toBe(0);
      },
    );

    it(
      "keeps evidence for different principles independent",
      () => {
        const model =
          new PrincipleApplicabilityModel();

        const context = {
          progressKind:
            "numeric" as const,

          candidateRelation:
            "productive-repeat" as const,
        };

        model.record({
          principleId:
            "principle-a",

          context,

          useful:
            true,
        });

        const first =
          model.estimate(
            "principle-a",
            context,
          );

        const second =
          model.estimate(
            "principle-b",
            context,
          );

        expect(
          first.applicability,
        ).toBeCloseTo(
          2 / 3,
        );

        expect(
          second.applicability,
        ).toBe(0.5);

        expect(
          model.getEvidenceCount(),
        ).toBe(1);
      },
    );
  },
);

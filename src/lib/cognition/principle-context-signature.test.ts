import {
  describe,
  expect,
  it,
} from "vitest";

import {
  InducedContextApplicabilityModel,
  StructuralContextSignatureEncoder,
} from "./principle-context-signature";

describe(
  "Mabojolu G structural context signature induction",
  () => {
    it(
      "produces the same signature for renamed but structurally identical target history",
      () => {
        const first =
          new StructuralContextSignatureEncoder();

        first.observe({
          action:
            "TRY",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              0,

            done:
              false,
          },

          changedKeys: [],
        });

        first.observe({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              1,

            done:
              false,
          },

          changedKeys: [
            "level",
          ],
        });

        const second =
          new StructuralContextSignatureEncoder();

        second.observe({
          action:
            "ATTEMPT",

          accepted:
            true,

          before: {
            charge:
              10,

            released:
              false,
          },

          after: {
            charge:
              10,

            released:
              false,
          },

          changedKeys: [],
        });

        second.observe({
          action:
            "BOOST",

          accepted:
            true,

          before: {
            charge:
              10,

            released:
              false,
          },

          after: {
            charge:
              11,

            released:
              false,
          },

          changedKeys: [
            "charge",
          ],
        });

        expect(
          first
            .encodeCandidate(
              "ADVANCE",
            )
            .key,
        ).toBe(
          second
            .encodeCandidate(
              "BOOST",
            )
            .key,
        );

        expect(
          first
            .encodeCandidate(
              "TRY",
            )
            .key,
        ).toBe(
          second
            .encodeCandidate(
              "ATTEMPT",
            )
            .key,
        );
      },
    );

    it(
      "distinguishes a deferred no-effect candidate from a recently productive candidate",
      () => {
        const encoder =
          new StructuralContextSignatureEncoder();

        encoder.observe({
          action:
            "TRY",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              0,

            done:
              false,
          },

          changedKeys: [],
        });

        encoder.observe({
          action:
            "ADVANCE",

          accepted:
            true,

          before: {
            level:
              0,

            done:
              false,
          },

          after: {
            level:
              1,

            done:
              false,
          },

          changedKeys: [
            "level",
          ],
        });

        expect(
          encoder
            .encodeCandidate(
              "TRY",
            )
            .key,
        ).not.toBe(
          encoder
            .encodeCandidate(
              "ADVANCE",
            )
            .key,
        );
      },
    );

    it(
      "does not store source action labels or state-variable names in the signature",
      () => {
        const encoder =
          new StructuralContextSignatureEncoder();

        encoder.observe({
          action:
            "SECRET-ACTION",

          accepted:
            true,

          before: {
            secretState:
              3,

            hiddenFlag:
              false,
          },

          after: {
            secretState:
              4,

            hiddenFlag:
              false,
          },

          changedKeys: [
            "secretState",
          ],
        });

        const serialized =
          JSON.stringify(
            encoder
              .encodeCandidate(
                "SECRET-ACTION",
              ),
          );

        expect(
          serialized,
        ).not.toContain(
          "SECRET-ACTION",
        );

        expect(
          serialized,
        ).not.toContain(
          "secretState",
        );

        expect(
          serialized,
        ).not.toContain(
          "hiddenFlag",
        );
      },
    );

    it(
      "learns applicability for an induced signature from outcome evidence",
      () => {
        const encoder =
          new StructuralContextSignatureEncoder();

        encoder.observe({
          action:
            "STEP",

          accepted:
            true,

          before: {
            value:
              0,
          },

          after: {
            value:
              1,
          },

          changedKeys: [
            "value",
          ],
        });

        const signature =
          encoder.encodeCandidate(
            "STEP",
          );

        const model =
          new InducedContextApplicabilityModel();

        expect(
          model.estimate(
            "principle-a",
            signature,
          ).applicability,
        ).toBe(0.5);

        model.record({
          principleId:
            "principle-a",

          signature,

          useful:
            true,
        });

        const learned =
          model.estimate(
            "principle-a",
            signature,
          );

        expect(
          learned.applicability,
        ).toBeCloseTo(
          2 / 3,
        );

        expect(
          learned.evidenceCount,
        ).toBe(1);
      },
    );

    it(
      "preserves v0.4 core matching while full-feature mode detects nuisance history differences",
      () => {
        const shortHistory =
          new StructuralContextSignatureEncoder();

        shortHistory.observe({
          action:
            "STEP",

          accepted:
            true,

          before: {
            value:
              0,
          },

          after: {
            value:
              1,
          },

          changedKeys: [
            "value",
          ],
        });

        const longerHistory =
          new StructuralContextSignatureEncoder();

        longerHistory.observe({
          action:
            "OTHER",

          accepted:
            true,

          before: {
            value:
              0,
          },

          after: {
            value:
              0,
          },

          changedKeys: [],
        });

        longerHistory.observe({
          action:
            "STEP",

          accepted:
            true,

          before: {
            value:
              0,
          },

          after: {
            value:
              1,
          },

          changedKeys: [
            "value",
          ],
        });

        const first =
          shortHistory
            .encodeCandidate(
              "STEP",
            );

        const second =
          longerHistory
            .encodeCandidate(
              "STEP",
            );

        expect(
          first.key,
        ).toBe(
          second.key,
        );

        expect(
          JSON.stringify(
            first.features,
          ),
        ).not.toBe(
          JSON.stringify(
            second.features,
          ),
        );

        const core =
          new InducedContextApplicabilityModel();

        core.record({
          principleId:
            "principle-a",

          signature:
            first,

          useful:
            true,
        });

        expect(
          core.estimate(
            "principle-a",
            second,
          ).evidenceCount,
        ).toBe(1);

        const full =
          new InducedContextApplicabilityModel(
            "full",
          );

        full.record({
          principleId:
            "principle-a",

          signature:
            first,

          useful:
            true,
        });

        expect(
          full.estimate(
            "principle-a",
            second,
          ).evidenceCount,
        ).toBe(0);
      },
    );

    it(
      "keeps evidence separate across structural signatures and principles",
      () => {
        const firstEncoder =
          new StructuralContextSignatureEncoder();

        firstEncoder.observe({
          action:
            "STEP",

          accepted:
            true,

          before: {
            value:
              0,
          },

          after: {
            value:
              1,
          },

          changedKeys: [
            "value",
          ],
        });

        const secondEncoder =
          new StructuralContextSignatureEncoder();

        secondEncoder.observe({
          action:
            "TRY",

          accepted:
            true,

          before: {
            ready:
              false,
          },

          after: {
            ready:
              false,
          },

          changedKeys: [],
        });

        const first =
          firstEncoder
            .encodeCandidate(
              "STEP",
            );

        const second =
          secondEncoder
            .encodeCandidate(
              "TRY",
            );

        const model =
          new InducedContextApplicabilityModel();

        model.record({
          principleId:
            "principle-a",

          signature:
            first,

          useful:
            true,
        });

        expect(
          model.estimate(
            "principle-a",
            second,
          ).evidenceCount,
        ).toBe(0);

        expect(
          model.estimate(
            "principle-b",
            first,
          ).evidenceCount,
        ).toBe(0);
      },
    );
  },
);

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MULTIMODAL_EVIDENCE_SCHEMA_VERSION,
  attachmentEvidenceSidecarPath,
  decodeMultimodalEvidence,
  encodeMultimodalEvidence,
  processAttachmentBytes,
} from "./analysis";

function bytes(
  value:
    string,
): Uint8Array {
  return new TextEncoder().encode(
    value,
  );
}

describe(
  "multimodal attachment analysis",
  () => {
    it(
      "extracts bounded UTF-8 text into a versioned evidence package",
      () => {
        const result =
          processAttachmentBytes(
            {
              attachmentId:
                "att-text",

              filename:
                "notes.md",

              mimeType:
                "text/markdown",

              bytes:
                bytes(
                  "# Mabojolu\nMultimodal cognition",
                ),
            },
          );

        expect(
          result,
        ).toMatchObject({
          ok:
            true,

          evidence: {
            schemaVersion:
              MULTIMODAL_EVIDENCE_SCHEMA_VERSION,

            attachmentId:
              "att-text",

            modality:
              "text-document",

            capabilityId:
              "document-understanding",

            processor: {
              id:
                "mabojolu-direct-text-v1",

              local:
                true,
            },
          },
        });

        if (
          result.ok
        ) {
          expect(
            result
              .evidence
              .text,
          ).toContain(
            "Multimodal cognition",
          );
        }
      },
    );

    it(
      "adds lightweight CSV structure metadata without changing source text",
      () => {
        const source =
          "name,score\nMabojolu,10\nWestforge,9";

        const result =
          processAttachmentBytes(
            {
              attachmentId:
                "att-csv",

              filename:
                "scores.csv",

              mimeType:
                "text/csv",

              bytes:
                bytes(
                  source,
                ),
            },
          );

        expect(
          result,
        ).toMatchObject({
          ok:
            true,

          evidence: {
            modality:
              "spreadsheet",

            metadata: {
              estimatedColumns:
                2,

              lines:
                3,
            },
          },
        });

        if (
          result.ok
        ) {
          expect(
            result
              .evidence
              .text,
          ).toBe(
            source,
          );
        }
      },
    );

    it(
      "validates JSON before marking structured evidence ready",
      () => {
        const good =
          processAttachmentBytes(
            {
              attachmentId:
                "att-json",

              filename:
                "data.json",

              mimeType:
                "application/json",

              bytes:
                bytes(
                  "[1,2,3]",
                ),
            },
          );

        expect(
          good,
        ).toMatchObject({
          ok:
            true,

          evidence: {
            modality:
              "structured-data",

            metadata: {
              jsonRootType:
                "array",
            },
          },
        });

        const bad =
          processAttachmentBytes(
            {
              attachmentId:
                "att-json-bad",

              filename:
                "bad.json",

              mimeType:
                "application/json",

              bytes:
                bytes(
                  "{broken",
                ),
            },
          );

        expect(
          bad,
        ).toMatchObject({
          ok:
            false,

          reason:
            "invalid-content",
        });
      },
    );

    it(
      "marks validated images as vision payload ready without pretending OCR occurred",
      () => {
        const result =
          processAttachmentBytes(
            {
              attachmentId:
                "att-image",

              filename:
                "photo.png",

              mimeType:
                "image/png",

              bytes:
                new Uint8Array([
                  0x89,
                  0x50,
                  0x4e,
                  0x47,
                ]),
            },
          );

        expect(
          result,
        ).toMatchObject({
          ok:
            true,

          evidence: {
            modality:
              "image-understanding",

            capabilityId:
              "image-understanding",

            metadata: {
              visionPayloadReady:
                true,
            },
          },
        });

        if (
          result.ok
        ) {
          expect(
            result
              .evidence
              .text,
          ).toBeUndefined();
        }
      },
    );

    it(
      "keeps accepted but unconnected binary processors unavailable instead of fabricating evidence",
      () => {
        const result =
          processAttachmentBytes(
            {
              attachmentId:
                "att-pdf",

              filename:
                "report.pdf",

              mimeType:
                "application/pdf",

              bytes:
                new Uint8Array([
                  0x25,
                  0x50,
                  0x44,
                  0x46,
                ]),
            },
          );

        expect(
          result,
        ).toMatchObject({
          ok:
            false,

          reason:
            "processor-unavailable",
        });
      },
    );

    it(
      "round-trips private evidence sidecars through a strict schema version",
      () => {
        const result =
          processAttachmentBytes(
            {
              attachmentId:
                "att-roundtrip",

              filename:
                "notes.txt",

              mimeType:
                "text/plain",

              bytes:
                bytes(
                  "hello",
                ),
            },
          );

        expect(
          result.ok,
        ).toBe(
          true,
        );

        if (
          !result.ok
        ) {
          return;
        }

        const encoded =
          encodeMultimodalEvidence(
            result.evidence,
          );

        expect(
          decodeMultimodalEvidence(
            encoded,
          ),
        ).toMatchObject({
          attachmentId:
            "att-roundtrip",

          text:
            "hello",
        });

        expect(
          attachmentEvidenceSidecarPath(
            "u/c/a-notes.txt",
          ),
        ).toBe(
          "u/c/a-notes.txt.analysis.json",
        );
      },
    );
  },
);

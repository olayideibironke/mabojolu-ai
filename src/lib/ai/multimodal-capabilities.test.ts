import {
  describe,
  expect,
  it,
} from "vitest";

import {
  UNIVERSAL_ASSISTANT_CAPABILITIES,
  attachmentExtension,
  classifyMultimodalFormat,
  multimodalCapability,
  normalizeMimeType,
  readyMultimodalCapabilities,
} from "./multimodal-capabilities";

describe(
  "Mabojolu multimodal capability contract",
  () => {
    it(
      "classifies every supported binary media family",
      () => {
        expect(
          classifyMultimodalFormat(
            "image/png",
            "photo.png",
          ),
        ).toMatchObject({
          modality:
            "image-understanding",

          capabilityId:
            "image-understanding",
        });

        expect(
          classifyMultimodalFormat(
            "audio/mpeg",
            "meeting.mp3",
          ),
        ).toMatchObject({
          modality:
            "audio-understanding",

          capabilityId:
            "audio-understanding",
        });

        expect(
          classifyMultimodalFormat(
            "video/mp4",
            "clip.mp4",
          ),
        ).toMatchObject({
          modality:
            "video-understanding",

          capabilityId:
            "video-understanding",
        });
      },
    );

    it(
      "distinguishes spreadsheets, presentations, PDFs, and structured data",
      () => {
        expect(
          classifyMultimodalFormat(
            "application/pdf",
            "report.pdf",
          )
            ?.modality,
        ).toBe(
          "pdf",
        );

        expect(
          classifyMultimodalFormat(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "forecast.xlsx",
          )
            ?.modality,
        ).toBe(
          "spreadsheet",
        );

        expect(
          classifyMultimodalFormat(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "deck.pptx",
          )
            ?.modality,
        ).toBe(
          "presentation",
        );

        expect(
          classifyMultimodalFormat(
            "application/json",
            "data.json",
          )
            ?.modality,
        ).toBe(
          "structured-data",
        );
      },
    );

    it(
      "treats recognized source extensions as code without executing them",
      () => {
        expect(
          classifyMultimodalFormat(
            "text/plain; charset=utf-8",
            "worker.py",
          ),
        ).toMatchObject({
          mimeType:
            "text/plain",

          modality:
            "source-code",

          capabilityId:
            "source-code-analysis",
        });

        expect(
          classifyMultimodalFormat(
            "text/plain",
            "notes.txt",
          )
            ?.modality,
        ).toBe(
          "text-document",
        );
      },
    );

    it(
      "normalizes MIME parameters and extensions deterministically",
      () => {
        expect(
          normalizeMimeType(
            "Text/Plain; charset=UTF-8",
          ),
        ).toBe(
          "text/plain",
        );

        expect(
          attachmentExtension(
            "Quarterly.Report.XLSX",
          ),
        ).toBe(
          "xlsx",
        );

        expect(
          attachmentExtension(
            ".env",
          ),
        ).toBe(
          "",
        );
      },
    );

    it(
      "returns defensive copies from public capability helpers",
      () => {
        const first =
          multimodalCapability(
            "image-understanding",
          );

        first.inputFormats.push(
          "mutated",
        );

        const second =
          multimodalCapability(
            "image-understanding",
          );

        expect(
          second.inputFormats,
        ).not.toContain(
          "mutated",
        );

        const ready =
          readyMultimodalCapabilities();

        expect(
          ready.every(
            (capability) =>
              capability.state ===
              "ready",
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "defines the complete ordinary-assistant target surface explicitly",
      () => {
        expect(
          UNIVERSAL_ASSISTANT_CAPABILITIES,
        ).toEqual(
          expect.arrayContaining([
            "text-generation",
            "image-understanding",
            "document-understanding",
            "spreadsheet-analysis",
            "presentation-analysis",
            "structured-data-analysis",
            "source-code-analysis",
            "audio-transcription",
            "audio-understanding",
            "video-understanding",
            "image-generation",
            "speech-synthesis",
          ]),
        );

        expect(
          new Set(
            UNIVERSAL_ASSISTANT_CAPABILITIES,
          ).size,
        ).toBe(
          UNIVERSAL_ASSISTANT_CAPABILITIES.length,
        );
      },
    );
  },
);

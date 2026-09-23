import {
  describe,
  expect,
  it,
} from "vitest";

import {
  attachmentContextCharacterCount,
  contentWithAttachmentContext,
  documentContextBlock,
  imageAttachments,
  textDocumentAttachments,
} from "./attachment-context";

import type {
  ChatAttachment,
} from "@/types/chat";

const image:
  ChatAttachment = {
  kind:
    "image",

  id:
    "image-1",

  name:
    "chart.png",

  mimeType:
    "image/png",

  sizeBytes:
    4,

  dataUrl:
    "data:image/png;base64,AAAA",
};

const document:
  ChatAttachment = {
  kind:
    "document",

  id:
    "doc-1",

  name:
    "notes.md",

  mimeType:
    "text/markdown",

  sizeBytes:
    20,

  textContent:
    "# Findings\nMabojolu works.",
};

describe(
  "attachment context normalization",
  () => {
    it(
      "wraps text documents with explicit filename and mime boundaries",
      () => {
        expect(
          documentContextBlock(
            document.kind ===
              "document"
              ? document
              : neverDocument(),
          ),
        ).toBe(
          [
            "[Attached document: notes.md; type=text/markdown]",
            "# Findings",
            "Mabojolu works.",
            "[/Attached document]",
          ].join(
            "\n",
          ),
        );
      },
    );

    it(
      "composes user text with multiple text documents",
      () => {
        const second:
          ChatAttachment = {
          kind:
            "document",

          id:
            "doc-2",

          name:
            "data.csv",

          mimeType:
            "text/csv",

          sizeBytes:
            8,

          textContent:
            "a,b\n1,2",
        };

        const result =
          contentWithAttachmentContext({
            content:
              "Compare these files.",

            attachments: [
              document,
              second,
            ],
          });

        expect(
          result,
        ).toContain(
          "Compare these files.",
        );

        expect(
          result,
        ).toContain(
          "[Attached document: notes.md; type=text/markdown]",
        );

        expect(
          result,
        ).toContain(
          "[Attached document: data.csv; type=text/csv]",
        );

        expect(
          result,
        ).toContain(
          "a,b\n1,2",
        );
      },
    );

    it(
      "keeps image and document attachments in separate normalized sets",
      () => {
        const attachments = [
          image,
          document,
        ];

        expect(
          imageAttachments({
            attachments,
          }),
        ).toEqual([
          image,
        ]);

        expect(
          textDocumentAttachments({
            attachments,
          }),
        ).toEqual([
          document,
        ]);
      },
    );

    it(
      "uses the image analysis default only when no text or document content exists",
      () => {
        expect(
          contentWithAttachmentContext({
            content:
              "",

            attachments: [
              image,
            ],
          }),
        ).toBe(
          "Answer directly from the attached image. Do not announce that you analyzed, processed, received, or were provided the image. Do not introduce yourself or mention your creator unless the user asks.",
        );

        const documentOnly =
          contentWithAttachmentContext({
            content:
              "",

            attachments: [
              document,
            ],
          });

        expect(
          documentOnly,
        ).toContain(
          "Use the extracted attachment evidence below to answer directly. Do not announce that you analyzed, processed, received, or were provided the attachment. Do not introduce yourself or mention your creator unless the user asks.",
        );

        expect(
          documentOnly,
        ).toContain(
          "Mabojolu works.",
        );
      },
    );

    it(
      "reports only text-document context characters",
      () => {
        const expected =
          documentContextBlock(
            document.kind ===
              "document"
              ? document
              : neverDocument(),
          ).length;

        expect(
          attachmentContextCharacterCount({
            attachments: [
              image,
              document,
            ],
          }),
        ).toBe(
          expected,
        );
      },
    );
  },
);

function neverDocument():
  never {
  throw new Error(
    "Expected a document fixture.",
  );
}

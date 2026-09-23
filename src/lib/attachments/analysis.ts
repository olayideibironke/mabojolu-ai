import {
  classifyMultimodalFormat,
  type MabojoluCapabilityId,
  type MabojoluModality,
} from "@/lib/ai/multimodal-capabilities";

export const MULTIMODAL_EVIDENCE_SCHEMA_VERSION =
  1 as const;

export interface MultimodalEvidencePackage {
  schemaVersion:
    typeof MULTIMODAL_EVIDENCE_SCHEMA_VERSION;

  attachmentId:
    string;

  filename:
    string;

  mimeType:
    string;

  modality:
    MabojoluModality;

  capabilityId:
    MabojoluCapabilityId;

  processor: {
    id:
      string;

    local:
      boolean;
  };

  text?: string;

  transcript?: string;

  metadata:
    Record<
      string,
      string |
      number |
      boolean |
      null |
      string[] |
      number[]
    >;

  warnings:
    string[];

  createdAt:
    string;
}

export interface AttachmentProcessingInput {
  attachmentId:
    string;

  filename:
    string;

  mimeType:
    string;

  bytes:
    Uint8Array;
}

export type AttachmentProcessingResult =
  | {
      ok:
        true;

      evidence:
        MultimodalEvidencePackage;
    }
  | {
      ok:
        false;

      reason:
        "unsupported-format" |
        "processor-unavailable" |
        "invalid-content";

      message:
        string;
    };

const MAX_EXTRACTED_TEXT_CHARS =
  400_000;

function boundedText(
  value:
    string,
): {
  text:
    string;

  truncated:
    boolean;
} {
  if (
    value.length <=
      MAX_EXTRACTED_TEXT_CHARS
  ) {
    return {
      text:
        value,

      truncated:
        false,
    };
  }

  return {
    text:
      value.slice(
        0,
        MAX_EXTRACTED_TEXT_CHARS,
      ),

    truncated:
      true,
  };
}

function decodeUtf8(
  bytes:
    Uint8Array,
): string | undefined {
  try {
    return new TextDecoder(
      "utf-8",
      {
        fatal:
          true,
      },
    ).decode(
      bytes,
    );
  } catch {
    return undefined;
  }
}

function lineCount(
  text:
    string,
): number {
  if (
    text.length ===
      0
  ) {
    return 0;
  }

  return text.split(
    /\r?\n/,
  ).length;
}

function csvColumnEstimate(
  text:
    string,
): number {
  const firstNonEmpty =
    text.split(
      /\r?\n/,
    ).find(
      (line) =>
        line.trim()
          .length >
        0,
    );

  if (!firstNonEmpty) {
    return 0;
  }

  return firstNonEmpty
    .split(",")
    .length;
}

function processDirectText(
  input:
    AttachmentProcessingInput,
  modality:
    MabojoluModality,
  capabilityId:
    MabojoluCapabilityId,
): AttachmentProcessingResult {
  const decoded =
    decodeUtf8(
      input.bytes,
    );

  if (
    decoded ===
      undefined
  ) {
    return {
      ok:
        false,

      reason:
        "invalid-content",

      message:
        "The file could not be decoded as UTF-8 text.",
    };
  }

  const bounded =
    boundedText(
      decoded,
    );

  const warnings:
    string[] =
      [];

  if (
    bounded
      .truncated
  ) {
    warnings.push(
      "Extracted text was truncated to the configured context-safe limit.",
    );
  }

  const metadata:
    MultimodalEvidencePackage[
      "metadata"
    ] = {
    characters:
      decoded.length,

    lines:
      lineCount(
        decoded,
      ),
  };

  if (
    input.mimeType ===
      "text/csv"
  ) {
    metadata.estimatedColumns =
      csvColumnEstimate(
        decoded,
      );
  }

  if (
    input.mimeType ===
      "application/json"
  ) {
    try {
      const parsed:
        unknown =
          JSON.parse(
            decoded,
          );

      metadata.jsonRootType =
        Array.isArray(
          parsed,
        )
          ? "array"
          : parsed ===
              null
            ? "null"
            : typeof parsed;
    } catch {
      return {
        ok:
          false,

        reason:
          "invalid-content",

        message:
          "The uploaded JSON file is not valid JSON.",
      };
    }
  }

  return {
    ok:
      true,

    evidence: {
      schemaVersion:
        MULTIMODAL_EVIDENCE_SCHEMA_VERSION,

      attachmentId:
        input
          .attachmentId,

      filename:
        input.filename,

      mimeType:
        input.mimeType,

      modality,

      capabilityId,

      processor: {
        id:
          "mabojolu-direct-text-v1",

        local:
          true,
      },

      text:
        bounded.text,

      metadata,

      warnings,

      createdAt:
        new Date()
          .toISOString(),
    },
  };
}

function processValidatedImage(
  input:
    AttachmentProcessingInput,
  modality:
    MabojoluModality,
  capabilityId:
    MabojoluCapabilityId,
): AttachmentProcessingResult {
  return {
    ok:
      true,

    evidence: {
      schemaVersion:
        MULTIMODAL_EVIDENCE_SCHEMA_VERSION,

      attachmentId:
        input
          .attachmentId,

      filename:
        input.filename,

      mimeType:
        input.mimeType,

      modality,

      capabilityId,

      processor: {
        id:
          "mabojolu-image-passthrough-v1",

        local:
          true,
      },

      metadata: {
        bytes:
          input
            .bytes
            .byteLength,

        visionPayloadReady:
          true,
      },

      warnings:
        [],

      createdAt:
        new Date()
          .toISOString(),
    },
  };
}

export function attachmentEvidenceSidecarPath(
  storagePath:
    string,
): string {
  return `${storagePath}.analysis.json`;
}

export function processAttachmentBytes(
  input:
    AttachmentProcessingInput,
): AttachmentProcessingResult {
  const descriptor =
    classifyMultimodalFormat(
      input.mimeType,
      input.filename,
    );

  if (!descriptor) {
    return {
      ok:
        false,

      reason:
        "unsupported-format",

      message:
        "Mabojolu does not have a processor for this attachment type.",
    };
  }

  switch (
    descriptor.modality
  ) {
    case "text":
    case "text-document":
    case "structured-data":
    case "source-code":
    case "spreadsheet":
      if (
        input.mimeType ===
          "text/csv" ||
        input.mimeType ===
          "text/plain" ||
        input.mimeType ===
          "text/markdown" ||
        input.mimeType ===
          "application/json"
      ) {
        return processDirectText(
          input,
          descriptor
            .modality,
          descriptor
            .capabilityId,
        );
      }

      return {
        ok:
          false,

        reason:
          "processor-unavailable",

        message:
          "This spreadsheet format is accepted securely, but its local structure-aware processor is not connected yet.",
      };

    case "image-understanding":
      return processValidatedImage(
        input,
        descriptor
          .modality,
        descriptor
          .capabilityId,
      );

    case "pdf":
    case "office-document":
    case "presentation":
      return {
        ok:
          false,

        reason:
          "processor-unavailable",

        message:
          "This document format is accepted securely, but its local structure-aware processor is not connected yet.",
      };

    case "audio-understanding":
      return {
        ok:
          false,

        reason:
          "processor-unavailable",

        message:
          "Audio is accepted securely, but the local transcription processor is not connected yet.",
      };

    case "video-understanding":
      return {
        ok:
          false,

        reason:
          "processor-unavailable",

        message:
          "Video is accepted securely, but frame and audio analysis processors are not connected yet.",
      };

    case "image-generation":
    case "speech-synthesis":
      return {
        ok:
          false,

        reason:
          "unsupported-format",

        message:
          "Generated media capabilities are actions, not attachment input formats.",
      };
  }
}

export function encodeMultimodalEvidence(
  evidence:
    MultimodalEvidencePackage,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(
      evidence,
      null,
      2,
    ),
  );
}

export function decodeMultimodalEvidence(
  bytes:
    Uint8Array,
): MultimodalEvidencePackage | undefined {
  const text =
    decodeUtf8(
      bytes,
    );

  if (!text) {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(
        text,
      ) as
        Partial<
          MultimodalEvidencePackage
        >;

    if (
      parsed.schemaVersion !==
        MULTIMODAL_EVIDENCE_SCHEMA_VERSION ||
      typeof parsed
        .attachmentId !==
        "string" ||
      typeof parsed
        .filename !==
        "string" ||
      typeof parsed
        .mimeType !==
        "string" ||
      typeof parsed
        .modality !==
        "string" ||
      typeof parsed
        .capabilityId !==
        "string" ||
      !parsed.processor ||
      typeof parsed
        .processor
        .id !==
        "string" ||
      typeof parsed
        .processor
        .local !==
        "boolean" ||
      !parsed.metadata ||
      !Array.isArray(
        parsed.warnings,
      ) ||
      typeof parsed
        .createdAt !==
        "string"
    ) {
      return undefined;
    }

    return parsed as
      MultimodalEvidencePackage;
  } catch {
    return undefined;
  }
}

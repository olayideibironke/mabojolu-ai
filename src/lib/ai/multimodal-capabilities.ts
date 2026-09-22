export type MabojoluModality =
  | "text"
  | "image-understanding"
  | "text-document"
  | "pdf"
  | "office-document"
  | "audio-understanding"
  | "video-understanding"
  | "image-generation";

export type MultimodalCapabilityState =
  | "ready"
  | "next"
  | "planned";

export interface MultimodalCapability {
  modality: MabojoluModality;
  state: MultimodalCapabilityState;
  localFirst: boolean;
  inputFormats: string[];
  notes: string;
}

export const MULTIMODAL_CAPABILITIES:
  readonly MultimodalCapability[] = [
  {
    modality:
      "text",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "plain text",
    ],

    notes:
      "Existing Mabojolu browser and local-provider text reasoning.",
  },
  {
    modality:
      "image-understanding",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "JPEG",
      "PNG",
      "WebP",
    ],

    notes:
      "Native image input through Chrome on-device multimodal Prompt API, with the existing Ollama vision contract retained for server-provider use.",
  },
  {
    modality:
      "text-document",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "TXT",
      "Markdown",
      "CSV",
      "JSON",
    ],

    notes:
      "UTF-8 text is extracted in the browser, bounded, labeled with filename and MIME type, and added to model context.",
  },
  {
    modality:
      "pdf",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "PDF",
    ],

    notes:
      "Storage validation already exists, but document parsing and page-aware model context are not yet enabled.",
  },
  {
    modality:
      "office-document",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "DOCX",
      "XLSX",
      "PPTX",
    ],

    notes:
      "Requires bounded client-side parsers and structure-aware extraction.",
  },
  {
    modality:
      "audio-understanding",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "recorded audio",
      "uploaded audio",
    ],

    notes:
      "Voice dictation already exists. File-level audio understanding will use a bounded on-device transcription/analysis path.",
  },
  {
    modality:
      "video-understanding",

    state:
      "planned",

    localFirst:
      true,

    inputFormats: [
      "uploaded video",
    ],

    notes:
      "Will combine bounded frame sampling, audio transcription, temporal metadata, and multimodal synthesis.",
  },
  {
    modality:
      "image-generation",

    state:
      "planned",

    localFirst:
      true,

    inputFormats: [
      "text-to-image",
      "image edit",
    ],

    notes:
      "Requires a separate local image-generation engine because the reasoning Prompt API produces text output.",
  },
] as const;

export function multimodalCapability(
  modality:
    MabojoluModality,
): MultimodalCapability {
  const capability =
    MULTIMODAL_CAPABILITIES.find(
      (
        candidate,
      ) =>
        candidate.modality ===
        modality,
    );

  if (
    !capability
  ) {
    throw new Error(
      `Unknown Mabojolu modality: ${modality}`,
    );
  }

  return capability;
}

export function readyMultimodalCapabilities():
  MultimodalCapability[] {
  return MULTIMODAL_CAPABILITIES
    .filter(
      (
        capability,
      ) =>
        capability.state ===
        "ready",
    )
    .map(
      (
        capability,
      ) => ({
        ...capability,

        inputFormats: [
          ...capability
            .inputFormats,
        ],
      }),
    );
}

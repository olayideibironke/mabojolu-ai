export type MabojoluModality =
  | "text"
  | "image-understanding"
  | "text-document"
  | "pdf"
  | "office-document"
  | "spreadsheet"
  | "presentation"
  | "structured-data"
  | "source-code"
  | "audio-understanding"
  | "video-understanding"
  | "image-generation"
  | "speech-synthesis";

export type MabojoluCapabilityId =
  | "text-generation"
  | "image-understanding"
  | "document-understanding"
  | "spreadsheet-analysis"
  | "presentation-analysis"
  | "structured-data-analysis"
  | "source-code-analysis"
  | "audio-transcription"
  | "audio-understanding"
  | "video-understanding"
  | "image-generation"
  | "speech-synthesis";

export type MultimodalCapabilityState =
  | "ready"
  | "next"
  | "planned";

export interface MultimodalCapability {
  modality: MabojoluModality;
  capabilityId: MabojoluCapabilityId;
  state: MultimodalCapabilityState;
  localFirst: boolean;
  inputFormats: string[];
  mimeTypes: string[];
  notes: string;
}

export interface MultimodalFormatDescriptor {
  mimeType: string;
  modality: MabojoluModality;
  capabilityId: MabojoluCapabilityId;
}

const MIME_CAPABILITIES: Readonly<
  Record<
    string,
    Omit<
      MultimodalFormatDescriptor,
      "mimeType"
    >
  >
> = {
  "text/plain": {
    modality:
      "text-document",
    capabilityId:
      "document-understanding",
  },

  "text/markdown": {
    modality:
      "text-document",
    capabilityId:
      "document-understanding",
  },

  "text/csv": {
    modality:
      "spreadsheet",
    capabilityId:
      "spreadsheet-analysis",
  },

  "application/json": {
    modality:
      "structured-data",
    capabilityId:
      "structured-data-analysis",
  },

  "application/pdf": {
    modality:
      "pdf",
    capabilityId:
      "document-understanding",
  },

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    modality:
      "office-document",
    capabilityId:
      "document-understanding",
  },

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    modality:
      "spreadsheet",
    capabilityId:
      "spreadsheet-analysis",
  },

  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    modality:
      "presentation",
    capabilityId:
      "presentation-analysis",
  },

  "image/png": {
    modality:
      "image-understanding",
    capabilityId:
      "image-understanding",
  },

  "image/jpeg": {
    modality:
      "image-understanding",
    capabilityId:
      "image-understanding",
  },

  "image/gif": {
    modality:
      "image-understanding",
    capabilityId:
      "image-understanding",
  },

  "image/webp": {
    modality:
      "image-understanding",
    capabilityId:
      "image-understanding",
  },

  "audio/wav": {
    modality:
      "audio-understanding",
    capabilityId:
      "audio-understanding",
  },

  "audio/mpeg": {
    modality:
      "audio-understanding",
    capabilityId:
      "audio-understanding",
  },

  "audio/flac": {
    modality:
      "audio-understanding",
    capabilityId:
      "audio-understanding",
  },

  "audio/ogg": {
    modality:
      "audio-understanding",
    capabilityId:
      "audio-understanding",
  },

  "audio/mp4": {
    modality:
      "audio-understanding",
    capabilityId:
      "audio-understanding",
  },

  "video/mp4": {
    modality:
      "video-understanding",
    capabilityId:
      "video-understanding",
  },

  "video/webm": {
    modality:
      "video-understanding",
    capabilityId:
      "video-understanding",
  },

  "video/quicktime": {
    modality:
      "video-understanding",
    capabilityId:
      "video-understanding",
  },
};

const SOURCE_EXTENSIONS =
  new Set([
    "py",
    "js",
    "jsx",
    "ts",
    "tsx",
    "css",
    "scss",
    "sql",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "log",
  ]);

export const MULTIMODAL_CAPABILITIES:
  readonly MultimodalCapability[] = [
  {
    modality:
      "text",

    capabilityId:
      "text-generation",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "plain text",
    ],

    mimeTypes: [
      "text/plain",
    ],

    notes:
      "Existing Mabojolu browser and local-provider text reasoning.",
  },
  {
    modality:
      "image-understanding",

    capabilityId:
      "image-understanding",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "JPEG",
      "PNG",
      "GIF",
      "WebP",
    ],

    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ],

    notes:
      "Existing local multimodal reasoning path. GIF analysis may use a representative decoded frame until temporal image sampling is enabled.",
  },
  {
    modality:
      "text-document",

    capabilityId:
      "document-understanding",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "TXT",
      "Markdown",
    ],

    mimeTypes: [
      "text/plain",
      "text/markdown",
    ],

    notes:
      "UTF-8 text is bounded, labeled with source metadata, and added to model context.",
  },
  {
    modality:
      "structured-data",

    capabilityId:
      "structured-data-analysis",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "JSON",
    ],

    mimeTypes: [
      "application/json",
    ],

    notes:
      "Structured UTF-8 data can already enter Mabojolu context and will gain schema-aware summaries through the universal processor.",
  },
  {
    modality:
      "source-code",

    capabilityId:
      "source-code-analysis",

    state:
      "ready",

    localFirst:
      true,

    inputFormats: [
      "Python",
      "JavaScript",
      "TypeScript",
      "CSS",
      "SQL",
      "XML",
      "YAML",
      "TOML",
      "INI",
      "logs",
    ],

    mimeTypes: [
      "text/plain",
    ],

    notes:
      "Source code is treated as inert text. Mabojolu analyzes it but does not execute an uploaded file automatically.",
  },
  {
    modality:
      "spreadsheet",

    capabilityId:
      "spreadsheet-analysis",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "CSV",
      "XLSX",
    ],

    mimeTypes: [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],

    notes:
      "CSV is already readable. XLSX requires structure-aware extraction from the stored OOXML container.",
  },
  {
    modality:
      "pdf",

    capabilityId:
      "document-understanding",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "PDF",
    ],

    mimeTypes: [
      "application/pdf",
    ],

    notes:
      "Secure storage validation is enabled. Page-aware text extraction and optional rendered-page vision remain to be connected.",
  },
  {
    modality:
      "office-document",

    capabilityId:
      "document-understanding",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "DOCX",
    ],

    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],

    notes:
      "Non-macro OOXML only. Extraction will preserve document order without executing embedded content.",
  },
  {
    modality:
      "presentation",

    capabilityId:
      "presentation-analysis",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "PPTX",
    ],

    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],

    notes:
      "Slide-aware text extraction and optional slide rendering are the processing path.",
  },
  {
    modality:
      "audio-understanding",

    capabilityId:
      "audio-understanding",

    state:
      "next",

    localFirst:
      true,

    inputFormats: [
      "WAV",
      "MP3",
      "FLAC",
      "OGG",
      "M4A",
    ],

    mimeTypes: [
      "audio/wav",
      "audio/mpeg",
      "audio/flac",
      "audio/ogg",
      "audio/mp4",
    ],

    notes:
      "Live microphone dictation exists. Uploaded audio needs local transcription plus acoustic metadata before reasoning.",
  },
  {
    modality:
      "video-understanding",

    capabilityId:
      "video-understanding",

    state:
      "planned",

    localFirst:
      true,

    inputFormats: [
      "MP4",
      "WebM",
      "MOV",
    ],

    mimeTypes: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],

    notes:
      "The target path combines bounded frame sampling, audio transcription, timing metadata, and multimodal synthesis.",
  },
  {
    modality:
      "image-generation",

    capabilityId:
      "image-generation",

    state:
      "planned",

    localFirst:
      true,

    inputFormats: [
      "text-to-image",
      "image edit",
    ],

    mimeTypes:
      [],

    notes:
      "A dedicated local image-generation engine is required because Mabojolu's reasoning models produce text, not pixels.",
  },
  {
    modality:
      "speech-synthesis",

    capabilityId:
      "speech-synthesis",

    state:
      "planned",

    localFirst:
      true,

    inputFormats: [
      "text-to-speech",
    ],

    mimeTypes:
      [],

    notes:
      "Speech output belongs to a dedicated local synthesis processor rather than the reasoning provider.",
  },
] as const;

export function normalizeMimeType(
  mimeType: string,
): string {
  return mimeType
    .split(";")[0]
    .trim()
    .toLowerCase();
}

export function attachmentExtension(
  filename: string,
): string {
  const lastDot =
    filename.lastIndexOf(
      ".",
    );

  if (
    lastDot <=
      0 ||
    lastDot ===
      filename.length -
      1
  ) {
    return "";
  }

  return filename
    .slice(
      lastDot +
        1,
    )
    .trim()
    .toLowerCase();
}

export function classifyMultimodalFormat(
  mimeType: string,
  filename = "",
): MultimodalFormatDescriptor | undefined {
  const normalized =
    normalizeMimeType(
      mimeType,
    );

  const extension =
    attachmentExtension(
      filename,
    );

  if (
    normalized ===
      "text/plain" &&
    SOURCE_EXTENSIONS.has(
      extension,
    )
  ) {
    return {
      mimeType:
        normalized,

      modality:
        "source-code",

      capabilityId:
        "source-code-analysis",
    };
  }

  const descriptor =
    MIME_CAPABILITIES[
      normalized
    ];

  if (!descriptor) {
    return undefined;
  }

  return {
    mimeType:
      normalized,

    ...descriptor,
  };
}

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

  return {
    ...capability,

    inputFormats: [
      ...capability
        .inputFormats,
    ],

    mimeTypes: [
      ...capability
        .mimeTypes,
    ],
  };
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

        mimeTypes: [
          ...capability
            .mimeTypes,
        ],
      }),
    );
}

export const UNIVERSAL_ASSISTANT_CAPABILITIES:
  readonly MabojoluCapabilityId[] = [
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
  ] as const;

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export type EditableMimeType =
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/json"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type FileEditResult =
  | { ok: true; bytes: Uint8Array; replacements: number }
  | { ok: false; code: "unsupported_format" | "text_not_found" | "invalid_archive"; message: string };

const OOXML_MIMES = new Set<EditableMimeType>([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function replaceAll(value: string, findText: string, replaceText: string): { value: string; count: number } {
  const pieces = value.split(findText);
  if (pieces.length === 1) return { value, count: 0 };
  return { value: pieces.join(replaceText), count: pieces.length - 1 };
}

function xmlEscapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function editFileBytes(input: {
  mimeType: EditableMimeType;
  bytes: Uint8Array;
  findText: string;
  replaceText: string;
}): FileEditResult {
  if (!input.findText) {
    return { ok: false, code: "text_not_found", message: "The text to replace cannot be empty." };
  }

  if (!OOXML_MIMES.has(input.mimeType)) {
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      return { ok: false, code: "unsupported_format", message: "The source file is not valid UTF-8 text." };
    }
    const edited = replaceAll(source, input.findText, input.replaceText);
    if (edited.count === 0) {
      return { ok: false, code: "text_not_found", message: "The requested text was not found in the source file." };
    }
    return { ok: true, bytes: new TextEncoder().encode(edited.value), replacements: edited.count };
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(input.bytes);
  } catch {
    return { ok: false, code: "invalid_archive", message: "The Office document container could not be read." };
  }

  const findXml = xmlEscapeText(input.findText);
  const replaceXml = xmlEscapeText(input.replaceText);
  let replacements = 0;
  const output: Record<string, Uint8Array> = {};

  for (const [name, bytes] of Object.entries(archive)) {
    if (!name.toLowerCase().endsWith(".xml")) {
      output[name] = bytes;
      continue;
    }
    const xml = strFromU8(bytes);
    const edited = replaceAll(xml, findXml, replaceXml);
    replacements += edited.count;
    output[name] = edited.count > 0 ? strToU8(edited.value) : bytes;
  }

  if (replacements === 0) {
    return {
      ok: false,
      code: "text_not_found",
      message:
        "The requested text was not found as a contiguous editable text run. Mabojolu left the original file unchanged.",
    };
  }

  return { ok: true, bytes: zipSync(output, { level: 6 }), replacements };
}

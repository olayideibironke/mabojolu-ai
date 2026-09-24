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
  | {
      ok: false;
      code: "unsupported_format" | "text_not_found" | "invalid_archive";
      message: string;
    };

const OOXML_MIMES = new Set<EditableMimeType>([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const XML_TEXT_PATTERN =
  /<(w:t|a:t|t)(\s[^>]*)?>([\s\S]*?)<\/\1>/g;

interface XmlTextNode {
  start: number;
  end: number;
  openTag: string;
  closeTag: string;
  rawText: string;
  text: string;
}

function replaceAll(
  value: string,
  findText: string,
  replaceText: string,
): { value: string; count: number } {
  const pieces = value.split(findText);
  if (pieces.length === 1) return { value, count: 0 };
  return { value: pieces.join(replaceText), count: pieces.length - 1 };
}

function xmlEscapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlDecodeText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTextNodes(xml: string): XmlTextNode[] {
  const nodes: XmlTextNode[] = [];
  for (const match of xml.matchAll(XML_TEXT_PATTERN)) {
    if (match.index === undefined) continue;
    const full = match[0];
    const rawText = match[3] ?? "";
    const rawOffset = full.indexOf(rawText);
    const openTag = full.slice(0, rawOffset);
    const closeTag = full.slice(rawOffset + rawText.length);
    nodes.push({
      start: match.index,
      end: match.index + full.length,
      openTag,
      closeTag,
      rawText,
      text: xmlDecodeText(rawText),
    });
  }
  return nodes;
}

function replaceAcrossXmlTextRuns(
  xml: string,
  findText: string,
  replaceText: string,
): { value: string; count: number } {
  let value = xml;
  let count = 0;

  while (true) {
    const nodes = xmlTextNodes(value);
    if (nodes.length === 0) break;

    const visibleText = nodes.map((node) => node.text).join("");
    const matchStart = visibleText.indexOf(findText);
    if (matchStart < 0) break;

    const matchEnd = matchStart + findText.length;
    let cursor = 0;
    let firstNode = -1;
    let lastNode = -1;
    let firstOffset = 0;
    let lastOffset = 0;

    for (let index = 0; index < nodes.length; index += 1) {
      const next = cursor + nodes[index].text.length;
      if (firstNode < 0 && matchStart >= cursor && matchStart < next) {
        firstNode = index;
        firstOffset = matchStart - cursor;
      }
      if (matchEnd > cursor && matchEnd <= next) {
        lastNode = index;
        lastOffset = matchEnd - cursor;
        break;
      }
      cursor = next;
    }

    if (firstNode < 0 || lastNode < 0) break;

    const first = nodes[firstNode];
    const last = nodes[lastNode];
    const prefix = first.text.slice(0, firstOffset);
    const suffix = last.text.slice(lastOffset);
    const replacement = xmlEscapeText(prefix + replaceText + suffix);

    let rebuilt = value.slice(0, first.start);
    rebuilt += first.openTag + replacement + first.closeTag;

    for (let index = firstNode + 1; index <= lastNode; index += 1) {
      const node = nodes[index];
      rebuilt += value.slice(nodes[index - 1].end, node.start);
      rebuilt += node.openTag + node.closeTag;
    }

    rebuilt += value.slice(last.end);
    value = rebuilt;
    count += 1;
  }

  return { value, count };
}

export function editFileBytes(input: {
  mimeType: EditableMimeType;
  bytes: Uint8Array;
  findText: string;
  replaceText: string;
}): FileEditResult {
  if (!input.findText) {
    return {
      ok: false,
      code: "text_not_found",
      message: "The text to replace cannot be empty.",
    };
  }

  if (!OOXML_MIMES.has(input.mimeType)) {
    let source: string;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      return {
        ok: false,
        code: "unsupported_format",
        message: "The source file is not valid UTF-8 text.",
      };
    }

    const edited = replaceAll(source, input.findText, input.replaceText);
    if (edited.count === 0) {
      return {
        ok: false,
        code: "text_not_found",
        message: "The requested text was not found in the source file.",
      };
    }

    return {
      ok: true,
      bytes: new TextEncoder().encode(edited.value),
      replacements: edited.count,
    };
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(input.bytes);
  } catch {
    return {
      ok: false,
      code: "invalid_archive",
      message: "The Office document container could not be read.",
    };
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
    const contiguous = replaceAll(xml, findXml, replaceXml);

    if (contiguous.count > 0) {
      replacements += contiguous.count;
      output[name] = strToU8(contiguous.value);
      continue;
    }

    const splitRuns = replaceAcrossXmlTextRuns(
      xml,
      input.findText,
      input.replaceText,
    );

    replacements += splitRuns.count;
    output[name] =
      splitRuns.count > 0
        ? strToU8(splitRuns.value)
        : bytes;
  }

  if (replacements === 0) {
    return {
      ok: false,
      code: "text_not_found",
      message:
        "The requested text was not found in editable Office text. Mabojolu left the original file unchanged.",
    };
  }

  return {
    ok: true,
    bytes: zipSync(output, { level: 6 }),
    replacements,
  };
}

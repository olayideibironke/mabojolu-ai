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
  const nodes =
    xmlTextNodes(
      xml,
    );

  if (nodes.length === 0) {
    return {
      value: xml,
      count: 0,
    };
  }

  const visibleText =
    nodes
      .map(
        (node) =>
          node.text,
      )
      .join("");

  const matchStart =
    visibleText.indexOf(
      findText,
    );

  if (matchStart < 0) {
    return {
      value: xml,
      count: 0,
    };
  }

  const matchEnd =
    matchStart +
    findText.length;

  let cursor = 0;
  let firstNode = -1;
  let lastNode = -1;
  let firstOffset = 0;
  let lastOffset = 0;

  for (
    let index = 0;
    index < nodes.length;
    index += 1
  ) {
    const next =
      cursor +
      nodes[index].text.length;

    if (
      firstNode < 0 &&
      matchStart >= cursor &&
      matchStart < next
    ) {
      firstNode =
        index;

      firstOffset =
        matchStart -
        cursor;
    }

    if (
      matchEnd > cursor &&
      matchEnd <= next
    ) {
      lastNode =
        index;

      lastOffset =
        matchEnd -
        cursor;

      break;
    }

    cursor =
      next;
  }

  if (
    firstNode < 0 ||
    lastNode < 0
  ) {
    return {
      value: xml,
      count: 0,
    };
  }

  const first =
    nodes[firstNode];

  const last =
    nodes[lastNode];

  const prefix =
    first.text.slice(
      0,
      firstOffset,
    );

  const suffix =
    last.text.slice(
      lastOffset,
    );

  const replacement =
    xmlEscapeText(
      prefix +
      replaceText +
      suffix,
    );

  let rebuilt =
    xml.slice(
      0,
      first.start,
    );

  rebuilt +=
    first.openTag +
    replacement +
    first.closeTag;

  for (
    let index =
      firstNode + 1;
    index <= lastNode;
    index += 1
  ) {
    const node =
      nodes[index];

    rebuilt +=
      xml.slice(
        nodes[index - 1]
          .end,
        node.start,
      );

    rebuilt +=
      node.openTag +
      node.closeTag;
  }

  rebuilt +=
    xml.slice(
      last.end,
    );

  return {
    value: rebuilt,
    count: 1,
  };
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

  let replacements = 0;
  const output: Record<string, Uint8Array> = {
    ...archive,
  };

  const editablePartNames =
    Object.keys(archive).filter((name) => {
      const normalized =
        name.toLowerCase();

      if (
        input.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        return (
          normalized ===
            "word/document.xml" ||
          /^word\/(?:header|footer)\d+\.xml$/.test(
            normalized,
          )
        );
      }

      if (
        input.mimeType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        return /^ppt\/slides\/slide\d+\.xml$/.test(
          normalized,
        );
      }

      return (
        normalized ===
          "xl/sharedstrings.xml" ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(
          normalized,
        )
      );
    });

  editablePartNames.sort((first, second) => {
    const priority = (name: string): number => {
      const normalized =
        name.toLowerCase();

      if (
        normalized ===
          "word/document.xml" ||
        normalized ===
          "xl/sharedstrings.xml"
      ) {
        return 0;
      }

      return 1;
    };

    return (
      priority(first) -
        priority(second) ||
      first.localeCompare(
        second,
        undefined,
        {
          numeric: true,
        },
      )
    );
  });

  for (const name of editablePartNames) {
    const bytes =
      archive[name];

    const edited =
      replaceAcrossXmlTextRuns(
        strFromU8(bytes),
        input.findText,
        input.replaceText,
      );

    if (edited.count > 0) {
      output[name] =
        strToU8(
          edited.value,
        );

      replacements =
        1;

      break;
    }
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

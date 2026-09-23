import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";

export const runtime = "nodejs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnName(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    result = String.fromCharCode(65 + r) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function parseRows(content: string): string[][] {
  const lines = content.replace(/\r\n/g, "\n").trim().split("\n").filter(Boolean);
  const delimiter = lines.some((line) => line.includes("|")) ? "|" : lines.some((line) => line.includes("\t")) ? "\t" : ",";
  return lines.map((line) => {
    const clean = delimiter === "|" ? line.replace(/^\s*\|/, "").replace(/\|\s*$/, "") : line;
    return clean.split(delimiter).map((value) => value.trim());
  });
}

function cellXml(value: string, row: number, column: number): string {
  const ref = `${columnName(column)}${row + 1}`;
  if (/^-?(?:\d+|\d*\.\d+)$/.test(value)) {
    return `<c r="${ref}"><v>${Number(value)}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function makeXlsx(rows: string[][]): Uint8Array {
  const sheetData = rows.map((values, row) =>
    `<row r="${row + 1}">${values.map((value, column) => cellXml(value, row, column)).join("")}</row>`
  ).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Mabojolu Output" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`),
  };
  return zipSync(files, { level: 6 });
}

export async function POST(request: Request) {
  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "The spreadsheet request was invalid." } }, { status: 400 });
  }

  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: { message: "Spreadsheet content is required." } }, { status: 400 });
  }
  if (body.content.length > 200_000) {
    return NextResponse.json({ error: { message: "The requested spreadsheet is too large." } }, { status: 413 });
  }

  const rows = parseRows(body.content);
  const bytes = makeXlsx(rows);
  return NextResponse.json({
    file: {
      name: "mabojolu-output.xlsx",
      mimeType: XLSX_MIME,
      sizeBytes: bytes.byteLength,
      dataUrl: `data:${XLSX_MIME};base64,${Buffer.from(bytes).toString("base64")}`,
    },
  });
}

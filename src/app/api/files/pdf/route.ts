import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pdfEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function latin1Safe(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function makePdf(content: string): Buffer {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => {
      const text = latin1Safe(line);
      if (text.length <= 88) return [text];
      const parts: string[] = [];
      for (let i = 0; i < text.length; i += 88) parts.push(text.slice(i, i + 88));
      return parts;
    });

  const streamParts = ["BT", "/F1 12 Tf", "72 720 Td", "16 TL"];
  lines.forEach((line, index) => {
    if (index > 0) streamParts.push("T*");
    streamParts.push(`(${pdfEscape(line)}) Tj`);
  });
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}

export async function POST(request: Request) {
  let body: { content?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { message: "The PDF request was invalid." } }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: { message: "PDF content is required." } }, { status: 400 });
  }
  if (body.content.length > 50_000) {
    return NextResponse.json({ error: { message: "The requested PDF is too large for this output path." } }, { status: 413 });
  }

  const bytes = makePdf(body.content.trim());
  return NextResponse.json({
    file: {
      name: "mabojolu-output.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      dataUrl: `data:application/pdf;base64,${bytes.toString("base64")}`,
    },
  });
}

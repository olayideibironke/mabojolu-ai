import { NextResponse } from "next/server";

export const runtime = "nodejs";

function utf16BeHex(value: string): string {
  const units: number[] = [0xfe, 0xff];

  for (const character of value) {
    const codePoint =
      character.codePointAt(0) ?? 0;

    if (codePoint <= 0xffff) {
      units.push(
        (codePoint >> 8) & 0xff,
        codePoint & 0xff,
      );
      continue;
    }

    const adjusted =
      codePoint - 0x10000;
    const high =
      0xd800 +
      (adjusted >> 10);
    const low =
      0xdc00 +
      (adjusted & 0x3ff);

    units.push(
      (high >> 8) & 0xff,
      high & 0xff,
      (low >> 8) & 0xff,
      low & 0xff,
    );
  }

  return units
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
}

function makePdf(
  content: string,
): Buffer {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n");

  const streamParts = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    "16 TL",
  ];

  lines.forEach(
    (line, index) => {
      if (index > 0) {
        streamParts.push("T*");
      }

      streamParts.push(
        `<${utf16BeHex(line)}> Tj`,
      );
    },
  );

  streamParts.push("ET");

  const stream =
    streamParts.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(
      stream,
      "ascii",
    )} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type0 /BaseFont /ArialUnicodeMS /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 8 0 R >>",
    "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ArialUnicodeMS /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /CIDToGIDMap /Identity /DW 1000 >>",
    "<< /Type /FontDescriptor /FontName /ArialUnicodeMS /Flags 32 /FontBBox [-1011 -330 2260 1078] /ItalicAngle 0 /Ascent 905 /Descent -212 /CapHeight 716 /StemV 80 >>",
    `<< /Length ${Buffer.byteLength(
      `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0000> <FFFF> <0000>
endbfrange
endcmap
CMapName currentdict /CMap defineresource pop
end
end`,
      "ascii",
    )} >>\nstream
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0000> <FFFF> <0000>
endbfrange
endcmap
CMapName currentdict /CMap defineresource pop
end
end
endstream`,
  ];

  let output =
    "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach(
    (object, index) => {
      offsets.push(
        Buffer.byteLength(
          output,
          "ascii",
        ),
      );

      output +=
        `${index + 1} 0 obj\n${object}\nendobj\n`;
    },
  );

  const xref =
    Buffer.byteLength(
      output,
      "ascii",
    );

  output +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (
    let index = 1;
    index <= objects.length;
    index += 1
  ) {
    output +=
      `${String(
        offsets[index],
      ).padStart(
        10,
        "0",
      )} 00000 n \n`;
  }

  output +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(
    output,
    "ascii",
  );
}

export async function POST(
  request: Request,
) {
  let body: {
    content?: unknown;
  };

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message:
            "The PDF request was invalid.",
        },
      },
      { status: 400 },
    );
  }

  if (
    typeof body.content !==
      "string" ||
    !body.content.trim()
  ) {
    return NextResponse.json(
      {
        error: {
          message:
            "PDF content is required.",
        },
      },
      { status: 400 },
    );
  }

  if (
    body.content.length >
    50_000
  ) {
    return NextResponse.json(
      {
        error: {
          message:
            "The requested PDF is too large for this output path.",
        },
      },
      { status: 413 },
    );
  }

  const bytes =
    makePdf(
      body.content.trim(),
    );

  return NextResponse.json({
    file: {
      name:
        "mabojolu-output.pdf",
      mimeType:
        "application/pdf",
      sizeBytes:
        bytes.byteLength,
      dataUrl:
        `data:application/pdf;base64,${bytes.toString(
          "base64",
        )}`,
    },
  });
}

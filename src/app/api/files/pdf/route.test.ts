import { describe, expect, it } from "vitest";

import { POST } from "./route";

function request(content: string): Request {
  return new Request("http://localhost/api/files/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

function utf16BeHex(value: string): string {
  const bytes: number[] = [0xfe, 0xff];
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0xffff) {
      bytes.push((codePoint >> 8) & 0xff, codePoint & 0xff);
    } else {
      const adjusted = codePoint - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      bytes.push((high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff);
    }
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

describe("PDF file route", () => {
  it("returns a PDF with Unicode CID text for accented and naira characters", async () => {
    const content = "Mabojolu PDF Output Qualification\nUnicode check: café, ₦42,500, Maryland.";
    const response = await POST(request(content));
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      file: { name: string; mimeType: string; sizeBytes: number; dataUrl: string };
    };

    expect(payload.file.name).toBe("mabojolu-output.pdf");
    expect(payload.file.mimeType).toBe("application/pdf");

    const bytes = Buffer.from(payload.file.dataUrl.split(",")[1], "base64");
    expect(bytes.byteLength).toBe(payload.file.sizeBytes);

    const pdf = bytes.toString("ascii");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Subtype /Type0");
    expect(pdf).toContain("/Encoding /Identity-H");
    expect(pdf).toContain("<" + utf16BeHex("Unicode check: café, ₦42,500, Maryland.") + "> Tj");
    expect(pdf.endsWith("%%EOF\n")).toBe(true);
  });
});

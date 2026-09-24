import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { POST } from "./route";

const MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function request(content: string): Request {
  return new Request("http://localhost/api/files/docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

describe("DOCX file route", () => {
  it("returns a genuine OOXML document and preserves Unicode text", async () => {
    const response = await POST(request("Mabojolu DOCX\nUnicode: café, ₦42,500"));
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      file: { name: string; mimeType: string; sizeBytes: number; dataUrl: string };
    };

    expect(payload.file.name).toBe("mabojolu-output.docx");
    expect(payload.file.mimeType).toBe(MIME);

    const bytes = Buffer.from(payload.file.dataUrl.split(",")[1], "base64");
    expect(bytes.byteLength).toBe(payload.file.sizeBytes);
    expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");

    const archive = unzipSync(bytes);
    expect(archive["[Content_Types].xml"]).toBeDefined();
    expect(archive["word/document.xml"]).toBeDefined();

    const documentXml = strFromU8(archive["word/document.xml"]);
    expect(documentXml).toContain("Mabojolu DOCX");
    expect(documentXml).toContain("café, ₦42,500");
  });
});

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { POST } from "./route";

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function request(content: string): Request {
  return new Request("http://localhost/api/files/xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

describe("XLSX file route", () => {
  it("returns a genuine workbook with numeric cells and Unicode strings", async () => {
    const response = await POST(
      request("Project|Target|Status\nKoruva|70000|Validation\nCafé|42500|₦"),
    );
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      file: { name: string; mimeType: string; sizeBytes: number; dataUrl: string };
    };

    expect(payload.file.name).toBe("mabojolu-output.xlsx");
    expect(payload.file.mimeType).toBe(MIME);

    const bytes = Buffer.from(payload.file.dataUrl.split(",")[1], "base64");
    expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");

    const archive = unzipSync(bytes);
    const workbookXml = strFromU8(archive["xl/workbook.xml"]);
    const sheetXml = strFromU8(archive["xl/worksheets/sheet1.xml"]);

    expect(workbookXml).toContain('name="Mabojolu Output"');
    expect(sheetXml).toContain('<c r="B2"><v>70000</v></c>');
    expect(sheetXml).toContain("Café");
    expect(sheetXml).toContain("₦");
  });
});

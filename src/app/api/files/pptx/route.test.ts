import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { POST } from "./route";

const MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function request(content: string): Request {
  return new Request("http://localhost/api/files/pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

describe("PPTX file route", () => {
  it("returns a genuine presentation with the requested slides and Unicode", async () => {
    const response = await POST(
      request("Slide 1: Mabojolu\nGenuine presentation\n\nSlide 2: Westforge\nUnicode café, ₦42,500"),
    );
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      file: { name: string; mimeType: string; sizeBytes: number; dataUrl: string };
    };

    expect(payload.file.name).toBe("mabojolu-output.pptx");
    expect(payload.file.mimeType).toBe(MIME);

    const bytes = Buffer.from(payload.file.dataUrl.split(",")[1], "base64");
    expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");

    const archive = unzipSync(bytes);
    expect(archive["ppt/slides/slide1.xml"]).toBeDefined();
    expect(archive["ppt/slides/slide2.xml"]).toBeDefined();
    expect(archive["ppt/slides/slide3.xml"]).toBeUndefined();

    expect(strFromU8(archive["ppt/slides/slide1.xml"])).toContain("Mabojolu");
    expect(strFromU8(archive["ppt/slides/slide2.xml"])).toContain("café, ₦42,500");
  });
});

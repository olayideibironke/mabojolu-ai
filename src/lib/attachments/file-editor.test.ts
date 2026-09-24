import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { editFileBytes } from "./file-editor";

describe("editFileBytes", () => {
  it("replaces exact UTF-8 text without changing unrelated content", () => {
    const result = editFileBytes({
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("Alpha\nTarget café ₦42,500\nOmega"),
      findText: "Target café ₦42,500",
      replaceText: "Target café ₦70,000",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new TextDecoder().decode(result.bytes)).toBe("Alpha\nTarget café ₦70,000\nOmega");
    expect(result.replacements).toBe(1);
  });

  it("preserves unrelated OOXML parts while replacing contiguous document text", () => {
    const original = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8("<w:document><w:t>Old value</w:t><w:t>Keep me</w:t></w:document>"),
      "word/media/image1.png": new Uint8Array([1, 2, 3, 4]),
    });
    const result = editFileBytes({
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Old value",
      replaceText: "New & better value",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archive = unzipSync(result.bytes);
    expect(strFromU8(archive["word/document.xml"])).toContain("New &amp; better value");
    expect(strFromU8(archive["word/document.xml"])).toContain("Keep me");
    expect(Array.from(archive["word/media/image1.png"])).toEqual([1, 2, 3, 4]);
  });

  it("refuses a non-contiguous OOXML replacement instead of rebuilding the file", () => {
    const original = zipSync({
      "word/document.xml": strToU8("<w:document><w:t>Split </w:t><w:t>text</w:t></w:document>"),
    });
    const result = editFileBytes({
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Split text",
      replaceText: "Changed",
    });
    expect(result).toMatchObject({ ok: false, code: "text_not_found" });
  });
});

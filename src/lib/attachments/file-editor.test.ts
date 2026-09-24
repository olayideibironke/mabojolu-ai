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
    expect(new TextDecoder().decode(result.bytes)).toBe(
      "Alpha\nTarget café ₦70,000\nOmega",
    );
    expect(result.replacements).toBe(1);
  });

  it("preserves unrelated OOXML parts while replacing contiguous document text", () => {
    const original = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8(
        "<w:document><w:t>Old value</w:t><w:t>Keep me</w:t></w:document>",
      ),
      "word/media/image1.png": new Uint8Array([1, 2, 3, 4]),
    });
    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Old value",
      replaceText: "New & better value",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archive = unzipSync(result.bytes);
    expect(strFromU8(archive["word/document.xml"])).toContain(
      "New &amp; better value",
    );
    expect(strFromU8(archive["word/document.xml"])).toContain("Keep me");
    expect(Array.from(archive["word/media/image1.png"])).toEqual([1, 2, 3, 4]);
  });

  it("edits Word text split across styled runs while preserving run markup", () => {
    const documentXml =
      '<w:document><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Split </w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t>text</w:t></w:r>' +
      '<w:r><w:t> stays</w:t></w:r></w:p></w:document>';
    const original = zipSync({
      "word/document.xml": strToU8(documentXml),
      "word/media/image1.png": new Uint8Array([9, 8, 7]),
    });

    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Split text",
      replaceText: "Changed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archive = unzipSync(result.bytes);
    const edited = strFromU8(archive["word/document.xml"]);
    expect(edited).toContain("<w:rPr><w:b/></w:rPr>");
    expect(edited).toContain("<w:rPr><w:i/></w:rPr>");
    expect(edited).toContain("<w:t>Changed</w:t>");
    expect(edited).toContain("<w:t></w:t>");
    expect(edited).toContain("<w:t> stays</w:t>");
    expect(Array.from(archive["word/media/image1.png"])).toEqual([9, 8, 7]);
  });

  it("edits PowerPoint text split across runs without rebuilding the slide", () => {
    const slideXml =
      '<p:sld><a:p><a:r><a:rPr b="1"/><a:t>Quarterly </a:t></a:r>' +
      '<a:r><a:rPr i="1"/><a:t>target</a:t></a:r>' +
      '<a:r><a:t> remains</a:t></a:r></a:p></p:sld>';
    const original = zipSync({
      "ppt/slides/slide1.xml": strToU8(slideXml),
      "ppt/media/image1.png": new Uint8Array([5, 4, 3]),
    });

    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      bytes: original,
      findText: "Quarterly target",
      replaceText: "Annual target",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archive = unzipSync(result.bytes);
    const edited = strFromU8(archive["ppt/slides/slide1.xml"]);
    expect(edited).toContain('<a:rPr b="1"/>');
    expect(edited).toContain('<a:rPr i="1"/>');
    expect(edited).toContain("<a:t>Annual target</a:t>");
    expect(edited).toContain("<a:t></a:t>");
    expect(edited).toContain("<a:t> remains</a:t>");
    expect(Array.from(archive["ppt/media/image1.png"])).toEqual([5, 4, 3]);
  });

  it("preserves prefix and suffix when a split-run replacement starts and ends mid-run", () => {
    const original = zipSync({
      "word/document.xml": strToU8(
        "<w:document><w:t>Before Old </w:t><w:t>value After</w:t></w:document>",
      ),
    });

    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Old value",
      replaceText: "New value",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const archive = unzipSync(result.bytes);
    expect(strFromU8(archive["word/document.xml"])).toContain(
      "<w:t>Before New value After</w:t><w:t></w:t>",
    );
  });


  it("edits the first visible Word occurrence even when it is split and a later copy is contiguous", () => {
    const documentXml =
      '<w:document><w:p><w:r><w:t>Qualification target: Westforge </w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t>Quarterly </w:t></w:r>' +
      '<w:r><w:t>Target is currently $25,000.</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>Instruction: Change &quot;Westforge Quarterly Target&quot; to something else.</w:t></w:r></w:p></w:document>';
    const original = zipSync({
      "word/document.xml": strToU8(documentXml),
    });

    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Westforge Quarterly Target",
      replaceText: "Westforge Annual Target",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const edited = strFromU8(
      unzipSync(result.bytes)["word/document.xml"],
    );

    expect(edited).toContain(
      "<w:t>Qualification target: Westforge Annual Target is currently $25,000.</w:t>",
    );
    expect(edited).toContain(
      "Instruction: Change &quot;Westforge Quarterly Target&quot; to something else.",
    );
    expect(result.replacements).toBe(1);
  });

  it("leaves the Office package untouched when the requested visible text is absent", () => {
    const original = zipSync({
      "word/document.xml": strToU8(
        "<w:document><w:t>Split </w:t><w:t>text</w:t></w:document>",
      ),
    });

    const result = editFileBytes({
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: original,
      findText: "Missing text",
      replaceText: "Changed",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "text_not_found",
    });
  });
});

import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";

export const runtime = "nodejs";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseSlides(content: string): Array<{ title: string; body: string[] }> {
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/).filter(Boolean);
  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const first = lines[0] ?? `Slide ${index + 1}`;
    const title = first.replace(/^slide\s+\d+\s*[:.-]?\s*/i, "").trim() || `Slide ${index + 1}`;
    return { title, body: lines.slice(1) };
  });
}

function slideXml(title: string, body: string[]): string {
  const bodyRuns = body.map((line) => `<a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="7772400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3200" b="1"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1600200"/><a:ext cx="7772400" cy="4572000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${bodyRuns || "<a:p/>"}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function makePptx(slides: Array<{ title: string; body: string[] }>): Uint8Array {
  const overrides = slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const slideIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("");
  const rels = slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${overrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`),
    "ppt/presentation.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000" type="screen4x3"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`),
    "ppt/_rels/presentation.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`),
  };
  slides.forEach((slide, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(slideXml(slide.title, slide.body));
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  });
  return zipSync(files, { level: 6 });
}

export async function POST(request: Request) {
  let body: { content?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: { message: "The presentation request was invalid." } }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: { message: "Presentation content is required." } }, { status: 400 });
  }
  if (body.content.length > 200_000) {
    return NextResponse.json({ error: { message: "The requested presentation is too large." } }, { status: 413 });
  }

  const slides = parseSlides(body.content);
  const bytes = makePptx(slides);
  return NextResponse.json({
    file: {
      name: "mabojolu-output.pptx",
      mimeType: PPTX_MIME,
      sizeBytes: bytes.byteLength,
      dataUrl: `data:${PPTX_MIME};base64,${Buffer.from(bytes).toString("base64")}`,
    },
  });
}

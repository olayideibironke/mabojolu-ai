import { describe, expect, it } from "vitest";
import { editFileBytes } from "@/lib/attachments/file-editor";

describe("preservation-safe PDF edit contract", () => {
  it("keeps an equal-width direct PDF edit byte-preserving", () => {
    const source = new TextEncoder().encode(
      "%PDF-1.4\nstream\nBT (Quarterly) Tj (Control Quarterly) Tj ET\nendstream\n%%EOF",
    );

    const result = editFileBytes({
      mimeType: "application/pdf",
      bytes: source,
      findText: "Quarterly",
      replaceText: "YearlyPla",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.bytes.byteLength).toBe(source.byteLength);
    expect(new TextDecoder().decode(result.bytes)).toBe(
      "%PDF-1.4\nstream\nBT (YearlyPla) Tj (Control Quarterly) Tj ET\nendstream\n%%EOF",
    );
    expect(result.replacements).toBe(1);
  });

  it("refuses unequal-width PDF replacement rather than rebuilding", () => {
    const result = editFileBytes({
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode(
        "%PDF-1.4\nstream\nBT (Quarterly) Tj ET\nendstream\n%%EOF",
      ),
      findText: "Quarterly",
      replaceText: "Annual",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "unsupported_format",
    });
  });
});

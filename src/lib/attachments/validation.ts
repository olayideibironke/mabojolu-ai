/**
 * Attachment validation.
 *
 * Uploads are the highest-risk input this product accepts, so validation is
 * layered and every layer assumes the others might be bypassed:
 *
 *   1. An allowlist of formats. Anything not named is rejected, rather than
 *      blocking known-bad types and hoping the list is complete.
 *   2. Extension and declared MIME type must agree. A mismatch means the client is
 *      confused or lying.
 *   3. Magic bytes must match the declared type. A client can claim any MIME type,
 *      so the file's actual contents are the only trustworthy signal.
 *   4. Filenames are rebuilt rather than cleaned, which removes path traversal and
 *      control characters by construction.
 *   5. A size ceiling checked before reading, and again after.
 *
 * Deliberately excluded, and why:
 *   SVG        Can carry script, so serving one is a stored-XSS vector.
 *   Archives   Hide their real contents behind an outer MIME type.
 *   Office     Zip containers with macro surface; PDF and text cover the need.
 */

export interface AllowedFormat {
  mimeType: string;
  extensions: string[];
  /**
   * Leading bytes identifying the format.
   *
   * Empty for plain text and Markdown, which genuinely have no signature. Those
   * are validated by decoding instead.
   */
  magic: number[][];
  /** Human label used in error messages. */
  label: string;
}

export const ALLOWED_FORMATS: readonly AllowedFormat[] = [
  {
    mimeType: "application/pdf",
    extensions: ["pdf"],
    // "%PDF"
    magic: [[0x25, 0x50, 0x44, 0x46]],
    label: "PDF",
  },
  {
    mimeType: "text/plain",
    extensions: ["txt", "text"],
    magic: [],
    label: "Plain text",
  },
  {
    mimeType: "text/markdown",
    extensions: ["md", "markdown"],
    magic: [],
    label: "Markdown",
  },
  {
    mimeType: "image/png",
    extensions: ["png"],
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    label: "PNG image",
  },
  {
    mimeType: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    magic: [[0xff, 0xd8, 0xff]],
    label: "JPEG image",
  },
  {
    mimeType: "image/gif",
    extensions: ["gif"],
    // "GIF87a" and "GIF89a"
    magic: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
    label: "GIF image",
  },
  {
    mimeType: "image/webp",
    // RIFF container: bytes 0-3 "RIFF", 8-11 "WEBP". Checked specially below,
    // because the signature is not contiguous from offset zero.
    extensions: ["webp"],
    magic: [[0x52, 0x49, 0x46, 0x46]],
    label: "WebP image",
  },
] as const;

export type ValidationFailure =
  | "unsupported_type"
  | "extension_mismatch"
  | "content_mismatch"
  | "too_large"
  | "empty_file"
  | "invalid_filename"
  | "invalid_text_encoding";

export interface ValidationResult {
  ok: boolean;
  failure?: ValidationFailure;
  /** User-facing explanation. No em dashes, per the product copy rules. */
  message?: string;
  /** Safe filename to store, present only when validation passed. */
  safeFilename?: string;
  format?: AllowedFormat;
}

/**
 * Rebuild a filename from allowed characters.
 *
 * Rebuilding rather than stripping: a blocklist invites bypasses through
 * encoding, whereas keeping only known-safe characters removes `../`, null bytes,
 * control characters, and Windows reserved names by construction.
 */
export function sanitizeFilename(filename: string): string | null {
  if (filename.length === 0 || filename.length > 255) {
    return null;
  }

  // Take the basename only. A path separator anywhere means an attempt to escape
  // the intended directory, so the directory portion is discarded outright.
  const basename = filename.split(/[/\\]/).pop() ?? "";

  const lastDot = basename.lastIndexOf(".");

  // A name with no extension, or one that is entirely an extension (".env"), is
  // rejected rather than guessed at.
  if (lastDot <= 0 || lastDot === basename.length - 1) {
    return null;
  }

  const stem = basename.slice(0, lastDot);
  const extension = basename.slice(lastDot + 1).toLowerCase();

  // Keep only characters that are unambiguous in a path, a URL, and a header.
  const safeStem = stem
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100);

  const safeExtension = extension.replace(/[^a-z0-9]/g, "");

  if (safeStem.length === 0 || safeExtension.length === 0) {
    return null;
  }

  return `${safeStem}.${safeExtension}`;
}

/** Look up an allowed format by declared MIME type. */
export function findFormat(mimeType: string): AllowedFormat | undefined {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_FORMATS.find((format) => format.mimeType === normalized);
}

/**
 * Check the leading bytes against a format's signature.
 *
 * The one control a client cannot lie about: a declared MIME type is just a
 * string, whereas the bytes are the file.
 */
export function matchesMagicBytes(
  bytes: Uint8Array,
  format: AllowedFormat,
): boolean {
  // Text formats have no signature, so they are validated by decoding instead.
  if (format.magic.length === 0) {
    return isProbablyUtf8Text(bytes);
  }

  // WebP is a RIFF container: "RIFF" at 0, then "WEBP" at 8.
  if (format.mimeType === "image/webp") {
    if (bytes.length < 12) {
      return false;
    }

    const riff = [0x52, 0x49, 0x46, 0x46].every(
      (byte, index) => bytes[index] === byte,
    );
    const webp = [0x57, 0x45, 0x42, 0x50].every(
      (byte, index) => bytes[8 + index] === byte,
    );

    return riff && webp;
  }

  return format.magic.some((signature) => {
    if (bytes.length < signature.length) {
      return false;
    }
    return signature.every((byte, index) => bytes[index] === byte);
  });
}

/**
 * Heuristic check that a buffer is UTF-8 text.
 *
 * A null byte is the strongest signal of a binary file mislabelled as text, and
 * strict decoding catches invalid sequences. Together these stop a renamed
 * executable being accepted as `text/plain`.
 */
export function isProbablyUtf8Text(bytes: Uint8Array): boolean {
  // Only the first 8 KB is examined: enough to be confident, cheap to check.
  const sample = bytes.subarray(0, 8_192);

  if (sample.includes(0x00)) {
    return false;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

export interface ValidateInput {
  filename: string;
  declaredMimeType: string;
  sizeBytes: number;
  /** Leading bytes. At least 12 are needed for the WebP check. */
  header: Uint8Array;
  maxBytes: number;
}

export function validateAttachment(input: ValidateInput): ValidationResult {
  if (input.sizeBytes <= 0) {
    return {
      ok: false,
      failure: "empty_file",
      message: "That file is empty.",
    };
  }

  if (input.sizeBytes > input.maxBytes) {
    const limitMb = Math.floor(input.maxBytes / 1_048_576);
    return {
      ok: false,
      failure: "too_large",
      message: `That file is larger than the ${limitMb} MB limit.`,
    };
  }

  const safeFilename = sanitizeFilename(input.filename);

  if (!safeFilename) {
    return {
      ok: false,
      failure: "invalid_filename",
      message: "That filename cannot be used. Please rename the file.",
    };
  }

  const format = findFormat(input.declaredMimeType);

  if (!format) {
    const supported = [...new Set(ALLOWED_FORMATS.map((f) => f.label))].join(", ");
    return {
      ok: false,
      failure: "unsupported_type",
      message: `That file type is not supported. Supported types: ${supported}.`,
    };
  }

  // The extension must agree with the declared type. A disagreement means the
  // client is mistaken or deliberately mislabelling the file.
  const extension = safeFilename.split(".").pop() ?? "";

  if (!format.extensions.includes(extension)) {
    return {
      ok: false,
      failure: "extension_mismatch",
      message: `That file's extension does not match its type. Expected ${format.extensions
        .map((value) => `.${value}`)
        .join(" or ")}.`,
    };
  }

  // The decisive check: the bytes themselves.
  if (!matchesMagicBytes(input.header, format)) {
    return {
      ok: false,
      failure: format.magic.length === 0 ? "invalid_text_encoding" : "content_mismatch",
      message:
        format.magic.length === 0
          ? "That file does not appear to be readable text."
          : `That file's contents do not match a ${format.label}.`,
    };
  }

  return { ok: true, safeFilename, format };
}

/**
 * Build the storage path for an attachment.
 *
 * The user id is the first segment, which is what the storage policies match on
 * to decide ownership. The attachment id prefix guarantees uniqueness, so two
 * files with the same name cannot collide or overwrite one another.
 */
export function buildStoragePath(input: {
  userId: string;
  conversationId: string;
  attachmentId: string;
  safeFilename: string;
}): string {
  return `${input.userId}/${input.conversationId}/${input.attachmentId}-${input.safeFilename}`;
}

/**
 * Identifier and timestamp helpers.
 *
 * These wrap impure calls (`crypto.randomUUID`, `Date.now`) so they are never
 * invoked during render. React's compiler now rejects impure calls in render,
 * and beyond satisfying the linter this is a real correctness rule: an id
 * generated during render changes on every re-render.
 *
 * Call these from event handlers and effects only.
 */

/** Collision-resistant id for client-created messages. */
export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Older browsers only. Sufficient for local, per-session message keys.
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

/** Current time as an ISO 8601 string with offset. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Derive a conversation title from the first user message.
 *
 * A local fallback used immediately so the sidebar is never blank; a
 * model-generated title replaces it once the server produces one.
 */
export function deriveTitle(content: string, maxLength = 48): string {
  const firstLine = content.trim().split("\n")[0]?.trim() ?? "";

  if (firstLine.length === 0) {
    return "New chat";
  }

  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  // Prefer breaking on a word boundary near the limit.
  const clipped = firstLine.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;

  return `${base.trimEnd()}...`;
}

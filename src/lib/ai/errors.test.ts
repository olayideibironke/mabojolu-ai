import { describe, expect, it } from "vitest";

import { ChatError, chatError, normalizeError } from "./errors";

/**
 * Error normalization is a security boundary as much as a UX one: it is what
 * stops a provider exception carrying request bodies or credential fragments to
 * the browser.
 */

describe("chatError", () => {
  it("supplies user-facing copy for every code", () => {
    const error = chatError("provider_unavailable");

    expect(error.message).toMatch(/temporarily unavailable/i);
    expect(error.message).not.toMatch(/—/); // No em dashes in product copy.
  });

  it("marks transient failures retryable and permanent ones not", () => {
    expect(chatError("provider_unavailable").retryable).toBe(true);
    expect(chatError("provider_timeout").retryable).toBe(true);
    expect(chatError("rate_limited").retryable).toBe(true);

    expect(chatError("invalid_request").retryable).toBe(false);
    expect(chatError("provider_not_configured").retryable).toBe(false);
    // A user who pressed stop did not fail, and must not be offered a retry as
    // though something went wrong.
    expect(chatError("aborted").retryable).toBe(false);
  });

  it("maps codes to sensible HTTP statuses", () => {
    expect(chatError("invalid_request").httpStatus).toBe(400);
    expect(chatError("unauthorized").httpStatus).toBe(401);
    expect(chatError("forbidden").httpStatus).toBe(403);
    expect(chatError("rate_limited").httpStatus).toBe(429);
    expect(chatError("internal_error").httpStatus).toBe(500);
  });

  it("carries a retry delay when one is known", () => {
    const error = chatError("rate_limited", { retryAfterSeconds: 30 });

    expect(error.toPayload()).toMatchObject({
      code: "rate_limited",
      retryable: true,
      retryAfterSeconds: 30,
    });
  });

  it("omits the retry delay when unknown rather than sending zero", () => {
    // A zero would read as "retry immediately", which is the wrong advice.
    expect(chatError("rate_limited").toPayload()).not.toHaveProperty(
      "retryAfterSeconds",
    );
  });
});

describe("normalizeError", () => {
  it("passes a ChatError through unchanged", () => {
    const original = chatError("provider_timeout");

    expect(normalizeError(original)).toBe(original);
  });

  it("recognizes an AbortError as an abort rather than a failure", () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";

    expect(normalizeError(abort).code).toBe("aborted");
  });

  it("recognizes a DOMException AbortError", () => {
    expect(
      normalizeError(new DOMException("Aborted", "AbortError")).code,
    ).toBe("aborted");
  });

  it("does not leak an unknown error's message to the user", () => {
    // This is the case that matters most: a raw provider error can contain the
    // request body or a key fragment.
    const leaky = new Error(
      "Request failed: x-api-key=sk-ant-secret123 body={...private prompt...}",
    );

    const normalized = normalizeError(leaky);

    expect(normalized.code).toBe("internal_error");
    expect(normalized.message).not.toMatch(/sk-ant-secret123/);
    expect(normalized.message).not.toMatch(/private prompt/);
    // The original is retained for server-side logging only.
    expect(normalized.cause).toBe(leaky);
  });

  it("normalizes a non-Error throw", () => {
    const normalized = normalizeError("something odd");

    expect(normalized).toBeInstanceOf(ChatError);
    expect(normalized.code).toBe("internal_error");
  });

  it("produces a payload with no extra fields", () => {
    // The payload is the API contract, so an accidental internal field would
    // become an unintended disclosure.
    const payload = normalizeError(new Error("boom")).toPayload();

    expect(Object.keys(payload).sort()).toEqual(
      ["code", "message", "retryable"].sort(),
    );
  });
});

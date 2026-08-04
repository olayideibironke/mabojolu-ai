import type { NextRequest } from "next/server";

import { z } from "zod";

import { chatError, logChatError, normalizeError } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/ai/stream";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";
import { inspectServerEnv } from "@/lib/env";
import { getRateLimiter, rateLimitIdentity } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/chat";

/**
 * Email magic-link sign-in.
 *
 * A magic link rather than a password: there is no password to store, reset, or
 * leak, and Supabase handles token issuance and expiry. Additional providers can
 * be added later without changing how the rest of the app resolves a session,
 * because everything reads identity through `getSession`.
 *
 * Not yet verified end to end. Doing so needs a real Supabase project, so it is
 * recorded as pending in docs/KNOWN_LIMITATIONS.md rather than described as
 * working.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(320),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const envResult = inspectServerEnv();

    if (!envResult.ok || envResult.env.AUTH_MODE !== "supabase") {
      return errorResponse(chatError("not_found"));
    }

    /*
     * Rate limit before anything else.
     *
     * Each accepted request sends an email. Without a limit this endpoint becomes
     * a way to use the product as a mail relay against a third party's inbox.
     * Tighter than the chat limit, because sign-in is a rare action.
     */
    const limit = getRateLimiter({
      name: "magic-link",
      max: 5,
      windowMs: 15 * 60 * 1_000,
    }).check(rateLimitIdentity({ headers: request.headers }));

    if (!limit.allowed) {
      return errorResponse(
        chatError("rate_limited", {
          message:
            "Too many sign-in attempts. Please wait a few minutes and try again.",
          retryAfterSeconds: limit.retryAfterSeconds,
        }),
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errorResponse(
        chatError("invalid_request", { message: "That request could not be read." }),
      );
    }

    const parsed = parseJsonBody(requestSchema, rawBody);

    if (!parsed.ok) {
      return errorResponse(
        chatError("invalid_request", {
          message: "Please enter a valid email address.",
        }),
      );
    }

    const client = await createServerSupabaseClient();

    if (!client) {
      return errorResponse(chatError("provider_not_configured"));
    }

    // Derived from the incoming request rather than a configured base URL, so the
    // callback works across local, preview, and production without per-environment
    // configuration.
    const redirectTo = new URL("/auth/callback", request.nextUrl.origin).toString();

    const { error } = await client.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: redirectTo,
        // Sign-up is allowed: for a magic link, first sign-in and account creation
        // are the same action.
        shouldCreateUser: true,
      },
    });

    if (error) {
      logChatError(
        normalizeError(error),
        { route: "POST /api/auth/magic-link" },
      );
      // Deliberately does not distinguish a send failure from an unknown address.
      return errorResponse(
        chatError("provider_unavailable", {
          message: "Could not send the sign-in link. Please try again shortly.",
        }),
      );
    }

    /*
     * Always the same response, whether or not the address has an account.
     *
     * A different answer for a known address would turn this endpoint into an
     * account-enumeration oracle.
     */
    return Response.json({
      ok: true,
      message: "Check your email for a sign-in link.",
    });
  } catch (cause) {
    const error = normalizeError(cause);
    logChatError(error, { route: "POST /api/auth/magic-link" });
    return errorResponse(error);
  }
}

import type { NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

/**
 * Magic-link callback.
 *
 * Supabase redirects here with a one-time code, which is exchanged for a session.
 * A Route Handler rather than a page, because the exchange sets cookies and then
 * redirects, and neither is available during a Server Component render.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  /*
   * Open-redirect guard.
   *
   * `next` comes from the URL, so it is attacker-controlled. Only a relative path
   * is honoured; an absolute URL would let a crafted link bounce a freshly
   * authenticated user to an attacker's site.
   */
  const requestedNext = searchParams.get("next") ?? "/";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";

  if (!code) {
    return Response.redirect(
      new URL("/sign-in?error=missing_code", origin),
      302,
    );
  }

  const client = await createServerSupabaseClient();

  if (!client) {
    return Response.redirect(
      new URL("/sign-in?error=not_configured", origin),
      302,
    );
  }

  const { error } = await client.auth.exchangeCodeForSession(code);

  if (error) {
    // The specific reason is not surfaced: an expired code and an invalid one
    // should look the same to whoever followed the link.
    console.error("[mabojolu] auth callback failed", { message: error.message });
    return Response.redirect(new URL("/sign-in?error=invalid_link", origin), 302);
  }

  return Response.redirect(new URL(next, origin), 302);
}

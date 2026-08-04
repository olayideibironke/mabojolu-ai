import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy.
 *
 * Note the filename: the `middleware` convention is deprecated in Next.js 16 and
 * renamed to `proxy`. Same capabilities, new export name.
 *
 * Two jobs here, and deliberately only two:
 *
 *   1. Refresh the Supabase auth session, since cookies cannot be written during a
 *      Server Component render.
 *   2. Apply security headers to every response.
 *
 * Authorization is not enforced here. The docs are explicit that proxy code may
 * be deployed to a CDN edge and should not be relied on for security decisions,
 * so each protected page and route checks the session itself. A redirect here is
 * a convenience for the user, never the control that keeps data safe.
 */

/**
 * Security headers.
 *
 * Applied to every response so a new route cannot be added without them.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;

  // Stop the browser second-guessing declared content types, which is how a
  // served text file becomes executable script.
  headers.set("X-Content-Type-Options", "nosniff");

  // Block framing entirely. Nothing in this product needs to be embedded, and
  // allowing it invites clickjacking of the composer.
  headers.set("X-Frame-Options", "DENY");

  // Send only the origin cross-site. Conversation URLs can carry a conversation
  // id, which should not leak to third parties in a Referer header.
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Deny device APIs the product does not use, so a compromised dependency
  // cannot silently request them.
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );

  // Isolate this origin from cross-origin windows.
  headers.set("Cross-Origin-Opener-Policy", "same-origin");

  /*
   * Content Security Policy.
   *
   * Honest about its own limits: `'unsafe-inline'` for styles is required because
   * Next.js injects inline style elements, and `'unsafe-eval'` is needed in
   * development for React Refresh. Both weaken the policy, so the eval allowance
   * is scoped to development only.
   *
   * A nonce-based script policy would be stronger still. That needs the inline
   * theme script to carry a per-request nonce, which is a worthwhile follow-up
   * and is recorded in the known limitations rather than claimed as done.
   */
  const isDevelopment = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' covers the pre-paint theme script; 'unsafe-eval' is dev only.
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // data: for inline SVG icons; blob: for locally previewed attachments.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Supabase needs https and wss for its API and realtime channels.
    `connect-src 'self' https: ${isDevelopment ? "ws: wss:" : "wss:"}`,
    // No plugins, and no base tag rewriting of relative URLs.
    "object-src 'none'",
    "base-uri 'self'",
    // Only submit forms back to this origin.
    "form-action 'self'",
    // Belt and braces with X-Frame-Options, which older browsers honour instead.
    "frame-ancestors 'none'",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);

  return response;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Only run the auth refresh when Supabase is actually configured. In local
  // development with dev auth there is no session to refresh.
  if (url && key) {
    // Imported lazily so the Supabase client is not bundled into the proxy when
    // it is not in use.
    const { createServerClient } = await import("@supabase/ssr");

    const client = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          // A fresh response is required so refreshed cookies are actually sent.
          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    /*
     * `getUser()` rather than `getSession()`.
     *
     * This call is what triggers the token refresh, and it verifies the token
     * against the auth server instead of trusting the cookie's contents. The
     * result is intentionally unused here: authorization happens in the route.
     */
    await client.auth.getUser();
  }

  return applySecurityHeaders(response);
}

export const config = {
  /*
   * Skip static assets and image optimization.
   *
   * Without this the proxy would run for every CSS file, script, and image, which
   * both wastes work and risks blocking assets if the auth call were ever to
   * fail. Assets receive their headers from next.config.ts instead.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};

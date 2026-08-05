import { NextResponse, type NextRequest } from "next/server";

/**
 * Request proxy.
 *
 * Next.js 16 renamed the former middleware convention to `proxy`.
 *
 * This proxy has two responsibilities:
 *
 * 1. Refresh the Supabase authentication session because cookies cannot be
 *    written during a Server Component render.
 * 2. Apply security headers to every dynamic response.
 *
 * Authorization is not enforced here. Protected pages and route handlers must
 * still validate the signed-in user themselves.
 */

function getSupabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Apply security headers to every response.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  /*
   * Mabojolu uses the microphone for voice input, so microphone access is
   * allowed only for this origin. Other unused device APIs remain blocked.
   */
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  );

  headers.set("Cross-Origin-Opener-Policy", "same-origin");

  /*
   * Content Security Policy.
   *
   * Inline styles are currently required by Next.js. Inline scripts are needed
   * for Mabojolu's pre-paint theme initialization. React Refresh additionally
   * requires eval during local development.
   */
  const isDevelopment = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    /*
     * data: supports selected image previews.
     * blob: supports browser-created preview objects.
     * https: supports private Supabase images served through signed URLs.
     */
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    /*
     * Supabase requires HTTPS and secure WebSocket connections. Local
     * development additionally permits ordinary WebSocket connections.
     */
    `connect-src 'self' https: ${isDevelopment ? "ws: wss:" : "wss:"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);

  return response;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabasePublicKey();

  /*
   * Run session refresh only when Supabase is configured. Local development
   * using dev authentication has no Supabase session to refresh.
   */
  if (url && key) {
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

          /*
           * A new response is required so refreshed authentication cookies are
           * actually returned to the browser.
           */
          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    /*
     * getUser verifies the access token with Supabase Auth and triggers token
     * refresh when necessary. Authorization remains the responsibility of the
     * destination page or route handler.
     */
    await client.auth.getUser();
  }

  return applySecurityHeaders(response);
}

export const config = {
  /*
   * Skip static assets and Next.js image optimization. Those resources receive
   * their security headers through next.config.ts.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
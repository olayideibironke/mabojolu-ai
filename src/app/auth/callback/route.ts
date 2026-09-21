import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  RECOVERY_SESSION_COOKIE,
  RECOVERY_SESSION_MAX_AGE_SECONDS,
  resolveAuthCallbackTarget,
} from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

/**
 * Authentication callback.
 *
 * Supabase redirects here with a one-time code for email confirmation,
 * password recovery, and other PKCE authentication flows. The code is
 * exchanged for a session before the user is redirected.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
): Promise<Response> {
  const {
    searchParams,
    origin,
  } = request.nextUrl;

  const code =
    searchParams.get("code");

  const requestedNext =
    searchParams.get(
      "next",
    );

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/sign-in?error=missing_code",
        origin,
      ),
      302,
    );
  }

  const client =
    await createServerSupabaseClient();

  if (!client) {
    return NextResponse.redirect(
      new URL(
        "/sign-in?error=not_configured",
        origin,
      ),
      302,
    );
  }

  const flowId =
    searchParams.get(
      "sb_flow_id",
    );

  const {
    data,
    error,
  } =
    await client.auth.exchangeCodeForSession(
      code,
      flowId
        ? {
            flowId,
          }
        : undefined,
    );

  if (error) {
    console.error(
      "[mabojolu] auth callback failed",
      {
        message: error.message,
      },
    );

    return NextResponse.redirect(
      new URL(
        "/sign-in?error=invalid_link",
        origin,
      ),
      302,
    );
  }

  const next =
    resolveAuthCallbackTarget({
      requestedNext,

      recoverySentAt:
        data.user
          ?.recovery_sent_at,
    });

  const response =
    NextResponse.redirect(
      new URL(
        next,
        origin,
      ),
      302,
    );

  if (
    next ===
      "/reset-password"
  ) {
    response.cookies.set(
      RECOVERY_SESSION_COOKIE,
      "1",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          RECOVERY_SESSION_MAX_AGE_SECONDS,
      },
    );
  } else {
    response.cookies.set(
      RECOVERY_SESSION_COOKIE,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      },
    );
  }

  return response;
}

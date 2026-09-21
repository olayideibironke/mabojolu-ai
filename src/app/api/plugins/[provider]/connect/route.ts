import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  cookies,
} from "next/headers";
import type {
  NextRequest,
} from "next/server";

import {
  getSession,
} from "@/lib/auth/session";
import {
  resolvePluginAccess,
} from "@/lib/plugins/access";
import {
  pluginOAuthConfig,
} from "@/lib/plugins/config";
import {
  buildPluginAuthorizationUrl,
} from "@/lib/plugins/oauth";
import {
  isPluginProviderId,
} from "@/lib/plugins/registry";
import {
  normalizePluginReturnPath,
} from "@/lib/plugins/return-path";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request:
    NextRequest,

  context: {
    params:
      Promise<{
        provider:
          string;
      }>;
  },
): Promise<Response> {
  const session =
    await getSession();

  if (
    !session ||
    session.isAnonymous
  ) {
    return Response.redirect(
      new URL(
        "/sign-in",
        request.url,
      ),
    );
  }

  const {
    provider,
  } =
    await context.params;

  if (
    !isPluginProviderId(
      provider,
    )
  ) {
    return Response.redirect(
      new URL(
        "/plugins?error=unknown-provider",
        request.url,
      ),
    );
  }

  const access =
    await resolvePluginAccess(
      session,
      provider,
    );

  if (!access.allowed) {
    return Response.redirect(
      new URL(
        "/plugins?error=paid-required",
        request.url,
      ),
    );
  }

  const config =
    pluginOAuthConfig(
      provider,
    );

  if (!config) {
    return Response.redirect(
      new URL(
        `/plugins?error=not-configured&provider=${provider}`,
        request.url,
      ),
    );
  }

  const state =
    randomBytes(
      32,
    ).toString(
      "base64url",
    );

  const returnPath =
    normalizePluginReturnPath(
      request.nextUrl
        .searchParams
        .get(
          "returnTo",
        ),
    );

  const codeVerifier =
    provider ===
      "supabase"
      ? randomBytes(
          32,
        ).toString(
          "base64url",
        )
      : null;

  const codeChallenge =
    codeVerifier
      ? createHash(
          "sha256",
        )
          .update(
            codeVerifier,
          )
          .digest(
            "base64url",
          )
      : undefined;

  const store =
    await cookies();

  const cookieOptions = {
    httpOnly:
      true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite:
      "lax" as const,
    path:
      `/api/plugins/${provider}`,
    maxAge:
      10 *
      60,
  };

  store.set(
    `mabojolu-plugin-oauth-${provider}`,
    state,
    cookieOptions,
  );

  store.set(
    `mabojolu-plugin-return-${provider}`,
    returnPath,
    cookieOptions,
  );

  if (
    codeVerifier
  ) {
    store.set(
      `mabojolu-plugin-pkce-${provider}`,
      codeVerifier,
      cookieOptions,
    );
  }

  return Response.redirect(
    buildPluginAuthorizationUrl({
      providerId:
        provider,
      config,
      state,
      ...(codeChallenge
        ? {
            codeChallenge,
          }
        : {}),
    }),
  );
}

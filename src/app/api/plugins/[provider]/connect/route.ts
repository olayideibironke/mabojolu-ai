import {
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

  const access =
    await resolvePluginAccess(
      session,
    );

  if (!access.allowed) {
    return Response.redirect(
      new URL(
        "/plugins?error=paid-required",
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

  const store =
    await cookies();

  store.set(
    `mabojolu-plugin-oauth-${provider}`,
    state,
    {
      httpOnly:
        true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite:
        "lax",
      path:
        `/api/plugins/${provider}`,
      maxAge:
        10 *
        60,
    },
  );

  return Response.redirect(
    buildPluginAuthorizationUrl({
      providerId:
        provider,
      config,
      state,
    }),
  );
}

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
  getDatabase,
} from "@/lib/database";
import {
  resolvePluginAccess,
} from "@/lib/plugins/access";
import {
  pluginOAuthConfig,
} from "@/lib/plugins/config";
import {
  encryptPluginSecret,
} from "@/lib/plugins/crypto";
import {
  exchangePluginAuthorizationCode,
} from "@/lib/plugins/oauth";
import {
  isPluginProviderId,
} from "@/lib/plugins/registry";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function pluginRedirect(
  request:
    NextRequest,

  query:
    string,
):
  Response {
  return Response.redirect(
    new URL(
      `/plugins?${query}`,
      request.url,
    ),
  );
}

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
    return pluginRedirect(
      request,
      "error=paid-required",
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
    return pluginRedirect(
      request,
      "error=unknown-provider",
    );
  }

  const providerError =
    request.nextUrl
      .searchParams
      .get(
        "error",
      );

  if (providerError) {
    return pluginRedirect(
      request,
      `error=authorization-declined&provider=${provider}`,
    );
  }

  const code =
    request.nextUrl
      .searchParams
      .get(
        "code",
      );

  const state =
    request.nextUrl
      .searchParams
      .get(
        "state",
      );

  const store =
    await cookies();

  const cookieName =
    `mabojolu-plugin-oauth-${provider}`;

  const expectedState =
    store.get(
      cookieName,
    )?.value;

  store.delete(
    cookieName,
  );

  if (
    !code ||
    !state ||
    !expectedState ||
    state !==
      expectedState
  ) {
    return pluginRedirect(
      request,
      `error=invalid-oauth-state&provider=${provider}`,
    );
  }

  const config =
    pluginOAuthConfig(
      provider,
    );

  if (!config) {
    return pluginRedirect(
      request,
      `error=not-configured&provider=${provider}`,
    );
  }

  try {
    const result =
      await exchangePluginAuthorizationCode({
        providerId:
          provider,
        code,
        config,
      });

    const existing =
      await getDatabase()
        .getPluginConnection(
          session.userId,
          provider,
        );

    await getDatabase()
      .upsertPluginConnection({
        userId:
          session.userId,

        provider,

        accountLabel:
          result.accountLabel,

        accessTokenEncrypted:
          encryptPluginSecret(
            result.accessToken,
          ),

        refreshTokenEncrypted:
          result.refreshToken
            ? encryptPluginSecret(
                result.refreshToken,
              )
            : existing
                ?.refreshTokenEncrypted ??
              null,

        expiresAt:
          result.expiresAt ??
          null,

        scopes: [
          ...result.scopes,
        ],
      });

    return pluginRedirect(
      request,
      `connected=${provider}`,
    );
  } catch (cause) {
    console.error(
      "[mabojolu] plugin oauth callback failed",
      {
        provider,
        error:
          cause instanceof
          Error
            ? cause.message
            : "unknown",
      },
    );

    return pluginRedirect(
      request,
      `error=connection-failed&provider=${provider}`,
    );
  }
}

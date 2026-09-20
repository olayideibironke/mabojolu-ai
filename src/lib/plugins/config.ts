import "server-only";

import {
  getPluginProvider,
  isGooglePluginProvider,
  type PluginProviderId,
} from "./registry";

export interface PluginOAuthConfig {
  providerId:
    PluginProviderId;

  clientId:
    string;

  clientSecret:
    string;

  redirectUri:
    string;

  authorizationUrl:
    string;

  scopes:
    readonly string[];
}

export function pluginOAuthConfig(
  providerId:
    PluginProviderId,
):
  PluginOAuthConfig |
  null {
  const rawAppUrl =
    process.env.MABOJOLU_APP_URL
      ?.trim();

  const encryptionKey =
    process.env
      .MABOJOLU_PLUGIN_ENCRYPTION_KEY
      ?.trim();

  if (
    !rawAppUrl ||
    !encryptionKey ||
    encryptionKey.length < 32
  ) {
    return null;
  }

  let appUrl:
    string;

  try {
    const parsed =
      new URL(
        rawAppUrl,
      );

    if (
      parsed.protocol !==
        "https:" &&
      parsed.hostname !==
        "localhost" &&
      parsed.hostname !==
        "127.0.0.1"
    ) {
      return null;
    }

    appUrl =
      parsed
        .toString()
        .replace(
          /\/+$/,
          "",
        );
  } catch {
    return null;
  }

  const credentials =
    isGooglePluginProvider(
      providerId,
    )
      ? {
          clientId:
            process.env
              .GOOGLE_OAUTH_CLIENT_ID,
          clientSecret:
            process.env
              .GOOGLE_OAUTH_CLIENT_SECRET,
        }
      : providerId ===
          "microsoft"
        ? {
            clientId:
              process.env
                .MICROSOFT_OAUTH_CLIENT_ID,
            clientSecret:
              process.env
                .MICROSOFT_OAUTH_CLIENT_SECRET,
          }
        : providerId ===
            "github"
          ? {
              clientId:
                process.env
                  .GITHUB_OAUTH_CLIENT_ID,
              clientSecret:
                process.env
                  .GITHUB_OAUTH_CLIENT_SECRET,
            }
          : null;

  if (
    !credentials
  ) {
    return null;
  }

  if (
    !credentials.clientId ||
    !credentials.clientSecret
  ) {
    return null;
  }

  const provider =
    getPluginProvider(
      providerId,
    );

  return {
    providerId,

    clientId:
      credentials.clientId,

    clientSecret:
      credentials.clientSecret,

    redirectUri:
      `${appUrl}/api/plugins/${providerId}/callback`,

    authorizationUrl:
      provider.authorizationUrl,

    scopes:
      provider.scopes,
  };
}

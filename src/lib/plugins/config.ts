import "server-only";

import {
  getPluginProvider,
  type PluginProviderId,
} from "./registry";
import { serverEnv } from "@/lib/env";

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
  const env =
    serverEnv();

  const appUrl =
    env.MABOJOLU_APP_URL
      ?.replace(
        /\/+$/,
        "",
      );

  if (
    !appUrl ||
    !env.MABOJOLU_PLUGIN_ENCRYPTION_KEY
  ) {
    return null;
  }

  const credentials =
    providerId ===
      "google"
      ? {
          clientId:
            env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret:
            env.GOOGLE_OAUTH_CLIENT_SECRET,
        }
      : providerId ===
          "microsoft"
        ? {
            clientId:
              env.MICROSOFT_OAUTH_CLIENT_ID,
            clientSecret:
              env.MICROSOFT_OAUTH_CLIENT_SECRET,
          }
        : {
            clientId:
              env.GITHUB_OAUTH_CLIENT_ID,
            clientSecret:
              env.GITHUB_OAUTH_CLIENT_SECRET,
          };

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

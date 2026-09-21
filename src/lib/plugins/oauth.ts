import "server-only";

import {
  getPluginProvider,
  isGooglePluginProvider,
  type PluginProviderId,
} from "./registry";
import type {
  PluginOAuthConfig,
} from "./config";

export interface PluginTokenResult {
  accessToken:
    string;

  refreshToken?:
    string;

  expiresAt?:
    string;

  accountLabel:
    string;

  scopes:
    string[];
}

function expiresAtFromSeconds(
  seconds:
    unknown,
):
  string |
  undefined {
  const value =
    typeof seconds ===
      "number"
      ? seconds
      : typeof seconds ===
          "string"
        ? Number(
            seconds,
          )
        : Number.NaN;

  if (
    !Number.isFinite(
      value,
    ) ||
    value <=
      0
  ) {
    return undefined;
  }

  return new Date(
    Date.now() +
      value *
        1_000,
  ).toISOString();
}

function parseScope(
  value:
    unknown,

  fallback:
    readonly string[],
):
  string[] {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return [
      ...fallback,
    ];
  }

  return value
    .split(
      /[ ,]+/,
    )
    .map(
      (
        scope,
      ) =>
        scope.trim(),
    )
    .filter(
      Boolean,
    );
}

export function buildPluginAuthorizationUrl(input: {
  providerId:
    PluginProviderId;

  config:
    PluginOAuthConfig;

  state:
    string;

  codeChallenge?:
    string;
}):
  string {
  const provider =
    getPluginProvider(
      input.providerId,
    );

  const url =
    new URL(
      provider.authorizationUrl,
    );

  if (
    isGooglePluginProvider(
      input.providerId,
    )
  ) {
    url.searchParams.set(
      "client_id",
      input.config.clientId,
    );

    url.searchParams.set(
      "redirect_uri",
      input.config.redirectUri,
    );

    url.searchParams.set(
      "response_type",
      "code",
    );

    url.searchParams.set(
      "scope",
      input.config.scopes.join(
        " ",
      ),
    );

    url.searchParams.set(
      "access_type",
      "offline",
    );

    url.searchParams.set(
      "prompt",
      "consent",
    );

    url.searchParams.set(
      "state",
      input.state,
    );

    return url.toString();
  }

  if (
    input.providerId ===
      "microsoft"
  ) {
    url.searchParams.set(
      "client_id",
      input.config.clientId,
    );

    url.searchParams.set(
      "redirect_uri",
      input.config.redirectUri,
    );

    url.searchParams.set(
      "response_type",
      "code",
    );

    url.searchParams.set(
      "response_mode",
      "query",
    );

    url.searchParams.set(
      "scope",
      input.config.scopes.join(
        " ",
      ),
    );

    url.searchParams.set(
      "state",
      input.state,
    );

    return url.toString();
  }

  if (
    input.providerId ===
      "github"
  ) {
    url.searchParams.set(
      "client_id",
      input.config.clientId,
    );

    url.searchParams.set(
      "redirect_uri",
      input.config.redirectUri,
    );

    url.searchParams.set(
      "scope",
      input.config.scopes.join(
        " ",
      ),
    );

    url.searchParams.set(
      "state",
      input.state,
    );

    url.searchParams.set(
      "allow_signup",
      "true",
    );

    return url.toString();
  }

  if (
    input.providerId ===
      "supabase"
  ) {
    url.searchParams.set(
      "client_id",
      input.config.clientId,
    );

    url.searchParams.set(
      "redirect_uri",
      input.config.redirectUri,
    );

    url.searchParams.set(
      "response_type",
      "code",
    );

    url.searchParams.set(
      "state",
      input.state,
    );

    if (
      input.codeChallenge
    ) {
      url.searchParams.set(
        "code_challenge",
        input.codeChallenge,
      );

      url.searchParams.set(
        "code_challenge_method",
        "S256",
      );
    }

    return url.toString();
  }

  throw new Error(
    "OAuth is not implemented for this plugin provider yet.",
  );
}

async function requireJson<T>(
  response:
    Response,

  label:
    string,
):
  Promise<T> {
  if (
    !response.ok
  ) {
    throw new Error(
      `${label} failed with HTTP ${response.status}.`,
    );
  }

  return await response.json() as T;
}

async function exchangeGoogle(
  code:
    string,

  config:
    PluginOAuthConfig,
):
  Promise<PluginTokenResult> {
  const tokenResponse =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            code,
            client_id:
              config.clientId,
            client_secret:
              config.clientSecret,
            redirect_uri:
              config.redirectUri,
            grant_type:
              "authorization_code",
          }),

        cache:
          "no-store",
      },
    );

  const token =
    await requireJson<{
      access_token:
        string;
      refresh_token?:
        string;
      expires_in?:
        number;
      scope?:
        string;
    }>(
      tokenResponse,
      "Google token exchange",
    );

  const profileResponse =
    await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization:
            `Bearer ${token.access_token}`,
        },

        cache:
          "no-store",
      },
    );

  const profile =
    await requireJson<{
      email?:
        string;
      name?:
        string;
    }>(
      profileResponse,
      "Google profile lookup",
    );

  return {
    accessToken:
      token.access_token,

    ...(token.refresh_token
      ? {
          refreshToken:
            token.refresh_token,
        }
      : {}),

    ...(expiresAtFromSeconds(
      token.expires_in,
    )
      ? {
          expiresAt:
            expiresAtFromSeconds(
              token.expires_in,
            ),
        }
      : {}),

    accountLabel:
      profile.email ??
      profile.name ??
      "Google account",

    scopes:
      parseScope(
        token.scope,
        config.scopes,
      ),
  };
}

async function exchangeMicrosoft(
  code:
    string,

  config:
    PluginOAuthConfig,
):
  Promise<PluginTokenResult> {
  const tokenResponse =
    await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              config.clientId,
            client_secret:
              config.clientSecret,
            code,
            redirect_uri:
              config.redirectUri,
            grant_type:
              "authorization_code",
            scope:
              config.scopes.join(
                " ",
              ),
          }),

        cache:
          "no-store",
      },
    );

  const token =
    await requireJson<{
      access_token:
        string;
      refresh_token?:
        string;
      expires_in?:
        number;
      scope?:
        string;
    }>(
      tokenResponse,
      "Microsoft token exchange",
    );

  const profileResponse =
    await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
      {
        headers: {
          Authorization:
            `Bearer ${token.access_token}`,
        },

        cache:
          "no-store",
      },
    );

  const profile =
    await requireJson<{
      displayName?:
        string;
      mail?:
        string;
      userPrincipalName?:
        string;
    }>(
      profileResponse,
      "Microsoft profile lookup",
    );

  return {
    accessToken:
      token.access_token,

    ...(token.refresh_token
      ? {
          refreshToken:
            token.refresh_token,
        }
      : {}),

    ...(expiresAtFromSeconds(
      token.expires_in,
    )
      ? {
          expiresAt:
            expiresAtFromSeconds(
              token.expires_in,
            ),
        }
      : {}),

    accountLabel:
      profile.mail ??
      profile.userPrincipalName ??
      profile.displayName ??
      "Microsoft account",

    scopes:
      parseScope(
        token.scope,
        config.scopes,
      ),
  };
}

async function exchangeGitHub(
  code:
    string,

  config:
    PluginOAuthConfig,
):
  Promise<PluginTokenResult> {
  const tokenResponse =
    await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              config.clientId,
            client_secret:
              config.clientSecret,
            code,
            redirect_uri:
              config.redirectUri,
          }),

        cache:
          "no-store",
      },
    );

  const token =
    await requireJson<{
      access_token:
        string;
      scope?:
        string;
    }>(
      tokenResponse,
      "GitHub token exchange",
    );

  const profileResponse =
    await fetch(
      "https://api.github.com/user",
      {
        headers: {
          Authorization:
            `Bearer ${token.access_token}`,
          Accept:
            "application/vnd.github+json",
          "X-GitHub-Api-Version":
            "2022-11-28",
          "User-Agent":
            "Mabojolu",
        },

        cache:
          "no-store",
      },
    );

  const profile =
    await requireJson<{
      login:
        string;
      name?:
        string |
        null;
      email?:
        string |
        null;
    }>(
      profileResponse,
      "GitHub profile lookup",
    );

  return {
    accessToken:
      token.access_token,

    accountLabel:
      profile.email ??
      profile.name ??
      profile.login,

    scopes:
      parseScope(
        token.scope,
        config.scopes,
      ),
  };
}

async function exchangeSupabase(
  code:
    string,

  config:
    PluginOAuthConfig,

  codeVerifier?:
    string,
):
  Promise<PluginTokenResult> {
  const basic =
    Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
      "utf8",
    ).toString(
      "base64",
    );

  const body =
    new URLSearchParams({
      grant_type:
        "authorization_code",
      code,
      redirect_uri:
        config.redirectUri,
    });

  if (
    codeVerifier
  ) {
    body.set(
      "code_verifier",
      codeVerifier,
    );
  }

  const tokenResponse =
    await fetch(
      "https://api.supabase.com/v1/oauth/token",
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",
          Authorization:
            `Basic ${basic}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body,

        cache:
          "no-store",
      },
    );

  const token =
    await requireJson<{
      access_token:
        string;
      refresh_token?:
        string;
      expires_in?:
        number;
      scope?:
        string;
    }>(
      tokenResponse,
      "Supabase token exchange",
    );

  let accountLabel =
    "Supabase account";

  try {
    const projectsResponse =
      await fetch(
        "https://api.supabase.com/v1/projects",
        {
          headers: {
            Authorization:
              `Bearer ${token.access_token}`,
          },

          cache:
            "no-store",
        },
      );

    if (
      projectsResponse.ok
    ) {
      const projects =
        await projectsResponse.json() as
          Array<{
            name?:
              string;
            organization_slug?:
              string;
          }>;

      const first =
        projects[0];

      accountLabel =
        first?.organization_slug ??
        first?.name ??
        accountLabel;
    }
  } catch {
    // A successful token exchange is enough to establish the connection.
  }

  return {
    accessToken:
      token.access_token,

    ...(token.refresh_token
      ? {
          refreshToken:
            token.refresh_token,
        }
      : {}),

    ...(expiresAtFromSeconds(
      token.expires_in,
    )
      ? {
          expiresAt:
            expiresAtFromSeconds(
              token.expires_in,
            ),
        }
      : {}),

    accountLabel,

    scopes:
      parseScope(
        token.scope,
        config.scopes,
      ),
  };
}

export async function exchangePluginAuthorizationCode(input: {
  providerId:
    PluginProviderId;

  code:
    string;

  config:
    PluginOAuthConfig;

  codeVerifier?:
    string;
}):
  Promise<PluginTokenResult> {
  if (
    isGooglePluginProvider(
      input.providerId,
    )
  ) {
    return exchangeGoogle(
      input.code,
      input.config,
    );
  }

  if (
    input.providerId ===
      "microsoft"
  ) {
    return exchangeMicrosoft(
      input.code,
      input.config,
    );
  }

  if (
    input.providerId ===
      "github"
  ) {
    return exchangeGitHub(
      input.code,
      input.config,
    );
  }

  if (
    input.providerId ===
      "supabase"
  ) {
    return exchangeSupabase(
      input.code,
      input.config,
      input.codeVerifier,
    );
  }

  throw new Error(
    "OAuth token exchange is not implemented for this plugin provider yet.",
  );
}

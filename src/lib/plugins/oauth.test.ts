import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildPluginAuthorizationUrl,
} from "./oauth";

const baseConfig = {
  clientId:
    "client-id",
  clientSecret:
    "client-secret",
  redirectUri:
    "https://mabojolu.example/api/plugins/google/callback",
  authorizationUrl:
    "https://accounts.google.com/o/oauth2/v2/auth",
  scopes: [
    "openid",
    "email",
  ],
} as const;

describe(
  "Mabojolu plugin OAuth authorization",
  () => {
    it(
      "builds a Google offline-consent authorization request",
      () => {
        const url =
          new URL(
            buildPluginAuthorizationUrl({
              providerId:
                "google",
              config: {
                ...baseConfig,
                providerId:
                  "google",
              },
              state:
                "state-1",
            }),
          );

        expect(
          url.searchParams.get(
            "state",
          ),
        ).toBe(
          "state-1",
        );

        expect(
          url.searchParams.get(
            "access_type",
          ),
        ).toBe(
          "offline",
        );

        expect(
          url.searchParams.get(
            "prompt",
          ),
        ).toBe(
          "consent",
        );
      },
    );

    it(
      "builds Microsoft authorization with query response mode",
      () => {
        const url =
          new URL(
            buildPluginAuthorizationUrl({
              providerId:
                "microsoft",
              config: {
                ...baseConfig,
                providerId:
                  "microsoft",
                authorizationUrl:
                  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                redirectUri:
                  "https://mabojolu.example/api/plugins/microsoft/callback",
              },
              state:
                "state-2",
            }),
          );

        expect(
          url.searchParams.get(
            "response_mode",
          ),
        ).toBe(
          "query",
        );

        expect(
          url.searchParams.get(
            "state",
          ),
        ).toBe(
          "state-2",
        );
      },
    );

    it(
      "builds GitHub authorization with the requested scopes",
      () => {
        const url =
          new URL(
            buildPluginAuthorizationUrl({
              providerId:
                "github",
              config: {
                ...baseConfig,
                providerId:
                  "github",
                authorizationUrl:
                  "https://github.com/login/oauth/authorize",
                redirectUri:
                  "https://mabojolu.example/api/plugins/github/callback",
              },
              state:
                "state-3",
            }),
          );

        expect(
          url.searchParams.get(
            "scope",
          ),
        ).toBe(
          "openid email",
        );

        expect(
          url.searchParams.get(
            "state",
          ),
        ).toBe(
          "state-3",
        );
      },
    );
  },
);

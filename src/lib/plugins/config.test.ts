import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  pluginOAuthConfig,
} from "./config";

describe(
  "plugin OAuth configuration",
  () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it(
      "builds Google Calendar OAuth config without depending on unrelated AI settings",
      () => {
        vi.stubEnv(
          "MABOJOLU_APP_URL",
          "https://www.mabojolu.com",
        );
        vi.stubEnv(
          "MABOJOLU_PLUGIN_ENCRYPTION_KEY",
          "12345678901234567890123456789012",
        );
        vi.stubEnv(
          "GOOGLE_OAUTH_CLIENT_ID",
          "google-client-id",
        );
        vi.stubEnv(
          "GOOGLE_OAUTH_CLIENT_SECRET",
          "google-client-secret",
        );

        vi.stubEnv(
          "AI_PROVIDER",
          "anthropic",
        );
        vi.stubEnv(
          "MABOJOLU_ALLOW_PAID_PROVIDERS",
          "false",
        );

        expect(
          pluginOAuthConfig(
            "google-calendar",
          ),
        ).toMatchObject({
          providerId:
            "google-calendar",
          clientId:
            "google-client-id",
          redirectUri:
            "https://www.mabojolu.com/api/plugins/google-calendar/callback",
        });
      },
    );

    it(
      "does not reuse GitHub credentials for catalog-only providers",
      () => {
        vi.stubEnv(
          "MABOJOLU_APP_URL",
          "https://www.mabojolu.com",
        );
        vi.stubEnv(
          "MABOJOLU_PLUGIN_ENCRYPTION_KEY",
          "12345678901234567890123456789012",
        );
        vi.stubEnv(
          "GITHUB_OAUTH_CLIENT_ID",
          "github-client-id",
        );
        vi.stubEnv(
          "GITHUB_OAUTH_CLIENT_SECRET",
          "github-client-secret",
        );

        expect(
          pluginOAuthConfig(
            "vercel",
          ),
        ).toBeNull();

        expect(
          pluginOAuthConfig(
            "supabase",
          ),
        ).toBeNull();
      },
    );

    it(
      "returns null when provider credentials are missing",
      () => {
        vi.stubEnv(
          "MABOJOLU_APP_URL",
          "https://www.mabojolu.com",
        );
        vi.stubEnv(
          "MABOJOLU_PLUGIN_ENCRYPTION_KEY",
          "12345678901234567890123456789012",
        );
        vi.stubEnv(
          "GOOGLE_OAUTH_CLIENT_ID",
          "",
        );
        vi.stubEnv(
          "GOOGLE_OAUTH_CLIENT_SECRET",
          "",
        );

        expect(
          pluginOAuthConfig(
            "google-calendar",
          ),
        ).toBeNull();
      },
    );
  },
);

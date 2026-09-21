import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getPluginProvider,
  isPluginProviderId,
} from "./registry";

describe(
  "Mabojolu split Google plugin registry",
  () => {
    it(
      "keeps Calendar, Drive, and Gmail scopes isolated",
      () => {
        const calendar =
          getPluginProvider(
            "google-calendar",
          );

        const drive =
          getPluginProvider(
            "google-drive",
          );

        const gmail =
          getPluginProvider(
            "google-gmail",
          );

        expect(
          calendar.scopes,
        ).toContain(
          "https://www.googleapis.com/auth/calendar.events.readonly",
        );

        expect(
          calendar.scopes.some(
            (
              scope,
            ) =>
              scope.includes(
                "gmail",
              ) ||
              scope.includes(
                "drive",
              ),
          ),
        ).toBe(
          false,
        );

        expect(
          drive.scopes,
        ).toContain(
          "https://www.googleapis.com/auth/drive.file",
        );

        expect(
          drive.scopes,
        ).not.toContain(
          "https://www.googleapis.com/auth/drive.readonly",
        );

        expect(
          gmail.scopes,
        ).toContain(
          "https://www.googleapis.com/auth/gmail.readonly",
        );

        expect(
          gmail.scopes.some(
            (
              scope,
            ) =>
              scope.includes(
                "calendar",
              ) ||
              scope.includes(
                "drive",
              ),
          ),
        ).toBe(
          false,
        );
      },
    );

    it(
      "marks developer connectors free and workspace connectors premium",
      () => {
        for (
          const providerId of [
            "github",
            "vercel",
            "supabase",
            "cloudflare",
            "resend",
          ] as const
        ) {
          expect(
            getPluginProvider(
              providerId,
            ).accessTier,
          ).toBe(
            "free",
          );
        }

        for (
          const providerId of [
            "google-calendar",
            "google-drive",
            "google-gmail",
            "microsoft",
          ] as const
        ) {
          expect(
            getPluginProvider(
              providerId,
            ).accessTier,
          ).toBe(
            "paid",
          );
        }
      },
    );

    it(
      "registers the new developer plugin ids",
      () => {
        for (
          const providerId of [
            "vercel",
            "supabase",
            "cloudflare",
            "resend",
          ]
        ) {
          expect(
            isPluginProviderId(
              providerId,
            ),
          ).toBe(true);
        }
      },
    );

    it(
      "accepts the split provider ids and rejects the old combined Google id",
      () => {
        expect(
          isPluginProviderId(
            "google-calendar",
          ),
        ).toBe(true);

        expect(
          isPluginProviderId(
            "google-drive",
          ),
        ).toBe(true);

        expect(
          isPluginProviderId(
            "google-gmail",
          ),
        ).toBe(true);

        expect(
          isPluginProviderId(
            "google",
          ),
        ).toBe(false);
      },
    );

    it(
      "marks Supabase as a live OAuth connector",
      () => {
        expect(
          getPluginProvider(
            "supabase",
          ).connectionMode,
        ).toBe(
          "oauth",
        );
      },
    );

  },
);

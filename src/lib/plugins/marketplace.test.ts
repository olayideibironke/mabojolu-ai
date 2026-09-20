import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MARKETPLACE_CATEGORY_ORDER,
  PLUGIN_MARKETPLACE,
} from "./marketplace";

describe(
  "Mabojolu plugin marketplace catalog",
  () => {
    it(
      "keeps plugin ids unique",
      () => {
        const ids =
          PLUGIN_MARKETPLACE.map(
            (
              plugin,
            ) =>
              plugin.id,
          );

        expect(
          new Set(
            ids,
          ).size,
        ).toBe(
          ids.length,
        );
      },
    );

    it(
      "covers every marketplace category with at least one plugin",
      () => {
        for (
          const category of
            MARKETPLACE_CATEGORY_ORDER
        ) {
          expect(
            PLUGIN_MARKETPLACE
              .some(
                (
                  plugin,
                ) =>
                  plugin.category ===
                  category,
              ),
          ).toBe(true);
        }
      },
    );

    it(
      "includes the core Mabojolu connector targets",
      () => {
        const names =
          new Set(
            PLUGIN_MARKETPLACE.map(
              (
                plugin,
              ) =>
                plugin.name,
            ),
          );

        for (
          const name of [
            "GitHub",
            "Vercel",
            "Supabase",
            "Cloudflare",
            "Resend",
            "Gmail",
            "Google Drive",
            "Google Calendar",
            "Slack",
            "Notion",
            "Stripe",
            "Firebase",
            "Tableau",
            "Microsoft Power BI",
          ]
        ) {
          expect(
            names.has(
              name,
            ),
          ).toBe(true);
        }
      },
    );

    it(
      "keeps functional provider ids attached to their marketplace entries",
      () => {
        const providerIds =
          new Set(
            PLUGIN_MARKETPLACE
              .map(
                (
                  plugin,
                ) =>
                  plugin.providerId,
              )
              .filter(
                Boolean,
              ),
          );

        for (
          const providerId of [
            "github",
            "vercel",
            "supabase",
            "cloudflare",
            "resend",
            "google-gmail",
            "google-drive",
            "google-calendar",
            "microsoft",
          ]
        ) {
          expect(
            providerIds.has(
              providerId,
            ),
          ).toBe(true);
        }
      },
    );
  },
);

import { redirect } from "next/navigation";

import {
  PluginCatalog,
  type PluginCatalogItem,
} from "@/components/plugins/plugin-catalog";
import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import {
  hasPluginAccess,
  resolvePluginAccess,
} from "@/lib/plugins/access";
import {
  pluginOAuthConfig,
} from "@/lib/plugins/config";
import {
  PLUGIN_PROVIDERS,
} from "@/lib/plugins/registry";
import {
  normalizePluginReturnPath,
} from "@/lib/plugins/return-path";

function providerMessage(
  value:
    string |
    string[] |
    undefined,
):
  string |
  undefined {
  return typeof value ===
    "string"
    ? value
    : undefined;
}

export default async function PluginsPage(input: {
  searchParams:
    Promise<
      Record<
        string,
        string |
        string[] |
        undefined
      >
    >;
}) {
  const session =
    await getSession();

  if (
    !session ||
    session.isAnonymous
  ) {
    redirect(
      "/sign-in",
    );
  }

  const paidAccess =
    await resolvePluginAccess(
      session,
    );

  const connections =
    await getDatabase()
      .listPluginConnections(
        session.userId,
      );

  const connected =
    new Map(
      connections.map(
        (
          connection,
        ) => [
          connection.provider,
          connection,
        ] as const,
      ),
    );

  const items:
    PluginCatalogItem[] =
      PLUGIN_PROVIDERS.map(
        (
          definition,
        ) => {
          const connection =
            connected.get(
              definition.id,
            );

          return {
            id:
              definition.id,

            name:
              definition.name,

            description:
              definition.description,

            capabilities: [
              ...definition
                .capabilities,
            ],

            ...(definition
                .permissionNote
              ? {
                  permissionNote:
                    definition
                      .permissionNote,
                }
              : {}),

            accessTier:
              definition
                .accessTier,

            category:
              definition
                .category,

            connectionMode:
              definition
                .connectionMode,

            configured:
              definition
                .connectionMode ===
                "oauth" &&
              pluginOAuthConfig(
                definition.id,
              ) !==
                null,

            allowed:
              hasPluginAccess(
                session,
                paidAccess
                  .account,
                definition.id,
              ),

            accountLabel:
              connection
                ?.accountLabel ??
              null,
          };
        },
      );

  const searchParams =
    await input.searchParams;

  const returnTo =
    normalizePluginReturnPath(
      providerMessage(
        searchParams.returnTo,
      ),
    );

  const connectedProvider =
    providerMessage(
      searchParams.connected,
    );

  const disconnectedProvider =
    providerMessage(
      searchParams.disconnected,
    );

  const error =
    providerMessage(
      searchParams.error,
    );

  const provider =
    providerMessage(
      searchParams.provider,
    );

  const notice =
    connectedProvider
      ? `${connectedProvider} connected successfully.`
      : disconnectedProvider
        ? `${disconnectedProvider} disconnected.`
        : error ===
            "paid-required"
          ? "That plugin requires a paid Mabojolu workspace."
          : error ===
              "not-configured"
            ? `${provider ?? "That provider"} is not configured for OAuth yet.`
            : error
              ? "Mabojolu could not complete that plugin connection. Please try again."
              : null;

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {notice ? (
          <div className="mb-5 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            {notice}
          </div>
        ) : null}

        <PluginCatalog
          items={
            items
          }
          returnTo={
            returnTo
          }
        />
      </div>
    </main>
  );
}

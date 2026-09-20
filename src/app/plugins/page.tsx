import Link from "next/link";
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
        ],
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
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mabojolu workspace
            </p>

            <h1 className="mt-1 text-2xl font-semibold">
              Plugins
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Connect the tools you already use. Free developer plugins are available without a paid Mabojolu plan. OAuth credentials stay server-side and provider tokens are encrypted before storage.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-border-default bg-surface-raised px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
          >
            Back to chat
          </Link>
        </div>

        {notice ? (
          <div className="mt-6 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            {notice}
          </div>
        ) : null}

        {!paidAccess.allowed ? (
          <div className="mt-6 rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold">
                  Free plugins are available now
                </p>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                  Developer connectors such as GitHub, Vercel, Supabase, Cloudflare, and Resend are part of the free plugin tier. Google and Microsoft workspace connectors remain premium.
                </p>
              </div>

              <Link
                href="/pricing"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
              >
                Compare plans
              </Link>
            </div>
          </div>
        ) : null}

        <PluginCatalog
          items={
            items
          }
        />

        <p className="mt-6 text-xs leading-5 text-text-muted">
          Connections use read-oriented scopes wherever the provider supports them. Mabojolu does not request unrestricted account control simply to establish a workspace connection.
        </p>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";
import {
  resolvePluginAccess,
} from "@/lib/plugins/access";
import {
  pluginOAuthConfig,
} from "@/lib/plugins/config";
import {
  PLUGIN_PROVIDERS,
  type PluginProviderId,
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

  const access =
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
          ? "Plugins are available to paid Mabojolu workspaces."
          : error ===
              "not-configured"
            ? `${provider ?? "That provider"} is not configured for OAuth yet.`
            : error
              ? "Mabojolu could not complete that plugin connection. Please try again."
              : null;

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mabojolu workspace
            </p>

            <h1 className="mt-1 text-2xl font-semibold">
              Plugins
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Connect your real accounts to Mabojolu. OAuth credentials stay server-side and provider tokens are encrypted before they are stored.
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

        {!access.allowed ? (
          <div className="mt-6 rounded-2xl border border-border-default bg-surface-raised p-5">
            <p className="text-sm font-semibold">
              Paid workspace feature
            </p>

            <p className="mt-2 text-sm leading-6 text-text-secondary">
              A paid Mabojolu plan is required before external accounts can be connected. This prevents third-party credentials from being collected for accounts that cannot use the integration.
            </p>

            <Link
              href="/pricing"
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse"
            >
              View plans
            </Link>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {PLUGIN_PROVIDERS.map(
            (
              definition,
            ) => {
              const connection =
                connected.get(
                  definition.id,
                );

              const configured =
                pluginOAuthConfig(
                  definition.id,
                ) !==
                null;

              return (
                <article
                  key={
                    definition.id
                  }
                  className="flex min-h-[300px] flex-col rounded-2xl border border-border-subtle bg-surface-raised p-5"
                >
                  <div>
                    <p className="text-base font-semibold">
                      {definition.name}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-text-secondary">
                      {definition.description}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {definition.capabilities.map(
                      (
                        capability,
                      ) => (
                        <span
                          key={
                            capability
                          }
                          className="rounded-full border border-border-subtle bg-surface-base px-2.5 py-1 text-[11px] text-text-secondary"
                        >
                          {capability}
                        </span>
                      ),
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    {connection ? (
                      <>
                        <p className="text-xs font-semibold text-text-primary">
                          Connected
                        </p>

                        <p className="mt-1 truncate text-xs text-text-muted">
                          {connection.accountLabel}
                        </p>

                        <form
                          action={`/api/plugins/${definition.id}/disconnect`}
                          method="post"
                        >
                          <button
                            type="submit"
                            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
                          >
                            Disconnect
                          </button>
                        </form>
                      </>
                    ) : !access.allowed ? (
                      <div className="flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-surface-base text-sm text-text-muted">
                        Paid plan required
                      </div>
                    ) : configured ? (
                      <Link
                        href={`/api/plugins/${definition.id}/connect`}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse hover:opacity-90"
                      >
                        Connect {definition.name}
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-border-subtle bg-surface-base px-3 py-2.5 text-center text-xs leading-5 text-text-muted">
                        OAuth credentials not configured
                      </div>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </section>

        <p className="mt-6 text-xs leading-5 text-text-muted">
          Connections use read-oriented scopes. Mabojolu does not ask providers for unrestricted account control simply to establish a workspace connection.
        </p>
      </div>
    </main>
  );
}

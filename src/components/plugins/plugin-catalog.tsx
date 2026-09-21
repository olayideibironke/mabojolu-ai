/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

import {
  MARKETPLACE_CATEGORY_ORDER,
  PLUGIN_MARKETPLACE,
  marketplaceLogoUrl,
  type MarketplacePluginDefinition,
} from "@/lib/plugins/marketplace";

import type {
  PluginAccessTier,
  PluginCategory,
  PluginConnectionMode,
  PluginProviderId,
} from "@/lib/plugins/registry";

export interface PluginCatalogItem {
  id:
    PluginProviderId;

  name:
    string;

  description:
    string;

  capabilities:
    string[];

  permissionNote?:
    string;

  accessTier:
    PluginAccessTier;

  category:
    PluginCategory;

  connectionMode:
    PluginConnectionMode;

  configured:
    boolean;

  allowed:
    boolean;

  accountLabel?:
    string |
    null;
}

function PluginLogo({
  name,
  domain,
  size =
    "md",
}: {
  name:
    string;

  domain?:
    string;

  size?:
    "sm" |
    "md";
}) {
  const logo =
    marketplaceLogoUrl(
      domain,
    );

  const dimension =
    size ===
      "sm"
      ? "h-9 w-9"
      : "h-10 w-10";

  return (
    <span
      className={`${dimension} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-base text-sm font-semibold text-text-secondary`}
      aria-hidden="true"
    >
      {logo ? (
        <img
          src={
            logo
          }
          alt=""
          className="h-7 w-7 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        name
          .slice(
            0,
            1,
          )
          .toUpperCase()
      )}
    </span>
  );
}

function accessLabel(
  runtime:
    PluginCatalogItem |
    undefined,
):
  string {
  if (!runtime) {
    return "Free";
  }

  return runtime.accessTier ===
    "free"
    ? "Free"
    : "Premium";
}

function searchBlob(
  entry:
    MarketplacePluginDefinition,
):
  string {
  return [
    entry.name,
    entry.description,
    entry.category,
    entry.domain ??
      "",
  ]
    .join(
      " ",
    )
    .toLowerCase();
}

export function PluginCatalog({
  items,
  returnTo,
}: {
  items:
    PluginCatalogItem[];

  returnTo:
    string;
}) {
  const [
    query,
    setQuery,
  ] = useState("");

  const [
    installOpen,
    setInstallOpen,
  ] = useState(false);

  const [
    installQuery,
    setInstallQuery,
  ] = useState("");

  const [
    manageProvider,
    setManageProvider,
  ] = useState<
    PluginProviderId |
    null
  >(
    null,
  );

  const runtimeByProvider =
    useMemo(
      () =>
        new Map<
          PluginProviderId,
          PluginCatalogItem
        >(
          items.map(
            (
              item,
            ) => [
              item.id,
              item,
            ] as const,
          ),
        ),
      [
        items,
      ],
    );

  const installed =
    useMemo(
      () =>
        PLUGIN_MARKETPLACE
          .filter(
            (
              entry,
            ) => {
              if (
                !entry.providerId
              ) {
                return false;
              }

              return Boolean(
                runtimeByProvider
                  .get(
                    entry.providerId,
                  )
                  ?.accountLabel,
              );
            },
          )
          .filter(
            (
              entry,
              index,
              array,
            ) =>
              array.findIndex(
                (
                  candidate,
                ) =>
                  candidate
                    .providerId ===
                  entry.providerId,
              ) ===
              index,
          ),
      [
        runtimeByProvider,
      ],
    );

  const visibleEntries =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        if (!normalized) {
          return [
            ...PLUGIN_MARKETPLACE,
          ];
        }

        return PLUGIN_MARKETPLACE
          .filter(
            (
              entry,
            ) =>
              searchBlob(
                entry,
              ).includes(
                normalized,
              ),
          );
      },
      [
        query,
      ],
    );

  const installableEntries =
    useMemo(
      () => {
        const normalized =
          installQuery
            .trim()
            .toLowerCase();

        return PLUGIN_MARKETPLACE
          .filter(
            (
              entry,
            ) => {
              if (
                !entry.providerId
              ) {
                return false;
              }

              const runtime =
                runtimeByProvider
                  .get(
                    entry.providerId,
                  );

              if (
                !runtime ||
                !runtime.configured ||
                runtime.connectionMode !==
                  "oauth" ||
                runtime.accountLabel
              ) {
                return false;
              }

              if (!normalized) {
                return true;
              }

              return searchBlob(
                entry,
              ).includes(
                normalized,
              );
            },
          )
          .filter(
            (
              entry,
              index,
              array,
            ) =>
              array.findIndex(
                (
                  candidate,
                ) =>
                  candidate
                    .providerId ===
                  entry.providerId,
              ) ===
              index,
          );
      },
      [
        installQuery,
        runtimeByProvider,
      ],
    );

  const connectReturnQuery =
    `?returnTo=${encodeURIComponent(
      returnTo,
    )}`;

  function providerAction(
    entry:
      MarketplacePluginDefinition,
  ) {
    const providerId =
      entry.providerId;

    const runtime =
      providerId
        ? runtimeByProvider
            .get(
              providerId,
            )
        : undefined;

    if (
      providerId &&
      runtime
        ?.accountLabel
    ) {
      const isOpen =
        manageProvider ===
        providerId;

      return (
        <div className="relative">
          <button
            type="button"
            aria-label={`Manage ${entry.name}`}
            aria-expanded={
              isOpen
            }
            onClick={() =>
              setManageProvider(
                (
                  current,
                ) =>
                  current ===
                  providerId
                    ? null
                    : providerId,
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
          >
            &hellip;
          </button>

          {isOpen ? (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-border-default bg-surface-raised p-2 shadow-lg">
              <p className="truncate px-2 py-1 text-xs text-text-muted">
                {runtime.accountLabel}
              </p>

              <form
                action={`/api/plugins/${providerId}/disconnect`}
                method="post"
              >
                <button
                  type="submit"
                  className="mt-1 flex h-9 w-full items-center rounded-lg px-2 text-left text-sm text-danger hover:bg-surface-sunken"
                >
                  Disconnect
                </button>
              </form>
            </div>
          ) : null}
        </div>
      );
    }

    if (
      providerId &&
      runtime &&
      !runtime.allowed
    ) {
      return (
        <Link
          href="/pricing"
          aria-label={`View plan for ${entry.name}`}
          title={`${entry.name} requires a Mabojolu plan`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-xl font-light text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          +
        </Link>
      );
    }

    if (
      providerId &&
      runtime?.configured &&
      runtime.connectionMode ===
        "oauth"
    ) {
      return (
        <Link
          href={`/api/plugins/${providerId}/connect${connectReturnQuery}`}
          aria-label={`Connect ${entry.name}`}
          title={`Connect ${entry.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-xl font-light text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          +
        </Link>
      );
    }

    return (
      <span
        title={`${entry.name} integration is not available yet`}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-medium text-text-muted"
      >
        Soon
      </span>
    );
  }

  return (
    <section className="pb-16">
      <div className="mb-4">
        <Link
          href={
            returnTo
          }
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          <span
            aria-hidden="true"
          >
            &larr;
          </span>

          <span>
            Back to chat
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-6 border-b border-border-subtle pb-6">
        <div className="mx-auto flex rounded-full bg-surface-sunken p-1">
          <span className="rounded-full bg-surface-raised px-6 py-2 text-sm font-semibold text-text-primary shadow-sm">
            Plugins
          </span>

          <button
            type="button"
            disabled
            title="Skills are coming to Mabojolu."
            className="rounded-full px-6 py-2 text-sm font-medium text-text-muted"
          >
            Skills
          </button>
        </div>

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
              Plugins
            </h1>

            <p className="mt-1 text-sm text-text-secondary">
              Work with Mabojolu across your favorite tools.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative block">
              <span className="sr-only">
                Search plugins
              </span>

              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
              >
                &#128269;
              </span>

              <input
                type="search"
                value={
                  query
                }
                onChange={(
                  event,
                ) =>
                  setQuery(
                    event
                      .currentTarget
                      .value,
                  )
                }
                placeholder="Search plugins"
                className="h-10 w-64 rounded-full border border-border-default bg-surface-base pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setInstallQuery(
                  "",
                );

                setInstallOpen(
                  true,
                );
              }}
              aria-label="Add a plugin"
              title="Add a plugin"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-base text-2xl font-light text-text-primary transition-colors hover:bg-surface-sunken"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 text-sm font-semibold text-text-primary">
            <span>
              Installed ({installed.length})
            </span>

            <span
              aria-hidden="true"
              className="text-text-muted"
            >
              &rsaquo;
            </span>
          </div>

          {installed.length >
          0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {installed.map(
                (
                  entry,
                ) => (
                  <div
                    key={
                      entry.id
                    }
                    title={
                      entry.name
                    }
                  >
                    <PluginLogo
                      name={
                        entry.name
                      }
                      domain={
                        entry.domain
                      }
                      size="md"
                    />
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-muted">
              Connected plugins will appear here.
            </p>
          )}
        </div>
      </div>

      {MARKETPLACE_CATEGORY_ORDER.map(
        (
          category,
        ) => {
          const categoryEntries =
            visibleEntries
              .filter(
                (
                  entry,
                ) =>
                  entry.category ===
                  category,
              );

          if (
            categoryEntries
              .length ===
            0
          ) {
            return null;
          }

          return (
            <section
              key={
                category
              }
              className="border-b border-border-subtle py-7 last:border-b-0"
            >
              <h2 className="mb-3 text-sm font-semibold text-text-primary">
                {category}
              </h2>

              <div className="grid gap-x-12 lg:grid-cols-2">
                {categoryEntries.map(
                  (
                    entry,
                  ) => {
                    const runtime =
                      entry.providerId
                        ? runtimeByProvider
                            .get(
                              entry
                                .providerId,
                            )
                        : undefined;

                    return (
                      <div
                        key={
                          entry.id
                        }
                        className="group flex min-h-18 items-center gap-3 rounded-xl px-1 py-2.5"
                      >
                        <PluginLogo
                          name={
                            entry.name
                          }
                          domain={
                            entry.domain
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {entry.name}
                            </p>

                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              accessLabel(
                                runtime,
                              ) ===
                                "Free"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-surface-sunken text-text-muted"
                            }`}>
                              {accessLabel(
                                runtime,
                              )}
                            </span>
                          </div>

                          <p className="mt-0.5 truncate text-xs text-text-muted">
                            {entry.description}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {providerAction(
                            entry,
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          );
        },
      )}

      {visibleEntries.length ===
      0 ? (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No plugins found
          </p>

          <p className="mt-1 text-sm text-text-muted">
            Try another search.
          </p>
        </div>
      ) : null}

      {installOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget
            ) {
              setInstallOpen(
                false,
              );
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-plugin-title"
            className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="add-plugin-title"
                  className="text-xl font-semibold text-text-primary"
                >
                  Add a plugin
                </h2>

                <p className="mt-1 text-sm text-text-secondary">
                  Choose a service and authorize Mabojolu with that provider.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setInstallOpen(
                    false,
                  )
                }
                aria-label="Close add plugin"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xl text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              >
                &times;
              </button>
            </div>

            <label className="relative mt-5 block">
              <span className="sr-only">
                Search available plugins
              </span>

              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
              >
                &#128269;
              </span>

              <input
                autoFocus
                type="search"
                value={
                  installQuery
                }
                onChange={(
                  event,
                ) =>
                  setInstallQuery(
                    event
                      .currentTarget
                      .value,
                  )
                }
                placeholder="Search available plugins"
                className="h-11 w-full rounded-xl border border-border-default bg-surface-base pl-9 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
              />
            </label>

            <div className="mt-4 max-h-80 overflow-y-auto">
              {installableEntries.length >
              0 ? (
                <div className="space-y-1">
                  {installableEntries.map(
                    (
                      entry,
                    ) => (
                      <Link
                        key={
                          entry.id
                        }
                        href={`/api/plugins/${entry.providerId}/connect${connectReturnQuery}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-sunken"
                      >
                        <PluginLogo
                          name={
                            entry.name
                          }
                          domain={
                            entry.domain
                          }
                          size="sm"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {entry.name}
                          </p>

                          <p className="truncate text-xs text-text-muted">
                            {entry.description}
                          </p>
                        </div>

                        <span
                          aria-hidden="true"
                          className="text-xl font-light text-text-secondary"
                        >
                          +
                        </span>
                      </Link>
                    ),
                  )}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-text-primary">
                    No available plugins found
                  </p>

                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Only integrations already configured by Mabojolu appear here. Users never need to create OAuth apps or enter provider secrets.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

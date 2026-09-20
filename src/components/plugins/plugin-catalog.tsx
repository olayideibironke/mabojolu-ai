/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  useEffect,
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

interface CustomPluginDraft {
  id:
    string;

  name:
    string;

  website:
    string;

  auth:
    "oauth" |
    "api-key" |
    "public";

  access:
    "read" |
    "read-write";

  purpose:
    string;

  createdAt:
    string;
}

const CUSTOM_PLUGIN_STORAGE_KEY =
  "mabojolu.custom-plugin-drafts.v1";

function normalizeDomain(
  website:
    string,
):
  string |
  undefined {
  const trimmed =
    website.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url =
      new URL(
        trimmed.includes(
          "://",
        )
          ? trimmed
          : `https://${trimmed}`,
      );

    return url.hostname;
  } catch {
    return trimmed
      .replace(
        /^https?:\/\//,
        "",
      )
      .split(
        "/",
      )[0];
  }
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
}: {
  items:
    PluginCatalogItem[];
}) {
  const [
    query,
    setQuery,
  ] = useState("");

  const [
    wizardOpen,
    setWizardOpen,
  ] = useState(false);

  const [
    wizardStep,
    setWizardStep,
  ] = useState(1);

  const [
    draftName,
    setDraftName,
  ] = useState("");

  const [
    draftWebsite,
    setDraftWebsite,
  ] = useState("");

  const [
    draftAuth,
    setDraftAuth,
  ] = useState<
    CustomPluginDraft[
      "auth"
    ]
  >(
    "oauth",
  );

  const [
    draftAccess,
    setDraftAccess,
  ] = useState<
    CustomPluginDraft[
      "access"
    ]
  >(
    "read",
  );

  const [
    draftPurpose,
    setDraftPurpose,
  ] = useState("");

  const [
    customDrafts,
    setCustomDrafts,
  ] = useState<
    CustomPluginDraft[]
  >(
    [],
  );

  const [
    savedMessage,
    setSavedMessage,
  ] = useState<
    string |
    null
  >(
    null,
  );

  const [
    manageProvider,
    setManageProvider,
  ] = useState<
    PluginProviderId |
    null
  >(
    null,
  );

  useEffect(
    () => {
      const timeoutId =
        window.setTimeout(
          () => {
            try {
              const raw =
                window.localStorage
                  .getItem(
                    CUSTOM_PLUGIN_STORAGE_KEY,
                  );

              if (!raw) {
                return;
              }

              const parsed =
                JSON.parse(
                  raw,
                );

              if (
                Array.isArray(
                  parsed,
                )
              ) {
                setCustomDrafts(
                  parsed as
                    CustomPluginDraft[],
                );
              }
            } catch {
              // Ignore malformed local drafts and keep the marketplace usable.
            }
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [],
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

  function openWizard(
    entry?:
      MarketplacePluginDefinition,
  ) {
    setWizardStep(
      1,
    );

    setDraftName(
      entry?.name ??
        "",
    );

    setDraftWebsite(
      entry?.domain
        ? `https://${entry.domain}`
        : "",
    );

    setDraftAuth(
      "oauth",
    );

    setDraftAccess(
      "read",
    );

    setDraftPurpose(
      "",
    );

    setWizardOpen(
      true,
    );

    setSavedMessage(
      null,
    );
  }

  function closeWizard() {
    setWizardOpen(
      false,
    );

    setWizardStep(
      1,
    );
  }

  function savePluginDraft() {
    const name =
      draftName
        .trim();

    if (!name) {
      return;
    }

    const draft:
      CustomPluginDraft = {
        id:
          crypto
            .randomUUID(),

        name,

        website:
          draftWebsite
            .trim(),

        auth:
          draftAuth,

        access:
          draftAccess,

        purpose:
          draftPurpose
            .trim(),

        createdAt:
          new Date()
            .toISOString(),
      };

    const next = [
      ...customDrafts,
      draft,
    ];

    setCustomDrafts(
      next,
    );

    try {
      window.localStorage
        .setItem(
          CUSTOM_PLUGIN_STORAGE_KEY,
          JSON.stringify(
            next,
          ),
        );
    } catch {
      // Saving the request is best-effort; never block the marketplace.
    }

    setSavedMessage(
      `${name} setup request saved on this browser.`,
    );

    closeWizard();
  }

  function pluginAction(
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-xl font-light text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          +
        </Link>
      );
    }

    if (
      providerId &&
      runtime
    ) {
      return (
        <Link
          href={`/api/plugins/${providerId}/connect`}
          aria-label={`Connect ${entry.name}`}
          title={`Connect ${entry.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-xl font-light text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
        >
          +
        </Link>
      );
    }

    return (
      <button
        type="button"
        aria-label={`Add custom plugin ${entry.name}`}
        title={`Set up ${entry.name}`}
        onClick={() =>
          openWizard(
            entry,
          )
        }
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-default text-xl font-light text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
      >
        +
      </button>
    );
  }

  return (
    <section className="pb-16">
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
              onClick={() =>
                openWizard()
              }
              aria-label="Add a plugin"
              title="Add a plugin"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-default bg-surface-base text-2xl font-light text-text-primary transition-colors hover:bg-surface-sunken"
            >
              +
            </button>
          </div>
        </div>

        {savedMessage ? (
          <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            {savedMessage}
          </div>
        ) : null}

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
                          {pluginAction(
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
            Try another search or use the + button to add one.
          </p>
        </div>
      ) : null}

      {customDrafts.length >
      0 ? (
        <section className="border-t border-border-subtle py-7">
          <h2 className="text-sm font-semibold text-text-primary">
            Your plugin setup requests
          </h2>

          <div className="mt-3 grid gap-x-12 lg:grid-cols-2">
            {customDrafts.map(
              (
                draft,
              ) => (
                <div
                  key={
                    draft.id
                  }
                  className="flex min-h-18 items-center gap-3 rounded-xl py-2.5"
                >
                  <PluginLogo
                    name={
                      draft.name
                    }
                    domain={
                      normalizeDomain(
                        draft.website,
                      )
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {draft.name}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {draft.auth ===
                      "oauth"
                        ? "OAuth"
                        : draft.auth ===
                            "api-key"
                          ? "API key"
                          : "Public API"}{" "}
                      · {draft.access ===
                      "read"
                        ? "Read only"
                        : "Read and write"} · Setup pending
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {wizardOpen ? (
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
              closeWizard();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plugin-wizard-title"
            className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Add a plugin · Step {wizardStep} of 3
                </p>

                <h2
                  id="plugin-wizard-title"
                  className="mt-1 text-xl font-semibold text-text-primary"
                >
                  {wizardStep ===
                  1
                    ? "Which tool do you want to add?"
                    : wizardStep ===
                        2
                      ? "How should Mabojolu connect?"
                      : "What should Mabojolu be allowed to do?"}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeWizard
                }
                aria-label="Close add plugin"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xl text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              >
                &times;
              </button>
            </div>

            {wizardStep ===
            1 ? (
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-text-primary">
                    Plugin name
                  </span>

                  <input
                    value={
                      draftName
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraftName(
                        event
                          .currentTarget
                          .value,
                      )
                    }
                    placeholder="e.g. Vercel"
                    className="mt-2 h-11 w-full rounded-xl border border-border-default bg-surface-base px-3 text-sm outline-none focus:border-border-strong"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-text-primary">
                    Website or API URL
                  </span>

                  <input
                    value={
                      draftWebsite
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraftWebsite(
                        event
                          .currentTarget
                          .value,
                      )
                    }
                    placeholder="https://example.com"
                    className="mt-2 h-11 w-full rounded-xl border border-border-default bg-surface-base px-3 text-sm outline-none focus:border-border-strong"
                  />
                </label>
              </div>
            ) : wizardStep ===
              2 ? (
              <div className="mt-6 space-y-3">
                {(
                  [
                    [
                      "oauth",
                      "OAuth",
                      "Sign in through the provider. Recommended when available.",
                    ],
                    [
                      "api-key",
                      "API key",
                      "Use a provider-issued key. Mabojolu will not collect the secret in this browser form.",
                    ],
                    [
                      "public",
                      "Public API",
                      "No account credential is required.",
                    ],
                  ] as const
                ).map(
                  (
                    [
                      value,
                      title,
                      detail,
                    ],
                  ) => (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        setDraftAuth(
                          value,
                        )
                      }
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        draftAuth ===
                          value
                          ? "border-border-strong bg-surface-sunken"
                          : "border-border-default hover:bg-surface-sunken"
                      }`}
                    >
                      <p className="text-sm font-semibold text-text-primary">
                        {title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-text-muted">
                        {detail}
                      </p>
                    </button>
                  ),
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Access level
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftAccess(
                          "read",
                        )
                      }
                      className={`rounded-xl border p-3 text-sm font-medium ${
                        draftAccess ===
                          "read"
                          ? "border-border-strong bg-surface-sunken"
                          : "border-border-default"
                      }`}
                    >
                      Read only
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftAccess(
                          "read-write",
                        )
                      }
                      className={`rounded-xl border p-3 text-sm font-medium ${
                        draftAccess ===
                          "read-write"
                          ? "border-border-strong bg-surface-sunken"
                          : "border-border-default"
                      }`}
                    >
                      Read & write
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-text-primary">
                    What should Mabojolu use this plugin for?
                  </span>

                  <textarea
                    value={
                      draftPurpose
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraftPurpose(
                        event
                          .currentTarget
                          .value,
                      )
                    }
                    rows={
                      4
                    }
                    placeholder="Describe the workflows you want Mabojolu to handle."
                    className="mt-2 w-full resize-none rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm outline-none focus:border-border-strong"
                  />
                </label>

                <p className="text-xs leading-5 text-text-muted">
                  This setup flow never asks for passwords, OAuth secrets, or API keys. It records the connector request so the integration can be wired safely.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  wizardStep ===
                    1
                    ? closeWizard()
                    : setWizardStep(
                        (
                          current,
                        ) =>
                          current -
                          1,
                      )
                }
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border-default px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
              >
                {wizardStep ===
                1
                  ? "Cancel"
                  : "Back"}
              </button>

              {wizardStep <
              3 ? (
                <button
                  type="button"
                  disabled={
                    wizardStep ===
                      1 &&
                    !draftName
                      .trim()
                  }
                  onClick={() =>
                    setWizardStep(
                      (
                        current,
                      ) =>
                        current +
                        1,
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-inverse px-5 text-sm font-semibold text-text-inverse disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    savePluginDraft
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-inverse px-5 text-sm font-semibold text-text-inverse"
                >
                  Add plugin
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

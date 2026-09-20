"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

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

type TierFilter =
  | "all"
  | "free"
  | "paid";

function searchText(
  item:
    PluginCatalogItem,
):
  string {
  return [
    item.name,
    item.description,
    item.category,
    ...item.capabilities,
    item.permissionNote ??
      "",
  ]
    .join(
      " ",
    )
    .toLowerCase();
}

function tierLabel(
  tier:
    PluginAccessTier,
):
  string {
  return tier ===
    "free"
    ? "Free"
    : "Premium";
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
    tier,
    setTier,
  ] = useState<
    TierFilter
  >(
    "all",
  );

  const visible =
    useMemo(
      () => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        return items.filter(
          (
            item,
          ) => {
            if (
              tier !==
                "all" &&
              item.accessTier !==
                tier
            ) {
              return false;
            }

            if (
              !normalized
            ) {
              return true;
            }

            return searchText(
              item,
            ).includes(
              normalized,
            );
          },
        );
      },
      [
        items,
        query,
        tier,
      ],
    );

  return (
    <section className="mt-8">
      <div className="rounded-2xl border border-border-subtle bg-surface-raised p-4">
        <label
          htmlFor="plugin-search"
          className="text-sm font-semibold text-text-primary"
        >
          Find a plugin
        </label>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id="plugin-search"
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
            placeholder="Search GitHub, Vercel, Supabase, Calendar..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-border-default bg-surface-base px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
          />

          <div
            className="flex flex-wrap gap-2"
            aria-label="Plugin access filter"
          >
            {(
              [
                [
                  "all",
                  "All",
                ],
                [
                  "free",
                  "Free",
                ],
                [
                  "paid",
                  "Premium",
                ],
              ] as const
            ).map(
              (
                [
                  value,
                  label,
                ],
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setTier(
                      value,
                    )
                  }
                  aria-pressed={
                    tier ===
                    value
                  }
                  className={`h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    tier ===
                      value
                      ? "border-text-primary bg-surface-inverse text-text-inverse"
                      : "border-border-default bg-surface-base text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-text-muted">
          {visible.length} plugin
          {visible.length ===
          1
            ? ""
            : "s"}{" "}
          shown
        </p>
      </div>

      {visible.length >
      0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(
            (
              item,
            ) => (
              <article
                key={
                  item.id
                }
                className="flex min-h-[320px] flex-col rounded-2xl border border-border-subtle bg-surface-raised p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-text-primary">
                      {item.name}
                    </p>

                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      {item.category ===
                      "developer"
                        ? "Developer"
                        : "Productivity"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      item.accessTier ===
                        "free"
                        ? "border-border-default bg-surface-base text-text-primary"
                        : "border-border-subtle bg-surface-sunken text-text-secondary"
                    }`}
                  >
                    {tierLabel(
                      item.accessTier,
                    )}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {item.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.capabilities.map(
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

                {item.permissionNote ? (
                  <p className="mt-4 text-xs leading-5 text-text-muted">
                    {item.permissionNote}
                  </p>
                ) : null}

                <div className="mt-auto pt-6">
                  {item.accountLabel ? (
                    <>
                      <p className="text-xs font-semibold text-text-primary">
                        Connected
                      </p>

                      <p className="mt-1 truncate text-xs text-text-muted">
                        {item.accountLabel}
                      </p>

                      <form
                        action={`/api/plugins/${item.id}/disconnect`}
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
                  ) : !item.allowed ? (
                    <div className="flex h-10 items-center justify-center rounded-xl border border-border-subtle bg-surface-base text-sm text-text-muted">
                      Paid plan required
                    </div>
                  ) : item.connectionMode ===
                    "setup-required" ? (
                    <div className="rounded-xl border border-border-subtle bg-surface-base px-3 py-2.5 text-center">
                      <p className="text-xs font-semibold text-text-primary">
                        Free plugin
                      </p>

                      <p className="mt-0.5 text-[11px] leading-5 text-text-muted">
                        OAuth setup required before connections can open.
                      </p>
                    </div>
                  ) : item.configured ? (
                    <Link
                      href={`/api/plugins/${item.id}/connect`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse hover:opacity-90"
                    >
                      Connect {item.name}
                    </Link>
                  ) : (
                    <div className="rounded-xl border border-border-subtle bg-surface-base px-3 py-2.5 text-center text-xs leading-5 text-text-muted">
                      OAuth credentials not configured
                    </div>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border-subtle bg-surface-raised px-5 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">
            No plugins found
          </p>

          <p className="mt-1 text-sm text-text-muted">
            Try another search or access filter.
          </p>
        </div>
      )}
    </section>
  );
}

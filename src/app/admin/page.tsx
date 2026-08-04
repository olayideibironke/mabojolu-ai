import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/ui/brand-mark";
import { getSession } from "@/lib/auth/session";
import { MODEL_REGISTRY } from "@/lib/ai/models";
import { getDatabase } from "@/lib/database";
import { inspectServerEnv } from "@/lib/env";
import { currentConcurrency } from "@/lib/security/limits";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** Never cached: these figures must be current, and they are per-request. */
export const dynamic = "force-dynamic";

/**
 * Administration.
 *
 * Access is enforced server-side, in this Server Component, before any data is
 * fetched. Two deliberate choices:
 *
 *   1. The role is read from the database, never from a token claim, a header, or
 *      anything the client could assert.
 *   2. A non-admin gets `notFound()` rather than a "forbidden" page, so the
 *      existence of this area is not confirmed to someone with no access to it.
 *
 * Message content is deliberately absent. Everything here is a count or an
 * aggregate, because an operations view should not become a way to read private
 * conversations.
 */
export default async function AdminPage() {
  const session = await getSession();

  // Fails closed: no session, or a non-admin, both look like a missing page.
  if (!session || session.profile.role !== "admin") {
    notFound();
  }

  const database = getDatabase();
  const metrics = await database.getAdminMetrics();
  const envResult = inspectServerEnv();
  const env = envResult.ok ? envResult.env : null;
  const concurrency = currentConcurrency();

  const totalCost = metrics.usageByModel.reduce(
    (sum, row) => sum + row.estimatedCostUsd,
    0,
  );

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.02em]">
                Mabojolu administration
              </h1>
              <p className="text-xs text-text-muted">
                Signed in as {session.email}
              </p>
            </div>
          </div>

          {/* `Link` rather than an anchor: a client-side transition keeps the
              app shell mounted instead of reloading the whole document. */}
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-xl border border-border-default bg-surface-raised px-3 text-sm font-medium transition-colors hover:border-border-strong"
          >
            Back to chat
          </Link>
        </header>

        {/* States plainly when the installation is not production-grade, so these
            figures are not mistaken for production telemetry. */}
        {database.kind === "local" ? (
          <div
            role="status"
            className="mb-6 rounded-xl border border-border-subtle bg-accent-subtle px-4 py-3"
          >
            <p className="text-sm font-medium">Development storage in use</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              This installation stores data in a local JSON file. Figures below
              reflect that file only, and it has no database-level access control.
              Configure Supabase for production.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="totals-heading" className="mb-8">
          <h2 id="totals-heading" className="mb-3 text-sm font-semibold">
            Totals
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Users" value={metrics.userCount.toLocaleString()} />
            <Stat
              label="Conversations"
              value={metrics.conversationCount.toLocaleString()}
            />
            <Stat label="Messages" value={metrics.messageCount.toLocaleString()} />
            <Stat
              label="Estimated cost"
              value={`$${totalCost.toFixed(4)}`}
              hint="Estimated from configured pricing, not a provider invoice."
            />
          </dl>
        </section>

        <section aria-labelledby="usage-heading" className="mb-8">
          <h2 id="usage-heading" className="mb-3 text-sm font-semibold">
            Usage by model
          </h2>

          {metrics.usageByModel.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-default px-4 py-6 text-center text-sm text-text-muted">
              No usage recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-surface-sunken text-left">
                  <tr>
                    <Th>Provider</Th>
                    <Th>Model</Th>
                    <Th align="right">Requests</Th>
                    <Th align="right">Input tokens</Th>
                    <Th align="right">Output tokens</Th>
                    <Th align="right">Est. cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.usageByModel.map((row) => (
                    <tr
                      key={`${row.provider}:${row.model}`}
                      className="border-t border-border-subtle"
                    >
                      <Td>{row.provider}</Td>
                      <Td>{row.model}</Td>
                      <Td align="right">{row.requests.toLocaleString()}</Td>
                      <Td align="right">{row.inputTokens.toLocaleString()}</Td>
                      <Td align="right">{row.outputTokens.toLocaleString()}</Td>
                      <Td align="right">${row.estimatedCostUsd.toFixed(4)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="mb-3 text-sm font-semibold">
              Feedback
            </h2>
            <div className="rounded-xl border border-border-subtle p-4">
              <p className="text-sm">
                <span className="font-medium text-success">
                  {metrics.feedback.up}
                </span>{" "}
                positive,{" "}
                <span className="font-medium text-danger">
                  {metrics.feedback.down}
                </span>{" "}
                negative
              </p>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                Ratings only. Message content is not shown here.
              </p>
            </div>
          </section>

          <section aria-labelledby="errors-heading">
            <h2 id="errors-heading" className="mb-3 text-sm font-semibold">
              Recent errors
            </h2>
            <div className="rounded-xl border border-border-subtle p-4">
              {metrics.recentErrors.length === 0 ? (
                <p className="text-sm text-text-muted">No errors recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {metrics.recentErrors.map((row) => (
                    <li
                      key={row.code}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <code className="font-mono text-xs">{row.code}</code>
                      <span className="tabular-nums text-text-secondary">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <section aria-labelledby="safety-heading" className="mb-8">
          <h2 id="safety-heading" className="mb-3 text-sm font-semibold">
            Safety events
          </h2>
          <div className="rounded-xl border border-border-subtle p-4">
            {metrics.safetyEvents.length === 0 ? (
              <p className="text-sm text-text-muted">No safety events recorded.</p>
            ) : (
              <ul className="space-y-1.5">
                {metrics.safetyEvents.map((row) => (
                  <li
                    key={`${row.kind}:${row.severity}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0">
                      <code className="font-mono text-xs">{row.kind}</code>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                          row.severity === "critical"
                            ? "bg-danger-subtle text-danger"
                            : row.severity === "warning"
                              ? "bg-accent-subtle text-accent"
                              : "bg-surface-sunken text-text-muted"
                        }`}
                      >
                        {row.severity}
                      </span>
                    </span>
                    <span className="tabular-nums text-text-secondary">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs leading-5 text-text-muted">
              Event kinds and counts only. Prompt and message content is never
              recorded in safety telemetry.
            </p>
          </div>
        </section>

        <section aria-labelledby="models-heading" className="mb-8">
          <h2 id="models-heading" className="mb-3 text-sm font-semibold">
            Model registry
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left">
                <tr>
                  <Th>Model</Th>
                  <Th>Provider</Th>
                  <Th align="right">Context</Th>
                  <Th align="right">In $/M</Th>
                  <Th align="right">Out $/M</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {MODEL_REGISTRY.map((model) => (
                  <tr key={model.id} className="border-t border-border-subtle">
                    <Td>{model.displayName}</Td>
                    <Td>{model.providerId}</Td>
                    <Td align="right">
                      {(model.contextWindowTokens / 1000).toLocaleString()}K
                    </Td>
                    <Td align="right">
                      ${model.pricing.inputPerMillionUsd.toFixed(2)}
                    </Td>
                    <Td align="right">
                      ${model.pricing.outputPerMillionUsd.toFixed(2)}
                    </Td>
                    <Td>
                      {model.enabled ? (
                        <span className="text-success">Enabled</span>
                      ) : (
                        <span className="text-text-muted">Disabled</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-muted">
            Enabling and disabling models at runtime is stored in the
            model_configurations table. Editing it from this page is not
            implemented yet, so changes are made in the database or the code
            registry.
          </p>
        </section>

        <section aria-labelledby="config-heading">
          <h2 id="config-heading" className="mb-3 text-sm font-semibold">
            Active configuration
          </h2>
          <dl className="grid gap-2 rounded-xl border border-border-subtle p-4 text-sm sm:grid-cols-2">
            <Config label="AI provider" value={env?.AI_PROVIDER ?? "unknown"} />
            <Config label="Persistence" value={database.kind} />
            <Config label="Auth mode" value={env?.AUTH_MODE ?? "unknown"} />
            <Config
              label="Attachments"
              value={env?.MABOJOLU_ATTACHMENTS_ENABLED ? "enabled" : "disabled"}
            />
            <Config
              label="Daily message limit"
              value={String(env?.MABOJOLU_DAILY_MESSAGE_LIMIT ?? "-")}
            />
            <Config
              label="Concurrent generations"
              value={String(env?.MABOJOLU_MAX_CONCURRENT_GENERATIONS ?? "-")}
            />
            <Config
              label="Rate limit"
              value={`${env?.MABOJOLU_RATE_LIMIT_MAX ?? "-"} per ${
                (env?.MABOJOLU_RATE_LIMIT_WINDOW_MS ?? 0) / 1000
              }s`}
            />
            <Config
              label="Daily cost ceiling"
              value={
                env?.MABOJOLU_DAILY_COST_LIMIT_USD
                  ? `$${env.MABOJOLU_DAILY_COST_LIMIT_USD.toFixed(2)}`
                  : "not set"
              }
            />
            <Config
              label="Maintenance mode"
              value={env?.MABOJOLU_MAINTENANCE_MODE ? "on" : "off"}
            />
            <Config
              label="Generations running"
              value={String(
                concurrency.reduce((sum, row) => sum + row.running, 0),
              )}
            />
          </dl>

          <p className="mt-3 text-xs leading-5 text-text-muted">
            Rate limiting and concurrency are tracked in process. On a
            multi-instance deployment each instance keeps its own counters, so the
            effective limit is per instance. Replace the store in
            src/lib/security/rate-limit.ts with a shared backend before relying on
            these as global limits.
          </p>
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </dd>
      {hint ? (
        <dd className="mt-1 text-[11px] leading-4 text-text-muted">{hint}</dd>
      ) : null}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-semibold ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-3 py-2 ${
        align === "right" ? "text-right tabular-nums" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function Config({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

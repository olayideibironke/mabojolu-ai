import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

export default async function ScheduledPage() {
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

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Mabojolu workspace
        </p>

        <h1 className="mt-1 text-2xl font-semibold">
          Scheduled
        </h1>

        <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-raised p-6">
          <p className="text-sm font-semibold">
            No scheduled work yet
          </p>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Scheduled Mabojolu tasks will appear here after the workspace scheduler is enabled. This page does not simulate or claim background work that has not been scheduled.
          </p>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-xl border border-border-default bg-surface-raised px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
        >
          Back to chat
        </Link>
      </div>
    </main>
  );
}

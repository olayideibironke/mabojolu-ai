import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database";

export default async function LibraryPage() {
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

  const conversations =
    await getDatabase()
      .listConversations(
        session.userId,
        {
          limit:
            100,
        },
      );

  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mabojolu workspace
            </p>

            <h1 className="mt-1 text-2xl font-semibold">
              Library
            </h1>

            <p className="mt-2 text-sm text-text-secondary">
              Your saved Mabojolu conversations.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-xl border border-border-default bg-surface-raised px-4 text-sm font-medium text-text-primary hover:bg-surface-sunken"
          >
            Back to chat
          </Link>
        </div>

        {conversations.length ===
        0 ? (
          <div className="mt-8 rounded-2xl border border-border-subtle bg-surface-raised p-6 text-sm text-text-secondary">
            Your library is empty. Start a conversation and it will appear here.
          </div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {conversations.map(
              (
                conversation,
              ) => (
                <Link
                  key={
                    conversation.id
                  }
                  href={`/?c=${encodeURIComponent(
                    conversation.id,
                  )}`}
                  className="rounded-2xl border border-border-subtle bg-surface-raised p-4 transition-colors hover:border-border-strong hover:bg-surface-sunken"
                >
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {conversation.title}
                  </p>

                  <p className="mt-2 text-xs text-text-muted">
                    {conversation.messageCount} messages
                  </p>
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}

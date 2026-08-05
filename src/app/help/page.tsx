import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/ui/brand-mark";

export const metadata: Metadata = {
  title: "Help",
  description:
    "Get help using Mabojolu, managing your account, and understanding access limits.",
};

const helpTopics = [
  {
    title: "Start a conversation",
    description:
      "Open the Mabojolu homepage, enter your request in the prompt box, and send it. You can begin without creating an account.",
  },
  {
    title: "Create a free account",
    description:
      "Select Sign up for free to keep the conversations you started and access them again later.",
  },
  {
    title: "Log in",
    description:
      "Use the Log in button with the email address and password connected to your Mabojolu account.",
  },
  {
    title: "Reset your password",
    description:
      "Open the Log in page, choose Forgot password, and follow the secure link sent to your email.",
  },
  {
    title: "Upload an image",
    description:
      "Use the attachment control in the prompt box to upload an image for Mabojolu to describe, review, or analyze.",
  },
  {
    title: "Usage limits",
    description:
      "Guest and free access include usage allowances. When an allowance is reached, Mabojolu will explain whether an account, paid plan, or waiting period is required.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-dvh bg-surface-base px-4 py-8 text-text-primary sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <BrandMark size="sm" />

            <span className="text-sm font-semibold">
              Mabojolu
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
            >
              Log in
            </Link>

            <Link
              href="/sign-in?mode=sign-up"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-raised"
            >
              Sign up for free
            </Link>
          </div>
        </header>

        <section className="pb-12 pt-20 text-center">
          <p className="text-sm font-semibold text-text-secondary">
            Mabojolu Help
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            How can we help?
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-secondary">
            Find quick answers about conversations, accounts, image uploads,
            access limits, and getting back into Mabojolu.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {helpTopics.map((topic) => (
            <article
              key={topic.title}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-6 shadow-sm"
            >
              <h2 className="text-base font-semibold">
                {topic.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {topic.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border border-border-default bg-surface-raised p-7 text-center shadow-sm">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            Ready to continue?
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">
            Return to Mabojolu to begin a new conversation, or review the plans
            page for information about access options.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-surface-inverse px-5 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
            >
              Return to Mabojolu
            </Link>

            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border-default bg-surface-base px-5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-muted"
            >
              See plans and pricing
            </Link>
          </div>
        </section>

        <footer className="mt-14 border-t border-border-subtle py-8 text-center text-xs text-text-muted">
          Mabojolu by Westforge Holdings Inc.
        </footer>
      </div>
    </main>
  );
}
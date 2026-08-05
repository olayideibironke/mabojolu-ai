import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/ui/brand-mark";

export const metadata: Metadata = {
  title: "Plans and pricing",
  description:
    "Explore Mabojolu access options and upcoming paid plans.",
};

export default function PricingPage() {
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
            Mabojolu plans
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Start free. Upgrade when you need more.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-text-secondary">
            Use Mabojolu without creating an account, then sign up free to keep
            your conversations. Paid plans will provide expanded usage and
            additional capabilities.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-border-default bg-surface-raised p-7 shadow-sm">
            <p className="text-sm font-semibold text-text-secondary">
              Free
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              Explore Mabojolu
            </h2>

            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Begin prompting immediately. Create a free account when you are
              ready to keep your conversations and continue using Mabojolu.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-text-primary">
              <li>Start without creating an account</li>
              <li>Free registered account</li>
              <li>Saved conversation history</li>
              <li>Text and image analysis</li>
            </ul>

            <Link
              href="/"
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
            >
              Start using Mabojolu
            </Link>
          </article>

          <article className="rounded-3xl border border-border-default bg-surface-raised p-7 shadow-sm">
            <p className="text-sm font-semibold text-text-secondary">
              Paid plans
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              More access is coming
            </h2>

            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Mabojolu paid plans are being prepared. Pricing will be published
              after usage limits, billing protections, and premium capabilities
              are fully validated.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-text-primary">
              <li>Expanded prompt allowances</li>
              <li>Shorter or no waiting periods</li>
              <li>Premium response modes</li>
              <li>Additional Mabojolu capabilities</li>
            </ul>

            <div className="mt-8 flex h-11 w-full items-center justify-center rounded-xl border border-border-default bg-surface-base px-4 text-sm font-semibold text-text-muted">
              Coming soon
            </div>
          </article>
        </section>

        <footer className="mt-14 border-t border-border-subtle py-8 text-center text-xs text-text-muted">
          Mabojolu by Westforge Holdings Inc.
        </footer>
      </div>
    </main>
  );
}
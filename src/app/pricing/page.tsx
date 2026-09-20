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
            Try Mabojolu with 10 free responses before signup. Registered free
            accounts receive 20 completed responses in a rolling 4-hour window,
            then can wait for free access to refresh or choose Pro when available.
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
              Begin with 10 guest responses. Sign up free to keep your
              conversations and receive 20 completed responses per rolling
              4-hour window.
            </p>

            <ul className="mt-7 space-y-3 text-sm text-text-primary">
              <li>10 guest responses before signup</li>
              <li>20 registered free responses per 4-hour rolling window</li>
              <li>Free access refreshes automatically after waiting</li>
              <li>Saved conversation history</li>
              <li>Free developer plugins</li>
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
              <li>Premium workspace plugins</li>
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
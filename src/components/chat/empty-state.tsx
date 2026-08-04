"use client";

import Link from "next/link";

import { BrandMark } from "@/components/ui/brand-mark";

/**
 * Empty conversation state.
 *
 * The starter cards send a real prompt rather than filling the composer, so a
 * new user reaches a working answer in one action.
 */

const STARTERS = [
  {
    title: "Create something",
    description: "Draft an email, proposal, story, or business document",
    prompt: "Help me write a clear, persuasive business proposal. Ask me what I need first.",
  },
  {
    title: "Explain something",
    description: "Break down a difficult topic into clear language",
    prompt: "Explain how large language models work, in plain language.",
  },
  {
    title: "Build an idea",
    description: "Turn a rough concept into an actionable plan",
    prompt: "Help me turn a business idea into a practical launch plan with clear next steps.",
  },
  {
    title: "Analyze information",
    description: "Review details and surface the most important insights",
    prompt: "Help me analyze a problem, weigh the tradeoffs, and identify the best next step.",
  },
] as const;

interface EmptyStateProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  isSignedIn?: boolean;
}

export function EmptyState({
  onSelect,
  disabled = false,
  isSignedIn = true,
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 w-fit">
            <BrandMark size="lg" />
          </div>

          <p className="mb-2 text-sm font-medium text-text-secondary">
            Mabojolu by Westforge
          </p>

          {/* The single h1 for this view. The header wordmark is not a heading,
              so the document outline starts here. */}
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary sm:text-4xl">
            What can I help you accomplish?
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-text-secondary sm:text-base">
            Think through ideas, create useful work, analyze information, and move
            from a question to a clear next step.
          </p>
        </div>

        {/* Shown instead of the starter cards when signed out, so a card that
            cannot work is never offered. */}
        {!isSignedIn ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 text-center shadow-sm">
            <p className="text-sm font-medium text-text-primary">
              Sign in to start a conversation
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-text-secondary">
              Your conversations are saved to your account so you can return to
              them.
            </p>
            <Link
              href="/sign-in"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-medium text-text-inverse transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.title}
              type="button"
              onClick={() => onSelect(starter.prompt)}
              disabled={disabled}
              className="rounded-2xl border border-border-subtle bg-surface-raised p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-default hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              <span className="block text-sm font-semibold text-text-primary">
                {starter.title}
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-text-secondary">
                {starter.description}
              </span>
            </button>
          ))}
        </div>
        )}

        <p className="mt-8 text-center text-xs leading-5 text-text-muted">
          Mabojolu does not remember previous conversations, and it cannot browse
          the web or run code. Review important information before relying on it.
        </p>
      </div>
    </div>
  );
}

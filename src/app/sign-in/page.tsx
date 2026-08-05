import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DevSignIn } from "@/components/auth/dev-sign-in";
import { EmailPasswordAuth } from "@/components/auth/email-password-auth";
import { BrandMark } from "@/components/ui/brand-mark";
import { getSession } from "@/lib/auth/session";
import { inspectServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in or create account",
};

/**
 * Mabojolu authentication page.
 *
 * Registered users and administrators are redirected home because they already
 * have permanent accounts.
 *
 * Anonymous guests are intentionally allowed to stay on this page so they can
 * upgrade the current guest identity without losing conversations, usage
 * history, or future billing records connected to that user ID.
 *
 * The active authentication mode is selected on the server so development-only
 * authentication code is never rendered in the production Supabase flow.
 */
export default async function SignInPage() {
  const session = await getSession();

  if (
    session &&
    !session.isAnonymous
  ) {
    redirect("/");
  }

  const envResult =
    inspectServerEnv();

  const authMode =
    envResult.ok
      ? envResult.env.AUTH_MODE
      : "dev";

  const isGuest =
    session?.isAnonymous === true;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-base px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <BrandMark size="lg" />
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text-primary">
            {isGuest
              ? "Keep your Mabojolu conversations"
              : "Welcome to Mabojolu"}
          </h1>

          <p className="mt-2 text-sm text-text-secondary">
            {isGuest
              ? "Create an account or sign in to continue"
              : "Sign in or create your account"}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
          {authMode === "supabase" ? (
            <EmailPasswordAuth />
          ) : (
            <DevSignIn />
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-text-muted">
          Mabojolu can make mistakes. Review important information before
          relying on it.
        </p>
      </div>
    </main>
  );
}
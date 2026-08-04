import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DevSignIn } from "@/components/auth/dev-sign-in";
import { MagicLinkSignIn } from "@/components/auth/magic-link-sign-in";
import { BrandMark } from "@/components/ui/brand-mark";
import { getSession } from "@/lib/auth/session";
import { inspectServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Sign-in page.
 *
 * A Server Component, so the auth mode is decided on the server and only the
 * relevant form is sent to the browser. Rendering both and hiding one would ship
 * a development bypass to production clients.
 */
export default async function SignInPage() {
  // Already signed in: send them to the app rather than showing a form that would
  // do nothing.
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const envResult = inspectServerEnv();
  const authMode = envResult.ok ? envResult.env.AUTH_MODE : "dev";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <BrandMark size="lg" />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text-primary">
            Sign in to Mabojolu
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            A Westforge Holdings Product
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
          {authMode === "supabase" ? <MagicLinkSignIn /> : <DevSignIn />}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-text-muted">
          Mabojolu can make mistakes. Review important information before relying
          on it.
        </p>
      </div>
    </main>
  );
}

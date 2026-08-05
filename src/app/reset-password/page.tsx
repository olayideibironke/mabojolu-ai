import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BrandMark } from "@/components/ui/brand-mark";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reset password",
};

/**
 * Password-reset page.
 *
 * Supabase establishes a temporary authenticated recovery session before sending
 * the user here. Without that session, changing a password must not be allowed.
 */
export default async function ResetPasswordPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in?error=invalid_reset_session");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-base px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <BrandMark size="lg" />
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text-primary">
            Create a new password
          </h1>

          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Choose a secure password for your Mabojolu account.
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
          <ResetPasswordForm />
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-text-muted">
          Remembered your password?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-text-primary underline-offset-4 hover:underline"
          >
            Return to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
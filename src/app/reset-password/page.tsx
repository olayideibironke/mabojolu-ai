import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { BrandMark } from "@/components/ui/brand-mark";
import { RECOVERY_SESSION_COOKIE } from "@/lib/auth/recovery";
import { createServerSupabaseClient } from "@/lib/auth/supabase-server";

export const metadata: Metadata = {
  title: "Reset password",
};

/**
 * Password-reset page.
 *
 * The form is shown only after Mabojolu has exchanged a valid emailed auth code
 * and marked this browser as being inside a short-lived password-setup flow.
 */
export default async function ResetPasswordPage() {
  const cookieStore =
    await cookies();

  if (
    cookieStore.get(
      RECOVERY_SESSION_COOKIE,
    )?.value !==
      "1"
  ) {
    redirect(
      "/sign-in?error=invalid_reset_session",
    );
  }

  const client =
    await createServerSupabaseClient();

  if (!client) {
    redirect(
      "/sign-in?error=invalid_reset_session",
    );
  }

  const {
    data,
    error,
  } =
    await client.auth.getUser();

  if (
    error ||
    !data.user
  ) {
    redirect(
      "/sign-in?error=invalid_reset_session",
    );
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

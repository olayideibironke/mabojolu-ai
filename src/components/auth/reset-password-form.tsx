"use client";

import {
  type FormEvent,
  useState,
} from "react";

type Notice =
  | {
      kind: "success";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | null;

export function ResetPasswordForm() {
  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    notice,
    setNotice,
  ] = useState<Notice>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setNotice(null);

    if (password.length < 8) {
      setNotice({
        kind: "error",
        message:
          "Your password must contain at least 8 characters.",
      });

      return;
    }

    if (password !== confirmPassword) {
      setNotice({
        kind: "error",
        message:
          "The passwords do not match.",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/auth/reset-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              password,
            }),
          },
        );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message:
            "This password-reset session is invalid or has expired. Request a new reset email and try again.",
        });

        return;
      }

      setPassword("");
      setConfirmPassword("");

      setNotice({
        kind: "success",
        message:
          "Your password has been updated successfully. Redirecting you to sign in...",
      });

      window.setTimeout(() => {
        window.location.replace(
          "/sign-in",
        );
      }, 900);
    } catch {
      setNotice({
        kind: "error",
        message:
          "Mabojolu could not update your password. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="new-password"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          New password
        </label>

        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value,
            )
          }
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isSubmitting}
          placeholder="At least 8 characters"
          className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div>
        <label
          htmlFor="confirm-new-password"
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          Confirm new password
        </label>

        <input
          id="confirm-new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(
              event.target.value,
            )
          }
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isSubmitting}
          placeholder="Enter the password again"
          className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {notice ? (
        <div
          role={
            notice.kind === "error"
              ? "alert"
              : "status"
          }
          className={`rounded-xl border px-3.5 py-3 text-sm leading-5 ${
            notice.kind === "error"
              ? "border-danger/20 bg-danger-subtle text-text-primary"
              : "border-border-default bg-surface-base text-text-secondary"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Updating password..."
          : "Update password"}
      </button>
    </form>
  );
}

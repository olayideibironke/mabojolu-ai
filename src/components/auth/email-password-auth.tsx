"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type AuthMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password";

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

export function EmailPasswordAuth() {
  const [
    mode,
    setMode,
  ] = useState<AuthMode>("sign-in");

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

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
    isAuthStateReady,
    setIsAuthStateReady,
  ] = useState(false);

  const [
    isAnonymous,
    setIsAnonymous,
  ] = useState(false);

  const [
    notice,
    setNotice,
  ] = useState<Notice>(null);

  const isSignUp =
    mode === "sign-up";

  const isForgotPassword =
    mode === "forgot-password";

  const isAnonymousSignUp =
    isSignUp &&
    isAnonymous;

  useEffect(() => {
    let isActive = true;

    const client =
      getSupabaseBrowserClient();

    void client.auth
      .getSession()
      .then(
        ({
          data,
        }) => {
          if (!isActive) {
            return;
          }

          setIsAnonymous(
            data.session?.user
              .is_anonymous === true,
          );

          setIsAuthStateReady(
            true,
          );
        },
      )
      .catch(() => {
        if (!isActive) {
          return;
        }

        setIsAnonymous(false);

        setIsAuthStateReady(
          true,
        );
      });

    const {
      data: {
        subscription,
      },
    } =
      client.auth.onAuthStateChange(
        (
          _event,
          session,
        ) => {
          if (!isActive) {
            return;
          }

          setIsAnonymous(
            session?.user
              .is_anonymous === true,
          );

          setIsAuthStateReady(
            true,
          );
        },
      );

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const submitLabel =
    useMemo(() => {
      if (!isAuthStateReady) {
        return "Preparing...";
      }

      if (isSubmitting) {
        if (
          isForgotPassword
        ) {
          return "Sending reset email...";
        }

        if (
          isAnonymousSignUp
        ) {
          return "Sending verification email...";
        }

        return isSignUp
          ? "Creating account..."
          : "Signing in...";
      }

      if (
        isForgotPassword
      ) {
        return "Send reset email";
      }

      if (
        isAnonymousSignUp
      ) {
        return "Continue with email";
      }

      return isSignUp
        ? "Create account"
        : "Sign in";
    }, [
      isAnonymousSignUp,
      isAuthStateReady,
      isForgotPassword,
      isSignUp,
      isSubmitting,
    ]);

  function changeMode(
    nextMode: AuthMode,
  ) {
    if (isSubmitting) {
      return;
    }

    setMode(nextMode);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting ||
      !isAuthStateReady
    ) {
      return;
    }

    setNotice(null);

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    const normalizedName =
      displayName.trim();

    if (!normalizedEmail) {
      setNotice({
        kind: "error",
        message:
          "Enter your email address.",
      });

      return;
    }

    if (
      isForgotPassword
    ) {
      setIsSubmitting(true);

      try {
        const client =
          getSupabaseBrowserClient();

        const {
          error,
        } =
          await client.auth
            .resetPasswordForEmail(
              normalizedEmail,
              {
                redirectTo:
                  `${window.location.origin}/auth/callback?next=/reset-password`,
              },
            );

        if (error) {
          setNotice({
            kind: "error",
            message:
              "Mabojolu could not send the reset email. Please try again.",
          });

          return;
        }

        setNotice({
          kind: "success",
          message:
            "Check your email for a secure password-reset link.",
        });
      } catch {
        setNotice({
          kind: "error",
          message:
            "Mabojolu could not send the reset email. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (
      isSignUp &&
      !normalizedName
    ) {
      setNotice({
        kind: "error",
        message:
          "Enter your name.",
      });

      return;
    }

    if (
      !isAnonymousSignUp &&
      password.length < 8
    ) {
      setNotice({
        kind: "error",
        message:
          "Your password must contain at least 8 characters.",
      });

      return;
    }

    if (
      isSignUp &&
      !isAnonymousSignUp &&
      password !==
        confirmPassword
    ) {
      setNotice({
        kind: "error",
        message:
          "The passwords do not match.",
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const client =
        getSupabaseBrowserClient();

      /**
       * Upgrade the current anonymous identity rather than creating a separate
       * account. This preserves the same user ID and all guest conversations.
       */
      if (
        isAnonymousSignUp
      ) {
        const {
          error,
        } =
          await client.auth
            .updateUser(
              {
                email:
                  normalizedEmail,

                data: {
                  display_name:
                    normalizedName,
                },
              },
              {
                emailRedirectTo:
                  `${window.location.origin}/auth/callback?next=/reset-password`,
              },
            );

        if (error) {
          setNotice({
            kind: "error",
            message:
              error.message,
          });

          return;
        }

        setNotice({
          kind: "success",
          message:
            "Check your email and verify your address. You will then create a password without losing your Mabojolu conversations.",
        });

        return;
      }

      if (isSignUp) {
        const {
          data,
          error,
        } =
          await client.auth
            .signUp({
              email:
                normalizedEmail,

              password,

              options: {
                data: {
                  display_name:
                    normalizedName,
                },

                emailRedirectTo:
                  `${window.location.origin}/auth/callback?next=/`,
              },
            });

        if (error) {
          setNotice({
            kind: "error",
            message:
              error.message,
          });

          return;
        }

        if (data.session) {
          window.location.assign(
            "/",
          );

          return;
        }

        setPassword("");
        setConfirmPassword("");

        setNotice({
          kind: "success",
          message:
            "Account created. Check your email and confirm your address before signing in.",
        });

        return;
      }

      const {
        error,
      } =
        await client.auth
          .signInWithPassword({
            email:
              normalizedEmail,

            password,
          });

      if (error) {
        setNotice({
          kind: "error",
          message:
            "The email or password is incorrect.",
        });

        return;
      }

      window.location.assign(
        "/",
      );
    } catch {
      setNotice({
        kind: "error",
        message:
          "Mabojolu could not complete authentication. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {!isForgotPassword ? (
        <div
          className="mb-5 grid grid-cols-2 rounded-xl border border-border-subtle bg-surface-base p-1"
          role="tablist"
          aria-label="Authentication options"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              mode ===
              "sign-in"
            }
            onClick={() =>
              changeMode(
                "sign-in",
              )
            }
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode ===
              "sign-in"
                ? "bg-surface-raised text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Sign in
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              mode ===
              "sign-up"
            }
            onClick={() =>
              changeMode(
                "sign-up",
              )
            }
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode ===
              "sign-up"
                ? "bg-surface-raised text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Create account
          </button>
        </div>
      ) : null}

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-text-primary">
          {isForgotPassword
            ? "Reset your password"
            : isAnonymousSignUp
              ? "Save your Mabojolu conversations"
              : isSignUp
                ? "Create your Mabojolu account"
                : "Welcome back"}
        </h2>

        <p className="mt-1 text-sm leading-5 text-text-secondary">
          {isForgotPassword
            ? "Enter your account email and we will send you a secure reset link."
            : isAnonymousSignUp
              ? "Add your email to keep this guest account. After verification, you will create a password."
              : isSignUp
                ? "Create an account to save and revisit your conversations."
                : "Sign in to continue your conversations."}
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        {isSignUp ? (
          <div>
            <label
              htmlFor="display-name"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Name
            </label>

            <input
              id="display-name"
              type="text"
              value={
                displayName
              }
              onChange={(
                event,
              ) =>
                setDisplayName(
                  event.target
                    .value,
                )
              }
              autoComplete="name"
              required
              disabled={
                isSubmitting ||
                !isAuthStateReady
              }
              placeholder="Your name"
              className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Email address
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(
              event,
            ) =>
              setEmail(
                event.target
                  .value,
              )
            }
            autoComplete="email"
            required
            disabled={
              isSubmitting ||
              !isAuthStateReady
            }
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {!isForgotPassword &&
        !isAnonymousSignUp ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary"
              >
                Password
              </label>

              {!isSignUp ? (
                <button
                  type="button"
                  disabled={
                    isSubmitting
                  }
                  onClick={() =>
                    changeMode(
                      "forgot-password",
                    )
                  }
                  className="text-xs font-semibold text-text-secondary underline-offset-4 hover:text-text-primary hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              ) : null}
            </div>

            <input
              id="password"
              type="password"
              value={
                password
              }
              onChange={(
                event,
              ) =>
                setPassword(
                  event.target
                    .value,
                )
              }
              autoComplete={
                isSignUp
                  ? "new-password"
                  : "current-password"
              }
              required
              minLength={8}
              disabled={
                isSubmitting ||
                !isAuthStateReady
              }
              placeholder="At least 8 characters"
              className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : null}

        {isSignUp &&
        !isAnonymousSignUp ? (
          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Confirm password
            </label>

            <input
              id="confirm-password"
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event,
              ) =>
                setConfirmPassword(
                  event.target
                    .value,
                )
              }
              autoComplete="new-password"
              required
              minLength={8}
              disabled={
                isSubmitting ||
                !isAuthStateReady
              }
              placeholder="Enter your password again"
              className="h-11 w-full rounded-xl border border-border-default bg-surface-base px-3.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-text-muted focus:ring-2 focus:ring-text-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        ) : null}

        {notice ? (
          <div
            role={
              notice.kind ===
              "error"
                ? "alert"
                : "status"
            }
            className={`rounded-xl border px-3.5 py-3 text-sm leading-5 ${
              notice.kind ===
              "error"
                ? "border-danger/20 bg-danger-subtle text-text-primary"
                : "border-border-default bg-surface-base text-text-secondary"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !isAuthStateReady
          }
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-inverse px-4 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-text-muted">
        {isForgotPassword ? (
          <button
            type="button"
            disabled={
              isSubmitting
            }
            onClick={() =>
              changeMode(
                "sign-in",
              )
            }
            className="font-semibold text-text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            Return to sign in
          </button>
        ) : (
          <>
            {isSignUp
              ? "Already have an account?"
              : "New to Mabojolu?"}{" "}

            <button
              type="button"
              disabled={
                isSubmitting
              }
              onClick={() =>
                changeMode(
                  isSignUp
                    ? "sign-in"
                    : "sign-up",
                )
              }
              className="font-semibold text-text-primary underline-offset-4 hover:underline disabled:opacity-50"
            >
              {isSignUp
                ? "Sign in"
                : "Create an account"}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
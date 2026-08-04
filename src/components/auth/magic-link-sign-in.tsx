"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

/**
 * Email magic-link sign-in.
 *
 * The success message is identical whether or not the address has an account, so
 * this form cannot be used to discover who is registered.
 */
export function MagicLinkSignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state === "sending") {
      return;
    }

    setState("sending");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: { message: string };
      };

      if (!response.ok) {
        setState("error");
        setMessage(
          data.error?.message ?? "Could not send the link. Please try again.",
        );
        return;
      }

      setState("sent");
    } catch {
      setState("error");
      setMessage("Could not reach the server. Check your connection.");
    }
  }

  if (state === "sent") {
    return (
      <div role="status">
        <h2 className="text-sm font-semibold text-text-primary">
          Check your email
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          If an account can be created or found for that address, a sign-in link
          is on its way. The link expires shortly, so use it soon.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            setState("idle");
            setEmail("");
          }}
          className="mt-4 w-full"
        >
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="email"
        className="block text-sm font-medium text-text-primary"
      >
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        autoComplete="email"
        // Helps a password manager and mobile keyboard do the right thing.
        inputMode="email"
        placeholder="you@example.com"
        aria-describedby="email-hint"
        className="mt-1.5 h-10 w-full rounded-xl border border-border-default bg-surface-base px-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border-strong"
      />

      <p id="email-hint" className="mt-2 text-xs leading-5 text-text-muted">
        We will email you a secure sign-in link. No password required.
      </p>

      {message ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        disabled={state === "sending" || email.trim().length === 0}
        className="mt-4 w-full"
      >
        {state === "sending" ? "Sending link..." : "Send sign-in link"}
      </Button>
    </form>
  );
}

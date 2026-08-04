"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Development sign-in.
 *
 * Offers the two local identities so ownership boundaries can actually be
 * demonstrated: sign in as one user, create a conversation, switch to the other,
 * and confirm it is not visible.
 *
 * Labelled plainly as a development mode, because a control that looks like real
 * authentication but is not would be misleading.
 */

interface DevUser {
  id: string;
  email: string;
  displayName: string;
}

export function DevSignIn() {
  const router = useRouter();
  const [users, setUsers] = useState<DevUser[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/dev-session");

        if (!response.ok) {
          if (!cancelled) {
            setError("Development sign-in is not available.");
          }
          return;
        }

        const data = (await response.json()) as { users: DevUser[] };
        if (!cancelled) {
          setUsers(data.users);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load local users.");
        }
      }
    }

    void load();

    // Guards against writing state after unmount if the user navigates away
    // mid-request.
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(userId: string) {
    setPendingId(userId);
    setError(null);

    try {
      const response = await fetch("/api/auth/dev-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        setError("Could not sign in. Please try again.");
        setPendingId(null);
        return;
      }

      /*
       * `refresh()` before `push()`.
       *
       * The session cookie is now set, but the Router Cache still holds markup
       * rendered without it. `refresh()` discards that cache so the destination
       * re-renders on the server as the signed-in user; navigating alone could
       * serve the stale signed-out page.
       */
      router.refresh();
      router.push("/");
    } catch {
      setError("Could not sign in. Please try again.");
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-border-subtle bg-accent-subtle px-3 py-2.5">
        <p className="text-xs font-medium text-text-primary">
          Development sign-in
        </p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          This is a local stand-in, not real authentication. It exists so account
          boundaries and per-user limits can be tested. It is disabled in
          production.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id}>
            <Button
              variant="secondary"
              onClick={() => signIn(user.id)}
              disabled={pendingId !== null}
              className="w-full justify-start"
            >
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">
                  {user.displayName}
                </span>
                <span className="block truncate text-xs text-text-muted">
                  {user.email}
                </span>
              </span>
              {pendingId === user.id ? (
                <span className="text-xs text-text-muted">Signing in</span>
              ) : null}
            </Button>
          </li>
        ))}
      </ul>

      {users.length === 0 && !error ? (
        <p className="text-sm text-text-muted">Loading local users...</p>
      ) : null}
    </div>
  );
}

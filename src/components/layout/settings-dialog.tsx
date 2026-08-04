"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, IconButton } from "@/components/ui/button";
import { CloseIcon, SignOutIcon } from "@/components/ui/icons";

/**
 * Settings dialog.
 *
 * Built on the native `<dialog>` element, which supplies focus trapping, the top
 * layer, and Escape-to-close without reimplementing any of it. Those are exactly
 * the parts hand-rolled modals get wrong.
 *
 * Only settings that actually work appear here. The data section states plainly
 * where conversations are stored and what is not implemented, because a privacy
 * notice that overstates protection is worse than none.
 */

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  userEmail?: string;
  persistenceKind: "local" | "supabase";
}

export function SettingsDialog({
  isOpen,
  onClose,
  isSignedIn,
  userEmail,
  persistenceKind,
}: SettingsDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // `showModal()` is imperative, so open state has to be mirrored onto the node
  // rather than expressed with the `open` attribute, which renders non-modally.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }

    if (isOpen && !node.open) {
      node.showModal();
    } else if (!isOpen && node.open) {
      node.close();
    }
  }, [isOpen]);

  // Escape closes natively and fires `cancel`. Intercept it so React state stays
  // in sync rather than the dialog closing behind our back.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) {
      return;
    }

    function onCancel(event: Event) {
      event.preventDefault();
      onClose();
    }

    node.addEventListener("cancel", onCancel);
    return () => node.removeEventListener("cancel", onCancel);
  }, [onClose]);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/sign-out", { method: "POST" });

      // `refresh()` clears the Router Cache, which still holds markup rendered
      // for the signed-in user. Without it the transcript could remain on screen
      // after signing out.
      onClose();
      router.refresh();
      router.push("/");
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      // `backdrop:` styles the native ::backdrop; `open:` is needed because a
      // closed dialog is display:none.
      className="m-auto max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border-subtle bg-surface-overlay p-0 text-text-primary shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
        <h2 id="settings-title" className="text-base font-semibold">
          Settings
        </h2>

        <IconButton label="Close settings" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>

      <div className="space-y-5 px-5 py-5">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">Appearance</h3>
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              Choose a theme or follow your device setting.
            </p>
          </div>
          <ThemeToggle />
        </section>

        {isSignedIn ? (
          <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
            <h3 className="text-sm font-medium">Account</h3>
            <p className="mt-1 truncate text-xs text-text-secondary">
              {userEmail}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={signOut}
              disabled={isSigningOut}
              className="mt-3"
            >
              <SignOutIcon className="h-4 w-4" />
              <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
            </Button>
          </section>
        ) : null}

        <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
          <h3 className="text-sm font-medium">Your data</h3>

          {persistenceKind === "local" ? (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              This installation is using local development storage: a JSON file on
              the server running Mabojolu. It is intended for development, not
              production, and it has no database-level access control.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Your conversations are stored in a database and are readable only by
              your account.
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            You can delete any conversation from the sidebar, which removes its
            messages permanently. Mabojolu does not carry memory between separate
            conversations.
          </p>

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Messages you send are processed by the configured AI provider to
            generate a response. Mabojolu does not claim your prompts are withheld
            from that provider, and it does not offer end-to-end encryption.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium">About</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Mabojolu by Westforge. A Westforge Holdings Product.
          </p>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            Mabojolu can make mistakes, including about people, places, and facts.
            It cannot browse the web or run code. Review important information
            before relying on it.
          </p>
        </section>
      </div>
    </dialog>
  );
}

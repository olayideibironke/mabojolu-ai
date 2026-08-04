"use client";

import { useEffect, useRef } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { IconButton } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Settings dialog.
 *
 * Built on the native `<dialog>` element, which supplies focus trapping, the
 * top layer, and Escape-to-close without reimplementing any of it. Those are
 * exactly the parts hand-rolled modals get wrong.
 *
 * Only settings that actually work are shown. Rows for unimplemented features
 * would be dead controls.
 */

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `showModal()` is imperative, so open state has to be mirrored onto the node
  // rather than expressed with the `open` attribute (which renders non-modally).
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

  // Escape closes the dialog natively and fires `cancel`. Intercept it so React
  // state stays in sync instead of the dialog closing behind our back.
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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      // `backdrop:` styles the native ::backdrop pseudo-element. `open:` is
      // needed because a closed dialog is display:none.
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-border-subtle bg-surface-overlay p-0 text-text-primary shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
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

        <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
          <h3 className="text-sm font-medium">Your data</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Conversations in this version are held in your browser for the
            current session and are not stored on a server. Closing the tab
            clears them. Mabojolu does not carry memory between conversations.
          </p>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Messages you send are processed by the configured AI provider to
            generate a response.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium">About</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Mabojolu by Westforge. A Westforge Holdings Product.
          </p>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            Mabojolu can make mistakes, including about people, places, and
            facts. Review important information before relying on it.
          </p>
        </section>
      </div>
    </dialog>
  );
}

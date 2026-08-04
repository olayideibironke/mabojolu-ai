"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Button,
  IconButton,
} from "@/components/ui/button";
import {
  CloseIcon,
  SignOutIcon,
} from "@/components/ui/icons";

export type MabojoluModelId =
  | "mabojolu-fast"
  | "mabojolu-local";

interface ModelOption {
  id: MabojoluModelId;
  name: string;
  label: string;
  description: string;
  bestFor: string;
}

const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: "mabojolu-fast",
    name: "Fast",
    label: "Mabojolu Fast",
    description:
      "Quicker local responses with lower memory and processor demand.",
    bestFor:
      "Everyday questions, short drafts, quick explanations, and general assistance.",
  },
  {
    id: "mabojolu-local",
    name: "Quality",
    label: "Mabojolu Quality",
    description:
      "Stronger local responses with more detailed reasoning and writing.",
    bestFor:
      "Analysis, planning, longer writing, technical work, and difficult questions.",
  },
];

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  userEmail?: string;
  persistenceKind: "local" | "supabase";
  selectedModelId: MabojoluModelId;
  onModelChange: (
    modelId: MabojoluModelId,
  ) => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  isSignedIn,
  userEmail,
  persistenceKind,
  selectedModelId,
  onModelChange,
}: SettingsDialogProps) {
  const router = useRouter();

  const dialogRef =
    useRef<HTMLDialogElement>(null);

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  useEffect(() => {
    const node = dialogRef.current;

    if (!node) {
      return;
    }

    if (isOpen && !node.open) {
      node.showModal();
      return;
    }

    if (!isOpen && node.open) {
      node.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const node = dialogRef.current;

    if (!node) {
      return;
    }

    function onCancel(event: Event) {
      event.preventDefault();
      onClose();
    }

    node.addEventListener(
      "cancel",
      onCancel,
    );

    return () => {
      node.removeEventListener(
        "cancel",
        onCancel,
      );
    };
  }, [onClose]);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
      });

      onClose();
      router.refresh();
      router.push("/");
    } catch {
      setIsSigningOut(false);
    }
  }

  const selectedModel =
    MODEL_OPTIONS.find(
      (option) =>
        option.id === selectedModelId,
    ) ?? MODEL_OPTIONS[0];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="settings-title"
      className="m-auto max-h-[88dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border-subtle bg-surface-overlay p-0 text-text-primary shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-[1px]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h2
            id="settings-title"
            className="text-base font-semibold"
          >
            Settings
          </h2>

          <p className="mt-0.5 text-xs text-text-muted">
            Customize your Mabojolu experience.
          </p>
        </div>

        <IconButton
          label="Close settings"
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section
          aria-labelledby="model-mode-title"
        >
          <div>
            <h3
              id="model-mode-title"
              className="text-sm font-medium"
            >
              Response mode
            </h3>

            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Choose between faster answers and
              stronger local response quality.
            </p>
          </div>

          <fieldset className="mt-3 grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">
              Choose a Mabojolu response mode
            </legend>

            {MODEL_OPTIONS.map((option) => {
              const isSelected =
                selectedModelId === option.id;

              return (
                <label
                  key={option.id}
                  className={`relative cursor-pointer rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] ${
                    isSelected
                      ? "border-accent bg-accent-subtle shadow-sm"
                      : "border-border-subtle bg-surface-raised hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="mabojolu-model"
                    value={option.id}
                    checked={isSelected}
                    onChange={() =>
                      onModelChange(option.id)
                    }
                    className="sr-only"
                  />

                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text-primary">
                        {option.name}
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-text-secondary">
                        {option.description}
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-accent bg-accent"
                          : "border-border-strong bg-surface-raised"
                      }`}
                    >
                      {isSelected ? (
                        <span className="h-2 w-2 rounded-full bg-accent-contrast" />
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="mt-3 rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3">
            <p className="text-xs font-medium text-text-primary">
              Active: {selectedModel.label}
            </p>

            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Best for: {selectedModel.bestFor}
            </p>

            <p className="mt-1 text-[11px] leading-5 text-text-muted">
              The selected mode applies to your next
              message. It does not interrupt a response
              already being generated.
            </p>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">
              Appearance
            </h3>

            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              Choose a theme or follow your device
              setting.
            </p>
          </div>

          <ThemeToggle />
        </section>

        {isSignedIn ? (
          <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
            <h3 className="text-sm font-medium">
              Account
            </h3>

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

              <span>
                {isSigningOut
                  ? "Signing out..."
                  : "Sign out"}
              </span>
            </Button>
          </section>
        ) : null}

        <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
          <h3 className="text-sm font-medium">
            Your data
          </h3>

          {persistenceKind === "local" ? (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              This installation uses local development
              storage on the computer running Mabojolu.
              It is intended for development and testing,
              not production.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Your conversations are stored in the
              configured database and are associated with
              your account.
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            You can permanently delete individual
            conversations from the sidebar. Mabojolu does
            not currently carry personal memory between
            separate conversations.
          </p>

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Local response modes process messages through
            Ollama on the computer running Mabojolu. No
            paid cloud AI API is used in local mode.
          </p>
        </section>

        <section className="border-t border-border-subtle pt-5">
          <h3 className="text-sm font-medium">
            About
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Mabojolu by Westforge. A Westforge Holdings
            Product.
          </p>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Mabojolu can make mistakes. It does not
            currently browse the web, operate a terminal,
            or access private files unless those
            capabilities are explicitly connected later.
            Review important information before relying
            on it.
          </p>
        </section>
      </div>
    </dialog>
  );
}
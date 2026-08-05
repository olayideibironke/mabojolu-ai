"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, IconButton } from "@/components/ui/button";
import {
  CloseIcon,
  SignOutIcon,
  TrashIcon,
} from "@/components/ui/icons";

export type MabojoluModelId =
  | "mabojolu-fast"
  | "mabojolu-regular"
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
      "The quickest local response mode with the lowest processor demand.",
    bestFor:
      "Short questions, quick explanations, simple drafting, and everyday assistance.",
  },
  {
    id: "mabojolu-regular",
    name: "Regular",
    label: "Mabojolu Regular",
    description:
      "A balanced local mode with stronger responses while remaining responsive.",
    bestFor:
      "General conversations, routine writing, summaries, planning, and most daily tasks.",
  },
  {
    id: "mabojolu-local",
    name: "Quality",
    label: "Mabojolu Quality",
    description:
      "The strongest available local mode with more detailed reasoning and writing.",
    bestFor:
      "Analysis, technical work, complex planning, longer writing, and difficult questions.",
  },
];

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  userEmail?: string;
  persistenceKind: "local" | "supabase";
  selectedModelId: MabojoluModelId;
  onModelChange: (modelId: MabojoluModelId) => void;
}

interface DeleteAccountResponse {
  ok?: boolean;
  error?: string;
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<
    string | null
  >(null);

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

      if (isDeletingAccount) {
        return;
      }

      onClose();
    }

    node.addEventListener("cancel", onCancel);

    return () => {
      node.removeEventListener("cancel", onCancel);
    };
  }, [isDeletingAccount, onClose]);

  function resetDeleteState() {
    setShowDeleteConfirmation(false);
    setDeleteConfirmation("");
    setDeleteAccountError(null);
    setIsDeletingAccount(false);
  }

  async function signOut() {
    setIsSigningOut(true);

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Sign out failed.");
      }

      onClose();
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  }

  function beginDeleteAccount() {
    setShowDeleteConfirmation(true);
    setDeleteConfirmation("");
    setDeleteAccountError(null);
  }

  function cancelDeleteAccount() {
    if (isDeletingAccount) {
      return;
    }

    resetDeleteState();
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") {
      setDeleteAccountError(
        "Type DELETE exactly to confirm permanent account deletion.",
      );

      return;
    }

    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      });

      const result = (await response
        .json()
        .catch(() => null)) as DeleteAccountResponse | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ??
            "Mabojolu could not delete your account. Please try again.",
        );
      }

      onClose();
      router.replace("/sign-in?account=deleted");
      router.refresh();
    } catch (cause) {
      setDeleteAccountError(
        cause instanceof Error
          ? cause.message
          : "Mabojolu could not delete your account. Please try again.",
      );

      setIsDeletingAccount(false);
    }
  }

  const selectedModel =
    MODEL_OPTIONS.find(
      (option) => option.id === selectedModelId,
    ) ?? MODEL_OPTIONS[1];

  return (
    <dialog
      ref={dialogRef}
      onClose={resetDeleteState}
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
          disabled={isDeletingAccount}
        >
          <CloseIcon />
        </IconButton>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section aria-labelledby="model-mode-title">
          <div>
            <h3
              id="model-mode-title"
              className="text-sm font-medium"
            >
              Response mode
            </h3>

            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Choose the balance of speed and response quality that
              works best for your task.
            </p>
          </div>

          <fieldset className="mt-3 grid gap-3">
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
                    onChange={() => onModelChange(option.id)}
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
              Your selection applies to the next message. It does not
              interrupt an answer already being generated.
            </p>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">
              Appearance
            </h3>

            <p className="mt-0.5 text-xs leading-5 text-text-secondary">
              Choose a theme or follow your device setting.
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

            {!showDeleteConfirmation ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={signOut}
                  disabled={isSigningOut}
                >
                  <SignOutIcon className="h-4 w-4" />

                  <span>
                    {isSigningOut
                      ? "Signing out..."
                      : "Sign out"}
                  </span>
                </Button>

                {persistenceKind === "supabase" ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={beginDeleteAccount}
                    disabled={isSigningOut}
                  >
                    <TrashIcon className="h-4 w-4" />

                    <span>Delete account</span>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger-subtle p-4">
                <h4 className="text-sm font-semibold text-text-primary">
                  Permanently delete your account?
                </h4>

                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  This permanently deletes your profile,
                  conversations, messages, feedback, and uploaded
                  attachments. This action cannot be undone.
                </p>

                <label
                  htmlFor="delete-account-confirmation"
                  className="mt-4 block text-xs font-medium text-text-primary"
                >
                  Type DELETE to confirm
                </label>

                <input
                  id="delete-account-confirmation"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) => {
                    setDeleteConfirmation(event.target.value);
                    setDeleteAccountError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={isDeletingAccount}
                  placeholder="DELETE"
                  className="mt-1.5 h-10 w-full rounded-xl border border-border-default bg-surface-raised px-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-danger disabled:cursor-not-allowed disabled:opacity-60"
                />

                {deleteAccountError ? (
                  <p
                    role="alert"
                    className="mt-2 text-xs leading-5 text-danger"
                  >
                    {deleteAccountError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void deleteAccount()}
                    disabled={
                      isDeletingAccount ||
                      deleteConfirmation !== "DELETE"
                    }
                  >
                    <TrashIcon className="h-4 w-4" />

                    <span>
                      {isDeletingAccount
                        ? "Deleting account..."
                        : "Permanently delete account"}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-xl border border-border-subtle bg-surface-sunken p-4">
          <h3 className="text-sm font-medium">
            Your data
          </h3>

          {persistenceKind === "local" ? (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              This installation uses local development storage on the
              computer running Mabojolu. It is intended for
              development and testing, not production.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Your conversations are stored in the configured
              database and associated with your account.
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            You can permanently delete individual conversations from
            the sidebar. Mabojolu does not currently carry personal
            memory between separate conversations.
          </p>

          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Local response modes process messages through Ollama on
            the computer running Mabojolu. No paid cloud AI API is
            used in local mode.
          </p>
        </section>

        <section className="border-t border-border-subtle pt-5">
          <h3 className="text-sm font-medium">
            About
          </h3>

          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Mabojolu by Westforge. A Westforge Holdings Product.
          </p>

          <p className="mt-1 text-xs leading-5 text-text-muted">
            Mabojolu can make mistakes. It does not currently browse
            the web, operate a terminal, or access private files
            unless those capabilities are explicitly connected
            later. Review important information before relying on it.
          </p>
        </section>
      </div>
    </dialog>
  );
}
"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Button,
} from "@/components/ui/button";
import {
  CheckIcon,
  CopyIcon,
} from "@/components/ui/icons";

interface HandoverPromptProps {
  level:
    "none" |
    "prepare" |
    "urgent";

  packet:
    string;

  isOpen:
    boolean;

  onOpenChange:
    (
      isOpen:
        boolean,
    ) => void;

  onContinueInNewChat:
    (
      packet:
        string,
    ) => void;
}

export function HandoverPrompt({
  level,
  packet,
  isOpen,
  onOpenChange,
  onContinueInNewChat,
}: HandoverPromptProps) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  const heading =
    level ===
      "urgent"
      ? "This chat is very close to its context limit."
      : "This chat is getting long.";

  const detail =
    level ===
      "urgent"
      ? "Prepare a handover now so Mabojolu can continue cleanly in a fresh chat before older project context falls out."
      : "Mabojolu can prepare a compact continuity handover before the conversation becomes too large.";

  const copyLabel =
    copied
      ? "Copied"
      : "Copy handover";

  const textRows =
    useMemo(
      () =>
        Math.min(
          18,
          Math.max(
            10,
            packet.split(
              "\n",
            ).length,
          ),
        ),
      [packet],
    );

  async function copyPacket() {
    try {
      await navigator.clipboard
        .writeText(
          packet,
        );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1_800,
      );
    } catch {
      setCopied(
        false,
      );
    }
  }

  return (
    <>
      {level !== "none" ? (
      <div className="mx-auto w-full max-w-[1040px] px-4 pb-2 sm:px-6">
        <div
          className={
            level ===
            "urgent"
              ? "rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3"
              : "rounded-2xl border border-border-default bg-surface-raised px-4 py-3"
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {heading}
              </p>

              <p className="mt-1 text-xs leading-5 text-text-secondary">
                {detail}
              </p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onOpenChange(
                  true,
                )
              }
              className="shrink-0"
            >
              Prepare handover
            </Button>
          </div>
        </div>
      </div>
      ) : null}

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="handover-title"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget
            ) {
              onOpenChange(
                false,
              );
            }
          }}
        >
          <div className="flex max-h-[88dvh] w-full max-w-3xl flex-col rounded-2xl border border-border-default bg-surface-base shadow-2xl">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2
                id="handover-title"
                className="text-base font-semibold text-text-primary"
              >
                Mabojolu continuity handover
              </h2>

              <p className="mt-1 text-sm text-text-secondary">
                Review it, copy it anywhere, or continue directly in a fresh Mabojolu chat.
              </p>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <textarea
                readOnly
                value={
                  packet
                }
                rows={
                  textRows
                }
                aria-label="Handover message"
                className="h-full min-h-[320px] w-full resize-none rounded-xl border border-border-subtle bg-surface-sunken p-4 font-mono text-xs leading-5 text-text-primary outline-none"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={() =>
                  onOpenChange(
                    false,
                  )
                }
              >
                Keep this chat
              </Button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void copyPacket()
                  }
                >
                  {copied ? (
                    <CheckIcon />
                  ) : (
                    <CopyIcon />
                  )}

                  {copyLabel}
                </Button>

                <Button
                  onClick={() => {
                    onOpenChange(
                      false,
                    );

                    onContinueInNewChat(
                      packet,
                    );
                  }}
                >
                  Continue in new chat
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

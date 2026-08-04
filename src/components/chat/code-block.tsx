"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/ui/icons";

/**
 * Fenced code block with a copy control.
 *
 * Highlighting is applied by rehype-highlight during Markdown parsing, so this
 * component only supplies the chrome and the copy behaviour. Long lines scroll
 * inside the block rather than widening the page.
 */

interface CodeBlockProps {
  /** Highlighted markup produced by rehype-highlight. */
  children: React.ReactNode;
  /** Language label from the fence, for example `ts`. */
  language?: string;
  /** Raw source, used for copying. */
  code: string;
}

export function CodeBlock({ children, language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear the pending reset on unmount so the timer cannot fire against an
  // unmounted component.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access can be denied, and in that case the user can still
      // select the text manually. Reporting a failure here would add noise
      // without giving them a better option.
    }
  }, [code]);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-sunken">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
          {language || "code"}
        </span>

        <button
          type="button"
          onClick={copy}
          // The accessible name reflects state so a screen reader user hears
          // the confirmation, not just a visual tick.
          aria-label={copied ? "Code copied" : "Copy code"}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      {/* tabIndex makes the scroll region reachable by keyboard, which is
          required when content can overflow horizontally. */}
      <pre
        tabIndex={0}
        className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/button";
import {
  CheckIcon,
  CopyIcon,
  RegenerateIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@/components/ui/icons";
import type { FeedbackRating } from "@/types/chat";

/**
 * Copy, regenerate, and feedback controls for an assistant reply.
 *
 * Every control here performs a real action. Nothing is decorative, which is
 * why feedback is state the caller owns rather than a button that only animates.
 */

interface MessageActionsProps {
  content: string;
  feedback?: FeedbackRating;
  onRegenerate: () => void;
  onFeedback: (rating: FeedbackRating) => void;
  /** Disabled while another generation is running, to avoid overlapping requests. */
  disabled?: boolean;
}

export function MessageActions({
  content,
  feedback,
  onRegenerate,
  onFeedback,
  disabled = false,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard permission can be denied; manual selection still works.
    }
  }, [content]);

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        size="sm"
        label={copied ? "Response copied" : "Copy response"}
        onClick={copy}
      >
        {copied ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
      </IconButton>

      <IconButton
        size="sm"
        label="Regenerate response"
        onClick={onRegenerate}
        disabled={disabled}
      >
        <RegenerateIcon className="h-4 w-4" />
      </IconButton>

      <IconButton
        size="sm"
        label="Good response"
        // aria-pressed makes the toggle state audible, not just visible.
        aria-pressed={feedback === "up"}
        onClick={() => onFeedback("up")}
        className={feedback === "up" ? "text-success" : ""}
      >
        <ThumbUpIcon className="h-4 w-4" />
      </IconButton>

      <IconButton
        size="sm"
        label="Bad response"
        aria-pressed={feedback === "down"}
        onClick={() => onFeedback("down")}
        className={feedback === "down" ? "text-danger" : ""}
      >
        <ThumbDownIcon className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

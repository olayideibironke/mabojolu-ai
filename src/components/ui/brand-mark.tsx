/**
 * Mabojolu mark.
 *
 * A clean MB monogram gives the product a more professional and recognizable
 * identity across the sidebar, assistant messages, and other UI surfaces.
 *
 * This remains a Server Component, so it adds no client JavaScript.
 */

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const CONTAINER_SIZES = {
  sm: "h-9 w-9 rounded-xl",
  md: "h-11 w-11 rounded-2xl",
  lg: "h-14 w-14 rounded-2xl",
} as const;

const TEXT_SIZES = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[16px]",
} as const;

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-surface-inverse text-text-inverse shadow-sm ${CONTAINER_SIZES[size]} ${className}`}
      aria-hidden="true"
    >
      <span
        className={`select-none font-semibold tracking-[0.08em] ${TEXT_SIZES[size]}`}
      >
        MB
      </span>
    </span>
  );
}

/** Wordmark with the ownership line. Used in the sidebar and empty state. */
export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandMark size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-text-primary">
          Mabojolu
        </span>
        <span className="block truncate text-xs text-text-muted">
          by Westforge
        </span>
      </span>
    </span>
  );
}
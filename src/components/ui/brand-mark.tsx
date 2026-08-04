/**
 * Mabojolu mark.
 *
 * An original geometric monogram rather than a letter in a rounded square: four
 * ascending strokes for the four names the product is named after, which gives
 * the brand something of its own rather than borrowing a familiar shape.
 *
 * A Server Component, so it costs no client JavaScript.
 */

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-surface-inverse text-text-inverse shadow-sm ${SIZES[size]} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-1/2 w-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* Four ascending strokes, one per name in "Mabojolu". */}
        <path d="M4 19V13" />
        <path d="M9.33 19V9" />
        <path d="M14.67 19V11" />
        <path d="M20 19V5" />
      </svg>
    </span>
  );
}

/** Wordmark with the ownership line. Used in the sidebar and empty state. */
export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandMark size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight text-text-primary">
          Mabojolu
        </span>
        <span className="block truncate text-[11px] text-text-muted">
          by Westforge
        </span>
      </span>
    </span>
  );
}

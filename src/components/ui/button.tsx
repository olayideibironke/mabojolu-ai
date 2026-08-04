import type { ComponentPropsWithRef } from "react";

/**
 * Button primitive.
 *
 * Exists so focus, disabled, and hover treatments are defined once. Every
 * interactive control in the app routes through this or `IconButton`, which is
 * what makes the accessibility guarantees hold app-wide rather than per screen.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-surface-inverse text-text-inverse hover:opacity-90 disabled:bg-border-default disabled:text-text-muted disabled:opacity-100",
  secondary:
    "border border-border-default bg-surface-raised text-text-primary hover:border-border-strong hover:bg-surface-sunken",
  ghost: "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
  danger: "bg-danger text-white hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

/**
 * `ComponentPropsWithRef` rather than `ButtonHTMLAttributes`: React 19 passes
 * `ref` as an ordinary prop to function components, so no `forwardRef` wrapper
 * is needed, but the prop still has to be in the type.
 */
export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      // Default to "button": an unspecified type inside a form submits it,
      // which is a common source of accidental sends.
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  /**
   * Accessible name. Required, because these controls have no visible text and
   * an icon alone is not a label.
   */
  label: string;
  variant?: Variant;
  size?: Size;
}

const ICON_SIZES: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${ICON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

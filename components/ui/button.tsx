import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Buttons.
 *
 * `primary` uses `--accent-contrast` for its text rather than a fixed black or white,
 * because the accent moves through the day and through the light/dark flip  --  a hardcoded
 * foreground fails contrast in at least one of those states.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary: "border border-line-strong bg-surface-2 text-text-1 hover:bg-surface-3",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text-1",
  danger: "border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

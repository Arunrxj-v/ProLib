import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

type Variant = "primary" | "default" | "danger" | "ghost" | "accent-soft";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Solid green action — the design's affirmative button.
  primary:
    "bg-gh-btn-primary hover:bg-gh-btn-primary-hover text-white border border-[rgba(240,246,252,0.1)] font-semibold",
  default:
    "bg-gh-btn-bg hover:bg-gh-btn-hover text-gh-fg-default border border-gh-border font-medium",
  danger:
    "bg-transparent hover:bg-gh-danger-emphasis hover:text-white text-gh-danger border border-gh-border font-medium",
  ghost:
    "bg-transparent hover:bg-gh-btn-hover text-gh-fg-muted hover:text-gh-fg-default border border-transparent font-medium",
  "accent-soft":
    "bg-[rgba(56,139,253,0.1)] hover:bg-[rgba(56,139,253,0.18)] text-gh-accent border border-transparent font-medium",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2 text-xs gap-1",
  md: "h-8 px-3 text-sm gap-1.5",
  lg: "px-5 py-2.5 text-sm gap-2",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  /** Renders a trailing chevron/arrow from the design. */
  trailingIcon?: string;
  leadingIcon?: string;
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "children"> & {
    href?: undefined;
  };

type LinkButtonProps = CommonProps & {
  href: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

function classes(variant: Variant, size: Size, block?: boolean, className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-md whitespace-nowrap transition-all",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

export function Button({
  variant = "default",
  size = "md",
  trailingIcon,
  leadingIcon,
  block,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, size, block, className)}
      {...props}
    >
      {leadingIcon && <Icon name={leadingIcon} size={size === "lg" ? 18 : 16} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={size === "lg" ? 18 : 16} />}
    </button>
  );
}

export function LinkButton({
  variant = "default",
  size = "md",
  trailingIcon,
  leadingIcon,
  block,
  className,
  children,
  href,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className={classes(variant, size, block, className)} {...props}>
      {leadingIcon && <Icon name={leadingIcon} size={size === "lg" ? 18 : 16} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={size === "lg" ? 18 : 16} />}
    </Link>
  );
}

/** Icon-only control; requires `aria-label`. */
export function IconButton({
  icon,
  label,
  className,
  tone = "muted",
  size = 18,
  ...props
}: {
  icon: string;
  label: string;
  className?: string;
  tone?: "default" | "muted" | "accent" | "success" | "attention" | "danger";
  size?: number;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent",
        "text-gh-fg-muted hover:text-gh-fg-default hover:bg-gh-btn-hover hover:border-gh-border transition-colors",
        className,
      )}
      {...props}
    >
      <Icon name={icon} tone={tone} size={size} />
    </button>
  );
}

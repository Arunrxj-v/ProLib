import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Material Symbols Outlined — the icon font used throughout the supplied
 * design. Icons are decorative by default (`aria-hidden`); always pair them
 * with a visible text label or an `aria-label` on the interactive element.
 */
type IconProps = ComponentProps<"span"> & {
  /** Material Symbols ligature name, e.g. "arrow_forward". */
  name: string;
  /** Pixel size of the glyph. */
  size?: number;
  tone?: "default" | "muted" | "accent" | "success" | "attention" | "danger" | "inherit";
  /** Set when the icon is the only content and must be announced. */
  label?: string;
};

const TONE_CLASS: Record<NonNullable<IconProps["tone"]>, string> = {
  default: "text-gh-fg-default",
  muted: "text-gh-fg-muted",
  accent: "text-gh-accent",
  success: "text-gh-success",
  attention: "text-gh-attention",
  danger: "text-gh-danger",
  inherit: "",
};

export function Icon({
  name,
  size = 18,
  tone = "muted",
  label,
  className,
  ...props
}: IconProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "material-symbols-outlined select-none leading-none",
        TONE_CLASS[tone],
        className,
      )}
      style={{ fontSize: size }}
      {...props}
    >
      {name}
    </span>
  );
}

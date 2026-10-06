import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

/* ------------------------------------------------------------------ */
/* Tech tag — monospaced chip on the inset surface (design: tech badges) */
/* ------------------------------------------------------------------ */

type TagTone = "accent" | "muted" | "attention" | "success" | "danger";

const TAG_TONES: Record<TagTone, string> = {
  accent: "text-gh-accent",
  muted: "text-gh-fg-muted",
  attention: "text-gh-attention",
  success: "text-gh-success",
  danger: "text-gh-danger",
};

export function Tag({
  children,
  tone = "muted",
  className,
  title,
}: {
  children: ReactNode;
  tone?: TagTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-gh-border bg-gh-inset px-2 py-0.5 font-mono text-xs leading-4 whitespace-nowrap",
        TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A tag that navigates to the filtered library for that technology. */
export function TechTag({
  name,
  slug,
  tone = "muted",
  icon,
}: {
  name: string;
  slug?: string;
  tone?: TagTone;
  icon?: string | null;
}) {
  const content = (
    <>
      {icon && <Icon name={icon} size={14} />}
      {name}
    </>
  );

  if (!slug) return <Tag tone={tone}>{content}</Tag>;

  return (
    <Link
      href={`/explore?technology=${slug}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-gh-border bg-gh-inset px-2 py-0.5 font-mono text-xs leading-4 whitespace-nowrap",
        "hover:border-gh-fg-subtle hover:text-gh-fg-default transition-colors",
        TAG_TONES[tone],
      )}
    >
      {content}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Badge — full pill for counters and statuses                          */
/* ------------------------------------------------------------------ */

export type BadgeTone = "muted" | "accent" | "success" | "attention" | "danger" | "done";

const BADGE_TONES: Record<BadgeTone, string> = {
  muted: "bg-gh-btn-bg text-gh-fg-muted border-gh-border",
  accent: "bg-[rgba(56,139,253,0.1)] text-gh-accent border-[rgba(56,139,253,0.35)]",
  success:
    "bg-[rgba(63,185,80,0.12)] text-gh-success border-[rgba(63,185,80,0.35)]",
  attention:
    "bg-[rgba(210,153,34,0.12)] text-gh-attention border-[rgba(210,153,34,0.35)]",
  danger: "bg-[rgba(248,81,73,0.12)] text-gh-danger border-[rgba(248,81,73,0.35)]",
  done: "bg-[rgba(137,87,229,0.12)] text-gh-done border-[rgba(137,87,229,0.35)]",
};

export function Badge({
  children,
  tone = "muted",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs leading-4 font-medium tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Eyebrow label used above every section heading                       */
/* ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-1 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-gh-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}

export type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  /** Right-hand side action, e.g. "View all 1,240 submissions →". */
  action?: { label: string; href: string };
  /** Extra content on the right (tabs, filters, live status). */
  aside?: ReactNode;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  action,
  aside,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-2xl font-semibold tracking-tight text-gh-fg-default">
          {title}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gh-accent hover:underline"
        >
          {action.label}
          <Icon name="north_east" size={16} />
        </Link>
      )}
      {aside}
    </div>
  );
}

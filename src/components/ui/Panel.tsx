import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

/**
 * Box component from the design system: `#161b22` body capped by a `#161b22`
 * header with a 1px bottom rule. Depth comes from borders, never shadows.
 */
export function Panel({
  children,
  className,
  padded = true,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-gh-border bg-gh-card",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 border-b border-gh-border bg-gh-subtle px-4 py-3",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-gh-fg-default">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-gh-fg-muted">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Empty states                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-gh-border bg-gh-subtle/40 text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className,
      )}
    >
      <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md border border-gh-border bg-gh-inset">
        <Icon name={icon} size={20} tone="muted" />
      </span>
      <h3 className="text-base font-semibold text-gh-fg-default">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-gh-fg-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

export function Skeleton({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("skeleton rounded", className)} {...props} />;
}

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gh-border bg-gh-card">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <div className="flex gap-1.5 pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="space-y-2 border-t border-gh-border pt-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline alert                                                        */
/* ------------------------------------------------------------------ */

export function Alert({
  tone = "danger",
  title,
  children,
  className,
}: {
  tone?: "danger" | "success" | "attention" | "accent";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "border-[rgba(248,81,73,0.4)] bg-[rgba(147,0,10,0.25)] text-gh-fg-default",
    success:
      "border-[rgba(63,185,80,0.4)] bg-[rgba(35,134,54,0.2)] text-gh-fg-default",
    attention:
      "border-[rgba(210,153,34,0.4)] bg-[rgba(210,153,34,0.12)] text-gh-fg-default",
    accent:
      "border-[rgba(88,166,255,0.4)] bg-[rgba(31,111,235,0.12)] text-gh-fg-default",
  } as const;

  const icons = {
    danger: "error",
    success: "check_circle",
    attention: "warning",
    accent: "info",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      <Icon
        name={icons[tone]}
        size={18}
        tone={tone === "accent" ? "accent" : tone}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-gh-fg-muted")}>{children}</div>}
      </div>
    </div>
  );
}

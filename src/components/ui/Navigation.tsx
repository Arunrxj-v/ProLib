import Link from "next/link";

import { cn } from "@/lib/utils";

import { Icon } from "./Icon";

/**
 * Segmented tab control from the design (`Trending / Recently Added / …`).
 * Tabs are links so the state lives in the URL and works without JavaScript.
 */
export function TabLinks({
  tabs,
  active,
  className,
  label = "View",
}: {
  tabs: Array<{ value: string; label: string; href: string }>;
  active: string;
  className?: string;
  label?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex self-start rounded-md border border-gh-border bg-gh-inset p-1 text-xs",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded px-3 py-1.5 transition-all",
              isActive
                ? "border border-gh-border bg-gh-btn-bg font-medium text-gh-fg-default shadow-sm"
                : "border border-transparent text-gh-fg-muted hover:text-gh-fg-default",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Numbered pagination for the discovery grid. */
export function Pagination({
  page,
  pageCount,
  basePath,
  searchParams,
  className,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  for (let index = start; index <= end; index++) window.push(index);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-gh-border bg-gh-btn-bg px-2.5 text-xs text-gh-fg-muted hover:text-gh-fg-default hover:bg-gh-btn-hover transition-colors"
        >
          <Icon name="chevron_left" size={16} />
          <span className="hidden sm:inline">Previous</span>
        </Link>
      )}

      {start > 1 && (
        <>
          <Link
            href={hrefFor(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gh-border bg-gh-inset text-xs text-gh-fg-muted hover:text-gh-fg-default"
          >
            1
          </Link>
          {start > 2 && <span className="px-1 text-gh-fg-subtle">…</span>}
        </>
      )}

      {window.map((candidate) => (
        <Link
          key={candidate}
          href={hrefFor(candidate)}
          aria-current={candidate === page ? "page" : undefined}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors",
            candidate === page
              ? "border-gh-accent bg-[rgba(56,139,253,0.1)] font-semibold text-gh-accent"
              : "border-gh-border bg-gh-inset text-gh-fg-muted hover:text-gh-fg-default hover:bg-gh-btn-hover",
          )}
        >
          {candidate}
        </Link>
      ))}

      {end < pageCount && (
        <>
          {end < pageCount - 1 && <span className="px-1 text-gh-fg-subtle">…</span>}
          <Link
            href={hrefFor(pageCount)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gh-border bg-gh-inset text-xs text-gh-fg-muted hover:text-gh-fg-default"
          >
            {pageCount}
          </Link>
        </>
      )}

      {page < pageCount && (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-gh-border bg-gh-btn-bg px-2.5 text-xs text-gh-fg-muted hover:text-gh-fg-default hover:bg-gh-btn-hover transition-colors"
        >
          <span className="hidden sm:inline">Next</span>
          <Icon name="chevron_right" size={16} />
        </Link>
      )}
    </nav>
  );
}

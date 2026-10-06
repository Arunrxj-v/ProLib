"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

type Hit = { title: string; subtitle: string; href: string };
type Group = { key: string; label: string; href: string; items: Hit[] };
type Preview = { query: string; total: number; groups: Group[] };

/**
 * Command palette bound to ⌘K / Ctrl+K. Results come from `/api/search`,
 * which queries the projects, students and technologies tables directly.
 *
 * The panel is only mounted while it is open, so its query and result state
 * is discarded automatically every time it closes — no reset effect needed.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PalettePanel onClose={onClose} />;
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const flat = preview?.groups.flatMap((group) => group.items) ?? [];

  const runSearch = useCallback(async (value: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!value.trim()) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      const data = (await response.json()) as Preview;
      setPreview(data);
      setActive(0);
    } catch (cause) {
      if ((cause as Error).name !== "AbortError") {
        setError("Search is unavailable right now. Please try again.");
        setPreview(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced query.
  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 220);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Focus the field on mount and cancel any in-flight request on unmount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function navigate(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const target = flat[active];
      if (target) {
        event.preventDefault();
        navigate(target.href);
      }
    }
  }

  let index = -1;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-[rgba(1,4,9,0.8)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search ProLib"
        className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-gh-border bg-gh-overlay shadow-[0_16px_32px_rgba(1,4,9,0.85)]"
      >
        <div className="flex items-center gap-3 border-b border-gh-border px-4">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, students, technologies…"
            aria-label="Search ProLib"
            className="h-12 w-full bg-transparent text-sm text-gh-fg-default outline-none placeholder:text-gh-fg-subtle"
          />
          {loading && (
            <span
              aria-label="Searching"
              className="material-symbols-outlined animate-spin text-[18px] text-gh-accent"
            >
              progress_activity
            </span>
          )}
          <kbd className="rounded border border-gh-border bg-gh-subtle px-1.5 py-0.5 font-mono text-[10px] text-gh-fg-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {error && (
            <p className="px-3 py-6 text-center text-sm text-gh-danger" role="alert">
              {error}
            </p>
          )}

          {!query.trim() && !error && (
            <div className="px-3 py-6 text-center text-sm text-gh-fg-muted">
              Type to search the campus library.
            </div>
          )}

          {query.trim() && !loading && !error && flat.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-gh-fg-default">No results found.</p>
              <p className="mt-1 text-xs text-gh-fg-muted">
                Nothing matches “{query}”. Try a technology, a student name or a
                project title.
              </p>
            </div>
          )}

          {loading && flat.length === 0 && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, row) => (
                <Skeleton key={row} className="h-11 w-full" />
              ))}
            </div>
          )}

          {preview?.groups.map((group) => (
            <div key={group.key} className="mb-1 last:mb-0">
              <p className="px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gh-fg-subtle">
                {group.label}
              </p>
              {group.items.map((item) => {
                index += 1;
                const isActive = index === active;
                return (
                  <button
                    key={item.href + item.title}
                    type="button"
                    onClick={() => navigate(item.href)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      isActive ? "bg-gh-btn-hover" : "hover:bg-gh-btn-hover/60",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gh-fg-default">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-gh-fg-muted">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <Icon
                      name="arrow_forward"
                      size={16}
                      className={isActive ? "opacity-100" : "opacity-0"}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gh-border bg-gh-subtle px-4 py-2 font-mono text-[11px] text-gh-fg-muted">
          <span>↑↓ navigate · ↵ open</span>
          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            onClick={onClose}
            className="text-gh-accent hover:underline"
          >
            See all results
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandLink } from "@/components/layout/BrandLogo";
import { SearchPalette } from "@/components/layout/SearchPalette";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type HeaderUser = {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  role: "student" | "admin";
};

const NAV = [
  { label: "Explore", href: "/" },
  { label: "Projects", href: "/explore" },
  { label: "Students", href: "/students" },
  { label: "Categories", href: "/categories" },
  { label: "Tech Stacks", href: "/technologies" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderShell({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ⌘K / Ctrl+K opens the palette from anywhere on the site.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const dashboardHref = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-gh-border bg-gh-inset/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand */}
          <div className="flex shrink-0 items-center gap-4">
            <BrandLink />
            <span className="hidden items-center gap-1.5 rounded-full border border-gh-border bg-gh-subtle px-2.5 py-0.5 font-mono text-xs text-gh-fg-muted sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-gh-success" />
              <span>{SITE.edition}</span>
            </span>
          </div>

          {/* Primary navigation */}
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 xl:flex"
          >
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border border-gh-border bg-gh-btn-bg text-gh-fg-default"
                      : "border border-transparent text-gh-fg-muted hover:bg-gh-btn-hover hover:text-gh-fg-default",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden w-52 items-center justify-between rounded-md border border-gh-border bg-gh-inset px-3 py-1.5 text-xs text-gh-fg-muted transition-all hover:border-gh-fg-subtle hover:text-gh-fg-default md:flex"
            >
              <span className="flex items-center gap-2">
                <Icon name="search" size={16} />
                <span>Search projects…</span>
              </span>
              <kbd className="rounded border border-gh-border bg-gh-subtle px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              aria-label="Search"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gh-border bg-gh-inset text-gh-fg-muted hover:text-gh-fg-default md:hidden"
            >
              <Icon name="search" size={16} />
            </button>

            <Link
              href={user ? "/dashboard/projects/new" : "/login?next=/dashboard/projects/new"}
              className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(240,246,252,0.1)] bg-gh-btn-primary px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-gh-btn-primary-hover"
            >
              <Icon name="add" size={16} tone="inherit" />
              <span className="hidden sm:inline">Add Project</span>
            </Link>

            {user && (
              <Link
                href="/dashboard/notifications"
                aria-label="Notifications"
                className="relative hidden h-8 w-8 items-center justify-center rounded-md border border-transparent text-gh-fg-muted transition-colors hover:border-gh-border hover:bg-gh-subtle hover:text-gh-fg-default sm:inline-flex"
              >
                <Icon name="notifications" size={18} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gh-accent ring-2 ring-gh-canvas" />
              </Link>
            )}

            {user ? (
              <Link
                href={dashboardHref}
                aria-label={`Signed in as ${user.name}. Open dashboard.`}
                className="relative ml-1 inline-flex items-center"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-gh-success ring-2 ring-gh-canvas" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden rounded-md border border-gh-border bg-gh-btn-bg px-3 py-1.5 text-xs font-medium text-gh-fg-default transition-colors hover:bg-gh-btn-hover sm:inline-flex"
              >
                Sign in
              </Link>
            )}

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gh-border bg-gh-inset text-gh-fg-muted hover:text-gh-fg-default xl:hidden"
            >
              <Icon name={mobileOpen ? "close" : "menu"} size={18} />
            </button>
          </div>
        </div>

        {/* Mobile / tablet drawer */}
        {mobileOpen && (
          <div className="border-t border-gh-border bg-gh-inset xl:hidden">
            <nav
              aria-label="Primary mobile"
              className="mx-auto max-w-7xl px-4 py-3 sm:px-6"
            >
              <ul className="grid grid-cols-2 gap-1.5">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block rounded-md border px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-gh-border bg-gh-btn-bg text-gh-fg-default"
                            : "border-transparent text-gh-fg-muted hover:bg-gh-btn-hover",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gh-border pt-3">
                <Link
                  href={user ? "/dashboard" : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-gh-border bg-gh-btn-bg px-3 py-2 text-sm text-gh-fg-default"
                >
                  {user ? "Dashboard" : "Sign in"}
                </Link>
                <Link
                  href={user ? "/dashboard/profile" : "/signup"}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-sm text-gh-fg-muted"
                >
                  {user ? "My profile" : "Create account"}
                </Link>
                {user?.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md border border-gh-border bg-gh-inset px-3 py-2 text-sm text-gh-accent"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <SearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

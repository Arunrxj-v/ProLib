"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { signOutOfProLib } from "@/lib/clientAuth";

/**
 * Avatar-triggered account menu for the signed-in header.
 *
 * Works identically for Google and email/password users — both hold the
 * same httpOnly `prolib_session` cookie, and "Sign out" calls the existing
 * `POST /api/auth/logout`, which deletes the session ROW server-side (the
 * cookie alone is never trusted) before this menu navigates to the public
 * Explore page. Google itself is never touched: this signs the student out
 * of ProLib only.
 */
export function AccountMenu({
  name,
  username,
  email,
  avatarUrl,
  dashboardHref,
}: {
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  dashboardHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape — the menu never traps the page.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    setError(null);
    const done = await signOutOfProLib(router);
    if (!done) setError("Sign out failed — try again.");
    setSigningOut(false);
  }

  return (
    <div ref={containerRef} className="relative ml-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Signed in as ${name}. Open account menu.`}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex items-center"
      >
        <Avatar name={name} src={avatarUrl} size="md" />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-gh-success ring-2 ring-gh-canvas" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-md border border-gh-border bg-gh-card"
        >
          <div className="border-b border-gh-border px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-gh-fg-default">
              {name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-gh-fg-muted">
              {username ? `@${username}` : email}
            </p>
          </div>

          <div className="p-1">
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-fg-default"
            >
              <Icon name="person" size={15} />
              My Profile
            </Link>
            <Link
              href={dashboardHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded px-2.5 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-fg-default"
            >
              <Icon name="folder" size={15} />
              {dashboardHref === "/admin" ? "Admin" : "My projects"}
            </Link>
          </div>

          <div className="border-t border-gh-border p-1">
            {error && (
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-relaxed text-gh-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs font-medium text-gh-fg-muted transition-colors hover:bg-gh-btn-hover hover:text-gh-danger disabled:opacity-50"
            >
              <Icon name={signingOut ? "progress_activity" : "logout"} size={15} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

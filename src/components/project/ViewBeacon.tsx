"use client";

import { useEffect, useRef } from "react";

/**
 * Fires exactly one view event per mounted project page.
 *
 * `sendBeacon` keeps the count honest without competing with navigation.
 * The `lastSlug` ref makes the effect idempotent: a React re-render (or the
 * StrictMode double-invoke in development) never sends a second beacon for
 * the same page — the endpoint's per-project cookie window is the second
 * line of defence, not the first.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  const lastSlug = useRef<string | null>(null);

  useEffect(() => {
    if (lastSlug.current === slug) return;
    lastSlug.current = slug;

    const url = `/api/projects/${encodeURIComponent(slug)}/view`;
    try {
      if (navigator.sendBeacon) {
        const payload = new Blob([JSON.stringify({})], {
          type: "application/json",
        });
        navigator.sendBeacon(url, payload);
      } else {
        void fetch(url, { method: "POST", keepalive: true });
      }
    } catch {
      // A blocked beacon must never break the page.
    }
  }, [slug]);

  return null;
}

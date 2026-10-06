"use client";

import { useEffect } from "react";

/**
 * Fires exactly one view event per mounted project page.
 *
 * `sendBeacon` keeps the count honest without competing with navigation, and
 * the endpoint ignores repeat hits for the same session within a window.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
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

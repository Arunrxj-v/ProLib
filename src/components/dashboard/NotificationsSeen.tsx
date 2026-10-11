"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Opening the Activity panel marks notifications as read. The watermark is
 * written through the API (which revalidates the shared layout server-side),
 * then the current route refreshes so the header bell clears immediately —
 * even though the layout for this very navigation may already have rendered
 * with the pre-open count. Silent and idempotent: a failed mark-read never
 * breaks the page.
 */
export function NotificationsSeen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/unread-count", { method: "POST" })
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

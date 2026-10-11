import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

/**
 * Notification read-state — the header bell's single source of truth.
 *
 * A "notification" is exactly one of the real review-activity rows shown on
 * `/dashboard/notifications` (a project with a submission or moderation
 * trail). Nothing here invents rows: unread-ness is derived by comparing the
 * event's timestamp (reviewed, else submitted, else created) against the
 * per-user `notifications_seen_at` watermark written when the student opens
 * the panel. Activity that has been seen therefore never lights the dot, and
 * a brand-new account (no events) is always dark.
 */

/** Activity predicate — identical to `getReviewActivity`, never wider. */
const IS_ACTIVITY = sql`(
  ${projects.reviewedAt} IS NOT NULL
  OR ${projects.submittedAt} IS NOT NULL
  OR ${projects.publicationStatus} = 'rejected'
)`;

/** The moment the event became visible to the student, per project. */
const EVENT_AT = sql`COALESCE(${projects.reviewedAt}, ${projects.submittedAt}, ${projects.createdAt})`;

/** Unseen watermark — never-seen users count every activity row as unread. */
const SEEN_AT = sql`COALESCE(
  (SELECT notifications_seen_at FROM users WHERE id = ${projects.ownerId}),
  to_timestamp(0)
)`;

/** How many review events the student has not opened the panel for yet. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        IS_ACTIVITY,
        sql`${EVENT_AT} > ${SEEN_AT}`,
      ),
    );
  return rows[0]?.value ?? 0;
}

/**
 * Opening the panel marks every current event as read. Idempotent, per-user
 * and best-effort: a failed watermark write must never break the page.
 */
export async function markNotificationsSeen(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(users)
    .set({ notificationsSeenAt: now, updatedAt: now })
    .where(eq(users.id, userId));
}

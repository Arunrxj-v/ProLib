import { revalidatePath } from "next/cache";

import { handleApiError, requireApiUser } from "@/lib/api";
import {
  countUnreadNotifications,
  markNotificationsSeen,
} from "@/lib/data/notifications";

export const dynamic = "force-dynamic";

/**
 * `GET /api/notifications/unread-count` — the header bell's live value.
 *
 * Reads the real review-activity rows against the session user's read
 * watermark; never cached, never shared between accounts.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const count = await countUnreadNotifications(user.id);
    return Response.json(
      { count },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * `POST /api/notifications/unread-count` — mark the panel as read.
 *
 * The Activity page calls this when the student opens it, so the indicator
 * clears immediately (the shared layout may already have rendered with the
 * pre-open count; `revalidatePath` refreshes it server-side too).
 */
export async function POST() {
  try {
    const user = await requireApiUser();
    await markNotificationsSeen(user.id);
    revalidatePath("/", "layout");
    return Response.json(
      { count: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

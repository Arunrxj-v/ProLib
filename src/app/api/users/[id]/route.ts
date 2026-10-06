import { and, eq } from "drizzle-orm";

import { apiError, handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { socialLinks, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * `GET /api/users/:id` — a public student profile.
 *
 * Only public columns are selected (never email, never status internals);
 * suspended accounts behave as if they do not exist. An empty database
 * answers 404 — never demo content.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        bio: users.bio,
        batch: users.batch,
        skills: users.skills,
        githubUsername: users.githubUsername,
        portfolioUrl: users.portfolioUrl,
        location: users.location,
        featured: users.featured,
        departmentId: users.departmentId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, id), eq(users.status, "active")))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return apiError(404, "Not Found", "No such student.");
    }

    const socials = await db
      .select({ provider: socialLinks.provider, url: socialLinks.url })
      .from(socialLinks)
      .where(eq(socialLinks.userId, user.id));

    return Response.json({ user, socials });
  } catch (error) {
    return handleApiError(error);
  }
}

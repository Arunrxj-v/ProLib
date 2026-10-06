import { and, eq, sql } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth/session";
import { getPublicStatuses } from "@/lib/data/projects";
import { db } from "@/lib/db";
import { projectLikes, projects } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Toggles the signed-in student's like.
 *
 * `projects.like_count` is the denormalised campus-wide total, so it moves by
 * exactly one per toggle while the `project_likes` row records *who* liked it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized", message: "Sign in required." },
      { status: 401 },
    );
  }

  const [project] = await db
    .select({
      id: projects.id,
      ownerId: projects.ownerId,
      publicationStatus: projects.publicationStatus,
      likeCount: projects.likeCount,
    })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) {
    return Response.json(
      { error: "Not Found", message: "Project not found." },
      { status: 404 },
    );
  }

  const statuses = await getPublicStatuses();
  const canAct =
    statuses.includes(project.publicationStatus) ||
    user.role === "admin" ||
    user.id === project.ownerId;

  if (!canAct) {
    return Response.json(
      { error: "Not Found", message: "Project not found." },
      { status: 404 },
    );
  }

  const condition = and(
    eq(projectLikes.projectId, project.id),
    eq(projectLikes.userId, user.id),
  );

  const existing = await db
    .select({ projectId: projectLikes.projectId })
    .from(projectLikes)
    .where(condition)
    .limit(1);

  if (existing.length > 0) {
    await db.delete(projectLikes).where(condition);
    await db
      .update(projects)
      .set({
        likeCount: sql`MAX(${projects.likeCount} - 1, 0)`,
      })
      .where(eq(projects.id, project.id));

    const [updated] = await db
      .select({ likeCount: projects.likeCount })
      .from(projects)
      .where(eq(projects.id, project.id));

    return Response.json({ liked: false, likeCount: updated?.likeCount ?? 0 });
  }

  await db.insert(projectLikes).values({
    projectId: project.id,
    userId: user.id,
  });
  await db
    .update(projects)
    .set({ likeCount: sql`${projects.likeCount} + 1` })
    .where(eq(projects.id, project.id));

  const [updated] = await db
    .select({ likeCount: projects.likeCount })
    .from(projects)
    .where(eq(projects.id, project.id));

  return Response.json({ liked: true, likeCount: updated?.likeCount ?? 0 });
}

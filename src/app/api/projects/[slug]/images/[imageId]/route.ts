import { and, eq } from "drizzle-orm";

import {
  apiError,
  handleApiError,
  requireApiUser,
  requireEditableProject,
  serviceError,
} from "@/lib/api";
import { db } from "@/lib/db";
import { projectImages } from "@/lib/db/schema";
import { removeGalleryImageFor } from "@/lib/projectService";

export const dynamic = "force-dynamic";

/**
 * `DELETE /api/projects/:id/images/:imageId` — remove one screenshot.
 * 404 when the image does not belong to this project; the file on disk is
 * removed together with the row. Owner/admin only.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; imageId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { slug, imageId } = await params;
    const project = await requireEditableProject(slug, user);

    const rows = await db
      .select({ id: projectImages.id })
      .from(projectImages)
      .where(
        and(eq(projectImages.id, imageId), eq(projectImages.projectId, project.id)),
      )
      .limit(1);
    if (!rows[0]) {
      return apiError(404, "Not Found", "That image no longer exists.");
    }

    const result = await removeGalleryImageFor(user, imageId, project.id);
    if (!result.ok) return serviceError(result);

    return Response.json({ removed: true, info: result.info });
  } catch (error) {
    return handleApiError(error);
  }
}

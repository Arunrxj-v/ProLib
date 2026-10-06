import { handleApiError, requireApiUser, requireEditableProject, serviceError } from "@/lib/api";
import { removeMemberFor } from "@/lib/projectService";

export const dynamic = "force-dynamic";

/**
 * `DELETE /api/projects/:id/members/:userId` — remove a teammate.
 * Owner/admin only; the project owner row can never be removed.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { slug, userId } = await params;
    const project = await requireEditableProject(slug, user);

    const result = await removeMemberFor(user, project, userId);
    if (!result.ok) return serviceError(result);

    return Response.json({ removed: true, info: result.info });
  } catch (error) {
    return handleApiError(error);
  }
}

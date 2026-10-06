import { handleApiError, requireApiUser, requireEditableProject, serviceError } from "@/lib/api";
import { addMemberFor } from "@/lib/projectService";

export const dynamic = "force-dynamic";

/**
 * `POST /api/projects/:id/members` — add a real ProLib user to the team.
 *
 * Body: `{ "username": "rahul" }` or `{ "user_id": "…" }`, optional
 * `"role"`. Only the owner or an admin may add members; the target must
 * be an existing active account — teammates are never free text.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireApiUser();
    const { slug } = await params;
    const project = await requireEditableProject(slug, user);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return serviceError({ error: "Expected a JSON object body." });
    }

    const record = body as Record<string, unknown>;
    const username =
      typeof record.username === "string" ? record.username : undefined;
    const userId =
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.userId === "string"
          ? record.userId
          : undefined;
    const role = typeof record.role === "string" ? record.role : undefined;

    if (!username && !userId) {
      return serviceError({ fieldErrors: { username: "Choose a student to add." } });
    }

    const result = await addMemberFor(user, project, { username, userId, role });
    if (!result.ok) return serviceError(result);

    return Response.json({ info: result.info }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

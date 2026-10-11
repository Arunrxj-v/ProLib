import { handleApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { disconnectGithubAccount } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * `POST /api/github/disconnect` — severs the signed-in student's GitHub
 * link and deletes the stored OAuth token.
 *
 * Scoping and safety:
 *   - always acts on the SESSION user's own row — no user id is accepted
 *     from the request, so one student can never disconnect another
 *   - CSRF: the session cookie is SameSite=Lax/httpOnly (same protection
 *     as every other state-changing route here), so a cross-site POST
 *     arrives without credentials and answers 401
 *   - idempotent: no connection is still a 200 `{ connected: false }`
 *   - the ProLib session is deliberately untouched; only the GitHub
 *     credentials row is removed, so repository listing (`/api/github/*`)
 *     immediately reports `connected: false` while projects and stored
 *     repository URLs stay exactly as they were
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { error: "Unauthorized", message: "Sign in required." },
        { status: 401 },
      );
    }

    await disconnectGithubAccount(user.id);
    return Response.json({ connected: false });
  } catch (error) {
    return handleApiError(error);
  }
}

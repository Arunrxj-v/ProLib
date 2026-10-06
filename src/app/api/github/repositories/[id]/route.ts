import { eq } from "drizzle-orm";

import { apiError, handleApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { githubRepositories } from "@/lib/db/schema";
import { fetchPublicRepoMeta } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * `GET /api/github/repositories/:id` — one stored repository association
 * (§23: owner, name, url, description cached locally).
 *
 * `?refresh=1` re-reads live metadata from GitHub — but only for the
 * student who linked the repository (or an admin). GitHub stays the
 * source of truth; `fetchedAt: null` honestly means "never fetched".
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const rows = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.id, id))
      .limit(1);

    const repository = rows[0];
    if (!repository) {
      return apiError(404, "Not Found", "No stored repository matches that id.");
    }

    const wantsRefresh =
      new URL(request.url).searchParams.get("refresh") === "1";

    if (wantsRefresh) {
      const user = await getCurrentUser();
      const allowed =
        user &&
        (user.role === "admin" ||
          (repository.linkedByUserId !== null &&
            repository.linkedByUserId === user.id));

      if (allowed) {
        const meta = await fetchPublicRepoMeta(repository.owner, repository.name);
        if (meta.available) {
          await db
            .update(githubRepositories)
            .set({
              htmlUrl: meta.htmlUrl,
              description: meta.description,
              stargazersCount: meta.stargazersCount,
              forksCount: meta.forksCount,
              language: meta.language,
              fetchedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(githubRepositories.id, repository.id));

          const fresh = await db
            .select()
            .from(githubRepositories)
            .where(eq(githubRepositories.id, id))
            .limit(1);
          return Response.json({ repository: fresh[0] ?? repository, refreshed: true });
        }
        // Unreachable — return the cache unchanged, with the reason.
        return Response.json({
          repository,
          refreshed: false,
          reason: meta.reason,
        });
      }
    }

    return Response.json({ repository });
  } catch (error) {
    return handleApiError(error);
  }
}
